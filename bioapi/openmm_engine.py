"""
OpenMM-based Molecular Dynamics Engine for ProtChain BioAPI

Provides genuine MD simulation with:
- AMBER ff14SB protein force field
- GAFF2 + AM1-BCC small molecule force field
- GBn2 (GBSA-OBC2) implicit solvent
- Langevin thermostat for proper NVT ensemble

This module is imported conditionally by molecular_dynamics.py when OpenMM
is installed.  When not available, the analytical minimisation fallback is
used instead.
"""

import io
import logging
import math
import time
from typing import Dict, Any, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenMM imports (will raise ImportError if not installed — caught by caller)
# ---------------------------------------------------------------------------
import openmm
import openmm.app as app
import openmm.unit as unit
from pdbfixer import PDBFixer

# Optional: openmmforcefields for small molecule parameterisation
GAFF_AVAILABLE = False
try:
    from openmmforcefields.generators import (
        GAFFTemplateGenerator,
    )
    GAFF_AVAILABLE = True
except ImportError:
    logger.warning(
        "openmmforcefields not installed — GAFF2 ligand parameterisation "
        "unavailable; will fall back to analytical engine for ligand energy"
    )

# RDKit for ligand handling (lazy import to match existing pattern)
def _import_rdkit():
    from rdkit import Chem
    from rdkit.Chem import AllChem
    return Chem, AllChem


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
KJ_TO_KCAL = 1.0 / 4.184
NM_TO_ANGSTROM = 10.0
ANGSTROM_TO_NM = 0.1
DEFAULT_TIMESTEP_FS = 2.0          # femtoseconds
DEFAULT_FRICTION = 1.0             # 1/ps
DEFAULT_RESTRAINT_K = 100.0        # kJ/mol/nm^2 for CA restraints
SNAPSHOT_INTERVAL_PS = 2.0         # record snapshot every 2 ps


class OpenMMSimulator:
    """
    Manages OpenMM simulations for protein-ligand complexes.

    Simulation protocol per compound:
    1. System preparation (PDB cleanup, ligand parameterisation, combine)
    2. Energy minimisation (L-BFGS, tolerance 10 kJ/mol)
    3. NVT equilibration with protein CA restraints
    4. Production NVT MD (unrestrained)
    5. Post-simulation analysis (RMSD, Rg, interaction energies)
    """

    def __init__(self):
        self._platform = None
        self._platform_properties = {}

    # ------------------------------------------------------------------
    # Platform detection
    # ------------------------------------------------------------------
    def _get_platform(self) -> openmm.Platform:
        """Auto-detect the best available compute platform."""
        if self._platform is not None:
            return self._platform

        for name in ("CUDA", "OpenCL", "CPU"):
            try:
                plat = openmm.Platform.getPlatformByName(name)
                self._platform = plat
                if name == "CPU":
                    import os
                    threads = os.environ.get("OPENMM_CPU_THREADS", "4")
                    self._platform_properties = {"Threads": threads}
                elif name == "CUDA":
                    self._platform_properties = {"Precision": "mixed"}
                logger.info(f"OpenMM platform: {name}")
                return plat
            except Exception:
                continue

        # Absolute fallback — Reference platform (slow but always exists)
        self._platform = openmm.Platform.getPlatformByName("Reference")
        logger.warning("OpenMM: using Reference platform (slow)")
        return self._platform

    # ------------------------------------------------------------------
    # PDB preparation
    # ------------------------------------------------------------------
    def prepare_protein(
        self, pdb_content: str
    ) -> Tuple[app.Topology, List[openmm.Vec3]]:
        """
        Clean a PDB string and return an OpenMM Topology + positions.

        Uses PDBFixer to:
        - Find and add missing residues / atoms
        - Add hydrogens at pH 7.0
        - Remove heterogens (water, ligands) so we start clean
        """
        fixer = PDBFixer(pdbfile=io.StringIO(pdb_content))
        fixer.findMissingResidues()
        fixer.findMissingAtoms()
        fixer.addMissingAtoms()
        fixer.removeHeterogens(keepWater=False)
        fixer.addMissingHydrogens(pH=7.0)

        return fixer.topology, fixer.positions

    # ------------------------------------------------------------------
    # Ligand parameterisation
    # ------------------------------------------------------------------
    def parameterize_ligand(
        self, smiles: str, mol_name: str = "LIG"
    ) -> Tuple[Any, np.ndarray]:
        """
        SMILES → RDKit 3D conformer → RDKit Mol object + coordinates.

        Returns:
            (rdkit_mol, coords_angstrom) where coords is shape (n_atoms, 3)
        """
        Chem, AllChem = _import_rdkit()

        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise ValueError(f"Invalid SMILES: {smiles}")

        mol = Chem.AddHs(mol)
        if AllChem.EmbedMolecule(mol, AllChem.ETKDGv3()) < 0:
            AllChem.EmbedMolecule(mol, AllChem.ETKDG())
        AllChem.MMFFOptimizeMolecule(mol, maxIters=200)

        conf = mol.GetConformer()
        n_atoms = mol.GetNumAtoms()
        coords = np.array([
            [conf.GetAtomPosition(i).x,
             conf.GetAtomPosition(i).y,
             conf.GetAtomPosition(i).z]
            for i in range(n_atoms)
        ])

        return mol, coords

    # ------------------------------------------------------------------
    # System building
    # ------------------------------------------------------------------
    def build_system(
        self,
        protein_topology: app.Topology,
        protein_positions: List[openmm.Vec3],
        ligand_mol,
        ligand_coords_angstrom: np.ndarray,
        pocket_center: Dict[str, float],
        temperature_kelvin: float = 300.0,
    ) -> Dict[str, Any]:
        """
        Build an OpenMM System combining protein + ligand.

        Uses AMBER ff14SB + GBn2 implicit solvent for protein.
        Uses GAFF2 (via openmmforcefields) for ligand.

        Returns dict with keys:
            system, topology, positions, integrator, simulation,
            protein_atom_count, ligand_atom_indices, ca_indices
        """
        # Centre ligand on binding site
        centroid = ligand_coords_angstrom.mean(axis=0)
        center_arr = np.array([
            pocket_center.get("x", 0),
            pocket_center.get("y", 0),
            pocket_center.get("z", 0),
        ])
        ligand_coords_angstrom = ligand_coords_angstrom + (center_arr - centroid)

        # Build force field with GBn2 implicit solvent
        ff = app.ForceField("amber14/protein.ff14SB.xml", "implicit/gbn2.xml")

        # Register GAFF2 template for the ligand
        if GAFF_AVAILABLE:
            gaff = GAFFTemplateGenerator(
                molecules=ligand_mol,
                forcefield="gaff-2.11",
            )
            ff.registerTemplateGenerator(gaff.generator)

        # Combine protein + ligand into one Modeller
        modeller = app.Modeller(protein_topology, protein_positions)
        protein_atom_count = modeller.topology.getNumAtoms()

        # Add ligand to the modeller
        # Convert ligand RDKit mol → OpenMM topology + positions
        lig_top, lig_pos = self._rdkit_mol_to_openmm(
            ligand_mol, ligand_coords_angstrom
        )
        modeller.add(lig_top, lig_pos)

        # Create the System
        system = ff.createSystem(
            modeller.topology,
            nonbondedMethod=app.NoCutoff,   # required for implicit solvent
            constraints=app.HBonds,          # constrain H-bonds for 2fs timestep
            hydrogenMass=1.5 * unit.amu,     # hydrogen mass repartitioning
        )

        # Identify atom indices
        total_atoms = modeller.topology.getNumAtoms()
        ligand_atom_indices = list(range(protein_atom_count, total_atoms))

        # Identify protein CA atoms for restraints
        ca_indices = []
        for atom in modeller.topology.atoms():
            if atom.index < protein_atom_count and atom.name == "CA":
                ca_indices.append(atom.index)

        # Create integrator
        integrator = openmm.LangevinMiddleIntegrator(
            temperature_kelvin * unit.kelvin,
            DEFAULT_FRICTION / unit.picosecond,
            DEFAULT_TIMESTEP_FS * unit.femtosecond,
        )

        # Create simulation
        platform = self._get_platform()
        simulation = app.Simulation(
            modeller.topology,
            system,
            integrator,
            platform,
            self._platform_properties,
        )
        simulation.context.setPositions(modeller.positions)

        return {
            "system": system,
            "topology": modeller.topology,
            "positions": modeller.positions,
            "integrator": integrator,
            "simulation": simulation,
            "protein_atom_count": protein_atom_count,
            "ligand_atom_indices": ligand_atom_indices,
            "ca_indices": ca_indices,
        }

    # ------------------------------------------------------------------
    # Simulation execution
    # ------------------------------------------------------------------
    def run_simulation(
        self,
        sim_data: Dict[str, Any],
        equil_steps: int = 25000,
        prod_steps: int = 100000,
        snapshot_interval: int = 5000,
    ) -> Dict[str, Any]:
        """
        Execute the full MD protocol:
        1. Energy minimisation
        2. NVT equilibration with CA restraints
        3. Production MD

        Returns dict with:
            minimized_energy, final_energy, snapshots, energies, rmsds,
            final_positions, minimized_positions, ligand_atom_indices
        """
        simulation = sim_data["simulation"]
        system = sim_data["system"]
        ca_indices = sim_data["ca_indices"]
        lig_indices = sim_data["ligand_atom_indices"]

        # --- Step 1: Energy Minimisation ---
        logger.info("  OpenMM: energy minimisation...")
        simulation.minimizeEnergy(
            maxIterations=1000,
            tolerance=10.0 * unit.kilojoule_per_mole,
        )

        state = simulation.context.getState(getEnergy=True, getPositions=True)
        minimized_energy_kj = state.getPotentialEnergy().value_in_unit(
            unit.kilojoule_per_mole
        )
        minimized_energy = minimized_energy_kj * KJ_TO_KCAL
        minimized_positions = state.getPositions(asNumpy=True).value_in_unit(
            unit.nanometer
        )

        # Reference positions for RMSD (ligand atoms only)
        ref_lig_pos = minimized_positions[lig_indices]

        # --- Step 2: NVT Equilibration with CA restraints ---
        logger.info(f"  OpenMM: NVT equilibration ({equil_steps} steps)...")
        restraint_force = openmm.CustomExternalForce(
            "k*((x-x0)^2+(y-y0)^2+(z-z0)^2)"
        )
        restraint_force.addGlobalParameter("k", DEFAULT_RESTRAINT_K)
        restraint_force.addPerParticleParameter("x0")
        restraint_force.addPerParticleParameter("y0")
        restraint_force.addPerParticleParameter("z0")

        for idx in ca_indices:
            pos = minimized_positions[idx]
            restraint_force.addParticle(
                idx, [pos[0], pos[1], pos[2]]
            )

        restraint_idx = system.addForce(restraint_force)
        simulation.context.reinitialize(preserveState=True)

        simulation.step(equil_steps)

        # Remove restraints
        system.removeForce(restraint_idx)
        simulation.context.reinitialize(preserveState=True)

        # --- Step 3: Production MD ---
        logger.info(f"  OpenMM: production MD ({prod_steps} steps)...")
        snapshots = []
        energies = []
        rmsds = []
        timestep_ps = DEFAULT_TIMESTEP_FS / 1000.0  # fs → ps

        for step_offset in range(0, prod_steps, snapshot_interval):
            steps_to_run = min(snapshot_interval, prod_steps - step_offset)
            simulation.step(steps_to_run)

            state = simulation.context.getState(
                getEnergy=True, getPositions=True
            )
            e_kj = state.getPotentialEnergy().value_in_unit(
                unit.kilojoule_per_mole
            )
            e_kcal = e_kj * KJ_TO_KCAL
            pos = state.getPositions(asNumpy=True).value_in_unit(
                unit.nanometer
            )

            current_lig_pos = pos[lig_indices]
            rmsd = self._compute_rmsd(current_lig_pos, ref_lig_pos)

            total_step = equil_steps + step_offset + steps_to_run
            current_time_ps = total_step * timestep_ps

            energies.append(e_kcal)
            rmsds.append(rmsd)
            snapshots.append({
                "step": total_step,
                "time_ps": round(current_time_ps, 3),
                "energy_kcal": round(e_kcal, 3),
                "rmsd_angstrom": round(rmsd, 4),
            })

        # Final state
        final_state = simulation.context.getState(
            getEnergy=True, getPositions=True
        )
        final_energy = (
            final_state.getPotentialEnergy().value_in_unit(
                unit.kilojoule_per_mole
            )
            * KJ_TO_KCAL
        )
        final_positions = final_state.getPositions(asNumpy=True).value_in_unit(
            unit.nanometer
        )

        return {
            "minimized_energy": minimized_energy,
            "final_energy": final_energy,
            "snapshots": snapshots,
            "energies": energies,
            "rmsds": rmsds,
            "final_positions": final_positions,
            "minimized_positions": minimized_positions,
            "ligand_atom_indices": lig_indices,
        }

    # ------------------------------------------------------------------
    # Helper: RMSD computation
    # ------------------------------------------------------------------
    @staticmethod
    def _compute_rmsd(
        coords: np.ndarray, reference: np.ndarray
    ) -> float:
        """RMSD between two coordinate arrays (in nm), returned in Angstroms."""
        diff = coords - reference
        rmsd_nm = np.sqrt(np.mean(np.sum(diff ** 2, axis=1)))
        return float(rmsd_nm * NM_TO_ANGSTROM)

    # ------------------------------------------------------------------
    # Helper: extract ligand coordinates from OpenMM positions (→ Å)
    # ------------------------------------------------------------------
    @staticmethod
    def extract_ligand_coords_angstrom(
        positions_nm: np.ndarray, lig_indices: List[int]
    ) -> np.ndarray:
        """Extract ligand atom coordinates and convert nm → Å."""
        return positions_nm[lig_indices] * NM_TO_ANGSTROM

    # ------------------------------------------------------------------
    # Helper: RDKit mol → OpenMM topology + positions
    # ------------------------------------------------------------------
    @staticmethod
    def _rdkit_mol_to_openmm(
        mol, coords_angstrom: np.ndarray
    ) -> Tuple[app.Topology, List[openmm.Vec3]]:
        """
        Convert an RDKit molecule + coordinates into OpenMM topology and
        positions suitable for Modeller.add().
        """
        from rdkit import Chem

        topology = app.Topology()
        chain = topology.addChain(id="L")
        residue = topology.addResidue("LIG", chain)

        atoms = []
        for i in range(mol.GetNumAtoms()):
            atom = mol.GetAtomWithIdx(i)
            element = app.Element.getByAtomicNumber(atom.GetAtomicNum())
            omm_atom = topology.addAtom(
                atom.GetSymbol(), element, residue
            )
            atoms.append(omm_atom)

        # Add bonds
        for bond in mol.GetBonds():
            topology.addBond(
                atoms[bond.GetBeginAtomIdx()],
                atoms[bond.GetEndAtomIdx()],
            )

        # Convert Å → nm for OpenMM
        positions = [
            openmm.Vec3(
                float(coords_angstrom[i, 0]) * ANGSTROM_TO_NM,
                float(coords_angstrom[i, 1]) * ANGSTROM_TO_NM,
                float(coords_angstrom[i, 2]) * ANGSTROM_TO_NM,
            )
            * unit.nanometer
            for i in range(len(coords_angstrom))
        ]

        return topology, positions

    # ------------------------------------------------------------------
    # Helper: radius of gyration (Å)
    # ------------------------------------------------------------------
    @staticmethod
    def compute_radius_of_gyration(coords_angstrom: np.ndarray) -> float:
        """Radius of gyration from coordinates in Angstroms."""
        centroid = coords_angstrom.mean(axis=0)
        return float(
            np.sqrt(np.mean(np.sum((coords_angstrom - centroid) ** 2, axis=1)))
        )

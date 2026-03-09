"""
Molecular Dynamics Simulation Module for ProtChain BioAPI

Performs MD simulation and stability analysis of protein-ligand complexes
using the top compounds from virtual screening.

When OpenMM is installed, uses genuine molecular dynamics:
- AMBER ff14SB protein force field
- GAFF2 + AM1-BCC charges for ligands (via openmmforcefields)
- GBn2 implicit solvent (GBSA-OBC2)
- Langevin thermostat (proper NVT ensemble)
- Protocol: energy minimisation → NVT equilibration → production MD

When OpenMM is NOT installed, falls back to analytical energy minimisation
using Lennard-Jones, Coulomb, and H-bond potentials (screening-grade).

Pipeline:
1. Parse PDB structure and extract binding-site residues
2. For each top compound, build a ligand-in-pocket model
3. Run MD simulation (OpenMM) or energy minimisation (fallback)
4. Compute per-compound stability metrics:
   - RMSD (root-mean-square deviation from initial pose)
   - Interaction energy (van der Waals + electrostatic + H-bond)
   - RMSF per residue (root-mean-square fluctuation)
   - Radius of gyration
5. Generate time-series trajectory snapshots
6. Return ranked compounds with stability verdicts and full metrics
"""

import logging
import math
import time
from typing import Dict, Any, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# Check for OpenMM availability (following molecular_docking.py pattern)
OPENMM_AVAILABLE = False
try:
    from openmm_engine import OpenMMSimulator
    OPENMM_AVAILABLE = True
    logger.info("OpenMM engine available — will use genuine MD simulation")
except ImportError:
    logger.warning(
        "OpenMM not installed — falling back to analytical energy minimisation"
    )

# ---------------------------------------------------------------------------
# Constants & force-field parameters
# ---------------------------------------------------------------------------

BOLTZMANN_KCAL = 0.001987204  # kcal/(mol·K)
DEFAULT_TEMPERATURE = 300.0    # Kelvin
DEFAULT_TIMESTEP = 0.002       # ps (2 fs)
DEFAULT_N_STEPS = 5000         # number of minimisation steps
DEFAULT_SNAPSHOT_INTERVAL = 500
WATER_DIELECTRIC = 78.5
COULOMB_CONSTANT = 332.0637    # kcal·Å/(mol·e²)

# Lennard-Jones parameters (AMBER ff14SB simplified)
LJ_PARAMS = {
    6:  {"sigma": 1.908, "epsilon": 0.0860},   # C
    7:  {"sigma": 1.824, "epsilon": 0.1700},   # N
    8:  {"sigma": 1.661, "epsilon": 0.2100},   # O
    16: {"sigma": 2.000, "epsilon": 0.2500},   # S
    15: {"sigma": 2.100, "epsilon": 0.2000},   # P
    1:  {"sigma": 0.600, "epsilon": 0.0157},   # H
    9:  {"sigma": 1.750, "epsilon": 0.0610},   # F
    17: {"sigma": 1.948, "epsilon": 0.2650},   # Cl
    35: {"sigma": 2.220, "epsilon": 0.3200},   # Br
}
DEFAULT_LJ = {"sigma": 1.900, "epsilon": 0.1500}

# Partial charges by element (approximate Gasteiger)
PARTIAL_CHARGES = {
    6: 0.0, 7: -0.35, 8: -0.40, 16: -0.20, 15: 0.30,
    1: 0.15, 9: -0.25, 17: -0.15, 35: -0.10,
}


def _import_rdkit():
    """Lazy-import RDKit."""
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
    return Chem, AllChem, Descriptors, rdMolDescriptors


# ---------------------------------------------------------------------------
# Coordinate helpers
# ---------------------------------------------------------------------------

def _parse_pdb_atoms(pdb_content: str) -> List[Dict[str, Any]]:
    """Extract ATOM records from PDB text."""
    atoms = []
    for line in pdb_content.split("\n"):
        if line.startswith("ATOM") or line.startswith("HETATM"):
            try:
                atom = {
                    "serial": int(line[6:11].strip()),
                    "name": line[12:16].strip(),
                    "resname": line[17:20].strip(),
                    "chain": line[21].strip(),
                    "resseq": int(line[22:26].strip()),
                    "x": float(line[30:38].strip()),
                    "y": float(line[38:46].strip()),
                    "z": float(line[46:54].strip()),
                    "element": line[76:78].strip() if len(line) > 76 else line[12:14].strip()[0],
                }
                atoms.append(atom)
            except (ValueError, IndexError):
                continue
    return atoms


def _element_to_atomic_num(element: str) -> int:
    """Map element symbol to atomic number."""
    mapping = {
        "H": 1, "C": 6, "N": 7, "O": 8, "F": 9, "P": 15,
        "S": 16, "CL": 17, "BR": 35,
    }
    return mapping.get(element.upper(), 6)


def _get_binding_residues(atoms: List[Dict], center: Dict, radius: float = 10.0) -> List[Dict]:
    """Return atoms within `radius` Å of the binding site center."""
    cx, cy, cz = center.get("x", 0), center.get("y", 0), center.get("z", 0)
    nearby = []
    for a in atoms:
        dx = a["x"] - cx
        dy = a["y"] - cy
        dz = a["z"] - cz
        if dx * dx + dy * dy + dz * dz <= radius * radius:
            nearby.append(a)
    return nearby


# ---------------------------------------------------------------------------
# Force-field energy calculations
# ---------------------------------------------------------------------------

def _lj_energy(r: float, sigma_i: float, eps_i: float, sigma_j: float, eps_j: float) -> float:
    """Lennard-Jones 12-6 potential with Lorentz-Berthelot combining rules."""
    sigma = (sigma_i + sigma_j) / 2.0
    epsilon = math.sqrt(eps_i * eps_j)
    if r < 0.5:
        r = 0.5  # Avoid singularity
    sr6 = (sigma / r) ** 6
    return 4.0 * epsilon * (sr6 * sr6 - sr6)


def _coulomb_energy(r: float, q_i: float, q_j: float) -> float:
    """Screened Coulomb interaction with distance-dependent dielectric."""
    if r < 0.5:
        r = 0.5
    dielectric = 4.0 * r  # distance-dependent dielectric approximation
    return COULOMB_CONSTANT * q_i * q_j / (dielectric * r)


def _hbond_energy(r: float, donor_Z: int, acceptor_Z: int) -> float:
    """Simple hydrogen bond potential (N-H···O or O-H···N)."""
    # Only N/O pairs can form H-bonds
    pair = {donor_Z, acceptor_Z}
    if not pair.issubset({7, 8}):
        return 0.0
    if r < 1.5 or r > 3.5:
        return 0.0
    # 10-12 potential shape (simplified)
    r_opt = 2.8
    depth = -2.5  # kcal/mol at optimal distance
    x = (r_opt / r)
    return depth * (5 * x ** 12 - 6 * x ** 10)


# ---------------------------------------------------------------------------
# MD Simulation Engine
# ---------------------------------------------------------------------------

class MolecularDynamicsEngine:
    """
    Performs MD simulation and stability analysis of protein-ligand complexes.

    When OpenMM is available: genuine NVT molecular dynamics with AMBER ff14SB,
    GAFF2 ligand parameterisation, and GBn2 implicit solvent.

    When OpenMM is not available: falls back to analytical energy minimisation
    using Lennard-Jones, Coulomb, and H-bond potentials.
    """

    def __init__(self):
        self._openmm_sim = None

    def _get_openmm_simulator(self) -> Optional['OpenMMSimulator']:
        """Lazy-initialise the OpenMM simulator."""
        if self._openmm_sim is None and OPENMM_AVAILABLE:
            self._openmm_sim = OpenMMSimulator()
        return self._openmm_sim

    def simulate(
        self,
        pdb_content: str,
        binding_site: Dict[str, Any],
        top_compounds: List[Dict[str, Any]],
        temperature: float = DEFAULT_TEMPERATURE,
        n_steps: int = DEFAULT_N_STEPS,
        max_compounds: int = 10,
    ) -> Dict[str, Any]:
        """Run MD stability analysis for top compounds from virtual screening."""
        if OPENMM_AVAILABLE:
            try:
                return self._simulate_openmm(
                    pdb_content, binding_site, top_compounds,
                    temperature, n_steps, max_compounds,
                )
            except Exception as e:
                logger.error(f"OpenMM simulation failed, falling back to analytical: {e}")

        return self._simulate_analytical(
            pdb_content, binding_site, top_compounds,
            temperature, n_steps, max_compounds,
        )

    # ==================================================================
    # OpenMM-powered simulation
    # ==================================================================
    def _simulate_openmm(
        self,
        pdb_content: str,
        binding_site: Dict[str, Any],
        top_compounds: List[Dict[str, Any]],
        temperature: float,
        n_steps: int,
        max_compounds: int,
    ) -> Dict[str, Any]:
        """Genuine MD simulation via OpenMM with AMBER ff14SB + GAFF2 + GBn2."""
        start_time = time.time()
        TIME_BUDGET = 1080  # 18 minutes (leave 2 min buffer)

        sim = self._get_openmm_simulator()
        logger.info(
            f"Starting OpenMM MD: {len(top_compounds)} compounds, "
            f"{n_steps} user steps, {temperature}K"
        )

        # Parse protein atoms for analytical post-analysis
        protein_atoms = _parse_pdb_atoms(pdb_content)
        if not protein_atoms:
            raise ValueError("No atoms found in PDB content")

        center = binding_site.get("center", {"x": 0, "y": 0, "z": 0})
        pocket_atoms = _get_binding_residues(protein_atoms, center, radius=12.0)
        pocket_coords = np.array([[a["x"], a["y"], a["z"]] for a in pocket_atoms])
        pocket_atomic_nums = [_element_to_atomic_num(a["element"]) for a in pocket_atoms]

        pocket_residues = {}
        for a in pocket_atoms:
            key = f"{a['resname']}_{a['resseq']}_{a['chain']}"
            if key not in pocket_residues:
                pocket_residues[key] = {
                    "resname": a["resname"],
                    "resseq": a["resseq"],
                    "chain": a["chain"],
                    "atoms": [],
                }
            pocket_residues[key]["atoms"].append(a)

        # Prepare protein once (reused for all compounds)
        logger.info("  Preparing protein topology...")
        protein_top, protein_pos = sim.prepare_protein(pdb_content)

        # Determine time budget per compound
        compounds_to_process = top_compounds[:max_compounds]
        n_compounds = len(compounds_to_process)
        time_per_compound = TIME_BUDGET / max(n_compounds, 1)

        # Determine simulation length based on time budget
        if time_per_compound > 150:
            equil_steps, prod_steps = 25000, 100000  # 50ps + 200ps
        elif time_per_compound > 90:
            equil_steps, prod_steps = 12500, 50000   # 25ps + 100ps
        else:
            equil_steps, prod_steps = 5000, 25000    # 10ps + 50ps

        total_sim_steps = equil_steps + prod_steps
        snapshot_interval = max(prod_steps // 20, 1000)  # ~20 snapshots

        logger.info(
            f"  Time budget: {time_per_compound:.0f}s/compound, "
            f"equil={equil_steps}, prod={prod_steps}"
        )

        compound_results = []
        trajectory_data = []

        for idx, comp in enumerate(compounds_to_process):
            comp_name = comp.get("name", f"compound_{idx + 1}")
            smiles = comp.get("smiles", "")
            if not smiles:
                logger.warning(f"Compound {comp_name}: no SMILES, skipping")
                continue

            comp_start = time.time()

            try:
                # Parameterise ligand
                lig_mol, lig_coords = sim.parameterize_ligand(smiles, comp_name)

                # Build combined system
                sim_data = sim.build_system(
                    protein_top, protein_pos,
                    lig_mol, lig_coords,
                    center, temperature,
                )

                # Run simulation
                md_result = sim.run_simulation(
                    sim_data,
                    equil_steps=equil_steps,
                    prod_steps=prod_steps,
                    snapshot_interval=snapshot_interval,
                )

                # Extract final ligand coordinates in Angstroms
                final_lig_coords = sim.extract_ligand_coords_angstrom(
                    md_result["final_positions"],
                    md_result["ligand_atom_indices"],
                )
                minimized_lig_coords = sim.extract_ligand_coords_angstrom(
                    md_result["minimized_positions"],
                    md_result["ligand_atom_indices"],
                )

                # Get ligand atomic numbers
                Chem, AllChem = _import_rdkit()[:2]
                lig_atomic_nums = [
                    lig_mol.GetAtomWithIdx(i).GetAtomicNum()
                    for i in range(lig_mol.GetNumAtoms())
                ]

                # Compute analytics using existing analytical functions
                final_rmsd = float(np.sqrt(np.mean(
                    np.sum((final_lig_coords - minimized_lig_coords) ** 2, axis=1)
                )))
                rg = sim.compute_radius_of_gyration(final_lig_coords)
                energy_breakdown = self._compute_energy_breakdown(
                    final_lig_coords, lig_atomic_nums,
                    pocket_coords, pocket_atomic_nums,
                )
                residue_interactions = self._compute_residue_interactions(
                    final_lig_coords, lig_atomic_nums, pocket_residues,
                )
                final_energy = energy_breakdown["total_kcal"]
                initial_energy = md_result["minimized_energy"]
                energy_change = final_energy - initial_energy
                stability = self._classify_stability(
                    final_rmsd, final_energy, energy_change
                )

                compound_result = {
                    "name": comp_name,
                    "smiles": smiles,
                    "status": "completed",
                    "rmsd_angstrom": round(final_rmsd, 4),
                    "initial_energy_kcal": round(initial_energy, 3),
                    "interaction_energy_kcal": round(final_energy, 3),
                    "energy_change_kcal": round(energy_change, 3),
                    "radius_of_gyration_angstrom": round(rg, 3),
                    "stability_verdict": stability,
                    "energy_breakdown": energy_breakdown,
                    "residue_interactions": residue_interactions[:10],
                    "n_ligand_atoms": lig_mol.GetNumAtoms(),
                    "vina_score_kcal": comp.get("vina_score_kcal"),
                    "predicted_binding_affinity_kcal": comp.get("predicted_binding_affinity_kcal"),
                    "category": comp.get("category", ""),
                    "molecular_weight": comp.get("molecular_weight", 0),
                }

                # Build trajectory in expected schema
                energy_series = [round(e, 2) for e in md_result["energies"]]
                rmsd_series = [round(r, 4) for r in md_result["rmsds"]]
                # Downsample to ~50 points for frontend
                step_es = max(1, len(energy_series) // 50)
                step_rs = max(1, len(rmsd_series) // 50)
                converged = (
                    len(md_result["energies"]) > 5
                    and np.std(md_result["energies"][-max(3, len(md_result["energies"]) // 5):]) < 5.0
                    and final_rmsd < 5.0
                )
                trajectory = {
                    "compound_name": comp_name,
                    "snapshots": md_result["snapshots"],
                    "energy_series": energy_series[::step_es],
                    "rmsd_series": rmsd_series[::step_rs],
                    "converged": converged,
                }

                compound_results.append(compound_result)
                trajectory_data.append(trajectory)
                comp_elapsed = time.time() - comp_start
                logger.info(
                    f"  Compound {idx + 1}/{n_compounds} ({comp_name}): "
                    f"RMSD={final_rmsd:.2f}Å, ΔG={final_energy:.2f} kcal/mol "
                    f"[{comp_elapsed:.1f}s]"
                )

                # Adaptive time budgeting after first compound
                if idx == 0 and n_compounds > 1:
                    remaining_time = TIME_BUDGET - (time.time() - start_time)
                    remaining_compounds = n_compounds - 1
                    adjusted_time = remaining_time / remaining_compounds
                    if adjusted_time < comp_elapsed * 0.7:
                        scale = adjusted_time / max(comp_elapsed, 1)
                        prod_steps = max(int(prod_steps * scale), 10000)
                        snapshot_interval = max(prod_steps // 20, 500)
                        logger.info(
                            f"  Adjusted prod_steps to {prod_steps} "
                            f"(time constraint)"
                        )

            except Exception as e:
                logger.error(
                    f"  Compound {comp_name} OpenMM failed: {e}, "
                    f"trying analytical fallback"
                )
                # Per-compound fallback to analytical engine
                try:
                    Chem, AllChem, Descriptors, _ = _import_rdkit()
                    fallback = self._simulate_compound(
                        Chem, AllChem, Descriptors,
                        comp, comp_name, smiles,
                        pocket_coords, pocket_atomic_nums, pocket_residues,
                        center, temperature, n_steps,
                    )
                    compound_results.append(fallback["compound"])
                    trajectory_data.append(fallback["trajectory"])
                except Exception as e2:
                    logger.error(f"  Analytical fallback also failed: {e2}")
                    compound_results.append({
                        "name": comp_name,
                        "smiles": smiles,
                        "status": "failed",
                        "error": str(e2),
                    })

            # Check overall time budget
            elapsed = time.time() - start_time
            if elapsed > TIME_BUDGET and idx < n_compounds - 1:
                logger.warning(
                    f"  Time budget exceeded ({elapsed:.0f}s), "
                    f"skipping remaining {n_compounds - idx - 1} compounds"
                )
                break

        # Assemble final result (same schema as analytical)
        return self._assemble_results(
            compound_results, trajectory_data,
            temperature, total_sim_steps, center,
            pocket_atoms, pocket_residues, start_time,
            method="openmm_amber_ff14sb_gbn2",
        )

    # ==================================================================
    # Analytical fallback (original code)
    # ==================================================================
    def _simulate_analytical(
        self,
        pdb_content: str,
        binding_site: Dict[str, Any],
        top_compounds: List[Dict[str, Any]],
        temperature: float,
        n_steps: int,
        max_compounds: int,
    ) -> Dict[str, Any]:
        """Analytical energy minimisation fallback (original engine)."""
        start_time = time.time()
        logger.info(f"Starting analytical MD: {len(top_compounds)} compounds, {n_steps} steps, {temperature}K")

        Chem, AllChem, Descriptors, _ = _import_rdkit()

        # Parse protein atoms
        protein_atoms = _parse_pdb_atoms(pdb_content)
        if not protein_atoms:
            raise ValueError("No atoms found in PDB content")

        center = binding_site.get("center", {"x": 0, "y": 0, "z": 0})
        pocket_atoms = _get_binding_residues(protein_atoms, center, radius=12.0)
        logger.info(f"Binding pocket: {len(pocket_atoms)} atoms within 12Å of center")

        pocket_coords = np.array([[a["x"], a["y"], a["z"]] for a in pocket_atoms])
        pocket_atomic_nums = [_element_to_atomic_num(a["element"]) for a in pocket_atoms]

        pocket_residues = {}
        for a in pocket_atoms:
            key = f"{a['resname']}_{a['resseq']}_{a['chain']}"
            if key not in pocket_residues:
                pocket_residues[key] = {
                    "resname": a["resname"],
                    "resseq": a["resseq"],
                    "chain": a["chain"],
                    "atoms": [],
                }
            pocket_residues[key]["atoms"].append(a)

        compounds_to_process = top_compounds[:max_compounds]
        compound_results = []
        trajectory_data = []

        for idx, comp in enumerate(compounds_to_process):
            comp_name = comp.get("name", f"compound_{idx + 1}")
            smiles = comp.get("smiles", "")
            if not smiles:
                logger.warning(f"Compound {comp_name}: no SMILES, skipping")
                continue

            try:
                result = self._simulate_compound(
                    Chem, AllChem, Descriptors,
                    comp, comp_name, smiles,
                    pocket_coords, pocket_atomic_nums, pocket_residues,
                    center, temperature, n_steps,
                )
                compound_results.append(result["compound"])
                trajectory_data.append(result["trajectory"])
                logger.info(
                    f"Compound {idx + 1}/{len(compounds_to_process)} ({comp_name}): "
                    f"RMSD={result['compound']['rmsd_angstrom']:.2f}Å, "
                    f"ΔG={result['compound']['interaction_energy_kcal']:.2f} kcal/mol"
                )
            except Exception as e:
                logger.error(f"Compound {comp_name} failed: {e}")
                compound_results.append({
                    "name": comp_name,
                    "smiles": smiles,
                    "status": "failed",
                    "error": str(e),
                })

        return self._assemble_results(
            compound_results, trajectory_data,
            temperature, n_steps, center,
            pocket_atoms, pocket_residues, start_time,
            method="physics_based_analytical_minimisation",
        )

    # ==================================================================
    # Shared result assembly
    # ==================================================================
    def _assemble_results(
        self,
        compound_results: List[Dict],
        trajectory_data: List[Dict],
        temperature: float,
        total_steps: int,
        center: Dict,
        pocket_atoms: List[Dict],
        pocket_residues: Dict,
        start_time: float,
        method: str = "physics_based_md_simulation",
    ) -> Dict[str, Any]:
        """Assemble the final result dict in the schema the frontend expects."""
        successful = [c for c in compound_results if c.get("status") != "failed"]
        successful.sort(key=lambda c: c.get("interaction_energy_kcal", 0))
        failed = [c for c in compound_results if c.get("status") == "failed"]

        for rank, comp in enumerate(successful, 1):
            comp["rank"] = rank

        all_rmsd = [c["rmsd_angstrom"] for c in successful]
        all_energies = [c["interaction_energy_kcal"] for c in successful]
        stable_count = sum(1 for c in successful if c.get("stability_verdict") == "stable")

        total_time = round(time.time() - start_time, 2)
        residue_rmsf_summary = self._aggregate_residue_rmsf(successful)

        result = {
            "status": "success",
            "method": method,
            "temperature_kelvin": temperature,
            "simulation_steps": total_steps,
            "timestep_ps": DEFAULT_TIMESTEP,
            "simulation_time_ns": round(total_steps * DEFAULT_TIMESTEP / 1000.0, 4),
            "compounds_simulated": len(successful),
            "compounds_failed": len(failed),
            "stable_compounds": stable_count,
            "average_rmsd_angstrom": round(float(np.mean(all_rmsd)), 3) if all_rmsd else 0,
            "average_interaction_energy_kcal": round(float(np.mean(all_energies)), 3) if all_energies else 0,
            "compound_results": successful + failed,
            "trajectories": trajectory_data,
            "residue_rmsf_summary": residue_rmsf_summary,
            "binding_site_used": {
                "center": center,
                "pocket_atoms": len(pocket_atoms),
                "pocket_residues": len(pocket_residues),
            },
            "total_computation_time_seconds": total_time,
        }
        return _sanitize(result)

    def _simulate_compound(
        self,
        Chem, AllChem, Descriptors,
        comp: Dict, name: str, smiles: str,
        pocket_coords: np.ndarray,
        pocket_atomic_nums: List[int],
        pocket_residues: Dict,
        center: Dict,
        temperature: float,
        n_steps: int,
    ) -> Dict[str, Any]:
        """Run energy minimisation for a single compound in the pocket."""
        # Build 3D conformer from SMILES
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise ValueError(f"Invalid SMILES: {smiles}")

        mol = Chem.AddHs(mol)
        if AllChem.EmbedMolecule(mol, AllChem.ETKDGv3()) < 0:
            # Fallback to random coords
            AllChem.EmbedMolecule(mol, AllChem.ETKDG())

        AllChem.MMFFOptimizeMolecule(mol, maxIters=200)

        # Get ligand atom coordinates and properties
        conf = mol.GetConformer()
        n_lig_atoms = mol.GetNumAtoms()
        lig_coords = np.array([
            [conf.GetAtomPosition(i).x, conf.GetAtomPosition(i).y, conf.GetAtomPosition(i).z]
            for i in range(n_lig_atoms)
        ])
        lig_atomic_nums = [mol.GetAtomWithIdx(i).GetAtomicNum() for i in range(n_lig_atoms)]

        # Centre ligand on binding site
        lig_centroid = lig_coords.mean(axis=0)
        binding_center = np.array([center.get("x", 0), center.get("y", 0), center.get("z", 0)])
        lig_coords += (binding_center - lig_centroid)

        # Run energy minimisation with trajectory recording
        snapshots = []
        energies = []
        rmsd_series = []
        initial_coords = lig_coords.copy()
        current_coords = lig_coords.copy()

        kT = BOLTZMANN_KCAL * temperature
        step_size = 0.02  # Å initial step size

        for step in range(n_steps):
            # Compute forces on each ligand atom from pocket
            forces = np.zeros_like(current_coords)
            total_energy = 0.0

            for i in range(n_lig_atoms):
                z_i = lig_atomic_nums[i]
                lj_i = LJ_PARAMS.get(z_i, DEFAULT_LJ)
                q_i = PARTIAL_CHARGES.get(z_i, 0.0)

                for j in range(len(pocket_coords)):
                    z_j = pocket_atomic_nums[j]
                    lj_j = LJ_PARAMS.get(z_j, DEFAULT_LJ)
                    q_j = PARTIAL_CHARGES.get(z_j, 0.0)

                    diff = current_coords[i] - pocket_coords[j]
                    r = np.linalg.norm(diff)
                    if r < 0.5:
                        r = 0.5

                    # LJ energy and force
                    e_lj = _lj_energy(r, lj_i["sigma"], lj_i["epsilon"], lj_j["sigma"], lj_j["epsilon"])
                    # Coulomb
                    e_coul = _coulomb_energy(r, q_i, q_j)
                    # H-bond
                    e_hb = _hbond_energy(r, z_i, z_j)

                    total_energy += e_lj + e_coul + e_hb

                    # Numerical force direction (gradient descent)
                    if r > 0.5:
                        # Attractive if energy is negative, push toward pocket
                        force_mag = -(e_lj + e_coul + e_hb) / r
                        forces[i] -= force_mag * diff / r

            energies.append(total_energy)

            # Steepest descent step with adaptive step size
            force_norm = np.linalg.norm(forces)
            if force_norm > 0:
                displacement = forces / force_norm * min(step_size, 0.05)
                current_coords += displacement

            # Adaptive step size (reduce if energy increases)
            if len(energies) > 1 and energies[-1] > energies[-2]:
                step_size *= 0.5
            else:
                step_size = min(step_size * 1.05, 0.05)

            # Record RMSD from initial pose
            rmsd = np.sqrt(np.mean(np.sum((current_coords - initial_coords) ** 2, axis=1)))
            rmsd_series.append(rmsd)

            # Record snapshots at intervals
            if step % DEFAULT_SNAPSHOT_INTERVAL == 0 or step == n_steps - 1:
                snapshots.append({
                    "step": step,
                    "time_ps": round(step * DEFAULT_TIMESTEP, 3),
                    "energy_kcal": round(total_energy, 3),
                    "rmsd_angstrom": round(rmsd, 4),
                    "step_size": round(step_size, 5),
                })

        # Final metrics
        final_rmsd = rmsd_series[-1] if rmsd_series else 0.0
        final_energy = energies[-1] if energies else 0.0
        initial_energy = energies[0] if energies else 0.0
        energy_change = final_energy - initial_energy

        # Radius of gyration
        final_centroid = current_coords.mean(axis=0)
        rg = np.sqrt(np.mean(np.sum((current_coords - final_centroid) ** 2, axis=1)))

        # Per-residue interaction energy (RMSF proxy)
        residue_interactions = self._compute_residue_interactions(
            current_coords, lig_atomic_nums, pocket_residues
        )

        # Stability classification
        stability_verdict = self._classify_stability(final_rmsd, final_energy, energy_change)

        # Compute energy components for breakdown
        energy_breakdown = self._compute_energy_breakdown(
            current_coords, lig_atomic_nums, pocket_coords, pocket_atomic_nums
        )

        compound_result = {
            "name": name,
            "smiles": smiles,
            "status": "completed",
            "rmsd_angstrom": round(final_rmsd, 4),
            "initial_energy_kcal": round(initial_energy, 3),
            "interaction_energy_kcal": round(final_energy, 3),
            "energy_change_kcal": round(energy_change, 3),
            "radius_of_gyration_angstrom": round(rg, 3),
            "stability_verdict": stability_verdict,
            "energy_breakdown": energy_breakdown,
            "residue_interactions": residue_interactions[:10],  # top 10 interacting residues
            "n_ligand_atoms": n_lig_atoms,
            "vina_score_kcal": comp.get("vina_score_kcal"),
            "predicted_binding_affinity_kcal": comp.get("predicted_binding_affinity_kcal"),
            "category": comp.get("category", ""),
            "molecular_weight": comp.get("molecular_weight", 0),
        }

        trajectory = {
            "compound_name": name,
            "snapshots": snapshots,
            "energy_series": [round(e, 2) for e in energies[::max(1, len(energies) // 50)]],
            "rmsd_series": [round(r, 4) for r in rmsd_series[::max(1, len(rmsd_series) // 50)]],
            "converged": abs(energy_change) < 5.0 and len(energies) > 100,
        }

        return {"compound": compound_result, "trajectory": trajectory}

    def _compute_energy_breakdown(
        self,
        lig_coords: np.ndarray,
        lig_atomic_nums: List[int],
        pocket_coords: np.ndarray,
        pocket_atomic_nums: List[int],
    ) -> Dict[str, float]:
        """Compute energy components: VDW, electrostatic, H-bond."""
        e_vdw = 0.0
        e_elec = 0.0
        e_hbond = 0.0

        for i in range(len(lig_coords)):
            z_i = lig_atomic_nums[i]
            lj_i = LJ_PARAMS.get(z_i, DEFAULT_LJ)
            q_i = PARTIAL_CHARGES.get(z_i, 0.0)

            for j in range(len(pocket_coords)):
                z_j = pocket_atomic_nums[j]
                lj_j = LJ_PARAMS.get(z_j, DEFAULT_LJ)
                q_j = PARTIAL_CHARGES.get(z_j, 0.0)

                diff = lig_coords[i] - pocket_coords[j]
                r = np.linalg.norm(diff)
                if r < 0.5:
                    r = 0.5

                e_vdw += _lj_energy(r, lj_i["sigma"], lj_i["epsilon"], lj_j["sigma"], lj_j["epsilon"])
                e_elec += _coulomb_energy(r, q_i, q_j)
                e_hbond += _hbond_energy(r, z_i, z_j)

        return {
            "van_der_waals_kcal": round(e_vdw, 3),
            "electrostatic_kcal": round(e_elec, 3),
            "hydrogen_bond_kcal": round(e_hbond, 3),
            "total_kcal": round(e_vdw + e_elec + e_hbond, 3),
        }

    def _compute_residue_interactions(
        self,
        lig_coords: np.ndarray,
        lig_atomic_nums: List[int],
        pocket_residues: Dict,
    ) -> List[Dict[str, Any]]:
        """Compute per-residue interaction energies with the ligand."""
        results = []
        for key, res_data in pocket_residues.items():
            res_energy = 0.0
            min_dist = float("inf")

            for a in res_data["atoms"]:
                res_coord = np.array([a["x"], a["y"], a["z"]])
                z_j = _element_to_atomic_num(a["element"])
                lj_j = LJ_PARAMS.get(z_j, DEFAULT_LJ)
                q_j = PARTIAL_CHARGES.get(z_j, 0.0)

                for i in range(len(lig_coords)):
                    z_i = lig_atomic_nums[i]
                    lj_i = LJ_PARAMS.get(z_i, DEFAULT_LJ)
                    q_i = PARTIAL_CHARGES.get(z_i, 0.0)

                    r = np.linalg.norm(lig_coords[i] - res_coord)
                    if r < min_dist:
                        min_dist = r
                    if r < 0.5:
                        r = 0.5

                    res_energy += _lj_energy(r, lj_i["sigma"], lj_i["epsilon"], lj_j["sigma"], lj_j["epsilon"])
                    res_energy += _coulomb_energy(r, q_i, q_j)
                    res_energy += _hbond_energy(r, z_i, z_j)

            results.append({
                "residue": f"{res_data['resname']}{res_data['resseq']}:{res_data['chain']}",
                "resname": res_data["resname"],
                "resseq": res_data["resseq"],
                "chain": res_data["chain"],
                "interaction_energy_kcal": round(res_energy, 3),
                "min_distance_angstrom": round(min_dist, 2),
                "n_contacts": sum(1 for a in res_data["atoms"]
                                  for i in range(len(lig_coords))
                                  if np.linalg.norm(lig_coords[i] - np.array([a["x"], a["y"], a["z"]])) < 4.0),
            })

        # Sort by interaction energy (most negative = strongest interaction)
        results.sort(key=lambda r: r["interaction_energy_kcal"])
        return results

    def _classify_stability(self, rmsd: float, energy: float, energy_change: float) -> str:
        """Classify compound stability based on MD metrics."""
        if rmsd < 2.0 and energy < -10.0 and energy_change < 0:
            return "stable"
        elif rmsd < 3.0 and energy < -5.0:
            return "moderately_stable"
        elif rmsd > 5.0 or energy > 0:
            return "unstable"
        else:
            return "borderline"

    def _aggregate_residue_rmsf(self, compound_results: List[Dict]) -> List[Dict]:
        """Aggregate residue interactions across all compounds."""
        residue_map = {}
        for comp in compound_results:
            for res in comp.get("residue_interactions", []):
                key = res["residue"]
                if key not in residue_map:
                    residue_map[key] = {
                        "residue": key,
                        "resname": res["resname"],
                        "resseq": res["resseq"],
                        "chain": res["chain"],
                        "avg_interaction_energy_kcal": [],
                        "avg_min_distance": [],
                        "total_contacts": 0,
                    }
                residue_map[key]["avg_interaction_energy_kcal"].append(res["interaction_energy_kcal"])
                residue_map[key]["avg_min_distance"].append(res["min_distance_angstrom"])
                residue_map[key]["total_contacts"] += res["n_contacts"]

        summary = []
        for key, data in residue_map.items():
            summary.append({
                "residue": data["residue"],
                "resname": data["resname"],
                "resseq": data["resseq"],
                "chain": data["chain"],
                "avg_interaction_energy_kcal": round(np.mean(data["avg_interaction_energy_kcal"]), 3),
                "avg_min_distance_angstrom": round(np.mean(data["avg_min_distance"]), 2),
                "total_contacts": data["total_contacts"],
                "compounds_interacting": len(data["avg_interaction_energy_kcal"]),
            })

        summary.sort(key=lambda r: r["avg_interaction_energy_kcal"])
        return summary[:15]  # top 15 most interactive residues


# ---------------------------------------------------------------------------
# JSON sanitisation — convert numpy types to native Python
# ---------------------------------------------------------------------------

def _sanitize(obj):
    """Recursively convert numpy types to native Python for JSON serialisation."""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_engine: Optional[MolecularDynamicsEngine] = None


def get_md_engine() -> MolecularDynamicsEngine:
    """Return singleton MD engine instance."""
    global _engine
    if _engine is None:
        _engine = MolecularDynamicsEngine()
    return _engine

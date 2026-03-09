"""
Molecular Docking Module for ProtChain BioAPI

Real molecular docking using AutoDock Vina with parallel batch processing.

Pipeline:
1. Prepare receptor: PDB -> PDBQT (openbabel)
2. Prepare ligands: SMILES -> 3D conformer (RDKit) -> PDBQT (meeko)
3. Run Vina docking for each compound in parallel (ProcessPoolExecutor)
4. Collect scores and poses
5. Return ranked results with SDF pose data for 3D visualization
"""

import logging
import os
import tempfile
import shutil
import time
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from concurrent.futures import ProcessPoolExecutor, as_completed

import numpy as np

logger = logging.getLogger(__name__)

# Check for optional dependencies at import time
VINA_AVAILABLE = False
try:
    import vina as _vina_check  # noqa: F401
    VINA_AVAILABLE = True
except ImportError:
    logger.warning("AutoDock Vina not installed — Vina docking will not be available")

OPENBABEL_AVAILABLE = False
try:
    from openbabel import openbabel as _ob_check  # noqa: F401
    OPENBABEL_AVAILABLE = True
except ImportError:
    logger.warning("Open Babel not installed — receptor PDBQT preparation will not be available")

MEEKO_AVAILABLE = False
try:
    import meeko as _meeko_check  # noqa: F401
    MEEKO_AVAILABLE = True
except ImportError:
    logger.warning("Meeko not installed — ligand PDBQT preparation will not be available")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_EXHAUSTIVENESS = 8
DEFAULT_N_POSES = 3
DEFAULT_ENERGY_RANGE = 3.0
MAX_WORKERS = 4
DOCKING_TIMEOUT = 120  # seconds per compound

# Ligand preparation settings
MAX_MW_FOR_DOCKING = 900.0      # Da — reject ligands above this
MAX_HEAVY_ATOMS = 100           # reject if too many heavy atoms
MAX_ROTATABLE_BONDS = 20        # reject if too flexible for Vina
WARN_ROTATABLE_BONDS = 12       # log warning if high
NUM_CONFORMERS = 5              # generate N conformers, keep best
MMFF_MAX_ITERS = 500            # increased from 200 for better convergence


@dataclass
class DockingConfig:
    center_x: float
    center_y: float
    center_z: float
    size_x: float
    size_y: float
    size_z: float
    exhaustiveness: int = DEFAULT_EXHAUSTIVENESS
    n_poses: int = DEFAULT_N_POSES
    energy_range: float = DEFAULT_ENERGY_RANGE


@dataclass
class DockingResult:
    name: str
    smiles: str
    vina_score: float
    all_scores: List[float] = field(default_factory=list)
    pose_sdf: str = ""
    status: str = "success"
    error_message: str = ""
    docking_time_seconds: float = 0.0


# ---------------------------------------------------------------------------
# Receptor preparation (PDB -> PDBQT via Open Babel)
# ---------------------------------------------------------------------------

def prepare_receptor_pdbqt(pdb_content: str, work_dir: str) -> str:
    """Convert PDB content to PDBQT receptor file using Open Babel."""
    from openbabel import openbabel as ob

    pdb_path = os.path.join(work_dir, "receptor.pdb")
    pdbqt_path = os.path.join(work_dir, "receptor.pdbqt")

    with open(pdb_path, "w") as f:
        f.write(pdb_content)

    conv = ob.OBConversion()
    conv.SetInAndOutFormats("pdb", "pdbqt")
    conv.AddOption("r", ob.OBConversion.OUTOPTIONS)  # rigid receptor
    conv.AddOption("p", ob.OBConversion.OUTOPTIONS)   # preserve hydrogens

    mol = ob.OBMol()
    conv.ReadFile(mol, pdb_path)

    # Add polar hydrogens at physiological pH
    mol.AddHydrogens(False, True, 7.4)

    # Assign Gasteiger partial charges
    charge_model = ob.OBChargeModel.FindType("gasteiger")
    if charge_model:
        charge_model.ComputeCharges(mol)

    conv.WriteFile(mol, pdbqt_path)

    if not os.path.exists(pdbqt_path) or os.path.getsize(pdbqt_path) == 0:
        raise RuntimeError("Receptor PDBQT preparation failed — output file is empty")

    logger.info(f"Receptor PDBQT prepared: {pdbqt_path} ({os.path.getsize(pdbqt_path)} bytes)")
    return pdbqt_path


# ---------------------------------------------------------------------------
# Ligand preparation helpers
# ---------------------------------------------------------------------------

def _standardize_mol(mol):
    """Standardize molecule: remove salts, normalize functional groups."""
    from rdkit import Chem
    from rdkit.Chem.MolStandardize import rdMolStandardize

    try:
        # Remove salts/counterions — keep largest fragment
        mol = rdMolStandardize.FragmentParent(mol)

        # Normalize functional groups (nitro, charge separation, etc.)
        normalizer = rdMolStandardize.Normalizer()
        mol = normalizer.normalize(mol)

        # Remove unnecessary formal charges
        uncharger = rdMolStandardize.Uncharger()
        mol = uncharger.uncharge(mol)
    except Exception as e:
        logger.warning(f"Molecule standardization failed, using original: {e}")

    return mol


def _canonical_tautomer(mol):
    """Pick the canonical tautomer (e.g., keto vs enol form)."""
    from rdkit.Chem.MolStandardize import rdMolStandardize

    try:
        enumerator = rdMolStandardize.TautomerEnumerator()
        mol = enumerator.Canonicalize(mol)
    except Exception as e:
        logger.warning(f"Tautomer canonicalization failed, using original: {e}")

    return mol


def _protonate_at_physiological_pH(mol, pH=7.4):
    """Adjust protonation state for physiological pH using OpenBabel.

    At pH 7.4: carboxylic acids deprotonated (COO-), amines protonated (NH3+).
    Uses the same approach as receptor preparation for consistency.
    """
    from rdkit import Chem

    if not OPENBABEL_AVAILABLE:
        logger.warning("OpenBabel not available — skipping pH-aware protonation")
        return mol

    try:
        from openbabel import openbabel as ob

        # RDKit mol → SMILES → OpenBabel
        smiles = Chem.MolToSmiles(mol)

        ob_conv = ob.OBConversion()
        ob_conv.SetInAndOutFormats("smi", "smi")

        ob_mol = ob.OBMol()
        ob_conv.ReadString(ob_mol, smiles)

        # Add hydrogens at physiological pH (same as receptor prep)
        ob_mol.AddHydrogens(False, True, pH)

        # Convert back to SMILES (without explicit H for RDKit parsing)
        ob_conv.AddOption("h", ob.OBConversion.OUTOPTIONS)  # output without explicit H
        protonated_smi = ob_conv.WriteString(ob_mol).strip()

        # Parse back into RDKit
        new_mol = Chem.MolFromSmiles(protonated_smi)
        if new_mol is None:
            logger.warning("OpenBabel protonation produced invalid SMILES, using original")
            return mol

        logger.debug(f"Protonated at pH {pH}: {smiles} -> {protonated_smi}")
        return new_mol

    except Exception as e:
        logger.warning(f"pH protonation failed, using original: {e}")
        return mol


def _generate_best_conformer(mol, num_confs=NUM_CONFORMERS, name="ligand"):
    """Generate multiple 3D conformers, minimize each, keep lowest energy."""
    from rdkit.Chem import AllChem

    params = AllChem.ETKDGv3()
    params.randomSeed = 42
    params.numThreads = 0  # use all cores

    # Generate multiple conformers
    conf_ids = list(AllChem.EmbedMultipleConfs(mol, numConfs=num_confs, params=params))

    if len(conf_ids) == 0:
        # Fallback: try with random coordinates
        params.useRandomCoords = True
        conf_ids = list(AllChem.EmbedMultipleConfs(mol, numConfs=num_confs, params=params))
        if len(conf_ids) == 0:
            raise ValueError(f"3D conformer generation failed for {name}")

    # Minimize each conformer with MMFF94 and track energies
    results = AllChem.MMFFOptimizeMoleculeConfs(mol, maxIters=MMFF_MAX_ITERS)

    # Pick conformer with lowest energy
    # results[i] = (not_converged, energy) — not_converged=0 means converged
    best_conf_id = conf_ids[0]
    best_energy = float('inf')
    for conf_id, (not_converged, energy) in zip(conf_ids, results):
        if energy < best_energy:
            best_energy = energy
            best_conf_id = conf_id

    # Remove all conformers except the best one
    for cid in sorted(conf_ids, reverse=True):
        if cid != best_conf_id:
            mol.RemoveConformer(cid)

    logger.debug(
        f"Conformer selection for {name}: {len(conf_ids)} generated, "
        f"best energy = {best_energy:.1f} kcal/mol (conf {best_conf_id})"
    )

    return mol


# ---------------------------------------------------------------------------
# Ligand preparation (SMILES -> prepared 3D conformer -> PDBQT)
# ---------------------------------------------------------------------------

def prepare_ligand_pdbqt(smiles: str, name: str = "ligand") -> str:
    """Convert SMILES to PDBQT string with full ligand preparation.

    Pipeline:
    1. Parse and validate SMILES
    2. Pre-docking validation (MW, heavy atoms, rotatable bonds)
    3. Standardize (remove salts, normalize functional groups)
    4. Canonicalize tautomer
    5. Protonate at physiological pH (7.4) via OpenBabel
    6. Add explicit hydrogens
    7. Generate multiple 3D conformers, minimize, keep best
    8. Convert to PDBQT via Meeko
    """
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors
    from meeko import MoleculePreparation, PDBQTWriterLegacy

    # Step 1: Parse SMILES
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    # Step 2: Pre-docking validation
    mw = Descriptors.ExactMolWt(mol)
    if mw > MAX_MW_FOR_DOCKING:
        raise ValueError(
            f"MW too high for docking ({mw:.0f} Da > {MAX_MW_FOR_DOCKING:.0f}): {name}"
        )

    heavy_atoms = mol.GetNumHeavyAtoms()
    if heavy_atoms > MAX_HEAVY_ATOMS:
        raise ValueError(
            f"Too many heavy atoms ({heavy_atoms} > {MAX_HEAVY_ATOMS}): {name}"
        )

    rot_bonds = Descriptors.NumRotatableBonds(mol)
    if rot_bonds > MAX_ROTATABLE_BONDS:
        raise ValueError(
            f"Too many rotatable bonds ({rot_bonds} > {MAX_ROTATABLE_BONDS}): {name}"
        )
    if rot_bonds > WARN_ROTATABLE_BONDS:
        logger.warning(f"High rotatable bonds ({rot_bonds}) for {name} — docking accuracy may be reduced")

    # Step 3: Standardize molecule
    mol = _standardize_mol(mol)

    # Step 4: Canonical tautomer
    mol = _canonical_tautomer(mol)

    # Step 5: Protonate at physiological pH
    mol = _protonate_at_physiological_pH(mol, pH=7.4)

    # Step 6: Add explicit hydrogens
    mol = Chem.AddHs(mol)

    # Step 7: Generate multiple 3D conformers, keep best
    mol = _generate_best_conformer(mol, num_confs=NUM_CONFORMERS, name=name)

    # Step 8: Convert to PDBQT via Meeko
    preparator = MoleculePreparation()
    mol_setups = preparator.prepare(mol)

    pdbqt_string, is_ok, error_msg = PDBQTWriterLegacy.write_string(mol_setups[0])
    if not is_ok:
        raise ValueError(f"Meeko PDBQT error for {name}: {error_msg}")

    return pdbqt_string


# ---------------------------------------------------------------------------
# Vina box computation from binding site geometry
# ---------------------------------------------------------------------------

def compute_vina_box(binding_site: dict) -> DockingConfig:
    """Compute Vina search box from binding site center and volume."""
    center = binding_site.get("center", {})

    # Handle both dict and list formats for center
    if isinstance(center, dict):
        cx = float(center.get("x", 0))
        cy = float(center.get("y", 0))
        cz = float(center.get("z", 0))
    elif isinstance(center, (list, tuple)) and len(center) >= 3:
        cx, cy, cz = float(center[0]), float(center[1]), float(center[2])
    else:
        raise ValueError(f"Invalid binding site center format: {center}")

    volume = float(binding_site.get("volume", 500.0))

    # Cube side length from volume + padding for conformational flexibility
    side = volume ** (1.0 / 3.0)
    box_size = max(side + 8.0, 20.0)  # minimum 20 Angstrom box
    box_size = min(box_size, 30.0)     # cap at 30 to keep runtime reasonable

    return DockingConfig(
        center_x=cx,
        center_y=cy,
        center_z=cz,
        size_x=box_size,
        size_y=box_size,
        size_z=box_size,
    )


# ---------------------------------------------------------------------------
# PDBQT pose -> SDF conversion for 3Dmol.js visualization
# ---------------------------------------------------------------------------

def _pdbqt_pose_to_sdf(pdbqt_string: str, smiles: str) -> str:
    """Convert Vina output PDBQT pose to SDF using Meeko reverse mapping."""
    try:
        from meeko import PDBQTMolecule, RDKitMolCreate
        from rdkit import Chem

        pdbqt_mol = PDBQTMolecule(pdbqt_string, is_dlg=False, skip_typing=True)
        rdmols = RDKitMolCreate.from_pdbqt_mol(pdbqt_mol)

        if rdmols and len(rdmols) > 0:
            mol = rdmols[0]
            mol.SetProp("_Name", "docked_pose")
            return Chem.MolToMolBlock(mol)
    except Exception as e:
        logger.warning(f"PDBQT->SDF conversion failed: {e}")

    # Fallback: return PDBQT directly (3Dmol.js can parse PDBQT too)
    return pdbqt_string


# ---------------------------------------------------------------------------
# Single compound docking (runs in worker process)
# ---------------------------------------------------------------------------

def _dock_single_compound(
    receptor_pdbqt_path: str,
    ligand_pdbqt_string: str,
    config: dict,
    compound_name: str,
    compound_smiles: str,
    work_dir: str,
) -> dict:
    """Dock a single compound against the receptor. Runs in a worker process."""
    t0 = time.time()

    try:
        from vina import Vina

        # Write ligand PDBQT to file
        safe_name = compound_name.replace(" ", "_").replace("/", "_")[:50]
        lig_path = os.path.join(work_dir, f"{safe_name}_lig.pdbqt")
        with open(lig_path, "w") as f:
            f.write(ligand_pdbqt_string)

        # Initialize Vina
        v = Vina(sf_name="vina")
        v.set_receptor(receptor_pdbqt_path)
        v.set_ligand_from_file(lig_path)
        v.compute_vina_maps(
            center=[config["center_x"], config["center_y"], config["center_z"]],
            box_size=[config["size_x"], config["size_y"], config["size_z"]],
        )

        # Dock
        v.dock(
            exhaustiveness=config.get("exhaustiveness", DEFAULT_EXHAUSTIVENESS),
            n_poses=config.get("n_poses", DEFAULT_N_POSES),
        )

        # Extract scores
        energies = v.energies()
        all_scores = [float(e[0]) for e in energies] if energies is not None else []
        best_score = all_scores[0] if all_scores else 0.0

        # Extract best pose and convert to SDF
        pose_pdbqt = v.poses(n_poses=1)
        pose_sdf = _pdbqt_pose_to_sdf(pose_pdbqt, compound_smiles)

        elapsed = time.time() - t0
        return {
            "name": compound_name,
            "smiles": compound_smiles,
            "vina_score": round(best_score, 2),
            "all_scores": [round(s, 2) for s in all_scores],
            "pose_sdf": pose_sdf,
            "status": "success",
            "error_message": "",
            "docking_time_seconds": round(elapsed, 1),
        }

    except Exception as e:
        elapsed = time.time() - t0
        logger.warning(f"Docking failed for {compound_name}: {e}")
        return {
            "name": compound_name,
            "smiles": compound_smiles,
            "vina_score": 0.0,
            "all_scores": [],
            "pose_sdf": "",
            "status": "failed",
            "error_message": str(e),
            "docking_time_seconds": round(elapsed, 1),
        }


# ---------------------------------------------------------------------------
# Batch docking orchestrator
# ---------------------------------------------------------------------------

class VinaDockingEngine:
    """Orchestrates parallel batch docking with AutoDock Vina."""

    def __init__(self, max_workers: int = MAX_WORKERS):
        self.max_workers = max_workers

    def check_dependencies(self):
        """Check that all required dependencies are available."""
        missing = []
        if not VINA_AVAILABLE:
            missing.append("vina (pip install vina)")
        if not OPENBABEL_AVAILABLE:
            missing.append("openbabel (pip install openbabel-wheel)")
        if not MEEKO_AVAILABLE:
            missing.append("meeko (pip install meeko)")
        if missing:
            raise RuntimeError(
                f"Vina docking requires the following packages: {', '.join(missing)}. "
                "Install them or run the BioAPI service in Docker."
            )

    def dock_batch(
        self,
        pdb_content: str,
        binding_site: dict,
        compounds: List[Dict[str, Any]],
        max_compounds: int = 50,
    ) -> Dict[str, Any]:
        """
        Dock a batch of compounds against a protein binding site.

        Parameters
        ----------
        pdb_content : str
            Raw PDB file text.
        binding_site : dict
            Binding site with center, volume, nearby_residues, etc.
        compounds : list of dict
            Each dict must have 'name' and 'smiles' keys.
        max_compounds : int
            Maximum compounds to dock.

        Returns
        -------
        dict with top_compounds, compounds_docked, docking_failures, etc.
        """
        self.check_dependencies()
        t_start = time.time()

        compounds = compounds[:max_compounds]
        logger.info(f"Starting Vina batch docking: {len(compounds)} compounds, {self.max_workers} workers")

        work_dir = tempfile.mkdtemp(prefix="vina_docking_")

        try:
            # Step 1: Prepare receptor (once for all compounds)
            logger.info("Preparing receptor PDBQT...")
            receptor_path = prepare_receptor_pdbqt(pdb_content, work_dir)

            # Step 2: Compute docking box from binding site
            docking_config = compute_vina_box(binding_site)
            config_dict = {
                "center_x": docking_config.center_x,
                "center_y": docking_config.center_y,
                "center_z": docking_config.center_z,
                "size_x": docking_config.size_x,
                "size_y": docking_config.size_y,
                "size_z": docking_config.size_z,
                "exhaustiveness": docking_config.exhaustiveness,
                "n_poses": docking_config.n_poses,
            }
            logger.info(
                f"Vina box: center=({docking_config.center_x:.1f}, {docking_config.center_y:.1f}, "
                f"{docking_config.center_z:.1f}), size={docking_config.size_x:.1f}A"
            )

            # Step 3: Prepare all ligand PDBQTs
            logger.info("Preparing ligand PDBQTs...")
            prepared_ligands = []
            prep_failures = []
            for comp in compounds:
                name = comp.get("name", "unknown")
                smiles = comp.get("smiles", "")
                if not smiles:
                    prep_failures.append({"name": name, "error": "No SMILES provided"})
                    continue
                try:
                    pdbqt_str = prepare_ligand_pdbqt(smiles, name)
                    prepared_ligands.append({
                        "name": name,
                        "smiles": smiles,
                        "pdbqt": pdbqt_str,
                        "compound_data": comp,
                    })
                except Exception as e:
                    prep_failures.append({"name": name, "error": str(e)})
                    logger.warning(f"Ligand prep failed for {name}: {e}")

            validation_failures = [f for f in prep_failures if "too high" in f.get("error", "") or "Too many" in f.get("error", "")]
            logger.info(
                f"Ligand prep: {len(prepared_ligands)} ready, {len(prep_failures)} failed "
                f"({len(validation_failures)} filtered by validation)"
            )

            # Step 4: Parallel docking
            results = []
            with ProcessPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_lig = {}
                for lig in prepared_ligands:
                    safe_name = lig["name"].replace(" ", "_").replace("/", "_")[:50]
                    comp_dir = os.path.join(work_dir, safe_name)
                    os.makedirs(comp_dir, exist_ok=True)

                    future = executor.submit(
                        _dock_single_compound,
                        receptor_path,
                        lig["pdbqt"],
                        config_dict,
                        lig["name"],
                        lig["smiles"],
                        comp_dir,
                    )
                    future_to_lig[future] = lig

                for future in as_completed(future_to_lig):
                    lig = future_to_lig[future]
                    try:
                        result = future.result(timeout=DOCKING_TIMEOUT)
                        results.append((result, lig["compound_data"]))
                    except Exception as e:
                        logger.warning(f"Worker exception for {lig['name']}: {e}")
                        results.append((
                            {
                                "name": lig["name"],
                                "smiles": lig["smiles"],
                                "vina_score": 0.0,
                                "all_scores": [],
                                "pose_sdf": "",
                                "status": "timeout",
                                "error_message": str(e),
                                "docking_time_seconds": 0.0,
                            },
                            lig["compound_data"],
                        ))

            # Step 5: Sort by Vina score (more negative = better binding)
            successful = [(r, c) for r, c in results if r["status"] == "success"]
            successful.sort(key=lambda x: x[0]["vina_score"])  # ascending (most negative first)

            failed = [(r, c) for r, c in results if r["status"] != "success"]

            total_time = round(time.time() - t_start, 1)

            # Step 6: Deduplicate by SMILES — merge poses from duplicate entries
            # If the same compound (same SMILES) was docked multiple times,
            # keep the best score and aggregate all pose scores and SDF data.
            deduped = {}  # keyed by canonical SMILES
            for r, comp_data in successful:
                smi = r["smiles"]
                if smi in deduped:
                    existing = deduped[smi]
                    # Merge pose scores
                    existing["all_scores"].extend(r["all_scores"])
                    existing["all_poses_sdf"].append(r["pose_sdf"])
                    existing["docking_time_seconds"] += r["docking_time_seconds"]
                    # Keep the better (more negative) score
                    if r["vina_score"] < existing["vina_score"]:
                        existing["vina_score"] = r["vina_score"]
                        existing["pose_sdf"] = r["pose_sdf"]
                else:
                    deduped[smi] = {
                        **r,
                        "all_poses_sdf": [r["pose_sdf"]] if r["pose_sdf"] else [],
                        "compound_data": comp_data,
                    }

            # Sort deduplicated compounds by best Vina score
            deduped_list = sorted(deduped.values(), key=lambda x: x["vina_score"])

            # Build output in frontend-compatible format
            top_compounds = []
            for rank, entry in enumerate(deduped_list, 1):
                comp_data = entry["compound_data"]
                mw = comp_data.get("molecular_weight", 0)
                logp = comp_data.get("logp", comp_data.get("logP", 0))
                hbd = comp_data.get("hbd", 0)
                hba = comp_data.get("hba", 0)

                # Compute Lipinski Rule-of-5 violations from descriptors
                lipinski = 0
                if mw and mw > 500: lipinski += 1
                if logp and logp > 5: lipinski += 1
                if hbd and hbd > 5: lipinski += 1
                if hba and hba > 10: lipinski += 1

                # Deduplicate and sort all pose scores
                all_scores = sorted(set(round(s, 2) for s in entry["all_scores"]))

                top_compounds.append({
                    "name": entry["name"],
                    "smiles": entry["smiles"],
                    "vina_score_kcal": entry["vina_score"],
                    "predicted_binding_affinity_kcal": entry["vina_score"],
                    "all_poses_scores": all_scores,
                    "all_poses_sdf": entry.get("all_poses_sdf", []),
                    "score": self._normalize_vina_score(entry["vina_score"]),
                    "pose_sdf": entry["pose_sdf"],
                    "has_pose": bool(entry["pose_sdf"]),
                    "docking_time_seconds": entry["docking_time_seconds"],
                    "rank": rank,
                    "status": entry["status"],
                    # Compound descriptors
                    "molecular_weight": mw,
                    "logP": logp,
                    "category": comp_data.get("category", "unknown"),
                    "lipinski_violations": lipinski,
                    "hbd": hbd,
                    "hba": hba,
                    "rotatable_bonds": comp_data.get("rotatable_bonds"),
                    "tpsa": comp_data.get("tpsa"),
                })

            binding_site_summary = {
                "center": binding_site.get("center"),
                "volume": binding_site.get("volume"),
                "druggability_score": binding_site.get("druggability_score"),
                "box_size": [docking_config.size_x, docking_config.size_y, docking_config.size_z],
            }

            return {
                "status": "success",
                "method": "autodock_vina",
                "top_compounds": top_compounds,
                "compounds_screened": len(compounds),
                "compounds_docked": len(successful),
                "hits_found": len([c for c in top_compounds if c["vina_score_kcal"] <= -6.0]),
                "docking_failures": len(failed) + len(prep_failures),
                "failure_details": [r for r, _ in failed] + prep_failures,
                "binding_site_used": binding_site_summary,
                "total_docking_time_seconds": total_time,
                "exhaustiveness": docking_config.exhaustiveness,
                "scoring_components": ["vina_score"],
                "ligand_preparation": {
                    "steps": [
                        "Molecule standardization (salt removal, charge normalization)",
                        "Tautomer canonicalization",
                        "Protonation at physiological pH (7.4)",
                        "Multi-conformer generation (5 conformers, MMFF94 minimization)",
                        "Best conformer selection by lowest energy",
                    ],
                    "protonation_pH": 7.4,
                    "conformers_generated": NUM_CONFORMERS,
                    "force_field": "MMFF94",
                    "max_iterations": MMFF_MAX_ITERS,
                    "validation_thresholds": {
                        "max_mw": MAX_MW_FOR_DOCKING,
                        "max_heavy_atoms": MAX_HEAVY_ATOMS,
                        "max_rotatable_bonds": MAX_ROTATABLE_BONDS,
                    },
                    "compounds_passed_validation": len(prepared_ligands),
                    "compounds_failed_validation": len(validation_failures),
                    "compounds_failed_prep": len(prep_failures) - len(validation_failures),
                },
            }

        finally:
            try:
                shutil.rmtree(work_dir)
            except Exception:
                pass

    @staticmethod
    def _normalize_vina_score(score_kcal: float) -> float:
        """Normalize Vina score to 0-1 range for frontend compatibility.
        Vina: -12 (excellent) to 0 (no binding).  Maps: -12 -> 1.0, 0 -> 0.0
        """
        return round(min(max(-score_kcal / 12.0, 0.0), 1.0), 4)


# ---------------------------------------------------------------------------
# Singleton access
# ---------------------------------------------------------------------------

_docking_engine: Optional[VinaDockingEngine] = None


def get_docking_engine() -> VinaDockingEngine:
    global _docking_engine
    if _docking_engine is None:
        _docking_engine = VinaDockingEngine()
    return _docking_engine

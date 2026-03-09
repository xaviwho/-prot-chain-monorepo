"""
Lead Optimization Module for ProtChain BioAPI  (v2 — Advanced)

Evaluates drug-likeness and optimizability of top compounds, then performs
cross-compound analyses to identify structure-activity relationships and
generate optimized analogs.

Per-compound analyses:
  - Lipinski Rule-of-Five, Veber rules, lead-likeness
  - QED (Bickerton et al. 2012)
  - Synthetic Accessibility Score (Ertl & Schuffenhauer 2009)
  - PAINS & structural-alert filters
  - ADMET property flags
  - Pharmacophore feature extraction (3D)

Cross-compound analyses:
  - Matched Molecular Pair (MMP) analysis + SAR
  - R-group decomposition & substituent activity ranking
  - Multi-objective Pareto ranking (potency × stability × QED × SA)
  - Bioisosteric replacement suggestions with scored products
  - Analog generation via fragment growing & bioisostere swaps
"""

import logging
import time
from typing import Dict, Any, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# RDKit imports
# ---------------------------------------------------------------------------
from rdkit import Chem
from rdkit.Chem import (
    Descriptors,
    Lipinski,
    FilterCatalog,
    rdMolDescriptors,
    QED as QEDModule,
    AllChem,
    rdFMCS,
)
from rdkit.Chem.FilterCatalog import FilterCatalogParams

# Optional RDKit modules (graceful fallback if missing in specific builds)
try:
    from rdkit.Chem import rdMMPA
    MMPA_AVAILABLE = True
except ImportError:
    MMPA_AVAILABLE = False
    logger.warning("rdMMPA not available — MMP analysis will be skipped")

try:
    from rdkit.Chem import rdRGroupDecomposition
    RGROUP_AVAILABLE = True
except ImportError:
    RGROUP_AVAILABLE = False
    logger.warning("rdRGroupDecomposition not available — R-group decomposition will be skipped")

try:
    from rdkit.Chem import ChemicalFeatures
    from rdkit import RDConfig
    import os
    _fdef_path = os.path.join(RDConfig.RDDataDir, "BaseFeatures.fdef")
    _feat_factory = ChemicalFeatures.BuildFeatureFactory(_fdef_path)
    PHARMACOPHORE_AVAILABLE = True
except Exception:
    PHARMACOPHORE_AVAILABLE = False
    logger.warning("Pharmacophore feature factory not available")

# Synthetic Accessibility — RDKit ships SA_Score via Contrib
try:
    from rdkit.Chem import RDConfig as _RDConfig
    import os, sys
    sa_path = os.path.join(_RDConfig.RDContribDir, "SA_Score")
    if sa_path not in sys.path:
        sys.path.insert(0, sa_path)
    import sascorer
    SA_AVAILABLE = True
except Exception:
    SA_AVAILABLE = False
    logger.warning("SA_Score contrib not available — using heuristic SA estimate")


# ---------------------------------------------------------------------------
# PAINS filter catalogue (built once)
# ---------------------------------------------------------------------------
_pains_catalog = None

def _get_pains_catalog():
    global _pains_catalog
    if _pains_catalog is None:
        params = FilterCatalogParams()
        params.AddCatalog(FilterCatalogParams.FilterCatalogs.PAINS)
        _pains_catalog = FilterCatalog.FilterCatalog(params)
    return _pains_catalog


# ---------------------------------------------------------------------------
# Common toxicophore / structural-alert SMARTS
# ---------------------------------------------------------------------------
STRUCTURAL_ALERTS = [
    ("nitro_aromatic", "[$(c-[N+](=O)[O-])]"),
    ("epoxide", "C1OC1"),
    ("michael_acceptor", "[CH2]=[CH]-[C,N,O]"),
    ("acyl_halide", "[CX3](=[OX1])[FX1,ClX1,BrX1,IX1]"),
    ("sulfonyl_halide", "[SX4](=[OX1])(=[OX1])[FX1,ClX1,BrX1]"),
    ("aldehyde", "[CX3H1](=O)[#6]"),
    ("thiol", "[SX2H]"),
    ("azide", "[NX1]#[NX2]-[*]"),
]

_compiled_alerts = None

def _get_structural_alerts():
    global _compiled_alerts
    if _compiled_alerts is None:
        _compiled_alerts = []
        for name, smarts in STRUCTURAL_ALERTS:
            pat = Chem.MolFromSmarts(smarts)
            if pat is not None:
                _compiled_alerts.append((name, pat))
    return _compiled_alerts


# ---------------------------------------------------------------------------
# Bioisosteric replacement SMARTS library
# ---------------------------------------------------------------------------
BIOISOSTERE_REPLACEMENTS = [
    ("phenyl", "pyridine",
     "[cH1:1]1[cH1:2][cH1:3][cH1:4][cH1:5]c1",
     "[cH1:1]1[cH1:2][cH1:3][nH0:4][cH1:5]c1"),
    ("ester", "amide",
     "[C:1](=[O:2])[O:3][C:4]",
     "[C:1](=[O:2])[NH:3][C:4]"),
    ("carboxylic_acid", "tetrazole",
     "[C:1](=O)[OH]",
     "[C:1]1=NN=N[NH]1"),
    ("Cl", "F",
     "[c:1][Cl]",
     "[c:1][F]"),
    ("Cl", "CF3",
     "[c:1][Cl]",
     "[c:1]C(F)(F)F"),
    ("morpholine", "piperazine",
     "C1COCCN1",
     "C1CNCCN1"),
    ("phenol", "indazole_OH",
     "[OH][c:1]1[cH:2][cH:3][cH:4][cH:5][cH:6]1",
     "[OH][c:1]1[cH:2][cH:3]c2nn[cH][c:4]2[cH:6]1"),
    ("methyl", "ethyl",
     "[c:1][CH3]",
     "[c:1][CH2][CH3]"),
    ("methyl", "cyclopropyl",
     "[c:1][CH3]",
     "[c:1]C1CC1"),
    ("methoxy", "ethoxy",
     "[c:1]O[CH3]",
     "[c:1]OCC"),
    ("NH", "N-methyl",
     "[C:1][NH:2][C:3]",
     "[C:1][N:2]([CH3])[C:3]"),
    ("sulfonamide", "reverse_sulfonamide",
     "[NH:1]S(=O)(=O)[c:2]",
     "[c:2]S(=O)(=O)[NH:1]"),
]


# ---------------------------------------------------------------------------
# Heuristic SA Score fallback
# ---------------------------------------------------------------------------
def _heuristic_sa_score(mol) -> float:
    ring_count = Descriptors.RingCount(mol)
    stereo = Descriptors.NumRadicalElectrons(mol)
    fsp3 = rdMolDescriptors.CalcFractionCSP3(mol)
    n_atoms = mol.GetNumHeavyAtoms()
    score = 2.0 + ring_count * 0.6 + stereo * 0.8 - fsp3 * 0.5
    score += max(0, (n_atoms - 20)) * 0.05
    return max(1.0, min(10.0, score))


# ---------------------------------------------------------------------------
# Quick profile for generated analogs (lightweight version)
# ---------------------------------------------------------------------------
def _quick_profile(smiles: str) -> Optional[Dict[str, Any]]:
    """Compute minimal property set for a generated analog."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    mol_h = Chem.AddHs(mol)
    mw = Descriptors.MolWt(mol_h)
    logp = Descriptors.MolLogP(mol_h)
    hbd = Descriptors.NumHDonors(mol_h)
    hba = Descriptors.NumHAcceptors(mol_h)
    mol_no_h = Chem.RemoveHs(mol_h)
    qed = QEDModule.qed(mol_no_h)
    if SA_AVAILABLE:
        sa = sascorer.calculateScore(mol_no_h)
    else:
        sa = _heuristic_sa_score(mol_no_h)
    lipinski_ok = mw <= 500 and logp <= 5 and hbd <= 5 and hba <= 10
    return {
        "smiles": smiles,
        "molecular_weight": round(mw, 2),
        "logp": round(logp, 2),
        "qed": round(qed, 4),
        "sa_score": round(sa, 2),
        "lipinski_pass": lipinski_ok,
    }


# ---------------------------------------------------------------------------
# Per-compound descriptor computation
# ---------------------------------------------------------------------------
def compute_compound_profile(smiles: str, name: str = "") -> Optional[Dict[str, Any]]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        logger.warning(f"Cannot parse SMILES for {name}: {smiles}")
        return None

    mol = Chem.AddHs(mol)

    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    tpsa = Descriptors.TPSA(mol)
    rotatable_bonds = Descriptors.NumRotatableBonds(mol)
    aromatic_rings = Descriptors.NumAromaticRings(mol)
    ring_count = Descriptors.RingCount(mol)
    heavy_atom_count = Lipinski.HeavyAtomCount(mol)
    fsp3 = rdMolDescriptors.CalcFractionCSP3(mol)

    lipinski_violations = sum([
        1 if mw > 500 else 0,
        1 if logp > 5 else 0,
        1 if hbd > 5 else 0,
        1 if hba > 10 else 0,
    ])
    lipinski_pass = lipinski_violations <= 1

    mol_no_h = Chem.RemoveHs(mol)
    qed_score = QEDModule.qed(mol_no_h)

    if SA_AVAILABLE:
        sa_score = sascorer.calculateScore(mol_no_h)
    else:
        sa_score = _heuristic_sa_score(mol_no_h)

    catalog = _get_pains_catalog()
    pains_match = catalog.HasMatch(mol_no_h)
    pains_alerts = []
    if pains_match:
        entry = catalog.GetFirstMatch(mol_no_h)
        if entry:
            pains_alerts.append(entry.GetDescription())

    alerts = _get_structural_alerts()
    structural_alert_flags = []
    for alert_name, pattern in alerts:
        if mol_no_h.HasSubstructMatch(pattern):
            structural_alert_flags.append(alert_name)

    lead_like = (
        200 <= mw <= 450
        and -1 <= logp <= 4
        and hbd <= 5
        and hba <= 8
        and rotatable_bonds <= 10
    )

    veber_pass = tpsa <= 140 and rotatable_bonds <= 10

    admet_flags = []
    if tpsa > 140:
        admet_flags.append("high_tpsa_poor_permeability")
    if logp > 5:
        admet_flags.append("high_logp_poor_solubility")
    if logp < -1:
        admet_flags.append("low_logp_poor_permeability")
    if mw > 500:
        admet_flags.append("high_mw_poor_absorption")
    if rotatable_bonds > 10:
        admet_flags.append("flexible_poor_oral_bioavailability")
    if hbd > 5:
        admet_flags.append("high_hbd_poor_permeability")

    sa_normalized = max(0, (10.0 - sa_score) / 9.0)
    lipinski_score = max(0, (4 - lipinski_violations)) / 4.0
    alert_penalty = 1.0 if (not pains_match and len(structural_alert_flags) == 0) else 0.3

    drug_likeness_score = (
        0.40 * qed_score
        + 0.25 * sa_normalized
        + 0.20 * lipinski_score
        + 0.15 * alert_penalty
    )

    return {
        "name": name,
        "smiles": smiles,
        "molecular_weight": round(mw, 2),
        "logp": round(logp, 2),
        "hbd": hbd,
        "hba": hba,
        "tpsa": round(tpsa, 2),
        "rotatable_bonds": rotatable_bonds,
        "aromatic_rings": aromatic_rings,
        "ring_count": ring_count,
        "heavy_atom_count": heavy_atom_count,
        "fraction_csp3": round(fsp3, 3),
        "lipinski_violations": lipinski_violations,
        "lipinski_pass": lipinski_pass,
        "qed": round(qed_score, 4),
        "synthetic_accessibility": round(sa_score, 2),
        "sa_normalized": round(sa_normalized, 3),
        "pains_pass": not pains_match,
        "pains_alerts": pains_alerts,
        "structural_alerts": structural_alert_flags,
        "lead_like": lead_like,
        "veber_pass": veber_pass,
        "admet_flags": admet_flags,
        "drug_likeness": round(drug_likeness_score, 4),
    }


# ---------------------------------------------------------------------------
# Optimization suggestion generator
# ---------------------------------------------------------------------------
def _generate_suggestions(profile: Dict[str, Any]) -> List[str]:
    suggestions = []

    if profile["molecular_weight"] > 500:
        suggestions.append(
            "High MW (>500). Consider fragment-based truncation or removing "
            "non-essential substituents to improve oral absorption."
        )
    if profile["logp"] > 5:
        suggestions.append(
            "High logP (>5). Introduce polar groups (OH, NH, heterocyclic N) "
            "to improve aqueous solubility."
        )
    elif profile["logp"] < -1:
        suggestions.append(
            "Low logP (<-1). Consider adding lipophilic groups to improve "
            "membrane permeability."
        )
    if profile["tpsa"] > 140:
        suggestions.append(
            "High TPSA (>140 A²). Reduce hydrogen bond donors/acceptors or "
            "use intramolecular H-bonds to lower effective polarity."
        )
    if profile["rotatable_bonds"] > 10:
        suggestions.append(
            "Many rotatable bonds (>10). Introduce ring constraints (cyclisation) "
            "to reduce conformational entropy penalty upon binding."
        )
    if not profile["pains_pass"]:
        suggestions.append(
            f"PAINS alert detected ({', '.join(profile['pains_alerts'])}). "
            "This compound may show assay interference; consider structural "
            "modifications to remove the reactive moiety."
        )
    if profile["structural_alerts"]:
        suggestions.append(
            f"Structural alerts: {', '.join(profile['structural_alerts'])}. "
            "These functional groups are associated with toxicity or metabolic "
            "liability; evaluate SAR to find alternatives."
        )
    if profile["synthetic_accessibility"] > 6:
        suggestions.append(
            f"Difficult synthesis (SA={profile['synthetic_accessibility']:.1f}/10). "
            "Simplify stereochemistry or use more common building blocks."
        )
    if profile["fraction_csp3"] < 0.25:
        suggestions.append(
            "Low Fsp3 (<0.25) — flat molecule. Introducing sp3 character "
            "(saturated rings, chiral centers) may improve selectivity and solubility."
        )
    if not suggestions:
        suggestions.append(
            "Compound has a favorable drug-likeness profile. Consider advancing "
            "to in-vitro assay validation."
        )
    return suggestions


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------
def _classify_compound(
    profile: Dict[str, Any],
    docking_score: Optional[float] = None,
    stability_verdict: Optional[str] = None,
) -> str:
    score = profile["drug_likeness"]
    red_flags = 0

    if not profile["pains_pass"]:
        red_flags += 1
    if len(profile["structural_alerts"]) > 0:
        red_flags += 1
    if profile["lipinski_violations"] >= 3:
        red_flags += 1
    if stability_verdict and stability_verdict.lower() == "unstable":
        red_flags += 1

    if red_flags >= 2:
        return "deprioritize"
    elif score >= 0.6 and red_flags == 0:
        return "advance"
    else:
        return "optimize"


# ===================================================================
# ADVANCED ANALYSES (v2)
# ===================================================================

# ---------------------------------------------------------------------------
# 1. Multi-objective Pareto ranking
# ---------------------------------------------------------------------------
def _compute_pareto_ranking(compounds: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Rank compounds across multiple objectives using Pareto dominance.
    Objectives (all maximised):
      - potency:  normalised docking score
      - stability: 1.0 if stable, 0.5 if marginal, 0.0 if unstable
      - drug_likeness: QED
      - synthesizability: sa_normalized
    """
    if len(compounds) < 2:
        for c in compounds:
            c["pareto_front"] = 0
            c["pareto_rank"] = 1
            c["crowding_distance"] = float("inf")
            c["pareto_objectives"] = {
                "potency": c.get("predicted_activity", 0),
                "stability": 1.0,
                "drug_likeness": c.get("qed", 0),
                "synthesizability": c.get("sa_normalized", 0),
            }
        return {"n_fronts": 1, "front_sizes": [len(compounds)],
                "objectives_used": ["potency", "stability", "drug_likeness", "synthesizability"]}

    # Build objective matrix (n x m), all to maximise
    obj_names = ["potency", "stability", "drug_likeness", "synthesizability"]
    n = len(compounds)
    obj_matrix = np.zeros((n, 4))

    for i, c in enumerate(compounds):
        # Potency: normalise docking score (-12 best → 1.0, 0 → 0.0)
        ds = c.get("docking_score")
        if ds is not None:
            obj_matrix[i, 0] = min(1.0, max(0.0, (-ds) / 12.0))
        else:
            obj_matrix[i, 0] = c.get("predicted_activity", 0.5)

        # Stability
        sv = c.get("stability_verdict", "unknown")
        if isinstance(sv, str):
            obj_matrix[i, 1] = {"stable": 1.0, "marginal": 0.5, "marginally stable": 0.5,
                                "unstable": 0.0}.get(sv.lower(), 0.5)
        else:
            obj_matrix[i, 1] = 0.5

        obj_matrix[i, 2] = c.get("qed", 0.5)
        obj_matrix[i, 3] = c.get("sa_normalized", 0.5)

    # Compute Pareto fronts
    remaining = set(range(n))
    fronts = []
    while remaining:
        front = []
        for i in remaining:
            dominated = False
            for j in remaining:
                if i == j:
                    continue
                if np.all(obj_matrix[j] >= obj_matrix[i]) and np.any(obj_matrix[j] > obj_matrix[i]):
                    dominated = True
                    break
            if not dominated:
                front.append(i)
        for idx in front:
            remaining.discard(idx)
        fronts.append(front)

    # Crowding distance within each front
    crowding = np.zeros(n)
    for front in fronts:
        if len(front) <= 2:
            for idx in front:
                crowding[idx] = float("inf")
            continue
        for m_idx in range(4):
            sorted_front = sorted(front, key=lambda i: obj_matrix[i, m_idx])
            crowding[sorted_front[0]] = float("inf")
            crowding[sorted_front[-1]] = float("inf")
            obj_range = obj_matrix[sorted_front[-1], m_idx] - obj_matrix[sorted_front[0], m_idx]
            if obj_range == 0:
                continue
            for k in range(1, len(sorted_front) - 1):
                crowding[sorted_front[k]] += (
                    obj_matrix[sorted_front[k + 1], m_idx] - obj_matrix[sorted_front[k - 1], m_idx]
                ) / obj_range

    # Assign to compounds
    rank = 1
    for front_idx, front in enumerate(fronts):
        sorted_by_crowding = sorted(front, key=lambda i: -crowding[i])
        for idx in sorted_by_crowding:
            compounds[idx]["pareto_front"] = front_idx
            compounds[idx]["pareto_rank"] = rank
            compounds[idx]["crowding_distance"] = round(float(crowding[idx]), 4) if not np.isinf(crowding[idx]) else None
            compounds[idx]["pareto_objectives"] = {
                obj_names[k]: round(float(obj_matrix[idx, k]), 4) for k in range(4)
            }
            rank += 1

    return {
        "n_fronts": len(fronts),
        "front_sizes": [len(f) for f in fronts],
        "objectives_used": obj_names,
    }


# ---------------------------------------------------------------------------
# 2. Matched Molecular Pair (MMP) analysis
# ---------------------------------------------------------------------------
def _run_mmp_analysis(compounds: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Find matched molecular pairs and correlate structural changes with activity."""
    if not MMPA_AVAILABLE or len(compounds) < 2:
        return None

    try:
        # Build (mol, smiles, activity) tuples
        entries = []
        for c in compounds:
            mol = Chem.MolFromSmiles(c["smiles"])
            if mol is None:
                continue
            activity = c.get("docking_score") or c.get("predicted_activity") or 0
            entries.append((mol, c["smiles"], c["name"], float(activity)))

        if len(entries) < 2:
            return None

        transformations = []

        for i in range(len(entries)):
            # Fragment molecule i
            try:
                frags_i = rdMMPA.FragmentMol(entries[i][0])
            except Exception:
                continue

            for j in range(i + 1, len(entries)):
                try:
                    frags_j = rdMMPA.FragmentMol(entries[j][0])
                except Exception:
                    continue

                # Check for shared cores
                for core_i, rgroup_i in frags_i:
                    if not core_i:
                        continue
                    for core_j, rgroup_j in frags_j:
                        if not core_j:
                            continue
                        if core_i == core_j and rgroup_i != rgroup_j:
                            delta_activity = entries[j][3] - entries[i][3]
                            delta_qed = (compounds[j].get("qed", 0) or 0) - (compounds[i].get("qed", 0) or 0)
                            transformations.append({
                                "compound_a": entries[i][2],
                                "compound_b": entries[j][2],
                                "core_smiles": core_i,
                                "transformation_from": rgroup_i,
                                "transformation_to": rgroup_j,
                                "delta_docking_score": round(delta_activity, 3),
                                "delta_qed": round(delta_qed, 4),
                            })

        if not transformations:
            return None

        # Sort by absolute activity change (most informative first)
        transformations.sort(key=lambda t: abs(t["delta_docking_score"]), reverse=True)

        # Top beneficial = more negative docking score (better binding)
        beneficial = [t for t in transformations if t["delta_docking_score"] < 0]

        return {
            "pairs_analyzed": len(entries) * (len(entries) - 1) // 2,
            "transformations_found": len(transformations),
            "transformations": transformations[:20],
            "top_beneficial_transformations": beneficial[:10],
        }

    except Exception as e:
        logger.error(f"MMP analysis error: {e}")
        return None


# ---------------------------------------------------------------------------
# 3. R-group decomposition
# ---------------------------------------------------------------------------
def _run_rgroup_decomposition(compounds: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Decompose compounds into core scaffold + R-groups, rank substituents by activity."""
    if not RGROUP_AVAILABLE or len(compounds) < 3:
        return None

    try:
        mols = []
        valid_compounds = []
        for c in compounds:
            mol = Chem.MolFromSmiles(c["smiles"])
            if mol is not None:
                mols.append(mol)
                valid_compounds.append(c)

        if len(mols) < 3:
            return None

        # Find MCS as core scaffold
        mcs_result = rdFMCS.FindMCS(
            mols,
            ringMatchesRingOnly=True,
            completeRingsOnly=True,
            timeout=10,
        )

        if mcs_result is None or mcs_result.numAtoms < 5:
            return None

        # Check MCS covers reasonable fraction of molecules
        avg_heavy = np.mean([m.GetNumHeavyAtoms() for m in mols])
        if mcs_result.numAtoms < avg_heavy * 0.3:
            return None

        core = Chem.MolFromSmarts(mcs_result.smartsString)
        if core is None:
            return None

        # Perform R-group decomposition
        rg_params = rdRGroupDecomposition.RGroupDecompositionParameters()
        rg_params.removeAllHydrogenRGroups = True

        rg_decomp = rdRGroupDecomposition.RGroupDecomposition(core, rg_params)

        for mol in mols:
            rg_decomp.Add(mol)
        rg_decomp.Process()

        rg_results = rg_decomp.GetRGroupsAsRows()

        if not rg_results:
            return None

        # Collect R-group data
        r_group_positions = set()
        for row in rg_results:
            for key in row:
                if key.startswith("R") and key != "Core":
                    r_group_positions.add(key)

        r_groups_data = []
        for pos in sorted(r_group_positions):
            substituents = {}
            for idx, row in enumerate(rg_results):
                if pos not in row:
                    continue
                rg_mol = row[pos]
                rg_smi = Chem.MolToSmiles(rg_mol) if rg_mol else "[H]"
                if rg_smi not in substituents:
                    substituents[rg_smi] = {"smiles": rg_smi, "compounds": [], "activities": []}
                substituents[rg_smi]["compounds"].append(valid_compounds[idx]["name"])
                act = valid_compounds[idx].get("docking_score") or valid_compounds[idx].get("predicted_activity") or 0
                substituents[rg_smi]["activities"].append(float(act))

            sub_list = []
            for smi, data in substituents.items():
                sub_list.append({
                    "smiles": data["smiles"],
                    "compounds": data["compounds"],
                    "avg_activity": round(float(np.mean(data["activities"])), 3) if data["activities"] else 0,
                    "count": len(data["compounds"]),
                })
            sub_list.sort(key=lambda s: s["avg_activity"])
            r_groups_data.append({
                "position": pos,
                "substituents": sub_list,
            })

        core_smiles = mcs_result.smartsString
        try:
            core_mol = Chem.MolFromSmarts(core_smiles)
            if core_mol:
                core_smiles = Chem.MolToSmiles(core_mol) if Chem.MolToSmiles(core_mol) else mcs_result.smartsString
        except Exception:
            pass

        return {
            "core_smiles": core_smiles,
            "core_smarts": mcs_result.smartsString,
            "core_num_atoms": mcs_result.numAtoms,
            "decomposition_success_rate": round(len(rg_results) / len(mols), 2),
            "r_groups": r_groups_data,
        }

    except Exception as e:
        logger.error(f"R-group decomposition error: {e}")
        return None


# ---------------------------------------------------------------------------
# 4. Bioisosteric replacement suggestions
# ---------------------------------------------------------------------------
def _generate_bioisostere_suggestions(compounds: List[Dict[str, Any]], max_per_compound: int = 5) -> None:
    """Add bioisostere_suggestions to each compound dict in-place."""
    for c in compounds:
        mol = Chem.MolFromSmiles(c["smiles"])
        if mol is None:
            c["bioisostere_suggestions"] = []
            continue

        suggestions = []
        parent_qed = c.get("qed", 0)
        parent_sa = c.get("synthetic_accessibility", 5.0)

        for orig_name, repl_name, from_smarts, to_smarts in BIOISOSTERE_REPLACEMENTS:
            if len(suggestions) >= max_per_compound:
                break

            from_pat = Chem.MolFromSmarts(from_smarts)
            if from_pat is None or not mol.HasSubstructMatch(from_pat):
                continue

            try:
                to_pat = Chem.MolFromSmarts(to_smarts)
                if to_pat is None:
                    continue

                products = AllChem.ReplaceSubstructs(mol, from_pat, to_pat, replaceAll=False)
                if not products:
                    continue

                product = products[0]
                try:
                    Chem.SanitizeMol(product)
                    product_smi = Chem.MolToSmiles(product)
                except Exception:
                    continue

                # Validate product
                check_mol = Chem.MolFromSmiles(product_smi)
                if check_mol is None:
                    continue

                # Quick property check
                prod_profile = _quick_profile(product_smi)
                if prod_profile is None:
                    continue

                qed_change = round(prod_profile["qed"] - parent_qed, 4)
                sa_change = round(prod_profile["sa_score"] - parent_sa, 2)

                suggestions.append({
                    "original_group": orig_name,
                    "replacement_group": repl_name,
                    "product_smiles": product_smi,
                    "product_qed": prod_profile["qed"],
                    "product_sa": prod_profile["sa_score"],
                    "product_mw": prod_profile["molecular_weight"],
                    "predicted_qed_change": qed_change,
                    "predicted_sa_change": sa_change,
                    "lipinski_pass": prod_profile["lipinski_pass"],
                })

            except Exception:
                continue

        c["bioisostere_suggestions"] = suggestions


# ---------------------------------------------------------------------------
# 5. Analog generation
# ---------------------------------------------------------------------------
FRAGMENT_EXTENSIONS = [
    ("add_methyl", "[c:1]([H])", "[c:1]C"),
    ("add_hydroxyl", "[c:1]([H])", "[c:1]O"),
    ("add_amino", "[c:1]([H])", "[c:1]N"),
    ("add_fluoro", "[c:1]([H])", "[c:1]F"),
    ("add_cyano", "[c:1]([H])", "[c:1]C#N"),
]

def _generate_analogs(
    compounds: List[Dict[str, Any]],
    max_parents: int = 5,
    max_per_parent: int = 10,
    max_total: int = 30,
) -> List[Dict[str, Any]]:
    """Generate near-neighbor analogs for top compounds via fragment growing & bioisostere swaps."""
    # Pick parents: advance first, then optimize, sorted by predicted_activity
    parents = sorted(
        [c for c in compounds if c.get("classification") in ("advance", "optimize")],
        key=lambda c: -c.get("predicted_activity", 0),
    )[:max_parents]

    if not parents:
        parents = compounds[:max_parents]

    all_analogs = []
    seen_smiles = set(c["smiles"] for c in compounds)

    for parent in parents:
        mol = Chem.MolFromSmiles(parent["smiles"])
        if mol is None:
            continue

        parent_analogs = []

        # a) Fragment extensions
        for method_name, from_sma, to_sma in FRAGMENT_EXTENSIONS:
            if len(parent_analogs) >= max_per_parent:
                break
            from_pat = Chem.MolFromSmarts(from_sma)
            to_pat = Chem.MolFromSmarts(to_sma)
            if from_pat is None or to_pat is None:
                continue
            if not mol.HasSubstructMatch(from_pat):
                continue
            try:
                products = AllChem.ReplaceSubstructs(mol, from_pat, to_pat, replaceAll=False)
                if not products:
                    continue
                prod = products[0]
                Chem.SanitizeMol(prod)
                smi = Chem.MolToSmiles(prod)
                if smi in seen_smiles:
                    continue

                profile = _quick_profile(smi)
                if profile and profile["lipinski_pass"]:
                    seen_smiles.add(smi)
                    parent_analogs.append({
                        "parent_name": parent["name"],
                        "parent_smiles": parent["smiles"],
                        "analog_smiles": smi,
                        "method": method_name,
                        "qed": profile["qed"],
                        "sa_score": profile["sa_score"],
                        "molecular_weight": profile["molecular_weight"],
                        "lipinski_pass": profile["lipinski_pass"],
                        "predicted_improvement": _describe_improvement(parent, profile),
                    })
            except Exception:
                continue

        # b) Bioisostere-based analogs
        for orig, repl, from_sma, to_sma in BIOISOSTERE_REPLACEMENTS:
            if len(parent_analogs) >= max_per_parent:
                break
            from_pat = Chem.MolFromSmarts(from_sma)
            to_pat = Chem.MolFromSmarts(to_sma)
            if from_pat is None or to_pat is None or not mol.HasSubstructMatch(from_pat):
                continue
            try:
                products = AllChem.ReplaceSubstructs(mol, from_pat, to_pat, replaceAll=False)
                if not products:
                    continue
                prod = products[0]
                Chem.SanitizeMol(prod)
                smi = Chem.MolToSmiles(prod)
                if smi in seen_smiles:
                    continue
                profile = _quick_profile(smi)
                if profile and profile["lipinski_pass"]:
                    seen_smiles.add(smi)
                    parent_analogs.append({
                        "parent_name": parent["name"],
                        "parent_smiles": parent["smiles"],
                        "analog_smiles": smi,
                        "method": f"bioisostere_{orig}_to_{repl}",
                        "qed": profile["qed"],
                        "sa_score": profile["sa_score"],
                        "molecular_weight": profile["molecular_weight"],
                        "lipinski_pass": profile["lipinski_pass"],
                        "predicted_improvement": _describe_improvement(parent, profile),
                    })
            except Exception:
                continue

        all_analogs.extend(parent_analogs)
        if len(all_analogs) >= max_total:
            break

    return all_analogs[:max_total]


def _describe_improvement(parent: Dict[str, Any], analog_profile: Dict[str, Any]) -> str:
    """Generate a human-readable description of how the analog compares to parent."""
    parts = []
    qed_diff = analog_profile["qed"] - parent.get("qed", 0)
    sa_diff = analog_profile["sa_score"] - parent.get("synthetic_accessibility", 5.0)

    if qed_diff > 0.02:
        parts.append(f"Improved QED (+{qed_diff:.3f})")
    elif qed_diff < -0.02:
        parts.append(f"Reduced QED ({qed_diff:.3f})")

    if sa_diff < -0.3:
        parts.append(f"Easier synthesis (SA {sa_diff:+.1f})")
    elif sa_diff > 0.3:
        parts.append(f"Harder synthesis (SA {sa_diff:+.1f})")

    mw_diff = analog_profile["molecular_weight"] - parent.get("molecular_weight", 0)
    if abs(mw_diff) > 10:
        parts.append(f"MW {mw_diff:+.0f}")

    return "; ".join(parts) if parts else "Similar properties to parent"


# ---------------------------------------------------------------------------
# 6. Pharmacophore feature extraction
# ---------------------------------------------------------------------------
def _extract_pharmacophores(compounds: List[Dict[str, Any]], max_compounds: int = 5) -> Optional[Dict[str, Any]]:
    """Extract pharmacophore features from top compounds using 3D conformers."""
    if not PHARMACOPHORE_AVAILABLE:
        return None

    try:
        # Use advance compounds first
        targets = [c for c in compounds if c.get("classification") == "advance"]
        if len(targets) < 2:
            targets = sorted(compounds, key=lambda c: -c.get("predicted_activity", 0))[:max_compounds]
        else:
            targets = targets[:max_compounds]

        compound_pharmacophores = []

        for c in targets:
            mol = Chem.MolFromSmiles(c["smiles"])
            if mol is None:
                continue

            mol = Chem.AddHs(mol)
            # Generate 3D conformer
            result = AllChem.EmbedMolecule(mol, AllChem.ETKDG())
            if result == -1:
                result = AllChem.EmbedMolecule(mol, AllChem.ETKDGv3())
                if result == -1:
                    continue
            AllChem.MMFFOptimizeMolecule(mol, maxIters=200)

            features = _feat_factory.GetFeaturesForMol(mol)
            feature_list = []
            for feat in features:
                pos = feat.GetPos()
                feature_list.append({
                    "type": feat.GetType(),
                    "position": [round(pos.x, 2), round(pos.y, 2), round(pos.z, 2)],
                    "atom_indices": list(feat.GetAtomIds()),
                })

            compound_pharmacophores.append({
                "compound_name": c["name"],
                "features": feature_list,
                "n_features": len(feature_list),
            })

        if not compound_pharmacophores:
            return None

        # Build consensus pharmacophore (features within 2A of each other across >50% compounds)
        consensus_features = []
        if len(compound_pharmacophores) >= 2:
            # Collect all features by type
            type_features = {}
            for cp in compound_pharmacophores:
                for f in cp["features"]:
                    ft = f["type"]
                    if ft not in type_features:
                        type_features[ft] = []
                    type_features[ft].append((f["position"], cp["compound_name"]))

            threshold = len(compound_pharmacophores) * 0.5

            for feat_type, positions in type_features.items():
                # Cluster positions within 2A
                used = [False] * len(positions)
                for i in range(len(positions)):
                    if used[i]:
                        continue
                    cluster = [positions[i]]
                    compounds_in_cluster = {positions[i][1]}
                    used[i] = True
                    for j in range(i + 1, len(positions)):
                        if used[j]:
                            continue
                        dist = np.sqrt(sum((a - b) ** 2 for a, b in zip(positions[i][0], positions[j][0])))
                        if dist <= 2.0:
                            cluster.append(positions[j])
                            compounds_in_cluster.add(positions[j][1])
                            used[j] = True
                    if len(compounds_in_cluster) >= threshold:
                        avg_pos = [
                            round(float(np.mean([p[0][k] for p in cluster])), 2)
                            for k in range(3)
                        ]
                        consensus_features.append({
                            "type": feat_type,
                            "position": avg_pos,
                            "radius": 2.0,
                            "compounds_contributing": list(compounds_in_cluster),
                        })

        return {
            "pharmacophore_models": compound_pharmacophores,
            "consensus_pharmacophore": {
                "features": consensus_features,
                "compounds_used": len(compound_pharmacophores),
            } if consensus_features else None,
        }

    except Exception as e:
        logger.error(f"Pharmacophore extraction error: {e}")
        return None


# ===================================================================
# Main optimization engine
# ===================================================================
class LeadOptimizationEngine:
    """
    Evaluates a set of compounds from the MD/virtual-screening pipeline
    for drug-likeness, synthetic feasibility, and ADMET properties.
    v2 adds cross-compound SAR, Pareto ranking, analog generation,
    and pharmacophore extraction.
    """

    def optimize(
        self,
        compounds: List[Dict[str, Any]],
        max_compounds: int = 20,
        enable_mmp: bool = True,
        enable_rgroup: bool = True,
        enable_bioisosteres: bool = True,
        enable_pareto: bool = True,
        enable_analogs: bool = True,
        enable_pharmacophore: bool = True,
    ) -> Dict[str, Any]:
        start_time = time.time()

        compounds_to_process = compounds[:max_compounds]
        optimized_compounds = []
        failed_compounds = []

        # --- Phase 1: Per-compound profiling (same as v1) ---
        for compound in compounds_to_process:
            name = compound.get("name", "Unknown")
            smiles = compound.get("smiles", "")

            if not smiles:
                failed_compounds.append({"name": name, "error": "No SMILES string provided"})
                continue

            profile = compute_compound_profile(smiles, name)
            if profile is None:
                failed_compounds.append({"name": name, "smiles": smiles, "error": "Failed to parse SMILES"})
                continue

            docking_score = compound.get("docking_score") or compound.get("binding_affinity")
            stability_verdict = compound.get("stability_verdict", "unknown")
            interaction_energy = compound.get("interaction_energy")

            profile["docking_score"] = docking_score
            profile["stability_verdict"] = stability_verdict
            profile["interaction_energy"] = interaction_energy

            profile["classification"] = _classify_compound(profile, docking_score, stability_verdict)
            profile["suggestions"] = _generate_suggestions(profile)

            if docking_score is not None:
                dock_component = min(1.0, max(0.0, (-docking_score) / 12.0))
                profile["predicted_activity"] = round(0.5 * dock_component + 0.5 * profile["drug_likeness"], 4)
            else:
                profile["predicted_activity"] = profile["drug_likeness"]

            optimized_compounds.append(profile)

        # Sort: advance > optimize > deprioritize, then by predicted_activity desc
        classification_order = {"advance": 0, "optimize": 1, "deprioritize": 2}
        optimized_compounds.sort(
            key=lambda c: (classification_order.get(c["classification"], 3), -c["predicted_activity"])
        )
        for i, comp in enumerate(optimized_compounds):
            comp["rank"] = i + 1

        # --- Phase 2: Cross-compound analyses ---
        advanced_analyses = {}

        # Pareto ranking
        if enable_pareto and len(optimized_compounds) >= 2:
            try:
                pareto_summary = _compute_pareto_ranking(optimized_compounds)
                advanced_analyses["pareto_summary"] = pareto_summary
            except Exception as e:
                logger.error(f"Pareto ranking error: {e}")

        # Bioisosteric suggestions (modifies compounds in-place)
        if enable_bioisosteres:
            try:
                _generate_bioisostere_suggestions(optimized_compounds)
            except Exception as e:
                logger.error(f"Bioisostere suggestions error: {e}")

        # MMP analysis
        mmp_result = None
        if enable_mmp:
            try:
                mmp_result = _run_mmp_analysis(optimized_compounds)
                if mmp_result:
                    advanced_analyses["mmp_analysis"] = mmp_result
            except Exception as e:
                logger.error(f"MMP analysis error: {e}")

        # R-group decomposition
        rgroup_result = None
        if enable_rgroup:
            try:
                rgroup_result = _run_rgroup_decomposition(optimized_compounds)
                if rgroup_result:
                    advanced_analyses["rgroup_decomposition"] = rgroup_result
            except Exception as e:
                logger.error(f"R-group decomposition error: {e}")

        # Analog generation
        analogs = []
        if enable_analogs:
            try:
                analogs = _generate_analogs(optimized_compounds)
                if analogs:
                    advanced_analyses["analogs_generated"] = analogs
            except Exception as e:
                logger.error(f"Analog generation error: {e}")

        # Pharmacophore extraction
        pharmacophore_data = None
        if enable_pharmacophore:
            try:
                pharmacophore_data = _extract_pharmacophores(optimized_compounds)
                if pharmacophore_data:
                    advanced_analyses["pharmacophore_data"] = pharmacophore_data
            except Exception as e:
                logger.error(f"Pharmacophore extraction error: {e}")

        # --- Summary statistics ---
        total = len(optimized_compounds)
        advance_count = sum(1 for c in optimized_compounds if c["classification"] == "advance")
        optimize_count = sum(1 for c in optimized_compounds if c["classification"] == "optimize")
        deprioritize_count = sum(1 for c in optimized_compounds if c["classification"] == "deprioritize")
        avg_qed = float(np.mean([c["qed"] for c in optimized_compounds])) if total > 0 else 0
        avg_sa = float(np.mean([c["synthetic_accessibility"] for c in optimized_compounds])) if total > 0 else 0
        lipinski_pass_count = sum(1 for c in optimized_compounds if c["lipinski_pass"])
        pains_clean_count = sum(1 for c in optimized_compounds if c["pains_pass"])

        elapsed = time.time() - start_time

        result = {
            "status": "completed",
            "method": "rdkit_lead_optimization_v2",
            "compounds_analyzed": total,
            "compounds_failed": len(failed_compounds),
            "advance_count": advance_count,
            "optimize_count": optimize_count,
            "deprioritize_count": deprioritize_count,
            "lipinski_pass_count": lipinski_pass_count,
            "pains_clean_count": pains_clean_count,
            "average_qed": round(avg_qed, 4),
            "average_synthetic_accessibility": round(avg_sa, 2),
            "optimized_compounds": optimized_compounds,
            "failed_compounds": failed_compounds,
            "total_computation_time_seconds": round(elapsed, 2),
            "summary": {
                "advance": advance_count,
                "optimize": optimize_count,
                "deprioritize": deprioritize_count,
                "total": total,
                "recommendation": (
                    f"{advance_count} compound(s) ready to advance, "
                    f"{optimize_count} amenable to optimisation, "
                    f"{deprioritize_count} deprioritised."
                ),
            },
            # v2 additions
            "analogs_generated": analogs,
            "analogs_count": len(analogs),
        }

        # Merge advanced analyses into top-level result
        result.update(advanced_analyses)

        return result


# ---------------------------------------------------------------------------
# Module-level accessor
# ---------------------------------------------------------------------------
_engine = None

def get_lead_optimizer() -> LeadOptimizationEngine:
    global _engine
    if _engine is None:
        _engine = LeadOptimizationEngine()
    return _engine

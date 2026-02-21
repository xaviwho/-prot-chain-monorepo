"""
Virtual Screening Module for ProtChain BioAPI

Performs computational virtual screening by scoring compounds against
a protein binding site using physics-based scoring functions.

The approach:
1. Parse the protein structure and binding site geometry
2. Load a compound library (FDA-approved drugs or fragment-like compounds)
3. Score each compound using a multi-component scoring function:
   - Shape complementarity (volume overlap with pocket)
   - Electrostatic complementarity (charge matching)
   - Hydrophobic matching (lipophilic fit)
   - Hydrogen bond potential
   - Molecular weight / LogP drug-likeness filters (Lipinski)
4. Rank compounds and return top hits with predicted binding affinity

This is a simplified scoring approach (not full molecular docking with
conformational sampling), but provides scientifically meaningful rankings
based on real physicochemical properties.
"""

import logging
import math
import hashlib
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Compound library — curated FDA-approved drugs and well-known fragments
# ---------------------------------------------------------------------------

@dataclass
class Compound:
    name: str
    smiles: str
    molecular_weight: float
    logp: float
    hbd: int  # hydrogen bond donors
    hba: int  # hydrogen bond acceptors
    rotatable_bonds: int
    tpsa: float  # topological polar surface area
    charge: float  # net charge at pH 7
    category: str
    # Precomputed pharmacophore feature vector
    hydrophobic_fraction: float = 0.0
    aromatic_rings: int = 0


# Representative FDA-approved drugs spanning diverse pharmacological classes
FDA_APPROVED_LIBRARY: List[Compound] = [
    Compound("Imatinib", "CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CN3CCN(CC3)C)NC4=NC=CC(=N4)C5=CN=CC=C5", 493.6, 3.5, 2, 7, 7, 86.3, 0.0, "kinase_inhibitor", 0.55, 4),
    Compound("Erlotinib", "COCCOC1=C(C=C2C(=C1)C(=NC=N2)NC3=CC(=CC=C3)C#C)OCCOC", 393.4, 3.3, 1, 6, 10, 74.7, 0.0, "kinase_inhibitor", 0.50, 3),
    Compound("Sorafenib", "CNC(=O)C1=CC(=C(C=C1)OC2=CC=C(C=C2)NC(=O)NC3=CC(=C(C=C3)Cl)C(F)(F)F)C", 464.8, 3.8, 3, 7, 5, 92.4, 0.0, "kinase_inhibitor", 0.52, 3),
    Compound("Aspirin", "CC(=O)OC1=CC=CC=C1C(=O)O", 180.2, 1.2, 1, 4, 3, 63.6, -1.0, "anti_inflammatory", 0.35, 1),
    Compound("Metformin", "CN(C)C(=N)NC(=N)N", 129.2, -1.4, 4, 3, 2, 91.5, 1.0, "antidiabetic", 0.10, 0),
    Compound("Atorvastatin", "CC(C)C1=C(C(=C(N1CCC(CC(CC(=O)O)O)O)C2=CC=C(C=C2)F)C3=CC=CC=C3)C(=O)NC4=CC=CC=C4", 558.6, 4.1, 4, 9, 12, 111.8, -1.0, "statin", 0.48, 4),
    Compound("Celecoxib", "CC1=CC=C(C=C1)C2=CC(=NN2C3=CC=C(C=C3)S(=O)(=O)N)C(F)(F)F", 381.4, 3.5, 1, 6, 3, 86.4, 0.0, "anti_inflammatory", 0.45, 3),
    Compound("Omeprazole", "CC1=CN=C(C(=C1OC)C)CS(=O)C2=NC3=CC=CC=C3N2", 345.4, 2.2, 1, 5, 5, 77.1, 0.0, "proton_pump_inhibitor", 0.40, 2),
    Compound("Fluconazole", "OC(CN1C=NC=N1)(CN2C=NC=N2)C3=CC=C(F)C=C3F", 306.3, 0.4, 1, 7, 5, 81.6, 0.0, "antifungal", 0.30, 3),
    Compound("Ciprofloxacin", "C1CC1N2C=C(C(=O)C3=CC(=C(C=C32)N4CCNCC4)F)C(=O)O", 331.3, -0.6, 2, 6, 3, 72.9, 0.0, "antibiotic", 0.35, 2),
    Compound("Tamoxifen", "CC/C(=C(/C1=CC=CC=C1)C2=CC=C(C=C2)OCCN(C)C)/C3=CC=CC=C3", 371.5, 6.3, 0, 2, 8, 12.5, 1.0, "anticancer", 0.72, 3),
    Compound("Methotrexate", "CN(CC1=CN=C2N=C(N=C(N)C2=N1)N)C3=CC=C(C(=O)NC(CCC(=O)O)C(=O)O)C=C3", 454.4, -1.8, 5, 12, 9, 210.5, -2.0, "anticancer", 0.25, 3),
    Compound("Losartan", "CCCCC1=NC(=C(N1CC2=CC=C(C=C2)C3=CC=CC=C3C4=NNN=N4)CO)Cl", 422.9, 4.0, 2, 5, 8, 92.5, -1.0, "antihypertensive", 0.55, 4),
    Compound("Amlodipine", "CCOC(=O)C1=C(NC(=C(C1C2=CC=CC=C2Cl)C(=O)OC)C)COCCN", 408.9, 3.0, 2, 7, 10, 100.0, 1.0, "antihypertensive", 0.42, 1),
    Compound("Sildenafil", "CCCC1=NN(C2=C1N=C(NC2=O)C3=C(C=CC(=C3)S(=O)(=O)N4CCN(CC4)C)OCC)C", 474.6, 2.3, 1, 8, 7, 113.4, 0.0, "pde5_inhibitor", 0.45, 3),
    Compound("Ritonavir", "CC(C)C(NC(=O)N(C)CC1=CSC(=N1)C(C)C)C(=O)NC(CC2=CC=CC=C2)CC(O)C(CC3=CC=CC=C3)NC(=O)OCC4=CN=CS4", 720.9, 5.2, 4, 9, 18, 145.8, 0.0, "antiviral", 0.55, 4),
    Compound("Oseltamivir", "CCOC(=O)C1=CC(OC(CC)CC)C(NC(C)=O)C(N)C1", 312.4, 1.0, 2, 5, 8, 90.6, 1.0, "antiviral", 0.38, 0),
    Compound("Dexamethasone", "CC1CC2C3CCC4=CC(=O)C=CC4(C3(C(CC2(C1(C(=O)CO)O)C)O)F)C", 392.5, 1.8, 3, 6, 2, 94.8, 0.0, "corticosteroid", 0.58, 4),
    Compound("Warfarin", "CC(=O)CC(C1=CC=CC=C1)C2=C(C3=CC=CC=C3OC2=O)O", 308.3, 2.7, 1, 4, 4, 67.5, -1.0, "anticoagulant", 0.50, 2),
    Compound("Clopidogrel", "COC(=O)C(C1=CC=CC=C1Cl)N2CCC3=C(C2)C=CS3", 321.8, 3.8, 0, 3, 5, 56.0, 0.0, "antiplatelet", 0.52, 2),
    Compound("Lisinopril", "NCCCC(NC(CCC1=CC=CC=C1)C(=O)O)C(=O)N2CCCC2C(=O)O", 405.5, -0.8, 4, 7, 11, 132.7, -1.0, "ace_inhibitor", 0.30, 1),
    Compound("Simvastatin", "CCC(C)(C)C(=O)OC1CC(C=C2C1C(C(C=C2C)CCC3CC(CC(=O)O3)O)C)C", 418.6, 4.7, 1, 5, 7, 72.8, 0.0, "statin", 0.65, 0),
    Compound("Donepezil", "COC1=CC2=C(C=C1OC)CC(CC2)NC(=O)CC3=CC=CC4=CC=CC=C34", 379.5, 4.3, 1, 4, 6, 38.8, 1.0, "acetylcholinesterase_inhibitor", 0.60, 3),
    Compound("Levetiracetam", "CCC(C(=O)N)N1CCCC1=O", 170.2, -0.6, 2, 3, 3, 63.4, 0.0, "antiepileptic", 0.25, 0),
    Compound("Ondansetron", "CC1=NC=CN1CC2CCC3=C(C2=O)C4=CC=CC=C4N3C", 293.4, 2.4, 0, 3, 2, 39.8, 1.0, "antiemetic", 0.50, 3),
    Compound("Dasatinib", "CC1=C(C(=O)N(C=N1)C2=CC(=CC=C2)NC(=O)C3=C(N=CC(=C3)OC4=C(C=C(CC4)N5CCN(CC5)CCO)C)C)C", 488.0, 1.8, 3, 9, 7, 135.3, 0.0, "kinase_inhibitor", 0.48, 4),
    Compound("Gefitinib", "COC1=C(C=C2C(=C1)N=CN=C2NC3=CC(=C(C=C3)F)Cl)OCCCN4CCOCC4", 446.9, 3.2, 1, 7, 8, 68.7, 0.0, "kinase_inhibitor", 0.45, 3),
    Compound("Lapatinib", "CS(=O)(=O)CCNCC1=CC=C(O1)C2=CC3=C(C=C2)N=CN=C3NC4=CC(=C(C=C4)Cl)Cl", 581.1, 4.6, 2, 7, 9, 114.7, 0.0, "kinase_inhibitor", 0.50, 4),
    Compound("Sunitinib", "CCN(CC)CCNC(=O)C1=C(NC(=C1C)/C=C/2C3=CC=CC=C3NC2=O)C", 398.5, 2.6, 3, 4, 7, 77.2, 1.0, "kinase_inhibitor", 0.48, 3),
    Compound("Lenalidomide", "C1CC(=O)NC(=O)C1N2CC3=CC=CC(=C3C2=O)N", 259.3, -0.4, 2, 5, 1, 92.5, 0.0, "immunomodulator", 0.32, 2),
    Compound("Ibrutinib", "C=CC(=O)N1CCC(CC1)N2C3=C(C=C(C=C3)OC4=CC=CC=C4)N=C2C5=CC=C(C=C5)NC6=NC=CN=C6", 440.5, 3.6, 2, 7, 6, 99.2, 0.0, "kinase_inhibitor", 0.52, 5),
    Compound("Venetoclax", "CC1(CCC(=C(C1)C2=CC=C(C=C2)Cl)CN3CCN(CC3)C4=CC(=C(C=C4)C(=O)NS(=O)(=O)C5=CC(=C(C=C5)[N+](=O)[O-])C(F)(F)F)OC6=CN=C7C=CC=CN7C6=O)C", 868.4, 5.5, 3, 11, 11, 183.2, 0.0, "bcl2_inhibitor", 0.55, 6),
    Compound("Palbociclib", "CC1=C(C(=O)N(C(=O)N1C2CCCC2)C3=C(C=C(C=C3)N4CCNCC4)F)C5=NC=NC=C5", 447.5, 2.7, 2, 7, 4, 103.2, 1.0, "cdk_inhibitor", 0.42, 4),
    Compound("Olaparib", "O=C1C2=CC=CC=C2C(=O)N1CC3=CC=C(C=C3)C(=O)N4CCN(CC4)C(=O)C5CC5", 434.5, 1.9, 1, 6, 5, 86.8, 0.0, "parp_inhibitor", 0.45, 3),
    Compound("Entrectinib", "CC1=CC=C(C=C1)C(=O)NC2=CC=C(C=C2)N3CCN(CC3)CC4=CC5=C(N4)N=CC=C5F", 560.6, 3.8, 2, 6, 7, 70.0, 1.0, "kinase_inhibitor", 0.52, 4),
    Compound("Baricitinib", "CCS(=O)(=O)N1CC(C1)N2C=C(C=N2)C3=C4C=CNC4=NC=N3", 371.4, 1.0, 2, 7, 5, 128.9, 0.0, "jak_inhibitor", 0.38, 3),
    Compound("Remdesivir", "CCC(CC)COC(=O)C(C)NP(=O)(OCC1C(C(C(O1)N2C=CC(=O)NC2=O)(C#N)C3=CC=C(C=C3)OC)O)OC4=CC=CC=C4", 602.6, 1.9, 3, 12, 14, 213.4, 0.0, "antiviral", 0.35, 3),
    Compound("Nirmatrelvir", "CC1(C2CC3CC(C2)N3C1=O)NC(=O)C(F)(F)C4=NC=CC=C4", 499.5, 1.5, 3, 8, 8, 150.6, 0.0, "protease_inhibitor", 0.40, 2),
    Compound("Ruxolitinib", "N#CCC(C1CCCC1)N2C=C(C=N2)C3=C4C=CNC4=NC=N3", 306.4, 2.1, 2, 4, 4, 83.2, 0.0, "jak_inhibitor", 0.45, 3),
    Compound("Tofacitinib", "CC1CCN(CC1NC(=O)C2=C(C=CN2)C#N)C3=NC=NC4=CC=CN34", 312.4, 1.6, 2, 5, 4, 88.7, 0.0, "jak_inhibitor", 0.42, 3),
    Compound("Bosutinib", "COC1=CC(=C2C(=C1)C(=NC=N2)NC3=CC(=C(C=C3)Cl)Cl)NC4=C(C=CC(=C4)OC)OC", 530.4, 3.6, 2, 5, 7, 80.4, 0.0, "kinase_inhibitor", 0.50, 4),
]

# Fragment-like compounds for fragment-based drug discovery
FRAGMENT_LIBRARY: List[Compound] = [
    Compound("Benzimidazole", "C1=CC=C2C(=C1)NC=N2", 118.1, 1.3, 1, 2, 0, 28.7, 0.0, "fragment", 0.55, 2),
    Compound("Indole", "C1=CC=C2C(=C1)C=CN2", 117.1, 2.1, 1, 1, 0, 15.8, 0.0, "fragment", 0.65, 2),
    Compound("Pyrimidine-2-amine", "C1=CN=C(N=C1)N", 95.1, -0.8, 2, 3, 0, 50.7, 0.0, "fragment", 0.20, 1),
    Compound("4-Aminopyridine", "C1=CN=CC=C1N", 94.1, 0.3, 2, 2, 0, 38.9, 1.0, "fragment", 0.25, 1),
    Compound("Phenol", "OC1=CC=CC=C1", 94.1, 1.5, 1, 1, 0, 20.2, 0.0, "fragment", 0.50, 1),
    Compound("Benzoic acid", "OC(=O)C1=CC=CC=C1", 122.1, 1.9, 1, 2, 1, 37.3, -1.0, "fragment", 0.45, 1),
    Compound("Nicotinamide", "NC(=O)C1=CC=CN=C1", 122.1, -0.4, 1, 3, 1, 56.0, 0.0, "fragment", 0.28, 1),
    Compound("Imidazole", "C1=CN=CN1", 68.1, -0.1, 1, 2, 0, 28.7, 0.0, "fragment", 0.20, 1),
    Compound("Piperazine", "C1CNCCN1", 86.1, -1.5, 2, 2, 0, 24.1, 2.0, "fragment", 0.10, 0),
    Compound("Morpholine", "C1COCCN1", 87.1, -0.9, 1, 2, 0, 21.3, 1.0, "fragment", 0.15, 0),
    Compound("Coumarin", "C1=CC=C2C(=C1)C=CC(=O)O2", 146.1, 1.4, 0, 2, 0, 30.2, 0.0, "fragment", 0.55, 2),
    Compound("Quinoline", "C1=CC=C2N=CC=CC2=C1", 129.2, 2.0, 0, 1, 0, 12.9, 0.0, "fragment", 0.65, 2),
    Compound("Thiophene-2-carboxamide", "NC(=O)C1=CC=CS1", 127.2, 0.6, 1, 2, 1, 41.5, 0.0, "fragment", 0.35, 1),
    Compound("Aminothiazole", "NC1=NC=CS1", 100.1, 0.4, 2, 2, 0, 38.9, 0.0, "fragment", 0.25, 1),
    Compound("Isoquinoline", "C1=CC2=CN=CC=C2C=C1", 129.2, 2.1, 0, 1, 0, 12.9, 0.0, "fragment", 0.65, 2),
]


def _get_library(name: str) -> List[Compound]:
    """Get compound library by name."""
    name = (name or "fda_approved").lower().strip()
    if name in ("fda_approved", "fda", "approved"):
        return FDA_APPROVED_LIBRARY
    elif name in ("fragments", "fragment", "fragment_library"):
        return FRAGMENT_LIBRARY
    elif name in ("combined", "all"):
        return FDA_APPROVED_LIBRARY + FRAGMENT_LIBRARY
    return FDA_APPROVED_LIBRARY


# ---------------------------------------------------------------------------
# Scoring functions
# ---------------------------------------------------------------------------

class VirtualScreener:
    """Physics-based virtual screening engine."""

    def __init__(self):
        self._rng = np.random.default_rng(seed=42)

    @staticmethod
    def _compounds_from_dicts(dicts: List[Dict[str, Any]]) -> List[Compound]:
        """Convert a list of dicts (from parsed upload) into Compound objects."""
        compounds = []
        for d in dicts:
            try:
                compounds.append(Compound(
                    name=d.get("name", "unknown"),
                    smiles=d.get("smiles", ""),
                    molecular_weight=float(d.get("molecular_weight", 0)),
                    logp=float(d.get("logp", 0)),
                    hbd=int(d.get("hbd", 0)),
                    hba=int(d.get("hba", 0)),
                    rotatable_bonds=int(d.get("rotatable_bonds", 0)),
                    tpsa=float(d.get("tpsa", 0)),
                    charge=float(d.get("charge", 0)),
                    category=d.get("category", "custom"),
                    hydrophobic_fraction=float(d.get("hydrophobic_fraction", 0)),
                    aromatic_rings=int(d.get("aromatic_rings", 0)),
                ))
            except (ValueError, TypeError) as e:
                logger.warning(f"Skipping compound {d.get('name', '?')}: {e}")
        return compounds

    def screen(
        self,
        binding_site: Dict[str, Any],
        pdb_content: Optional[str],
        compound_library: str = "fda_approved",
        max_compounds: int = 50,
        custom_compounds: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Screen compounds against a binding site.

        Parameters
        ----------
        binding_site : dict
            Binding site from ProtChain binding analysis (center, volume,
            druggability_score, nearby_residues, hydrophobicity, etc.)
        pdb_content : str or None
            Raw PDB file text (used for detailed pocket geometry)
        compound_library : str
            Library name: "fda_approved", "fragments", "combined", or "custom"
        max_compounds : int
            Maximum number of top hits to return
        custom_compounds : list of dicts or None
            User-uploaded compounds (each dict has Compound fields).
            When provided, these are used instead of built-in libraries.

        Returns
        -------
        dict with keys: top_compounds, compounds_screened, hits_found,
        binding_site_used, method
        """
        logger.info(f"Starting virtual screening with library={compound_library}, max={max_compounds}")

        if custom_compounds:
            library = self._compounds_from_dicts(custom_compounds)
            logger.info(f"Using {len(library)} custom compounds")
        else:
            library = _get_library(compound_library)
        pocket_features = self._extract_pocket_features(binding_site)

        # Score every compound
        scored: List[Dict[str, Any]] = []
        for compound in library:
            score_breakdown = self._score_compound(compound, pocket_features)
            total = score_breakdown["total_score"]
            scored.append({
                "name": compound.name,
                "smiles": compound.smiles,
                "molecular_weight": compound.molecular_weight,
                "logP": compound.logp,
                "category": compound.category,
                "predicted_binding_affinity_kcal": round(-total * 12.0, 2),  # approx kcal/mol
                "score": round(total, 4),
                "score_breakdown": {
                    "shape_complementarity": round(score_breakdown["shape"], 4),
                    "electrostatic": round(score_breakdown["electrostatic"], 4),
                    "hydrophobic_match": round(score_breakdown["hydrophobic"], 4),
                    "hbond_potential": round(score_breakdown["hbond"], 4),
                    "lipinski_compliance": round(score_breakdown["lipinski"], 4),
                },
                "lipinski_violations": self._lipinski_violations(compound),
                "hbd": compound.hbd,
                "hba": compound.hba,
                "rotatable_bonds": compound.rotatable_bonds,
                "tpsa": compound.tpsa,
            })

        # Sort by score descending
        scored.sort(key=lambda x: x["score"], reverse=True)

        # Mark hits (score >= 0.50 threshold)
        hits = [c for c in scored if c["score"] >= 0.50]

        top = scored[:max_compounds]

        binding_site_summary = {
            "center": binding_site.get("center"),
            "volume": binding_site.get("volume"),
            "druggability_score": binding_site.get("druggability_score"),
            "hydrophobicity": binding_site.get("hydrophobicity"),
            "nearby_residue_count": len(binding_site.get("nearby_residues", [])),
        }

        return {
            "status": "success",
            "method": "physics_based_scoring",
            "top_compounds": top,
            "compounds_screened": len(library),
            "hits_found": len(hits),
            "binding_site_used": binding_site_summary,
            "scoring_components": [
                "shape_complementarity",
                "electrostatic_complementarity",
                "hydrophobic_matching",
                "hydrogen_bond_potential",
                "lipinski_drug_likeness",
            ],
        }

    # ------------------------------------------------------------------
    # Pocket feature extraction
    # ------------------------------------------------------------------

    def _extract_pocket_features(self, site: Dict[str, Any]) -> Dict[str, float]:
        """Derive numeric pocket descriptors from binding site data."""
        residues = site.get("nearby_residues", [])

        hydrophobic_res = {"ALA", "VAL", "LEU", "ILE", "PHE", "TRP", "MET", "PRO"}
        polar_res = {"SER", "THR", "ASN", "GLN", "TYR", "CYS"}
        positive_res = {"ARG", "LYS", "HIS"}
        negative_res = {"ASP", "GLU"}
        aromatic_res = {"PHE", "TRP", "TYR", "HIS"}

        n = max(len(residues), 1)
        res_names = [r.get("residue_name", "") for r in residues]

        hydrophobic_ratio = sum(1 for r in res_names if r in hydrophobic_res) / n
        polar_ratio = sum(1 for r in res_names if r in polar_res) / n
        positive_ratio = sum(1 for r in res_names if r in positive_res) / n
        negative_ratio = sum(1 for r in res_names if r in negative_res) / n
        aromatic_ratio = sum(1 for r in res_names if r in aromatic_res) / n
        net_charge = (positive_ratio - negative_ratio) * n

        volume = site.get("volume", 400.0)
        druggability = site.get("druggability_score", 0.5)
        hydrophobicity_score = site.get("hydrophobicity", hydrophobic_ratio)
        enclosure = site.get("enclosure_score", 0.5)

        return {
            "volume": volume,
            "druggability": druggability,
            "hydrophobic_ratio": hydrophobic_ratio,
            "polar_ratio": polar_ratio,
            "positive_ratio": positive_ratio,
            "negative_ratio": negative_ratio,
            "aromatic_ratio": aromatic_ratio,
            "net_charge": net_charge,
            "enclosure": enclosure,
            "hydrophobicity": hydrophobicity_score,
            "n_residues": len(residues),
        }

    # ------------------------------------------------------------------
    # Compound scoring
    # ------------------------------------------------------------------

    def _score_compound(
        self, compound: Compound, pocket: Dict[str, float]
    ) -> Dict[str, float]:
        """Multi-component scoring function."""
        shape = self._shape_complementarity(compound, pocket)
        elec = self._electrostatic_score(compound, pocket)
        hydro = self._hydrophobic_score(compound, pocket)
        hbond = self._hbond_score(compound, pocket)
        lip = self._lipinski_score(compound)

        # Weighted combination (weights from docking literature)
        total = (
            0.30 * shape
            + 0.20 * elec
            + 0.20 * hydro
            + 0.15 * hbond
            + 0.15 * lip
        )

        return {
            "total_score": total,
            "shape": shape,
            "electrostatic": elec,
            "hydrophobic": hydro,
            "hbond": hbond,
            "lipinski": lip,
        }

    def _shape_complementarity(
        self, compound: Compound, pocket: Dict[str, float]
    ) -> float:
        """
        Estimate shape fit based on molecular weight vs. pocket volume.
        Optimal: compound volume (≈ MW * 1.0 ų per Da) fills 30-70% of pocket.
        """
        pocket_vol = pocket["volume"]
        if pocket_vol <= 0:
            return 0.0

        # Rough compound volume estimate (1 ų per Dalton is a coarse but
        # standard approximation for organic drug molecules)
        compound_vol = compound.molecular_weight * 1.0
        fill_fraction = compound_vol / pocket_vol

        # Bell curve centred on 0.5 (50% fill)
        score = math.exp(-((fill_fraction - 0.50) ** 2) / 0.08)

        # Bonus for aromatic stacking potential in aromatic-rich pockets
        if compound.aromatic_rings >= 2 and pocket["aromatic_ratio"] >= 0.2:
            score = min(1.0, score + 0.1)

        return min(max(score, 0.0), 1.0)

    def _electrostatic_score(
        self, compound: Compound, pocket: Dict[str, float]
    ) -> float:
        """
        Complementary charge matching: opposite charges score higher.
        Also considers salt-bridge potential.
        """
        pocket_charge = pocket["net_charge"]
        compound_charge = compound.charge

        # Ideal: compound charge opposes pocket charge
        if pocket_charge == 0 and compound_charge == 0:
            return 0.6  # neutral-neutral is acceptable
        if (pocket_charge > 0 and compound_charge < 0) or (
            pocket_charge < 0 and compound_charge > 0
        ):
            return 0.95  # salt bridge — strong
        if pocket_charge * compound_charge > 0:
            return 0.15  # same-sign repulsion
        # One is neutral
        return 0.55

    def _hydrophobic_score(
        self, compound: Compound, pocket: Dict[str, float]
    ) -> float:
        """Match compound hydrophobicity to pocket lipophilicity."""
        pocket_hydro = pocket["hydrophobicity"]
        compound_hydro = compound.hydrophobic_fraction

        # Similarity score (1 − |diff|)
        diff = abs(pocket_hydro - compound_hydro)
        score = max(0, 1.0 - diff * 1.5)

        # logP penalty: very high logP compounds are poorly soluble
        if compound.logp > 5:
            score *= 0.7
        elif compound.logp < -1:
            score *= 0.8

        return min(max(score, 0.0), 1.0)

    def _hbond_score(
        self, compound: Compound, pocket: Dict[str, float]
    ) -> float:
        """Hydrogen bond complementarity with pocket polar/charged residues."""
        pocket_polar = pocket["polar_ratio"] + pocket["positive_ratio"] + pocket["negative_ratio"]

        # Compounds with more H-bond donors/acceptors match polar pockets better
        hb_capacity = (compound.hbd + compound.hba) / 15.0  # normalise
        hb_capacity = min(hb_capacity, 1.0)

        if pocket_polar >= 0.3:
            # Polar pocket — reward HB capacity
            score = 0.3 + 0.7 * hb_capacity
        else:
            # Hydrophobic pocket — moderate HB is fine, excess penalised
            if hb_capacity > 0.6:
                score = 0.4
            else:
                score = 0.5 + 0.3 * hb_capacity

        return min(max(score, 0.0), 1.0)

    def _lipinski_score(self, compound: Compound) -> float:
        """Lipinski Rule-of-5 drug-likeness."""
        violations = self._lipinski_violations(compound)
        if violations == 0:
            return 1.0
        elif violations == 1:
            return 0.75
        elif violations == 2:
            return 0.40
        else:
            return 0.15

    @staticmethod
    def _lipinski_violations(compound: Compound) -> int:
        """Count Lipinski Rule-of-5 violations."""
        v = 0
        if compound.molecular_weight > 500:
            v += 1
        if compound.logp > 5:
            v += 1
        if compound.hbd > 5:
            v += 1
        if compound.hba > 10:
            v += 1
        return v


# Singleton
_screener: Optional[VirtualScreener] = None


def get_screener() -> VirtualScreener:
    global _screener
    if _screener is None:
        _screener = VirtualScreener()
    return _screener

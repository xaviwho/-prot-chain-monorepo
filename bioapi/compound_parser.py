"""
Compound Parser Module for ProtChain BioAPI

Parses user-uploaded CSV or SDF compound files and computes molecular
descriptors from SMILES strings using RDKit.
"""

import csv
import io
import logging
import tempfile
import os
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

MAX_COMPOUNDS = 10000

# Common column-name aliases → canonical name
_NAME_ALIASES = {
    "name", "mol_name", "molecule_name", "compound_name", "compound",
    "mol", "drug_name", "drug", "ligand_name", "ligand", "title",
    "iupac_name", "common_name", "id", "mol_id", "molecule_id",
    "compound_id",
}
_SMILES_ALIASES = {
    "smiles", "canonical_smiles", "isomeric_smiles", "smi",
    "canonical_smi", "molecule_smiles", "mol_smiles", "structure",
}


def _import_rdkit():
    """Lazy-import RDKit so module loads even if rdkit is missing."""
    from rdkit import Chem
    from rdkit.Chem import Descriptors, rdMolDescriptors
    return Chem, Descriptors, rdMolDescriptors


def compute_descriptors(smiles: str) -> Dict[str, Any]:
    """
    Compute molecular descriptors from a SMILES string using RDKit.

    Returns a dict with:
        molecular_weight, logp, hbd, hba, rotatable_bonds, tpsa,
        charge, hydrophobic_fraction, aromatic_rings
    """
    Chem, Descriptors, rdMolDescriptors = _import_rdkit()

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")

    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    rot = Descriptors.NumRotatableBonds(mol)
    tpsa = Descriptors.TPSA(mol)
    charge = float(Chem.GetFormalCharge(mol))
    aromatic_rings = Descriptors.NumAromaticRings(mol)

    # Approximate hydrophobic fraction:
    # ratio of carbon + sulfur atoms to total heavy atoms
    heavy = mol.GetNumHeavyAtoms()
    if heavy > 0:
        c_s = sum(
            1 for atom in mol.GetAtoms()
            if atom.GetAtomicNum() in (6, 16)  # C, S
        )
        hydrophobic_fraction = round(c_s / heavy, 3)
    else:
        hydrophobic_fraction = 0.0

    # Lipinski Rule-of-5 violations
    lipinski = 0
    if mw > 500: lipinski += 1
    if logp > 5: lipinski += 1
    if hbd > 5: lipinski += 1
    if hba > 10: lipinski += 1

    return {
        "molecular_weight": round(mw, 2),
        "logp": round(logp, 2),
        "hbd": int(hbd),
        "hba": int(hba),
        "rotatable_bonds": int(rot),
        "tpsa": round(tpsa, 2),
        "charge": charge,
        "hydrophobic_fraction": hydrophobic_fraction,
        "aromatic_rings": int(aromatic_rings),
        "lipinski_violations": lipinski,
    }


def parse_csv(file_content: str) -> Dict[str, Any]:
    """
    Parse a CSV file of compounds.

    Required columns: ``name``, ``smiles``
    Optional columns: ``molecular_weight``, ``logp``, ``hbd``, ``hba``,
        ``rotatable_bonds``, ``tpsa``, ``charge``, ``category``,
        ``hydrophobic_fraction``, ``aromatic_rings``

    Missing descriptor columns are computed from SMILES via RDKit.

    Returns ``{ "compounds": [...], "warnings": [...], "count": int }``
    """
    compounds: List[Dict[str, Any]] = []
    warnings: List[str] = []

    # Auto-detect delimiter (tab vs comma vs semicolon)
    try:
        sample = file_content[:4096]
        dialect = csv.Sniffer().sniff(sample, delimiters=',\t;|')
        delimiter = dialect.delimiter
    except csv.Error:
        # Fallback: if first line has tabs, use tab; otherwise comma
        first_line = file_content.split('\n', 1)[0]
        delimiter = '\t' if '\t' in first_line else ','

    reader = csv.DictReader(io.StringIO(file_content), delimiter=delimiter)
    headers = [h.strip().lower() for h in (reader.fieldnames or [])]

    # Flexible column matching: find which header maps to 'name' and 'smiles'
    name_col = None
    smiles_col = None
    for h in headers:
        if h in _NAME_ALIASES and name_col is None:
            name_col = h
        if h in _SMILES_ALIASES and smiles_col is None:
            smiles_col = h

    if smiles_col is None:
        return {
            "compounds": [],
            "warnings": [
                f"CSV must have a SMILES column. Accepted names: {', '.join(sorted(_SMILES_ALIASES))}. "
                f"Found columns: {', '.join(headers)}"
            ],
            "count": 0,
        }

    if name_col is None:
        # No name column — we'll auto-generate names
        warnings.append("No name column found; compounds will be auto-numbered")

    for idx, row in enumerate(reader):
        if len(compounds) >= MAX_COMPOUNDS:
            warnings.append(
                f"Stopped at {MAX_COMPOUNDS} compounds (limit reached)"
            )
            break

        # Normalise keys
        row = {k.strip().lower(): v.strip() for k, v in row.items()}
        name = row.get(name_col, "").strip() if name_col else ""
        smiles = row.get(smiles_col, "").strip()

        if not smiles:
            warnings.append(f"Row {idx + 2}: missing SMILES, skipped")
            continue

        if not name:
            name = f"compound_{idx + 1}"

        # Compute descriptors from SMILES (or use provided values)
        try:
            desc = compute_descriptors(smiles)
        except Exception as e:
            warnings.append(f"Row {idx + 2} ({name}): invalid SMILES — {e}")
            continue

        # Build compound dict — prefer user-supplied values over computed
        compound = {
            "name": name,
            "smiles": smiles,
            "molecular_weight": _float_or(row.get("molecular_weight"), desc["molecular_weight"]),
            "logp": _float_or(row.get("logp"), desc["logp"]),
            "hbd": _int_or(row.get("hbd"), desc["hbd"]),
            "hba": _int_or(row.get("hba"), desc["hba"]),
            "rotatable_bonds": _int_or(row.get("rotatable_bonds"), desc["rotatable_bonds"]),
            "tpsa": _float_or(row.get("tpsa"), desc["tpsa"]),
            "charge": _float_or(row.get("charge"), desc["charge"]),
            "category": row.get("category", "custom").strip() or "custom",
            "hydrophobic_fraction": _float_or(row.get("hydrophobic_fraction"), desc["hydrophobic_fraction"]),
            "aromatic_rings": _int_or(row.get("aromatic_rings"), desc["aromatic_rings"]),
            "lipinski_violations": _int_or(row.get("lipinski_violations"), desc["lipinski_violations"]),
        }
        compounds.append(compound)

    return {"compounds": compounds, "warnings": warnings, "count": len(compounds)}


def parse_sdf(file_content: bytes) -> Dict[str, Any]:
    """
    Parse an SDF (Structure-Data File) using RDKit.

    Extracts molecule names from the title line or ``_Name`` property.
    Computes all descriptors from the molecular graph.

    Returns ``{ "compounds": [...], "warnings": [...], "count": int }``
    """
    Chem, _, _ = _import_rdkit()

    compounds: List[Dict[str, Any]] = []
    warnings: List[str] = []

    # Write bytes to a temp file for SDMolSupplier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".sdf", mode="wb") as tmp:
        tmp.write(file_content)
        tmp_path = tmp.name

    try:
        supplier = Chem.SDMolSupplier(tmp_path, removeHs=True)

        for idx, mol in enumerate(supplier):
            if len(compounds) >= MAX_COMPOUNDS:
                warnings.append(
                    f"Stopped at {MAX_COMPOUNDS} compounds (limit reached)"
                )
                break

            if mol is None:
                warnings.append(f"Molecule {idx + 1}: could not be parsed, skipped")
                continue

            # Extract name
            name = mol.GetProp("_Name") if mol.HasProp("_Name") else ""
            if not name:
                name = f"compound_{idx + 1}"

            smiles = Chem.MolToSmiles(mol)
            if not smiles:
                warnings.append(f"Molecule {idx + 1} ({name}): could not generate SMILES, skipped")
                continue

            try:
                desc = compute_descriptors(smiles)
            except Exception as e:
                warnings.append(f"Molecule {idx + 1} ({name}): descriptor error — {e}")
                continue

            compound = {
                "name": name,
                "smiles": smiles,
                "category": "custom",
                **desc,
            }
            compounds.append(compound)
    finally:
        os.unlink(tmp_path)

    return {"compounds": compounds, "warnings": warnings, "count": len(compounds)}


# ── helpers ──────────────────────────────────────────────────────────────────

def _float_or(val, default: float) -> float:
    """Return float(val) if truthy, else default."""
    if val is not None and str(val).strip():
        try:
            return round(float(val), 3)
        except (ValueError, TypeError):
            pass
    return default


def _int_or(val, default: int) -> int:
    """Return int(val) if truthy, else default."""
    if val is not None and str(val).strip():
        try:
            return int(float(val))
        except (ValueError, TypeError):
            pass
    return default

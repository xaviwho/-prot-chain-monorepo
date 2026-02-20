import logging
import requests
import tempfile
import os
from Bio import PDB
from Bio.PDB import PDBParser, PPBuilder
from Bio.Data.IUPACData import protein_weights
import numpy as np
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Standard amino acid molecular weights (monoisotopic, in Daltons)
# These are residue weights (minus water lost in peptide bond formation)
AMINO_ACID_WEIGHTS = {
    "ALA": 89.09,  "ARG": 174.20, "ASN": 132.12, "ASP": 133.10,
    "CYS": 121.16, "GLN": 146.15, "GLU": 147.13, "GLY": 75.03,
    "HIS": 155.16, "ILE": 131.17, "LEU": 131.17, "LYS": 146.19,
    "MET": 149.21, "PHE": 165.19, "PRO": 115.13, "SER": 105.09,
    "THR": 119.12, "TRP": 204.23, "TYR": 181.19, "VAL": 117.15,
}

# Average weight of water lost per peptide bond
WATER_WEIGHT = 18.015

# Atomic masses for center-of-mass calculation
ATOMIC_MASSES = {
    "C": 12.011, "N": 14.007, "O": 15.999, "S": 32.065,
    "H": 1.008,  "P": 30.974, "FE": 55.845, "ZN": 65.38,
    "MG": 24.305, "CA": 40.078, "MN": 54.938, "CO": 58.933,
    "CU": 63.546, "SE": 78.96,
}


class StructurePreparation:
    def __init__(self):
        self.parser = PDBParser(QUIET=True)

    def prepare_structure(self, pdb_id: str, structure_data: Optional[str] = None) -> Dict[str, Any]:
        """Prepare protein structure with real scientific analysis"""
        try:
            if structure_data:
                structure = self._parse_structure_data(structure_data, pdb_id)
            else:
                structure = self._download_and_parse_pdb(pdb_id)

            if not structure:
                return None

            analysis_results = self._analyze_protein_structure(structure, pdb_id)
            return analysis_results

        except Exception as e:
            logger.error(f"Structure preparation error for {pdb_id}: {str(e)}")
            return None

    def prepare_structure_from_file(self, file_path: str) -> Dict[str, Any]:
        """Prepare structure from uploaded file"""
        try:
            structure = self.parser.get_structure("uploaded", file_path)
            analysis_results = self._analyze_protein_structure(structure, "uploaded")
            return analysis_results
        except Exception as e:
            logger.error(f"File structure preparation error: {str(e)}")
            return None

    def _download_and_parse_pdb(self, pdb_id: str):
        """Download PDB file and parse structure"""
        try:
            pdb_url = f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb"
            response = requests.get(pdb_url, timeout=30)

            if response.status_code != 200:
                logger.warning(f"Failed to download PDB {pdb_id}: {response.status_code}")
                return None

            with tempfile.NamedTemporaryFile(mode='w', suffix='.pdb', delete=False) as temp_file:
                temp_file.write(response.text)
                temp_file_path = temp_file.name

            structure = self.parser.get_structure(pdb_id, temp_file_path)
            os.unlink(temp_file_path)

            return structure

        except Exception as e:
            logger.error(f"PDB download error for {pdb_id}: {str(e)}")
            return None

    def _parse_structure_data(self, structure_data: str, pdb_id: str):
        """Parse structure from provided data"""
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pdb', delete=False) as temp_file:
                temp_file.write(structure_data)
                temp_file_path = temp_file.name

            structure = self.parser.get_structure(pdb_id, temp_file_path)
            os.unlink(temp_file_path)

            return structure

        except Exception as e:
            logger.error(f"Structure data parsing error: {str(e)}")
            return None

    def _analyze_protein_structure(self, structure, pdb_id: str) -> Dict[str, Any]:
        """Perform comprehensive protein structure analysis"""
        try:
            models = list(structure)
            if not models:
                return None

            model = models[0]
            chains = list(model)

            # Count atoms and residues
            total_atoms = 0
            total_residues = 0
            chain_info = []

            for chain in chains:
                residues = list(chain)
                chain_residues = len(residues)
                chain_atoms = sum(len(list(residue)) for residue in residues)

                total_atoms += chain_atoms
                total_residues += chain_residues

                chain_info.append({
                    "chain_id": chain.id,
                    "num_residues": chain_residues,
                    "num_atoms": chain_atoms
                })

            # Real molecular weight using per-residue weights
            molecular_weight = self._calculate_molecular_weight(chains)

            # Amino acid composition
            amino_acid_composition = self._get_amino_acid_composition(chains)

            # Center of mass with real atomic masses
            center_of_mass = self._calculate_center_of_mass(chains)

            # Secondary structure from phi/psi angles
            secondary_structure = self._analyze_secondary_structure(structure, model)

            # Protein classification
            protein_class = self._classify_protein(total_residues, amino_acid_composition)

            # Quality metrics from PDB header
            quality_metrics = self._calculate_quality_metrics(structure, chains)

            results = {
                "pdb_id": pdb_id,
                "num_models": len(models),
                "num_chains": len(chains),
                "num_residues": total_residues,
                "num_atoms": total_atoms,
                "molecular_weight": round(molecular_weight, 2),
                "chain_information": chain_info,
                "amino_acid_composition": amino_acid_composition,
                "center_of_mass": center_of_mass,
                "secondary_structure": secondary_structure,
                "protein_classification": protein_class,
                "quality_metrics": quality_metrics,
                "analysis_method": "real_protein_structure_analysis"
            }

            logger.info(f"Structure analysis completed for {pdb_id}: {total_residues} residues, {total_atoms} atoms, MW={molecular_weight:.1f} Da")
            return results

        except Exception as e:
            logger.error(f"Structure analysis error: {str(e)}")
            return None

    def _calculate_molecular_weight(self, chains) -> float:
        """Calculate molecular weight using per-residue weights from standard amino acid data"""
        total_weight = 0.0
        residue_count = 0

        for chain in chains:
            chain_residues = 0
            for residue in chain:
                if PDB.is_aa(residue):
                    resname = residue.get_resname().strip()
                    weight = AMINO_ACID_WEIGHTS.get(resname, 110.0)  # fallback for non-standard
                    total_weight += weight
                    chain_residues += 1

            # Subtract water for peptide bonds (n-1 bonds per chain)
            if chain_residues > 1:
                total_weight -= (chain_residues - 1) * WATER_WEIGHT
            residue_count += chain_residues

        return total_weight

    def _get_amino_acid_composition(self, chains) -> Dict[str, int]:
        """Get amino acid composition"""
        composition = {}

        for chain in chains:
            for residue in chain:
                if PDB.is_aa(residue):
                    resname = residue.get_resname()
                    composition[resname] = composition.get(resname, 0) + 1

        return composition

    def _calculate_center_of_mass(self, chains) -> Dict[str, float]:
        """Calculate center of mass using real atomic masses"""
        total_mass = 0.0
        weighted_coords = np.array([0.0, 0.0, 0.0])

        for chain in chains:
            for residue in chain:
                for atom in residue:
                    coord = atom.get_coord()
                    element = atom.element.strip().upper()
                    mass = ATOMIC_MASSES.get(element, 12.0)
                    weighted_coords += coord * mass
                    total_mass += mass

        if total_mass > 0:
            center = weighted_coords / total_mass
            return {"x": round(float(center[0]), 3), "y": round(float(center[1]), 3), "z": round(float(center[2]), 3)}

        return {"x": 0.0, "y": 0.0, "z": 0.0}

    def _analyze_secondary_structure(self, structure, model) -> Dict[str, Any]:
        """Analyze secondary structure using phi/psi backbone angles.

        Uses Ramachandran-based assignment:
        - Alpha helix: phi ~ -60, psi ~ -47
        - Beta sheet: phi ~ -120, psi ~ 120
        - Everything else: coil/loop
        """
        helix_count = 0
        sheet_count = 0
        coil_count = 0
        total_assigned = 0

        per_residue_ss = []

        try:
            ppb = PPBuilder()
            for pp in ppb.build_peptides(model):
                phi_psi_list = pp.get_phi_psi_list()
                for i, (phi, psi) in enumerate(phi_psi_list):
                    if phi is None or psi is None:
                        coil_count += 1
                        total_assigned += 1
                        continue

                    phi_deg = np.degrees(phi)
                    psi_deg = np.degrees(psi)

                    # Ramachandran-based secondary structure assignment
                    if -100 < phi_deg < -30 and -67 < psi_deg < -7:
                        # Alpha helix region
                        helix_count += 1
                        per_residue_ss.append("H")
                    elif (-170 < phi_deg < -70 and 90 < psi_deg < 170) or \
                         (-170 < phi_deg < -70 and -180 < psi_deg < -140):
                        # Beta sheet region
                        sheet_count += 1
                        per_residue_ss.append("E")
                    else:
                        coil_count += 1
                        per_residue_ss.append("C")

                    total_assigned += 1

        except Exception as e:
            logger.warning(f"Phi/psi secondary structure analysis failed: {str(e)}, falling back to header")
            return self._analyze_secondary_structure_from_header(structure)

        if total_assigned == 0:
            return self._analyze_secondary_structure_from_header(structure)

        return {
            "helices": helix_count,
            "sheets": sheet_count,
            "coils": coil_count,
            "total_assigned": total_assigned,
            "helix_percentage": round(helix_count / total_assigned * 100, 1) if total_assigned > 0 else 0,
            "sheet_percentage": round(sheet_count / total_assigned * 100, 1) if total_assigned > 0 else 0,
            "coil_percentage": round(coil_count / total_assigned * 100, 1) if total_assigned > 0 else 0,
            "method": "ramachandran_phi_psi"
        }

    def _analyze_secondary_structure_from_header(self, structure) -> Dict[str, Any]:
        """Fallback: extract secondary structure counts from PDB HELIX/SHEET records.

        Biopython's PDBParser stores HELIX/SHEET records in ``structure.header``
        under the keys ``'helix'`` and ``'sheet'`` (lists of dicts).  We count
        entries to give at least a coarse picture when phi/psi analysis is not
        possible (e.g. CA-only models).
        """
        try:
            header = structure.header if hasattr(structure, 'header') else {}

            helix_list = header.get('helix', []) or []
            sheet_list = header.get('sheet', []) or []

            helix_count = len(helix_list)
            sheet_count = len(sheet_list)

            if helix_count == 0 and sheet_count == 0:
                return {
                    "helices": 0, "sheets": 0, "coils": 0,
                    "total_assigned": 0,
                    "helix_percentage": 0, "sheet_percentage": 0, "coil_percentage": 0,
                    "method": "no_data_available"
                }

            total = helix_count + sheet_count
            return {
                "helices": helix_count,
                "sheets": sheet_count,
                "coils": 0,
                "total_assigned": total,
                "helix_percentage": round(helix_count / total * 100, 1) if total > 0 else 0,
                "sheet_percentage": round(sheet_count / total * 100, 1) if total > 0 else 0,
                "coil_percentage": 0,
                "method": "header_helix_sheet_records"
            }
        except Exception:
            return {
                "helices": 0, "sheets": 0, "coils": 0,
                "total_assigned": 0,
                "helix_percentage": 0, "sheet_percentage": 0, "coil_percentage": 0,
                "method": "analysis_failed"
            }

    def _classify_protein(self, num_residues: int, composition: Dict[str, int]) -> str:
        """Classify protein based on size and composition"""
        if num_residues < 50:
            return "peptide"
        elif num_residues < 150:
            return "small_protein"
        elif num_residues < 500:
            return "medium_protein"
        else:
            return "large_protein"

    def _calculate_quality_metrics(self, structure, chains) -> Dict[str, Any]:
        """Calculate structure quality metrics, extracting real data from PDB header when available"""
        try:
            total_atoms = sum(len(list(residue)) for chain in chains for residue in chain)
            total_residues = sum(len(list(chain)) for chain in chains)

            completeness = min(total_atoms / (total_residues * 8), 1.0) if total_residues > 0 else 0

            # Try to extract resolution and method from PDB header
            # Use None (JSON null) instead of "unknown" to keep types consistent
            resolution = None
            r_factor = None
            exp_method = None

            header = structure.header
            if "resolution" in header and header["resolution"] is not None:
                resolution = round(header["resolution"], 2)
            if "structure_method" in header and header["structure_method"]:
                exp_method = header["structure_method"]

            return {
                "completeness": round(completeness, 3),
                "resolution": resolution,
                "r_factor": r_factor,
                "experimental_method": exp_method,
                "method": "pdb_header_metrics"
            }
        except Exception:
            return {
                "completeness": 0.0,
                "resolution": None,
                "r_factor": None,
                "experimental_method": None,
                "method": "metrics_failed"
            }

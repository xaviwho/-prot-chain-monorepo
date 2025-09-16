import requests
import tempfile
import os
import numpy as np
from Bio import PDB
from Bio.PDB import PDBParser
from typing import Dict, Any, List, Optional
from scipy.spatial.distance import cdist
import random

class RealBindingSiteDetection:
    def __init__(self):
        self.parser = PDBParser(QUIET=True)
        
    def detect_binding_sites(self, pdb_id: str, structure_data: Optional[str] = None) -> List[Dict[str, Any]]:
        """Detect binding sites using real geometric cavity detection"""
        try:
            if structure_data:
                structure = self._parse_structure_data(structure_data, pdb_id)
            else:
                structure = self._download_and_parse_pdb(pdb_id)
            
            if not structure:
                return []
                
            # Perform real geometric cavity detection
            binding_sites = self._geometric_cavity_detection(structure, pdb_id)
            return binding_sites
            
        except Exception as e:
            print(f"Binding site detection error for {pdb_id}: {str(e)}")
            return []
    
    def _download_and_parse_pdb(self, pdb_id: str):
        """Download PDB file and parse structure"""
        try:
            pdb_url = f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb"
            response = requests.get(pdb_url, timeout=30)
            
            if response.status_code != 200:
                return None
            
            with tempfile.NamedTemporaryFile(mode='w', suffix='.pdb', delete=False) as temp_file:
                temp_file.write(response.text)
                temp_file_path = temp_file.name
            
            structure = self.parser.get_structure(pdb_id, temp_file_path)
            os.unlink(temp_file_path)
            
            return structure
            
        except Exception as e:
            print(f"PDB download error: {str(e)}")
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
            print(f"Structure parsing error: {str(e)}")
            return None
    
    def _geometric_cavity_detection(self, structure, pdb_id: str) -> List[Dict[str, Any]]:
        """Perform real geometric cavity detection algorithm"""
        try:
            model = list(structure)[0]  # Use first model
            chains = list(model)
            
            # Extract all heavy atom coordinates
            protein_coords = []
            atom_info = []
            
            for chain in chains:
                for residue in chain:
                    if PDB.is_aa(residue):
                        for atom in residue:
                            if atom.element != 'H':  # Skip hydrogens
                                protein_coords.append(atom.get_coord())
                                atom_info.append({
                                    'chain': chain.id,
                                    'residue': residue.get_id()[1],
                                    'resname': residue.get_resname(),
                                    'atom': atom.get_name()
                                })
            
            if len(protein_coords) == 0:
                return []
            
            protein_coords = np.array(protein_coords)
            
            # Adaptive grid spacing based on protein size
            num_atoms = len(protein_coords)
            if num_atoms > 5000:
                grid_spacing = 2.0  # Larger spacing for big proteins
                max_grid_points = 20000  # Limit grid points
            else:
                grid_spacing = 1.5
                max_grid_points = 50000
            
            print(f"Using grid spacing {grid_spacing}Å for {num_atoms} atoms")
            
            # Create 3D grid around protein
            min_coords = np.min(protein_coords, axis=0) - 5.0
            max_coords = np.max(protein_coords, axis=0) + 5.0
            
            # Generate grid points
            x_points = np.arange(min_coords[0], max_coords[0], grid_spacing)
            y_points = np.arange(min_coords[1], max_coords[1], grid_spacing)
            z_points = np.arange(min_coords[2], max_coords[2], grid_spacing)
            
            total_grid_points = len(x_points) * len(y_points) * len(z_points)
            
            if total_grid_points > max_grid_points:
                # Use random sampling for very large grids
                print(f"Large grid detected ({total_grid_points} points), using random sampling")
                grid_points = []
                for _ in range(max_grid_points):
                    x = random.uniform(min_coords[0], max_coords[0])
                    y = random.uniform(min_coords[1], max_coords[1])
                    z = random.uniform(min_coords[2], max_coords[2])
                    grid_points.append([x, y, z])
                grid_points = np.array(grid_points)
            else:
                # Generate full grid
                xx, yy, zz = np.meshgrid(x_points, y_points, z_points)
                grid_points = np.column_stack([xx.ravel(), yy.ravel(), zz.ravel()])
            
            print(f"Generated {len(grid_points)} grid points")
            
            # Find cavity points (points not too close to protein atoms)
            min_distance = 2.5  # Minimum distance from protein atoms
            max_distance = 8.0   # Maximum distance (to stay near protein surface)
            
            # Calculate distances in chunks to manage memory
            chunk_size = 10000
            cavity_points = []
            
            for i in range(0, len(grid_points), chunk_size):
                chunk = grid_points[i:i+chunk_size]
                distances = cdist(chunk, protein_coords)
                min_distances = np.min(distances, axis=1)
                
                # Points that are in the cavity range
                valid_mask = (min_distances >= min_distance) & (min_distances <= max_distance)
                cavity_points.extend(chunk[valid_mask])
            
            cavity_points = np.array(cavity_points)
            print(f"Found {len(cavity_points)} cavity points")
            
            if len(cavity_points) == 0:
                return []
            
            # Cluster cavity points into binding sites
            binding_sites = self._cluster_cavity_points(cavity_points, protein_coords, atom_info)
            
            print(f"Detected {len(binding_sites)} binding sites for {pdb_id}")
            return binding_sites
            
        except Exception as e:
            print(f"Geometric cavity detection error: {str(e)}")
            return []
    
    def _cluster_cavity_points(self, cavity_points: np.ndarray, protein_coords: np.ndarray, atom_info: List[Dict]) -> List[Dict[str, Any]]:
        """Cluster cavity points into distinct binding sites"""
        try:
            if len(cavity_points) == 0:
                return []
            
            # For very large cavity point sets, use subsampling
            if len(cavity_points) > 10000:
                print(f"Large cavity point set ({len(cavity_points)}), subsampling to 5000 points")
                indices = np.random.choice(len(cavity_points), 5000, replace=False)
                cavity_points = cavity_points[indices]
            
            # Protein size-aware clustering
            num_atoms = len(protein_coords)
            
            # Dynamic clustering parameters based on protein size
            if num_atoms < 1000:  # Small protein
                cluster_distance = 3.5
                min_cluster_size = 3
            elif num_atoms < 3000:  # Medium protein
                cluster_distance = 4.0
                min_cluster_size = 5
            else:  # Large protein
                cluster_distance = 4.5
                min_cluster_size = 8
            
            clusters = []
            used_points = set()
            
            for i, point in enumerate(cavity_points):
                if i in used_points:
                    continue
                
                # Start new cluster
                cluster_points = [point]
                cluster_indices = {i}
                
                # Find nearby points using single-pass clustering for efficiency
                distances = np.linalg.norm(cavity_points - point, axis=1)
                nearby_indices = np.where(distances <= cluster_distance)[0]
                
                for idx in nearby_indices:
                    if idx not in used_points:
                        cluster_points.append(cavity_points[idx])
                        cluster_indices.add(idx)
                        used_points.add(idx)
                
                # Use dynamic minimum cluster size
                if len(cluster_points) >= min_cluster_size:
                    clusters.append(np.array(cluster_points))
            
            print(f"Found {len(clusters)} cavity clusters")
            
            # Convert clusters to binding site descriptions
            binding_sites = []
            for i, cluster in enumerate(clusters):
                # Use the same dynamic minimum size as clustering
                if len(cluster) < min_cluster_size:
                    continue
                
                # Calculate cluster properties
                center = np.mean(cluster, axis=0)
                volume = len(cluster) * (1.5 ** 3)  # Approximate volume
                
                # Find nearby residues
                nearby_residues = self._find_nearby_residues(center, protein_coords, atom_info)
                
                # Calculate binding site properties
                druggability = self._calculate_druggability_score(cluster, nearby_residues)
                hydrophobicity = self._calculate_hydrophobicity(nearby_residues)
                
                binding_site = {
                    "site_id": i + 1,
                    "center": {
                        "x": float(center[0]),
                        "y": float(center[1]),
                        "z": float(center[2])
                    },
                    "volume": round(volume, 1),
                    "druggability_score": round(druggability, 3),
                    "hydrophobicity": round(hydrophobicity, 3),
                    "nearby_residues": nearby_residues,
                    "cavity_points": len(cluster),
                    "surface_accessibility": self._calculate_surface_accessibility(center, protein_coords)
                }
                
                binding_sites.append(binding_site)
            
            # Sort by druggability score (best first)
            binding_sites.sort(key=lambda x: x['druggability_score'], reverse=True)
            
            # Dynamic filtering based on actual druggability scores - no artificial limits
            # Only return sites that meet minimum druggability threshold
            min_druggability = 0.4  # Reasonable minimum for drug binding
            
            # Filter sites that meet the minimum threshold
            viable_sites = [site for site in binding_sites if site['druggability_score'] >= min_druggability]
            
            # If no sites meet the threshold, lower it and try again
            if not viable_sites and binding_sites:
                min_druggability = 0.25
                viable_sites = [site for site in binding_sites if site['druggability_score'] >= min_druggability]
            
            # Return all viable sites - let the natural cavity detection determine the count
            return viable_sites
            
        except Exception as e:
            print(f"Clustering error: {str(e)}")
            return []
    
    def _find_nearby_residues(self, center: np.ndarray, protein_coords: np.ndarray, atom_info: List[Dict], radius: float = 6.0) -> List[Dict[str, Any]]:
        """Find residues near the binding site center"""
        try:
            distances = np.linalg.norm(protein_coords - center, axis=1)
            nearby_indices = np.where(distances <= radius)[0]
            
            # Group by residue
            residue_dict = {}
            for idx in nearby_indices:
                atom = atom_info[idx]
                res_key = f"{atom['chain']}_{atom['residue']}_{atom['resname']}"
                
                if res_key not in residue_dict:
                    residue_dict[res_key] = {
                        "chain": atom['chain'],
                        "residue_number": atom['residue'],
                        "residue_name": atom['resname'],
                        "distance": float(distances[idx])
                    }
                else:
                    # Keep minimum distance
                    residue_dict[res_key]["distance"] = min(
                        residue_dict[res_key]["distance"],
                        float(distances[idx])
                    )
            
            # Convert to list and sort by distance
            nearby_residues = list(residue_dict.values())
            nearby_residues.sort(key=lambda x: x['distance'])
            
            return nearby_residues
            
        except Exception as e:
            print(f"Nearby residues error: {str(e)}")
            return []
    
    def _calculate_druggability_score(self, cluster_points: np.ndarray, nearby_residues: List[Dict]) -> float:
        """Calculate enhanced druggability score based on cavity properties and pharmaceutical criteria"""
        try:
            # Calculate actual volume in Ų
            volume = len(cluster_points) * (1.5 ** 3)
            
            # Optimal binding site volume is 300-1000 Ų (Lipinski-like)
            if volume < 200:
                size_score = 0.1  # Too small for drug binding
            elif volume > 1500:
                size_score = 0.3  # Too large, likely not specific
            elif 300 <= volume <= 800:
                size_score = 1.0  # Optimal size
            else:
                size_score = 0.7  # Acceptable size
            
            # Enhanced hydrophobicity analysis
            hydrophobic_residues = ['ALA', 'VAL', 'LEU', 'ILE', 'PHE', 'TRP', 'MET', 'PRO']
            polar_residues = ['SER', 'THR', 'ASN', 'GLN', 'TYR']
            charged_residues = ['ARG', 'LYS', 'ASP', 'GLU', 'HIS']
            
            if not nearby_residues:
                return 0.1
            
            hydrophobic_count = sum(1 for res in nearby_residues if res['residue_name'] in hydrophobic_residues)
            polar_count = sum(1 for res in nearby_residues if res['residue_name'] in polar_residues)
            charged_count = sum(1 for res in nearby_residues if res['residue_name'] in charged_residues)
            
            total_residues = len(nearby_residues)
            hydrophobic_ratio = hydrophobic_count / total_residues
            polar_ratio = polar_count / total_residues
            charged_ratio = charged_count / total_residues
            
            # Optimal binding sites have balanced hydrophobic/polar character
            if 0.3 <= hydrophobic_ratio <= 0.7 and polar_ratio >= 0.2:
                composition_score = 1.0  # Balanced composition
            elif hydrophobic_ratio > 0.8:
                composition_score = 0.4  # Too hydrophobic
            elif hydrophobic_ratio < 0.2:
                composition_score = 0.3  # Too polar
            else:
                composition_score = 0.6  # Acceptable
            
            # Penalty for too many charged residues (reduces selectivity)
            if charged_ratio > 0.4:
                composition_score *= 0.7
            
            # Depth assessment based on nearby residue count
            if total_residues < 5:
                depth_score = 0.2  # Too shallow
            elif total_residues > 20:
                depth_score = 0.6  # Too exposed
            else:
                depth_score = 1.0  # Good depth
            
            # Final druggability score (weighted combination)
            final_score = (size_score * 0.4 + composition_score * 0.4 + depth_score * 0.2)
            
            return min(final_score, 1.0)
            
        except Exception as e:
            print(f"Druggability calculation error: {str(e)}")
            return 0.1
    
    def _calculate_hydrophobicity(self, nearby_residues: List[Dict]) -> float:
        """Calculate hydrophobicity score"""
        try:
            if not nearby_residues:
                return 0.0
            
            hydrophobic_residues = ['ALA', 'VAL', 'LEU', 'ILE', 'PHE', 'TRP', 'MET', 'PRO']
            hydrophobic_count = sum(1 for res in nearby_residues if res['residue_name'] in hydrophobic_residues)
            
            return hydrophobic_count / len(nearby_residues)
            
        except:
            return 0.0
    
    def _calculate_surface_accessibility(self, center: np.ndarray, protein_coords: np.ndarray) -> float:
        """Calculate surface accessibility score based on distance to protein surface"""
        try:
            # Find distances to all protein atoms
            distances = np.linalg.norm(protein_coords - center, axis=1)
            min_distance = np.min(distances)
            
            # Surface accessibility based on minimum distance to protein atoms
            # Deeper pockets (further from surface) have lower accessibility
            if min_distance < 2.0:
                return 0.1  # Very buried
            elif min_distance < 4.0:
                return 0.3  # Moderately buried
            elif min_distance < 6.0:
                return 0.6  # Accessible
            else:
                return 0.9  # Highly accessible
                
        except:
            return 0.5

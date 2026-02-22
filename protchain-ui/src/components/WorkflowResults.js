'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Button,
  CircularProgress,
  Chip,
  Alert,
} from '@mui/material';
import { ExpandMore, Download, HourglassEmpty, ErrorOutline, CheckCircle, Warning, Error as ErrorIcon } from '@mui/icons-material';
import { saveAs } from 'file-saver';
// Import 3D viewers
import ProteinViewer3D from './ProteinViewer3D';
import BindingSiteVisualizer from './BindingSiteVisualizer';
import SmartDruggabilityCard from './SmartDruggabilityCard';
import DockingPoseViewer from './DockingPoseViewer';
// Alias for backward compatibility
const ProteinViewer = ProteinViewer3D;

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function WorkflowResults({ results, stage, activeTab = 0, workflow = null, onProceedWithoutCommitting = null }) {
  // Initialize blockchain state from persisted workflow data
  const blockchainData = workflow?.blockchain || {};
  const [blockchainCommitted, setBlockchainCommitted] = useState(!!blockchainData.transactionHash);
  const [ipfsHash, setIpfsHash] = useState(blockchainData.ipfsHash || null);
  const [blockchainTxHash, setBlockchainTxHash] = useState(blockchainData.transactionHash || null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(blockchainData.verified ? blockchainData.verificationData : null);
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [selectedPocketId, setSelectedPocketId] = useState(null);
  const [selectedPoseCompound, setSelectedPoseCompound] = useState(null);
  const params = useParams();
  
  // Initialize 3Dmol.js viewer for binding site visualization
  useEffect(() => {
    if (stage !== 'binding_site_analysis') return;
    if (!results?.binding_sites && !results?.binding_site_analysis?.binding_sites) return;
    if (!params?.id) return;


    const loadAndInitialize3D = async () => {
      try {
        // Load 3Dmol.js if not already loaded
        if (!window.$3Dmol) {
          const script = document.createElement('script');
          script.src = 'https://3dmol.csb.pitt.edu/build/3Dmol-min.js';
          script.async = true;
          document.head.appendChild(script);
          
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
          });
        }

        // Get the viewer container
        const viewerElement = document.getElementById(`molviewer-${params.id}`);
        if (!viewerElement) {
          return;
        }

        // Clear any existing content
        viewerElement.innerHTML = '';

        // Fetch the PDB structure
        const response = await fetch(`/api/workflow/${params.id}/processed-structure`);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDB: ${response.statusText}`);
        }
        
        const pdbData = await response.text();
        if (!pdbData || !pdbData.trim()) {
          throw new Error('Empty PDB data received');
        }

        // Create the 3D viewer
        const viewer = window.$3Dmol.createViewer(viewerElement, { 
          backgroundColor: 'white',
          antialias: true
        });
        
        // Add the protein model
        viewer.addModel(pdbData, 'pdb');
        
        // Set protein style
        viewer.setStyle({}, { cartoon: { color: 'spectrum' } });

        // Get binding sites data
        const bindingSites = results?.binding_site_analysis?.binding_sites || results?.binding_sites || [];
        
        // Highlight binding sites
        bindingSites.forEach((site, index) => {
          if (site.residues && Array.isArray(site.residues)) {
            let residueIds = [];
            
            // Handle different residue formats
            site.residues.forEach(residue => {
              if (residue.res_num) {
                residueIds.push(parseInt(residue.res_num));
              } else if (typeof residue === 'string') {
                const parts = residue.split(' ');
                const resNum = parseInt(parts[parts.length - 1]);
                if (!isNaN(resNum)) residueIds.push(resNum);
              }
            });
            
            if (residueIds.length > 0) {
              // Add red spheres for binding site residues
              viewer.addStyle(
                { resi: residueIds }, 
                { sphere: { color: 'red', radius: 0.8, alpha: 0.8 } }
              );
              // Add sticks for better visibility
              viewer.addStyle(
                { resi: residueIds }, 
                { stick: { color: 'red', radius: 0.3 } }
              );
            }
          }
          
          // Add center sphere if available
          if (site.center) {
            viewer.addSphere({
              center: { x: site.center.x, y: site.center.y, z: site.center.z },
              radius: 2.0,
              color: 'yellow',
              alpha: 0.7
            });
          }
        });

        // Render and zoom
        viewer.zoomTo();
        viewer.render();
        
        
      } catch (error) {
        const viewerElement = document.getElementById(`molviewer-${params.id}`);
        if (viewerElement) {
          viewerElement.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #f44336;">
              <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
              <div style="font-weight: bold; margin-bottom: 8px;">3D Viewer Error</div>
              <div style="text-align: center; max-width: 400px;">${error.message}</div>
              <button onclick="window.location.reload()" style="margin-top: 16px; padding: 8px 16px; background: #1976d2; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>
            </div>
          `;
        }
      }
    };

    // Small delay to ensure DOM is ready
    setTimeout(loadAndInitialize3D, 100);

  }, [stage, results, params?.id]);

  const commitToBlockchain = async () => {
    if (!results || !params.id) return;

    setCommitLoading(true);
    try {
      const ipfsResponse = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          workflowId: params.id,
          results: results,
          timestamp: new Date().toISOString(),
          stage: stage,
        }),
      });

      if (!ipfsResponse.ok) {
        throw new Error('Failed to upload to IPFS');
      }

      const ipfsData = await ipfsResponse.json();
      setIpfsHash(ipfsData.hash);

      const blockchainResponse = await fetch('/api/blockchain/commit-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          workflowId: params.id,
          ipfsHash: ipfsData.hash,
          resultsHash: generateResultsHash(results),
          stage: stage,
        }),
      });

      if (!blockchainResponse.ok) {
        throw new Error('Failed to commit to blockchain');
      }

      const blockchainData = await blockchainResponse.json();
      setBlockchainTxHash(blockchainData.transactionHash);
      setBlockchainCommitted(true);
      
      // Store commit info in localStorage with stage-specific keys for unique hashes
      const recentCommits = JSON.parse(localStorage.getItem('recentBlockchainCommits') || '{}');
      const stageKey = `${params.id}_${stage}`; // Use stage-specific key
      
      if (!recentCommits[params.id]) {
        recentCommits[params.id] = {};
      }
      
      recentCommits[params.id][stage] = {
        txHash: blockchainData.transactionHash,
        ipfsHash: ipfsData.hash,
        timestamp: new Date().toISOString(),
        stage: stage
      };
      localStorage.setItem('recentBlockchainCommits', JSON.stringify(recentCommits));
      
    } catch (error) {
      alert('Failed to commit results to blockchain: ' + error.message);
    } finally {
      setCommitLoading(false);
    }
  };

  const verifyResults = async () => {
    if (!blockchainTxHash || !ipfsHash) return;

    setVerifyLoading(true);
    try {
      const verifyResponse = await fetch('/api/blockchain/verify-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          transactionHash: blockchainTxHash,
          ipfsHash: ipfsHash,
          workflowId: params.id,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Failed to verify results');
      }

      const verifyData = await verifyResponse.json();
      setVerificationResult(verifyData);
    } catch (error) {
      alert('Failed to verify results: ' + error.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const generateResultsHash = (results) => {
    return btoa(JSON.stringify(results)).slice(0, 32);
  };

  const handleDownloadResults = () => {
    if (!results) return;

    try {
      let csvContent = '';
      const esc = (v) => `"${String(v ?? 'N/A').replace(/"/g, '""')}"`;
      const num = (v, d = 3) => v != null ? Number(v).toFixed(d) : 'N/A';

      if (stage === 'virtual_screening') {
        // ── Virtual Screening: full compound data ──
        const vsData = results.virtual_screening || results;
        const compounds = vsData.top_compounds || [];
        const isVina = vsData.method === 'autodock_vina';

        if (compounds.length === 0) {
          alert('No compound data available for export');
          return;
        }

        // Metadata block
        const meta = [
          `"Workflow ID","${params.id}"`,
          `"Analysis Stage","Virtual Screening"`,
          `"Generated On","${new Date().toISOString()}"`,
          `"Method","${isVina ? 'AutoDock Vina' : (vsData.method || 'physics_based_scoring').replace(/_/g, ' ')}"`,
          `"Compounds Screened","${vsData.compounds_screened || compounds.length}"`,
          `"Hits Found","${vsData.hits_found || 0}"`,
          `"Compound Library","${vsData.compound_library || 'N/A'}"`,
        ];
        if (isVina) {
          meta.push(`"Compounds Docked","${vsData.compounds_docked || 'N/A'}"`);
          meta.push(`"Docking Time (seconds)","${vsData.total_docking_time_seconds || 'N/A'}"`);
          meta.push(`"Exhaustiveness","${vsData.exhaustiveness || 'N/A'}"`);
          meta.push(`"Docking Failures","${vsData.docking_failures || 0}"`);
        }
        if (vsData.binding_site_used) {
          const bs = vsData.binding_site_used;
          meta.push(`"Binding Site Volume (A3)","${num(bs.volume, 1)}"`);
          meta.push(`"Binding Site Center","${num(bs.center?.x, 2)}, ${num(bs.center?.y, 2)}, ${num(bs.center?.z, 2)}"`);
        }
        meta.push('');

        // CSV header row — all compound fields
        const header = [
          'Rank', 'Name', 'SMILES', 'Category', 'Score',
          'Binding Affinity (kcal/mol)', 'Molecular Weight', 'LogP',
          'HBD', 'HBA', 'Rotatable Bonds', 'TPSA', 'Charge',
          'Aromatic Rings', 'Lipinski Violations',
        ];
        if (isVina) {
          header.push('Best Pose (kcal/mol)', 'All Pose Scores');
        }
        // Include score breakdown components if present
        const breakdownKeys = compounds[0]?.score_breakdown ? Object.keys(compounds[0].score_breakdown) : [];
        breakdownKeys.forEach(k => header.push(`Score: ${k.replace(/_/g, ' ')}`));

        // CSV data rows
        const rows = compounds.map((c, i) => {
          const row = [
            i + 1,
            esc(c.name || c.id || `Compound ${i + 1}`),
            esc(c.smiles),
            esc((c.category || 'unknown').replace(/_/g, ' ')),
            num(c.score),
            c.predicted_binding_affinity_kcal != null ? num(c.predicted_binding_affinity_kcal, 2) : 'N/A',
            num(c.molecular_weight, 2),
            num(c.logP ?? c.logp, 2),
            c.hbd ?? 'N/A',
            c.hba ?? 'N/A',
            c.rotatable_bonds ?? 'N/A',
            num(c.tpsa, 2),
            c.charge ?? 'N/A',
            c.aromatic_rings ?? 'N/A',
            c.lipinski_violations ?? 'N/A',
          ];
          if (isVina) {
            row.push(c.predicted_binding_affinity_kcal != null ? num(c.predicted_binding_affinity_kcal, 2) : 'N/A');
            row.push(c.all_poses_scores ? c.all_poses_scores.join('; ') : 'N/A');
          }
          breakdownKeys.forEach(k => row.push(num(c.score_breakdown?.[k])));
          return row.map(v => typeof v === 'string' && v.startsWith('"') ? v : esc(v)).join(',');
        });

        csvContent = meta.join('\n') + '\n' + header.map(h => esc(h)).join(',') + '\n' + rows.join('\n');

      } else if (stage === 'binding_site_analysis') {
        // ── Binding Site Analysis: full site data with residues ──
        const bindingSites = results.binding_sites || results.binding_site_analysis?.binding_sites || [];

        if (bindingSites.length === 0) {
          alert('No binding site data available for export');
          return;
        }

        const meta = [
          `"Workflow ID","${params.id}"`,
          `"Analysis Stage","Binding Site Analysis"`,
          `"Generated On","${new Date().toISOString()}"`,
          `"Status","${results.status || 'Completed'}"`,
          `"Method","${results.method || results.binding_site_analysis?.method || 'fpocket'}"`,
          `"Total Binding Sites","${bindingSites.length}"`,
          '',
        ];

        const header = [
          'Site ID', 'Score', 'Volume (A3)', 'Druggability', 'Hydrophobicity',
          'Center X', 'Center Y', 'Center Z',
          'Residue Count', 'Residues',
        ];

        const rows = bindingSites.map(site => {
          const c = site.center || {};
          const residueList = (site.residues || []).map(r =>
            r.name ? `${r.name}${r.sequence_number || ''}${r.chain ? ':' + r.chain : ''}` : String(r)
          ).join('; ');
          return [
            esc(site.id || 'N/A'),
            num(site.score),
            num(site.volume, 2),
            num(site.druggability),
            num(site.hydrophobicity),
            num(c.x, 2), num(c.y, 2), num(c.z, 2),
            site.residues?.length || 0,
            esc(residueList || 'N/A'),
          ].map(v => typeof v === 'string' && v.startsWith('"') ? v : esc(v)).join(',');
        });

        csvContent = meta.join('\n') + '\n' + header.map(h => esc(h)).join(',') + '\n' + rows.join('\n');

      } else if (stage === 'molecular_dynamics') {
        // ── Molecular Dynamics: compound stability results ──
        const mdData = results.molecular_dynamics || results;
        const compResults = mdData.compound_results || [];
        const successful = compResults.filter(c => c.status !== 'failed');

        if (successful.length === 0) {
          alert('No molecular dynamics data available for export');
          return;
        }

        const meta = [
          `"Workflow ID","${params.id}"`,
          `"Analysis Stage","Molecular Dynamics Simulation"`,
          `"Generated On","${new Date().toISOString()}"`,
          `"Method","${(mdData.method || 'physics_based_md_simulation').replace(/_/g, ' ')}"`,
          `"Temperature","${mdData.temperature_kelvin || 300} K"`,
          `"Simulation Steps","${mdData.simulation_steps || 'N/A'}"`,
          `"Simulation Time","${mdData.simulation_time_ns || 'N/A'} ns"`,
          `"Compounds Simulated","${mdData.compounds_simulated || successful.length}"`,
          `"Stable Compounds","${mdData.stable_compounds || 0}"`,
          `"Average RMSD","${num(mdData.average_rmsd_angstrom)} A"`,
          `"Average Interaction Energy","${num(mdData.average_interaction_energy_kcal)} kcal/mol"`,
          `"Computation Time","${num(mdData.total_computation_time_seconds, 1)} seconds"`,
          '',
        ];

        const header = [
          'Rank', 'Name', 'SMILES', 'Category', 'Stability Verdict',
          'RMSD (A)', 'Interaction Energy (kcal/mol)', 'Energy Change (kcal/mol)',
          'Radius of Gyration (A)', 'VDW Energy', 'Electrostatic Energy',
          'H-Bond Energy', 'Vina Score (kcal/mol)', 'Molecular Weight',
          'Top Interacting Residues',
        ];

        const rows = successful.map((c, i) => {
          const eb = c.energy_breakdown || {};
          const topRes = (c.residue_interactions || []).slice(0, 5).map(r => r.residue).join('; ');
          return [
            c.rank || i + 1,
            esc(c.name),
            esc(c.smiles),
            esc((c.category || '').replace(/_/g, ' ')),
            esc((c.stability_verdict || 'unknown').replace(/_/g, ' ')),
            num(c.rmsd_angstrom, 4),
            num(c.interaction_energy_kcal, 2),
            num(c.energy_change_kcal, 2),
            num(c.radius_of_gyration_angstrom, 3),
            num(eb.van_der_waals_kcal, 2),
            num(eb.electrostatic_kcal, 2),
            num(eb.hydrogen_bond_kcal, 2),
            c.vina_score_kcal != null ? num(c.vina_score_kcal, 2) : 'N/A',
            num(c.molecular_weight, 2),
            esc(topRes || 'N/A'),
          ].map(v => typeof v === 'string' && v.startsWith('"') ? v : esc(v)).join(',');
        });

        csvContent = meta.join('\n') + '\n' + header.map(h => esc(h)).join(',') + '\n' + rows.join('\n');

      } else {
        // ── Structure Preparation: all descriptors + chain/residue data ──
        let structureData = {};
        const lookups = [
          results.details?.descriptors,
          results.STRUCTURE_PREPARATION?.descriptors,
          results.structure_preparation?.descriptors,
          results.data?.details?.descriptors,
          results.data?.descriptors,
          results.descriptors,
        ];
        for (const d of lookups) {
          if (d && Object.keys(d).length > 0) { structureData = d; break; }
        }

        // Flatten nested objects
        const flattenObj = (obj, prefix = '') => {
          const out = {};
          for (const [k, v] of Object.entries(obj)) {
            const key = prefix ? `${prefix} > ${k}` : k;
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              Object.assign(out, flattenObj(v, key));
            } else if (Array.isArray(v)) {
              out[key] = v.join('; ');
            } else {
              out[key] = v;
            }
          }
          return out;
        };

        // If no descriptors, build from all available top-level data
        if (Object.keys(structureData).length === 0) {
          structureData = flattenObj(results);
        } else {
          structureData = flattenObj(structureData);
        }

        // Add key metadata
        const pdbId = results.pdbId || results.pdb_id || results.details?.pdb_id || 'Unknown';
        const extraMeta = { 'PDB ID': pdbId, 'Status': results.status || 'Completed' };

        // Add chain and residue info if present
        const details = results.details || results.data?.details || {};
        if (details.chains) extraMeta['Chains'] = Array.isArray(details.chains) ? details.chains.join(', ') : details.chains;
        if (details.residue_count) extraMeta['Residue Count'] = details.residue_count;
        if (details.atom_count) extraMeta['Atom Count'] = details.atom_count;
        if (details.molecular_weight) extraMeta['Molecular Weight (Da)'] = Number(details.molecular_weight).toFixed(1);

        const allData = { ...extraMeta, ...structureData };

        const meta = [
          `"Workflow ID","${params.id}"`,
          `"Analysis Stage","Structure Preparation"`,
          `"Generated On","${new Date().toISOString()}"`,
          '',
        ];
        const header = ['Property', 'Value'];
        const rows = Object.entries(allData).map(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const val = typeof value === 'boolean' ? (value ? 'Yes' : 'No')
                    : typeof value === 'number' ? value.toFixed(2)
                    : String(value ?? 'N/A');
          return `${esc(label)},${esc(val)}`;
        });

        csvContent = meta.join('\n') + '\n' + header.map(h => esc(h)).join(',') + '\n' + rows.join('\n');
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `workflow-${params.id}-${stage}-results-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const renderStructurePreparation = (data) => {
    let structureData = {};

    if (typeof data === 'object' && data !== null) {
      // First, check if the entire data object needs to be parsed
      if (data.data && typeof data.data === 'string') {
        try {
          // The data.data field might be a JSON string
          const parsedData = JSON.parse(data.data);
          data = { ...data, data: parsedData };
        } catch (e) {
        }
      }
      
      // Check various possible data structures
      if (data.data && data.data.details && data.data.details.descriptors) {
        structureData = data.data.details.descriptors;
      } else if (data.details && data.details.descriptors) {
        structureData = data.details.descriptors;
      } else if (data.descriptors) {
        structureData = data.descriptors;
      } else if (data.STRUCTURE_PREPARATION && data.STRUCTURE_PREPARATION.descriptors) {
        structureData = data.STRUCTURE_PREPARATION.descriptors;
      } else if (data.atom_count || data.residue_count || data.chain_count) {
        structureData = {
          num_atoms: data.atom_count,
          num_residues: data.residue_count,
          num_chains: data.chain_count,
          hetatm_count: data.hetatm_count,
          has_hydrogens: data.has_hydrogens,
          has_ligands: data.has_ligands,
        };
      } else if (data.structure_preparation && data.structure_preparation.descriptors) {
        structureData = data.structure_preparation.descriptors;
      } else if (data.data) {
        // If data.data exists but doesn't have the expected structure, check if it needs parsing
        if (typeof data.data === 'string') {
          try {
            // Try to parse if it's a JSON string
            const parsed = JSON.parse(data.data);
            if (parsed.details && parsed.details.descriptors) {
              structureData = parsed.details.descriptors;
            } else if (parsed.descriptors) {
              structureData = parsed.descriptors;
            } else {
              structureData = parsed;
            }
          } catch (e) {
            structureData = data.data;
          }
        } else {
          structureData = data.data;
        }
      } else {
        // Last resort - use all the data we have
        structureData = { ...data };
        
        // If data.data exists and is an object, merge it in
        if (data.data && typeof data.data === 'object') {
          structureData = { ...structureData, ...data.data };
          // Remove the nested data field to avoid duplication
          delete structureData.data;
        }
      }

      // Flatten: if nested data object holds details/descriptors, hoist them
      if (data.data && typeof data.data === 'object') {
        if (!structureData.details && data.data.details) {
          structureData.details = data.data.details;
        }
        if (!structureData.descriptors && data.data.descriptors) {
          structureData.descriptors = data.data.descriptors;
        }
      }
    }

    // If structureData is still a string, try to parse it
    if (typeof structureData === 'string') {
      try {
        structureData = JSON.parse(structureData);
      } catch (e) {
      }
    }

    

    if (Object.keys(structureData).length === 0) {
      return (
        <Box>
          <Typography variant="h6" gutterBottom>
            Structure Preparation Results
          </Typography>
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No structure analysis results available
            </Typography>
          </Paper>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Structure Analysis Results
        </Typography>
        <Paper sx={{ p: 3, mb: 3 }}>
          <TableContainer>
            <Table sx={{ minWidth: 500 }}>
              <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Property</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  // Extract and flatten the data properly
                  const rows = {};
                  
                  
                  // If structureData has a 'data' field, extract from it
                  if (structureData.data && typeof structureData.data === 'object') {
                    const nestedData = structureData.data;
                    
                    // Extract details and descriptors if they exist
                    if (nestedData.details) {
                      // If details is a string, try to parse it
                      if (typeof nestedData.details === 'string') {
                        try {
                          rows['Details'] = JSON.parse(nestedData.details);
                        } catch (e) {
                          rows['Details'] = nestedData.details;
                        }
                      } else {
                        rows['Details'] = nestedData.details;
                      }
                    }
                    if (nestedData.descriptors) {
                      // If descriptors is a string, try to parse it
                      if (typeof nestedData.descriptors === 'string') {
                        try {
                          rows['Descriptors'] = JSON.parse(nestedData.descriptors);
                        } catch (e) {
                          rows['Descriptors'] = nestedData.descriptors;
                        }
                      } else {
                        rows['Descriptors'] = nestedData.descriptors;
                      }
                    }
                    if (nestedData.method) {
                      rows['Method'] = nestedData.method;
                    }
                    if (nestedData.pdb_id || nestedData.pdbId) {
                      rows['Pdb Id'] = nestedData.pdb_id || nestedData.pdbId;
                    }
                    if (nestedData.status) {
                      rows['Status'] = nestedData.status;
                    }
                    if (nestedData.workflow_id || nestedData.workflowId) {
                      rows['Workflow Id'] = nestedData.workflow_id || nestedData.workflowId;
                    }
                  } else {
                    // No nested data field, use structureData directly
                    Object.entries(structureData).forEach(([key, value]) => {
                      const keyLower = key.toLowerCase();
                      
                      // Skip raw PDB data
                      if (typeof value === 'string' && value.length > 1000 && 
                          (value.includes('ATOM') || value.includes('HETATM'))) {
                        return;
                      }
                      
                      // Skip large raw fields
                      if ((keyLower === 'pdb_content' || keyLower === 'structure_data' || 
                           keyLower === 'raw_data' || keyLower === 'file_content') && 
                          typeof value === 'string' && value.length > 100) {
                        return;
                      }
                      
                      rows[key] = value;
                    });
                  }
                  
                  // Also add top-level metadata fields
                  if (structureData.error !== undefined) {
                    rows['Error'] = structureData.error || '';
                  }
                  if (structureData.success !== undefined) {
                    rows['Success'] = structureData.success;
                  }
                  

                  return Object.entries(rows).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell sx={{ verticalAlign: 'top', fontWeight: 'medium' }}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Try to parse string values that might be JSON
                          let displayValue = value;
                          if (typeof value === 'string') {
                            // Check if it looks like JSON
                            if ((value.startsWith('{') && value.endsWith('}')) || 
                                (value.startsWith('[') && value.endsWith(']'))) {
                              try {
                                displayValue = JSON.parse(value);
                              } catch (e) {
                                // Not valid JSON, use as is
                                displayValue = value;
                              }
                            }
                            // Also check if it's "[object Object]" string
                            else if (value === '[object Object]') {
                              displayValue = 'Data not properly formatted';
                            }
                          }
                          
                          // Now render based on type
                          if (typeof displayValue === 'boolean') {
                            return displayValue ? 'Yes' : 'No';
                          } else if (typeof displayValue === 'number') {
                            return displayValue.toFixed(2);
                          } else if (typeof displayValue === 'object' && displayValue !== null) {
                            // For large nested objects, show a formatted view
                            const entries = Object.entries(displayValue);
                            
                            // If it's a very large object (like raw data), show it in a more compact format
                            if (entries.length > 20 || JSON.stringify(displayValue).length > 1000) {
                              return (
                                <Box sx={{ 
                                  p: 1, 
                                  backgroundColor: '#f8f9fa', 
                                  borderRadius: 1,
                                  maxHeight: '200px',
                                  overflowY: 'auto',
                                  fontSize: '0.85rem',
                                  fontFamily: 'monospace'
                                }}>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {JSON.stringify(displayValue, null, 2)}
                                  </pre>
                                </Box>
                              );
                            }
                            
                            // For smaller objects, show in table format
                            return (
                            <Box sx={{ p: 1, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                              <Table size="small" sx={{ minWidth: 'auto' }}>
                                <TableBody>
                                  {entries.map(([subKey, subValue]) => (
                                    <TableRow key={subKey} sx={{ 
                                      '&:last-child td': { border: 0 },
                                      '& td': { borderBottom: '1px solid #e0e0e0' }
                                    }}>
                                      <TableCell sx={{ 
                                        py: 0.75, 
                                        px: 1, 
                                        fontSize: '0.875rem', 
                                        fontWeight: 500,
                                        color: '#555',
                                        width: '40%'
                                      }}>
                                        {subKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                      </TableCell>
                                      <TableCell sx={{ 
                                        py: 0.75, 
                                        px: 1, 
                                        fontSize: '0.875rem',
                                        fontWeight: 400
                                      }}>
                                        {(() => {
                                          // Handle different types of subValue
                                          if (typeof subValue === 'number') {
                                            return subValue.toFixed(2);
                                          } else if (typeof subValue === 'boolean') {
                                            return subValue ? 'Yes' : 'No';
                                          } else if (typeof subValue === 'object' && subValue !== null) {
                                            // Render nested object as a table
                                            return (
                                            <Box sx={{ p: 0.5, backgroundColor: '#f0f0f0', borderRadius: 0.5, mt: 0.5 }}>
                                              <Table size="small" sx={{ minWidth: 'auto' }}>
                                                <TableBody>
                                                  {Object.entries(subValue).map(([nestedKey, nestedValue]) => (
                                                    <TableRow key={nestedKey} sx={{ 
                                                      '&:last-child td': { border: 0 },
                                                      '& td': { borderBottom: '1px solid #ddd' }
                                                    }}>
                                                      <TableCell sx={{ 
                                                        py: 0.5, 
                                                        px: 0.75, 
                                                        fontSize: '0.8rem', 
                                                        fontWeight: 500,
                                                        color: '#666',
                                                        width: '45%'
                                                      }}>
                                                        {nestedKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                      </TableCell>
                                                      <TableCell sx={{ py: 0.5, px: 0.75, fontSize: '0.8rem' }}>
                                                        {(() => {
                                                          if (typeof nestedValue === 'number') {
                                                            return nestedValue.toFixed(2);
                                                          } else if (typeof nestedValue === 'boolean') {
                                                            return nestedValue ? 'Yes' : 'No';
                                                          } else if (typeof nestedValue === 'object' && nestedValue !== null) {
                                                            // For deeply nested objects, show as a compact table
                                                            return (
                                                              <Box sx={{ mt: 0.5 }}>
                                                                <Table size="small" sx={{ minWidth: 'auto', '& td': { py: 0.25, px: 0.5, fontSize: '0.75rem', border: 'none' } }}>
                                                                  <TableBody>
                                                                    {Object.entries(nestedValue).map(([deepKey, deepValue]) => (
                                                                      <TableRow key={deepKey}>
                                                                        <TableCell sx={{ fontWeight: 500, color: '#888', width: '50%' }}>
                                                                          {deepKey.replace(/_/g, ' ')}:
                                                                        </TableCell>
                                                                        <TableCell>
                                                                          {typeof deepValue === 'number' ? deepValue.toFixed(2) : 
                                                                           typeof deepValue === 'boolean' ? (deepValue ? 'Yes' : 'No') :
                                                                           typeof deepValue === 'object' ? JSON.stringify(deepValue) : String(deepValue)}
                                                                        </TableCell>
                                                                      </TableRow>
                                                                    ))}
                                                                  </TableBody>
                                                                </Table>
                                                              </Box>
                                                            );
                                                          } else {
                                                            return String(nestedValue);
                                                          }
                                                        })()}
                                                      </TableCell>
                                                    </TableRow>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            </Box>
                                            );
                                          } else {
                                            // For strings and other primitives
                                            return String(subValue);
                                          }
                                        })()}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                            );
                          } else {
                            // For strings and other types, display as is
                            return displayValue;
                          }
                        })()}
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 3D Protein Structure Visualization */}
          <Box sx={{ mt: 4, mb: 3 }}>
            <ProteinViewer3D 
              pdbId={results?.pdbId || results?.pdb_id || workflow?.pdb_id || workflow?.pdbId}
              workflowId={params?.id} 
              stage="structure_preparation"
              bindingSites={null}
            />
          </Box>

          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleDownloadResults}
                sx={{
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  color: 'white',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1976D2 30%, #0288D1 90%)',
                  },
                }}
              >
                Download Results
              </Button>

              {!blockchainCommitted ? (
                <>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={commitToBlockchain}
                    disabled={commitLoading}
                    sx={{
                      background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
                      color: 'white',
                      '&:hover': {
                        background: 'linear-gradient(45deg, #388E3C 30%, #689F38 90%)',
                      },
                    }}
                  >
                    {commitLoading ? <CircularProgress size={24} /> : 'Commit to Blockchain'}
                  </Button>
                  {onProceedWithoutCommitting && (
                    <Button
                      variant="outlined"
                      onClick={() => onProceedWithoutCommitting(stage, results)}
                      sx={{
                        borderColor: '#FF9800',
                        color: '#FF9800',
                        '&:hover': {
                          borderColor: '#F57C00',
                          backgroundColor: 'rgba(255, 152, 0, 0.08)',
                        },
                      }}
                    >
                      Proceed Without Committing
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  variant="contained"
                  color="info"
                  onClick={verifyResults}
                  disabled={verifyLoading}
                  sx={{
                    background: 'linear-gradient(45deg, #00BCD4 30%, #009688 90%)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #0097A7 30%, #00796B 90%)',
                    },
                  }}
                >
                  {verifyLoading ? <CircularProgress size={24} /> : 'Verify'}
                </Button>
              )}
            </Box>

            {blockchainCommitted && ipfsHash && blockchainTxHash && (
              <Paper sx={{ p: 2, mt: 2, backgroundColor: 'rgba(46, 125, 50, 0.05)', border: '1px solid rgba(46, 125, 50, 0.2)' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                  Blockchain & IPFS Records
                </Typography>
                <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  <Typography variant="body2">
                    <strong>IPFS Hash:</strong> 
                    <a 
                      href={`https://gateway.pinata.cloud/ipfs/${ipfsHash}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#1976d2', textDecoration: 'none', marginLeft: '8px' }}
                    >
                      {ipfsHash}
                    </a>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Blockchain Tx:</strong> 
                    <a 
                      href={`https://nsllab-kit.onrender.com/purechain/api/v1/tx/${blockchainTxHash}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#1976d2', textDecoration: 'none', marginLeft: '8px' }}
                    >
                      {blockchainTxHash}
                    </a>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Receipt:</strong> 
                    <a 
                      href={`https://nsllab-kit.onrender.com/purechain/api/v1/receipt/${blockchainTxHash}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#1976d2', textDecoration: 'none', marginLeft: '8px' }}
                    >
                      View Official Receipt
                    </a>
                  </Typography>
                </Box>
              </Paper>
            )}

            {verificationResult && (
              <Box sx={{ mt: 2, p: 2, backgroundColor: verificationResult.verified ? 'rgba(46, 125, 50, 0.1)' : 'rgba(255, 167, 38, 0.1)', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', color: verificationResult.verified ? 'success.main' : 'warning.main' }}>
                  {verificationResult.verified ? '✅ Verification Successful' : '⚠️ Verification Failed'}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>{verificationResult.message}</Typography>
                {verificationResult.blockchainData && (
                  <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <Typography variant="caption" display="block">
                      Block: {verificationResult.blockchainData.blockNumber}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Timestamp: {new Date(verificationResult.blockchainData.timestamp * 1000).toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>
    );
  };

  const renderBindingSites = (data) => {
    let bindingSites = [];

    if (data?.binding_sites && Array.isArray(data.binding_sites) && data.binding_sites.length > 0) {
      bindingSites = data.binding_sites;
    } else if (data?.binding_site_analysis?.binding_sites && Array.isArray(data.binding_site_analysis.binding_sites) && data.binding_site_analysis.binding_sites.length > 0) {
      bindingSites = data.binding_site_analysis.binding_sites;
    }

    if (bindingSites.length === 0) {
      return (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Binding Site Analysis
          </Typography>
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              No binding sites found. Please run binding site analysis.
            </Typography>
            <Button variant="contained" color="primary" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </Paper>
        </Box>
      );
    }



    return (
      <Box>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Binding Site Analysis Results
        </Typography>

        {/* Binding Site Count Summary */}
        <Typography variant="body1" sx={{ mb: 3, fontWeight: 'medium', color: 'text.secondary' }}>
          The total number of detected binding sites is {bindingSites.length}
        </Typography>

        {/* 3D Protein Structure with Binding Sites */}
        <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Binding Site Visualization
          </Typography>
          
          {/* 3D Viewer Container with Binding Sites */}
          <Box sx={{ mb: 3 }}>
            <BindingSiteVisualizer
              bindingSites={bindingSites}
              pdbId={data?.pdb_id || data?.pdbId || workflow?.pdb_id || workflow?.pdbId || results?.pdbId || results?.pdb_id}
              workflowId={params?.id}
              selectedPocketId={selectedPocketId}
              onPocketSelect={setSelectedPocketId}
            />
          </Box>
          
          {/* Simple Controls */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button 
              variant="outlined" 
              size="small" 
              onClick={() => window.location.reload()}
            >
              Refresh Viewer
            </Button>
            <Typography variant="body2" color="text.secondary">
              Protein structure with binding sites highlighted in red
            </Typography>
          </Box>
        </Paper>

        {/* Binding Site Results Table - Now displayed under the 3D viewer */}
        <Paper sx={{ p: 3, mt: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Binding Site Analysis Results
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Site ID</strong></TableCell>
                  <TableCell><strong>Volume (Å³)</strong></TableCell>
                  <TableCell><strong>Druggability Score</strong></TableCell>
                  <TableCell><strong>Hydrophobicity</strong></TableCell>
                  <TableCell><strong>Center Coordinates</strong></TableCell>
                  <TableCell><strong>Key Residues</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bindingSites.map((site, index) => {
                  const siteId = site.id || site.pocket_id || (index + 1);
                  const isSelected = selectedPocketId === siteId;
                  const druggabilityScore = site.druggability || site.score || site.druggability_score || 0;
                  
                  // Color based on druggability score (matching fpocket style)
                  const getPocketColor = (score) => {
                    if (score >= 0.7) return '#d32f2f'; // Red - high druggability
                    if (score >= 0.5) return '#f57c00'; // Orange - medium druggability  
                    return '#fbc02d'; // Yellow - lower druggability
                  };
                  
                  return (
                    <TableRow 
                      key={index} 
                      hover 
                      onClick={() => setSelectedPocketId(isSelected ? null : siteId)}
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                        '&:hover': {
                          backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0, 0, 0, 0.04)'
                        },
                        border: isSelected ? '2px solid #1976d2' : 'none'
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box 
                            sx={{ 
                              width: 12, 
                              height: 12, 
                              borderRadius: '50%', 
                              backgroundColor: getPocketColor(druggabilityScore),
                              border: '1px solid rgba(0,0,0,0.2)'
                            }} 
                          />
                          {siteId}
                        </Box>
                      </TableCell>
                      <TableCell>{site.volume?.toFixed(1) || 'N/A'}</TableCell>
                      <TableCell>{druggabilityScore?.toFixed(3) || 'N/A'}</TableCell>
                      <TableCell>{(site.hydrophobicity || site.hydrophobic_ratio)?.toFixed(3) || 'N/A'}</TableCell>
                      <TableCell>
                        {site.center ? 
                          `(${site.center.x?.toFixed(1)}, ${site.center.y?.toFixed(1)}, ${site.center.z?.toFixed(1)})` : 
                          'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        {site.nearby_residues?.slice(0, 3).map(r => `${r.residue_name}${r.residue_number}`).join(', ') || 
                         site.residues?.slice(0, 3).map(r => `${r.name || r.residue_name}${r.number || r.residue_number}`).join(', ') || 
                         'N/A'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="contained" startIcon={<Download />} onClick={handleDownloadResults} sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}>
            Download Results
          </Button>
        </Box>

        {/* AI-Enhanced Druggability Scoring */}
        <SmartDruggabilityCard
          bindingSites={bindingSites}
          pdbId={data?.pdb_id || data?.pdbId || workflow?.pdb_id || workflow?.pdbId || results?.pdbId || results?.pdb_id}
        />

        {/* Blockchain/IPFS Integration Section */}
        <Paper sx={{ p: 3, mt: 3, borderRadius: 2, backgroundColor: 'rgba(25, 118, 210, 0.02)' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
            🔗 Blockchain & IPFS Integration
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            Commit your binding site analysis results to blockchain for permanent provenance and integrity verification.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {!blockchainCommitted ? (
              <>
                <Button
                  variant="contained"
                  onClick={commitToBlockchain}
                  disabled={commitLoading}
                  sx={{
                    background: 'linear-gradient(45deg, #2E7D32 30%, #388E3C 90%)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #1B5E20 30%, #2E7D32 90%)',
                    },
                  }}
                >
                  {commitLoading ? <CircularProgress size={24} /> : 'Commit to Blockchain'}
                </Button>
                {onProceedWithoutCommitting && (
                  <Button
                    variant="outlined"
                    onClick={() => onProceedWithoutCommitting(stage, results)}
                    sx={{
                      borderColor: '#FF9800',
                      color: '#FF9800',
                      '&:hover': {
                        borderColor: '#F57C00',
                        backgroundColor: 'rgba(255, 152, 0, 0.08)',
                      },
                    }}
                  >
                    Proceed Without Committing
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="contained"
                color="info"
                onClick={verifyResults}
                disabled={verifyLoading}
                sx={{
                  background: 'linear-gradient(45deg, #00BCD4 30%, #009688 90%)',
                  color: 'white',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #0097A7 30%, #00796B 90%)',
                  },
                }}
              >
                {verifyLoading ? <CircularProgress size={24} /> : 'Verify'}
              </Button>
            )}
          </Box>

          {blockchainCommitted && ipfsHash && blockchainTxHash && (
            <Paper sx={{ p: 2, mt: 2, backgroundColor: 'rgba(46, 125, 50, 0.05)', border: '1px solid rgba(46, 125, 50, 0.2)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                Blockchain & IPFS Records
              </Typography>
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                <Typography variant="body2"><strong>IPFS Hash:</strong> {ipfsHash}</Typography>
                <Typography variant="body2"><strong>Blockchain Tx:</strong> {blockchainTxHash}</Typography>
              </Box>
            </Paper>
          )}

          {verificationResult && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: verificationResult.verified ? 'rgba(46, 125, 50, 0.1)' : 'rgba(255, 167, 38, 0.1)', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: verificationResult.verified ? 'success.main' : 'warning.main' }}>
                {verificationResult.verified ? '✅ Verification Successful' : '⚠️ Verification Failed'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>{verificationResult.message}</Typography>
              {verificationResult.blockchainData && (
                <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                  <Typography variant="caption" display="block">
                    Block: {verificationResult.blockchainData.blockNumber}
                  </Typography>
                  <Typography variant="caption" display="block">
                    Timestamp: {new Date(verificationResult.blockchainData.timestamp * 1000).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Paper>
      </Box>
    );
  };

  const renderMDResults = (data) => {
    const compoundResults = data.compound_results || [];
    const successful = compoundResults.filter(c => c.status !== 'failed');
    const trajectories = data.trajectories || [];

    const stabilityColor = (verdict) => {
      switch (verdict) {
        case 'stable': return 'success';
        case 'moderately_stable': return 'warning';
        case 'unstable': return 'error';
        default: return 'default';
      }
    };

    const stabilityIcon = (verdict) => {
      switch (verdict) {
        case 'stable': return <CheckCircle fontSize="small" />;
        case 'moderately_stable': return <Warning fontSize="small" />;
        case 'unstable': return <ErrorIcon fontSize="small" />;
        default: return null;
      }
    };

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Molecular Dynamics Simulation Results
          </Typography>
          <Button variant="contained" startIcon={<Download />} onClick={handleDownloadResults} sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}>
            Download Results
          </Button>
        </Box>

        {/* Simulation Summary */}
        <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f8fafc' }}>
          <Typography variant="subtitle1" gutterBottom>Simulation Parameters</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Temperature</Typography>
              <Typography variant="body1" fontWeight="bold">{data.temperature_kelvin || 300} K</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Simulation Time</Typography>
              <Typography variant="body1" fontWeight="bold">{data.simulation_time_ns || '—'} ns</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Steps</Typography>
              <Typography variant="body1" fontWeight="bold">{(data.simulation_steps || 0).toLocaleString()}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Timestep</Typography>
              <Typography variant="body1" fontWeight="bold">{data.timestep_ps || 0.002} ps</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Compounds Simulated</Typography>
              <Typography variant="body1" fontWeight="bold">{data.compounds_simulated || 0}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Stable Compounds</Typography>
              <Typography variant="body1" fontWeight="bold" color="success.main">{data.stable_compounds || 0}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Avg RMSD</Typography>
              <Typography variant="body1" fontWeight="bold">{data.average_rmsd_angstrom?.toFixed(2) || '—'} Å</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Avg Interaction Energy</Typography>
              <Typography variant="body1" fontWeight="bold">{data.average_interaction_energy_kcal?.toFixed(1) || '—'} kcal/mol</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Computation Time</Typography>
              <Typography variant="body1" fontWeight="bold">{data.total_computation_time_seconds?.toFixed(1) || '—'}s</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Compound Results Table */}
        <Typography variant="subtitle1" gutterBottom>Compound Stability Rankings</Typography>
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                <TableCell>Rank</TableCell>
                <TableCell>Compound</TableCell>
                <TableCell>Stability</TableCell>
                <TableCell align="right">RMSD (Å)</TableCell>
                <TableCell align="right">Interaction Energy</TableCell>
                <TableCell align="right">Energy Change</TableCell>
                <TableCell align="right">Rg (Å)</TableCell>
                <TableCell align="right">Vina/Score</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {successful.map((comp, idx) => (
                <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#f9f9f9' } }}>
                  <TableCell>{comp.rank || idx + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">{comp.name}</Typography>
                    {comp.category && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {comp.category.replace(/_/g, ' ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={stabilityIcon(comp.stability_verdict)}
                      label={comp.stability_verdict?.replace(/_/g, ' ') || 'unknown'}
                      size="small"
                      color={stabilityColor(comp.stability_verdict)}
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell align="right">{comp.rmsd_angstrom?.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={comp.interaction_energy_kcal < -10 ? 'success.main' : comp.interaction_energy_kcal < 0 ? 'text.primary' : 'error.main'}
                      fontWeight="bold"
                    >
                      {comp.interaction_energy_kcal?.toFixed(1)} kcal/mol
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      color={comp.energy_change_kcal < 0 ? 'success.main' : 'error.main'}
                    >
                      {comp.energy_change_kcal > 0 ? '+' : ''}{comp.energy_change_kcal?.toFixed(1)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{comp.radius_of_gyration_angstrom?.toFixed(2)}</TableCell>
                  <TableCell align="right">
                    {comp.vina_score_kcal
                      ? `${comp.vina_score_kcal} kcal/mol`
                      : comp.predicted_binding_affinity_kcal
                        ? `${comp.predicted_binding_affinity_kcal} kcal/mol`
                        : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Energy breakdown per compound (expandable) */}
        <Typography variant="subtitle1" gutterBottom>Compound Details</Typography>
        {successful.map((comp, idx) => (
          <Accordion key={idx}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography sx={{ flexGrow: 1 }}>{comp.rank || idx + 1}. {comp.name}</Typography>
                <Chip
                  label={comp.stability_verdict?.replace(/_/g, ' ')}
                  size="small"
                  color={stabilityColor(comp.stability_verdict)}
                  sx={{ textTransform: 'capitalize' }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {/* Energy Breakdown */}
                {comp.energy_breakdown && (
                  <Box sx={{ minWidth: 250 }}>
                    <Typography variant="subtitle2" gutterBottom>Energy Breakdown</Typography>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Van der Waals</TableCell>
                          <TableCell align="right">{comp.energy_breakdown.van_der_waals_kcal?.toFixed(2)} kcal/mol</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Electrostatic</TableCell>
                          <TableCell align="right">{comp.energy_breakdown.electrostatic_kcal?.toFixed(2)} kcal/mol</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Hydrogen Bond</TableCell>
                          <TableCell align="right">{comp.energy_breakdown.hydrogen_bond_kcal?.toFixed(2)} kcal/mol</TableCell>
                        </TableRow>
                        <TableRow sx={{ fontWeight: 'bold' }}>
                          <TableCell><strong>Total</strong></TableCell>
                          <TableCell align="right"><strong>{comp.energy_breakdown.total_kcal?.toFixed(2)} kcal/mol</strong></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Box>
                )}

                {/* Key Residue Interactions */}
                {comp.residue_interactions && comp.residue_interactions.length > 0 && (
                  <Box sx={{ minWidth: 300 }}>
                    <Typography variant="subtitle2" gutterBottom>Top Interacting Residues</Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Residue</TableCell>
                          <TableCell align="right">Energy</TableCell>
                          <TableCell align="right">Distance</TableCell>
                          <TableCell align="right">Contacts</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comp.residue_interactions.slice(0, 5).map((res, ri) => (
                          <TableRow key={ri}>
                            <TableCell>{res.residue}</TableCell>
                            <TableCell align="right">{res.interaction_energy_kcal?.toFixed(1)}</TableCell>
                            <TableCell align="right">{res.min_distance_angstrom?.toFixed(1)} Å</TableCell>
                            <TableCell align="right">{res.n_contacts}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}

                {/* SMILES */}
                {comp.smiles && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>SMILES</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {comp.smiles}
                    </Typography>
                  </Box>
                )}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}

        {/* Trajectory Energy Convergence */}
        {trajectories.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Energy Convergence</Typography>
            {trajectories.map((traj, idx) => (
              <Accordion key={idx}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Typography sx={{ flexGrow: 1 }}>{traj.compound_name}</Typography>
                    <Chip
                      label={traj.converged ? 'Converged' : 'Not converged'}
                      size="small"
                      color={traj.converged ? 'success' : 'warning'}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {/* Snapshots table */}
                    {traj.snapshots && traj.snapshots.length > 0 && (
                      <Box sx={{ minWidth: 350 }}>
                        <Typography variant="subtitle2" gutterBottom>Trajectory Snapshots</Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Step</TableCell>
                              <TableCell>Time (ps)</TableCell>
                              <TableCell align="right">Energy (kcal/mol)</TableCell>
                              <TableCell align="right">RMSD (Å)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {traj.snapshots.map((snap, si) => (
                              <TableRow key={si}>
                                <TableCell>{snap.step}</TableCell>
                                <TableCell>{snap.time_ps}</TableCell>
                                <TableCell align="right">{snap.energy_kcal?.toFixed(1)}</TableCell>
                                <TableCell align="right">{snap.rmsd_angstrom?.toFixed(3)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    )}

                    {/* Simple energy progress bar */}
                    {traj.energy_series && traj.energy_series.length > 1 && (
                      <Box sx={{ minWidth: 250 }}>
                        <Typography variant="subtitle2" gutterBottom>Energy Profile</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Initial: {traj.energy_series[0]?.toFixed(1)} kcal/mol
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          Final: {traj.energy_series[traj.energy_series.length - 1]?.toFixed(1)} kcal/mol
                        </Typography>
                        <br />
                        <Typography variant="caption" color={
                          traj.energy_series[traj.energy_series.length - 1] < traj.energy_series[0] ? 'success.main' : 'error.main'
                        }>
                          Change: {(traj.energy_series[traj.energy_series.length - 1] - traj.energy_series[0]).toFixed(1)} kcal/mol
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {/* Residue RMSF Summary */}
        {data.residue_rmsf_summary && data.residue_rmsf_summary.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Key Binding Pocket Residues</Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell>Residue</TableCell>
                    <TableCell align="right">Avg Interaction Energy</TableCell>
                    <TableCell align="right">Avg Min Distance</TableCell>
                    <TableCell align="right">Total Contacts</TableCell>
                    <TableCell align="right">Compounds Interacting</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.residue_rmsf_summary.map((res, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{res.residue}</TableCell>
                      <TableCell align="right">{res.avg_interaction_energy_kcal?.toFixed(2)} kcal/mol</TableCell>
                      <TableCell align="right">{res.avg_min_distance_angstrom?.toFixed(1)} Å</TableCell>
                      <TableCell align="right">{res.total_contacts}</TableCell>
                      <TableCell align="right">{res.compounds_interacting}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Blockchain commit & proceed buttons */}
        <Paper sx={{ p: 3, mt: 3, border: '1px solid #e0e0e0' }}>
          <Typography variant="subtitle1" gutterBottom>
            Commit Results
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Commit your molecular dynamics results to blockchain for permanent provenance and integrity verification.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {!blockchainCommitted ? (
              <>
                <Button
                  variant="contained"
                  onClick={commitToBlockchain}
                  disabled={commitLoading}
                  sx={{
                    background: 'linear-gradient(45deg, #2E7D32 30%, #388E3C 90%)',
                    color: 'white',
                    '&:hover': { background: 'linear-gradient(45deg, #1B5E20 30%, #2E7D32 90%)' },
                  }}
                >
                  {commitLoading ? <CircularProgress size={24} /> : 'Commit to Blockchain'}
                </Button>
                {onProceedWithoutCommitting && (
                  <Button
                    variant="outlined"
                    onClick={() => onProceedWithoutCommitting(stage, results)}
                    sx={{
                      borderColor: '#FF9800', color: '#FF9800',
                      '&:hover': { borderColor: '#F57C00', backgroundColor: 'rgba(255, 152, 0, 0.08)' },
                    }}
                  >
                    Proceed Without Committing
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="contained"
                color="info"
                onClick={verifyResults}
                disabled={verifyLoading}
                sx={{
                  background: 'linear-gradient(45deg, #00BCD4 30%, #009688 90%)',
                  color: 'white',
                  '&:hover': { background: 'linear-gradient(45deg, #0097A7 30%, #00796B 90%)' },
                }}
              >
                {verifyLoading ? <CircularProgress size={24} /> : 'Verify'}
              </Button>
            )}
          </Box>

          {blockchainCommitted && ipfsHash && blockchainTxHash && (
            <Paper sx={{ p: 2, mt: 2, backgroundColor: 'rgba(46, 125, 50, 0.05)', border: '1px solid rgba(46, 125, 50, 0.2)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                Blockchain & IPFS Records
              </Typography>
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                <Typography variant="body2"><strong>IPFS Hash:</strong> {ipfsHash}</Typography>
                <Typography variant="body2"><strong>Blockchain Tx:</strong> {blockchainTxHash}</Typography>
              </Box>
            </Paper>
          )}

          {verificationResult && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: verificationResult.verified ? 'rgba(46, 125, 50, 0.1)' : 'rgba(255, 167, 38, 0.1)', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', color: verificationResult.verified ? 'success.main' : 'warning.main' }}>
                {verificationResult.verified ? '✅ Verification Successful' : '⚠️ Verification Failed'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>{verificationResult.message}</Typography>
            </Box>
          )}
        </Paper>
      </Box>
    );
  };

  const renderOptimizationResults = (data) => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Lead Optimization Results
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Compound</TableCell>
              <TableCell>Predicted Activity</TableCell>
              <TableCell>Synthetic Accessibility</TableCell>
              <TableCell>Drug Likeness</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.optimized_compounds.map((compound, index) => (
              <TableRow key={index}>
                <TableCell>{compound.name}</TableCell>
                <TableCell>{compound.predicted_activity.toFixed(2)}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: '100%', mr: 1 }}>
                      <LinearProgress variant="determinate" value={compound.synthetic_accessibility * 10} />
                    </Box>
                    <Box sx={{ minWidth: 35 }}>
                      <Typography variant="body2">{compound.synthetic_accessibility.toFixed(1)}/10</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{compound.drug_likeness.toFixed(2)}</TableCell>
                <TableCell>
                  <Button size="small" variant="outlined">View</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderVirtualScreeningResults = (data) => {
    // Handle both 'completed' and 'success' status values
    if (!data || (data.status !== 'completed' && data.status !== 'success')) {
      return (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Virtual Screening Analysis
          </Typography>
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {data ? `Status: ${data.status}` : 'No data available.'}
            </Typography>
            {data && data.status === 'running' && <LinearProgress sx={{ mb: 2 }} />}
            <Button variant="contained" color="primary" onClick={() => window.location.reload()}>
              Check Status
            </Button>
          </Paper>
        </Box>
      );
    }

    const compounds = data.top_compounds || [];
    const isVinaDocking = data.method === 'autodock_vina';

    return (
      <Box>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          {isVinaDocking ? 'Vina Molecular Docking Results' : 'Virtual Screening Results'}
        </Typography>

        {/* Summary card */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2, background: isVinaDocking ? 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' : 'linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%)' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Compounds Screened</Typography>
              <Typography variant="h5" fontWeight="bold">{data.compounds_screened || compounds.length}</Typography>
            </Box>
            {isVinaDocking && data.compounds_docked != null && (
              <Box>
                <Typography variant="caption" color="text.secondary">Successfully Docked</Typography>
                <Typography variant="h5" fontWeight="bold">{data.compounds_docked}</Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">Hits Found</Typography>
              <Typography variant="h5" fontWeight="bold" color="success.main">{data.hits_found || 0}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Method</Typography>
              <Typography variant="body1">{isVinaDocking ? 'AutoDock Vina' : (data.method || 'physics_based_scoring').replace(/_/g, ' ')}</Typography>
            </Box>
            {data.binding_site_used && (
              <Box>
                <Typography variant="caption" color="text.secondary">Pocket Volume</Typography>
                <Typography variant="body1">{data.binding_site_used.volume?.toFixed(0) || 'N/A'} &#x212B;&sup3;</Typography>
              </Box>
            )}
            {isVinaDocking && data.total_docking_time_seconds != null && (
              <Box>
                <Typography variant="caption" color="text.secondary">Docking Time</Typography>
                <Typography variant="body1">{data.total_docking_time_seconds}s</Typography>
              </Box>
            )}
            {isVinaDocking && data.docking_failures > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">Failures</Typography>
                <Typography variant="body1" color="warning.main">{data.docking_failures}</Typography>
              </Box>
            )}
          </Box>
        </Paper>

        {/* Top compounds table */}
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            Top Ranked Compounds
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Compound</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Score</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">Binding Affinity</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">MW</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="right">LogP</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">Lipinski</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>SMILES</TableCell>
                  {isVinaDocking && (
                    <TableCell sx={{ fontWeight: 'bold' }} align="center">Pose</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {compounds.map((compound, idx) => (
                  <TableRow key={compound.name || compound.id || idx} hover>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{compound.name || compound.id || `Compound ${idx + 1}`}</TableCell>
                    <TableCell>
                      <Box component="span" sx={{
                        px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem',
                        backgroundColor: 'action.hover',
                        textTransform: 'capitalize'
                      }}>
                        {(compound.category || 'unknown').replace(/_/g, ' ')}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold', color: compound.score >= 0.7 ? 'success.main' : compound.score >= 0.5 ? 'warning.main' : 'text.secondary' }}>
                      {compound.score?.toFixed(3) || 'N/A'}
                    </TableCell>
                    <TableCell align="right">
                      {compound.predicted_binding_affinity_kcal != null
                        ? `${compound.predicted_binding_affinity_kcal} kcal/mol`
                        : 'N/A'}
                    </TableCell>
                    <TableCell align="right">{compound.molecular_weight?.toFixed(1) || 'N/A'}</TableCell>
                    <TableCell align="right">{compound.logP?.toFixed(1) || 'N/A'}</TableCell>
                    <TableCell align="center">
                      {compound.lipinski_violations !== undefined && compound.lipinski_violations !== null ? (
                        <Box component="span" sx={{
                          px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem',
                          backgroundColor: compound.lipinski_violations === 0 ? 'success.light' : compound.lipinski_violations === 1 ? 'warning.light' : 'error.light',
                          color: compound.lipinski_violations === 0 ? 'success.dark' : compound.lipinski_violations === 1 ? 'warning.dark' : 'error.dark',
                        }}>
                          {compound.lipinski_violations === 0 ? 'Pass' : `${compound.lipinski_violations} violation${compound.lipinski_violations > 1 ? 's' : ''}`}
                        </Box>
                      ) : 'N/A'}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {compound.smiles}
                    </TableCell>
                    {isVinaDocking && (
                      <TableCell align="center">
                        {compound.has_pose ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setSelectedPoseCompound(compound)}
                            sx={{ textTransform: 'none', fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
                          >
                            View Pose
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.secondary">N/A</Typography>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Score breakdown for top compound (physics-based only) */}
          {!isVinaDocking && compounds.length > 0 && compounds[0].score_breakdown && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Score Breakdown — {compounds[0].name || 'Top Compound'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {Object.entries(compounds[0].score_breakdown).map(([key, value]) => (
                  <Box key={key} sx={{ minWidth: 140 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {key.replace(/_/g, ' ')}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(value * 100, 100)}
                      sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
                    />
                    <Typography variant="body2" fontWeight="bold">{(value * 100).toFixed(0)}%</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* All poses scores for Vina top compound — clickable to view pose */}
          {isVinaDocking && compounds.length > 0 && compounds[0].all_poses_scores?.length > 1 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Top Compound Pose Scores — {compounds[0].name}
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>(click to view)</Typography>
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {compounds[0].all_poses_scores.map((score, i) => (
                  <Box
                    key={i}
                    component="span"
                    onClick={() => {
                      if (compounds[0].has_pose) {
                        setSelectedPoseCompound({ ...compounds[0], selected_pose_index: i });
                      }
                    }}
                    sx={{
                      px: 1.5, py: 0.5, borderRadius: 1, fontSize: '0.8rem',
                      backgroundColor: i === 0 ? 'success.light' : 'action.hover',
                      color: i === 0 ? 'success.dark' : 'text.primary',
                      fontWeight: i === 0 ? 'bold' : 'normal',
                      cursor: compounds[0].has_pose ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                      '&:hover': compounds[0].has_pose ? {
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        transform: 'translateY(-1px)',
                      } : {},
                    }}
                  >
                    Pose {i + 1}: {score} kcal/mol
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<Download />} onClick={handleDownloadResults} sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}>
              Download Report
            </Button>

            {!blockchainCommitted ? (
              <>
                <Button
                  variant="contained"
                  color="success"
                  onClick={commitToBlockchain}
                  disabled={commitLoading}
                  sx={{
                    background: 'linear-gradient(45deg, #4CAF50 30%, #8BC34A 90%)',
                    color: 'white',
                    '&:hover': { background: 'linear-gradient(45deg, #388E3C 30%, #689F38 90%)' },
                  }}
                >
                  {commitLoading ? <CircularProgress size={24} /> : 'Commit to Blockchain'}
                </Button>
                {onProceedWithoutCommitting && (
                  <Button
                    variant="outlined"
                    onClick={() => onProceedWithoutCommitting(stage, results)}
                    sx={{
                      borderColor: '#FF9800',
                      color: '#FF9800',
                      '&:hover': { borderColor: '#F57C00', backgroundColor: 'rgba(255, 152, 0, 0.08)' },
                    }}
                  >
                    Proceed Without Committing
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="contained"
                color="info"
                onClick={verifyResults}
                disabled={verifyLoading}
                sx={{
                  background: 'linear-gradient(45deg, #00BCD4 30%, #009688 90%)',
                  color: 'white',
                  '&:hover': { background: 'linear-gradient(45deg, #0097A7 30%, #00796B 90%)' },
                }}
              >
                {verifyLoading ? <CircularProgress size={24} /> : 'Verify'}
              </Button>
            )}
          </Box>

          {/* Blockchain & IPFS records for virtual screening */}
          {blockchainCommitted && ipfsHash && blockchainTxHash && (
            <Paper sx={{ p: 2, mt: 2, backgroundColor: 'rgba(46, 125, 50, 0.05)', border: '1px solid rgba(46, 125, 50, 0.2)' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
                Blockchain & IPFS Records
              </Typography>
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                <Typography variant="body2">
                  <strong>IPFS Hash:</strong>{' '}
                  <a href={`https://gateway.pinata.cloud/ipfs/${ipfsHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'none' }}>
                    {ipfsHash}
                  </a>
                </Typography>
                <Typography variant="body2">
                  <strong>Blockchain Tx:</strong>{' '}
                  <a href={`https://nsllab-kit.onrender.com/purechain/api/v1/tx/${blockchainTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'none' }}>
                    {blockchainTxHash}
                  </a>
                  {' | '}
                  <a href={`https://nsllab-kit.onrender.com/purechain/api/v1/tx/${blockchainTxHash}/receipt`} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'none' }}>
                    Receipt
                  </a>
                </Typography>
              </Box>
              {verificationResult && (
                <Box sx={{ mt: 1, p: 1, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 1 }}>
                  <Typography variant="body2" color="success.main">
                    Verified on block #{verificationResult.blockNumber} at {new Date(verificationResult.timestamp).toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </Paper>

        {/* Docking pose 3D viewer dialog */}
        {selectedPoseCompound && (
          <DockingPoseViewer
            compound={selectedPoseCompound}
            workflowId={params?.id}
            pdbId={data?.binding_site_used?.pdb_id || data?.pdb_id}
            onClose={() => setSelectedPoseCompound(null)}
          />
        )}
      </Box>
    );
  };

  const renderStageResults = () => {

    if (!results) {
      return <Typography>No results available for this workflow.</Typography>;
    }

    switch (stage) {
      case 'structure_preparation':
        // Check for bioapi format (details.descriptors) or legacy formats
        return (results.details?.descriptors || results.STRUCTURE_PREPARATION || results.structure_preparation) ? 
          renderStructurePreparation(results) : 
          <Typography>No structure preparation results available.</Typography>;
      case 'binding_site_analysis':
        return (results.binding_site_analysis || results.binding_sites) ? renderBindingSites(results) : <Typography>No binding site analysis results available.</Typography>;
      case 'virtual_screening':
        return results.virtual_screening ? renderVirtualScreeningResults(results.virtual_screening) : <Typography>No virtual screening results available.</Typography>;
      case 'molecular_dynamics':
        return results.molecular_dynamics ? renderMDResults(results.molecular_dynamics) : <Typography>No molecular dynamics results available.</Typography>;
      case 'lead_optimization':
        return results.lead_optimization ? renderOptimizationResults(results.lead_optimization) : <Typography>No lead optimization results available.</Typography>;
      default:
        if (results.structure_preparation || results.STRUCTURE_PREPARATION) return renderStructurePreparation(results);
        if (results.binding_site_analysis) return renderBindingSites(results.binding_site_analysis);
        if (results.virtual_screening) return renderVirtualScreeningResults(results.virtual_screening);
        return <Typography>Select a valid stage to view results.</Typography>;
    }
  };

  // Main component render logic
  if (!results) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', mt: 4 }}>
        <HourglassEmpty sx={{ fontSize: 40, color: 'text.secondary', mb: 2 }} />
        <Typography>Waiting for workflow to complete...</Typography>
      </Paper>
    );
  }

  switch (stage) {
    case 'structure_preparation':
      return renderStructurePreparation(results);
    case 'binding_site_analysis':
    case 'completed':
      return renderBindingSites(results);
    case 'virtual_screening':
      return results.virtual_screening ? renderVirtualScreeningResults(results.virtual_screening) : renderStageResults();
    case 'molecular_dynamics':
      return results.molecular_dynamics ? renderMDResults(results.molecular_dynamics) : renderStageResults();
    case 'lead_optimization':
      return results.lead_optimization ? renderOptimizationResults(results.lead_optimization) : renderStageResults();
    default:
      return (
        <Paper sx={{ p: 4, textAlign: 'center', mt: 4 }}>
          <ErrorOutline sx={{ fontSize: 40, color: 'error.main', mb: 2 }} />
          <Typography color="error">Unknown or invalid workflow stage: '{stage}'</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please check the workflow status and try again.
          </Typography>
        </Paper>
      );
  }
}

export default WorkflowResults;


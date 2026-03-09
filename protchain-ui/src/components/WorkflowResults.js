'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Grid,
} from '@mui/material';
import { ExpandMore, Download, HourglassEmpty, ErrorOutline, CheckCircle, Warning, Error as ErrorIcon, NavigateNext, PictureAsPdf, Image as ImageIcon } from '@mui/icons-material';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
// Import 3D viewers
import ProteinViewer3D from './ProteinViewer3D';
import BindingSiteVisualizer from './BindingSiteVisualizer';
import SmartDruggabilityCard from './SmartDruggabilityCard';
import DockingPoseViewer from './DockingPoseViewer';
import { getIpfsGatewayUrl } from '@/lib/api';
// Alias for backward compatibility
const ProteinViewer = ProteinViewer3D;

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function WorkflowResults({ results, stage, activeTab = 0, workflow = null, onProceedToNextStage = null }) {
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [selectedPocketId, setSelectedPocketId] = useState(null);
  const [selectedPoseCompound, setSelectedPoseCompound] = useState(null);
  const [exportingFormat, setExportingFormat] = useState(null);
  const resultsRef = useRef(null);
  const params = useParams();

  const stageLabel = {
    structure_preparation: 'Structure Preparation',
    binding_site_analysis: 'Binding Site Analysis',
    virtual_screening: 'Virtual Screening',
    molecular_dynamics: 'Molecular Dynamics',
    lead_optimization: 'Lead Optimization',
  }[stage] || stage;

  const handleDownloadPNG = useCallback(async () => {
    if (!resultsRef.current) return;
    setExportingFormat('png');
    try {
      const canvas = await html2canvas(resultsRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: resultsRef.current.scrollWidth,
      });
      canvas.toBlob((blob) => {
        if (blob) saveAs(blob, `workflow-${params.id}-${stage}-${new Date().toISOString().split('T')[0]}.png`);
      }, 'image/png');
    } catch (err) {
      console.error('PNG export error:', err);
    } finally {
      setExportingFormat(null);
    }
  }, [params.id, stage]);

  const handleDownloadPDF = useCallback(async () => {
    if (!resultsRef.current) return;
    setExportingFormat('pdf');
    try {
      const canvas = await html2canvas(resultsRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: resultsRef.current.scrollWidth,
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      // A4 dimensions in points
      const pdfWidth = 595.28;
      const pdfHeight = 841.89;
      const margin = 20;
      const contentWidth = pdfWidth - margin * 2;
      const scaledHeight = (imgHeight * contentWidth) / imgWidth;

      const pdf = new jsPDF({
        orientation: scaledHeight > pdfHeight ? 'portrait' : 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      // Add title
      pdf.setFontSize(16);
      pdf.setTextColor(33, 33, 33);
      pdf.text(`ProtChain — ${stageLabel} Results`, margin, margin + 12);
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Workflow #${params.id} • Exported ${new Date().toLocaleString()}`, margin, margin + 26);

      const headerHeight = 40;
      let yOffset = margin + headerHeight;
      let remainingHeight = scaledHeight;
      let sourceY = 0;

      // Paginate if content is taller than one page
      while (remainingHeight > 0) {
        const availableHeight = pdfHeight - yOffset - margin;
        const sliceHeight = Math.min(availableHeight, remainingHeight);
        const sourceSliceHeight = (sliceHeight / scaledHeight) * imgHeight;

        // Create a temporary canvas for each page slice
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgWidth;
        sliceCanvas.height = sourceSliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, sourceY, imgWidth, sourceSliceHeight, 0, 0, imgWidth, sourceSliceHeight);

        const sliceData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sliceData, 'PNG', margin, yOffset, contentWidth, sliceHeight);

        remainingHeight -= sliceHeight;
        sourceY += sourceSliceHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
          yOffset = margin;
        }
      }

      pdf.save(`workflow-${params.id}-${stage}-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExportingFormat(null);
    }
  }, [params.id, stage, stageLabel]);
  
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

  // Reusable blockchain provenance display
  const BlockchainProvenanceCard = ({ blockchain }) => {
    if (!blockchain) return null;
    if (blockchain.success === false) {
      if (blockchain.skipped) return null; // silently skip if not configured
      return (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Blockchain commit skipped: {blockchain.error || 'Unknown error'}
        </Alert>
      );
    }
    return (
      <Paper sx={{ p: 2, mt: 2, backgroundColor: 'rgba(46, 125, 50, 0.05)', border: '1px solid rgba(46, 125, 50, 0.2)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <CheckCircle sx={{ color: '#2E7D32', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#2E7D32' }}>
            Blockchain Verified (Automatic)
          </Typography>
        </Box>
        <Box sx={{ fontFamily: 'monospace', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            <strong>Tx Hash:</strong>{' '}
            <a href={`https://purechain-explorer.onrender.com/tx/${blockchain.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2' }}>
              {blockchain.txHash}
            </a>
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            <strong>IPFS CID:</strong>{' '}
            <a href={`${getIpfsGatewayUrl()}/ipfs/${blockchain.ipfsHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2' }}>
              {blockchain.ipfsHash}
            </a>
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            <strong>Results Hash (SHA-256):</strong> {blockchain.resultsHash?.slice(0, 16)}...{blockchain.resultsHash?.slice(-8)}
          </Typography>
          {blockchain.blockNumber && (
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              <strong>Block:</strong> {blockchain.blockNumber}
            </Typography>
          )}
        </Box>
        {blockchain.chain && (
          <Box sx={{ mt: 1.5, pl: 2, borderLeft: '3px solid #4CAF50' }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Chained from: <strong>{blockchain.chain.parentStage?.replace(/_/g, ' ')}</strong>
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              Parent Tx: {blockchain.chain.parentTxHash?.slice(0, 24)}...
            </Typography>
          </Box>
        )}
      </Paper>
    );
  };

  const DownloadButtonGroup = ({ label = 'Download Results' }) => (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <Button
        variant="contained"
        startIcon={<Download />}
        onClick={handleDownloadResults}
        size="small"
        sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}
      >
        CSV
      </Button>
      <Button
        variant="contained"
        startIcon={<PictureAsPdf />}
        onClick={handleDownloadPDF}
        disabled={exportingFormat === 'pdf'}
        size="small"
        sx={{ backgroundColor: '#d32f2f', '&:hover': { backgroundColor: '#b71c1c' } }}
      >
        {exportingFormat === 'pdf' ? 'Exporting...' : 'PDF'}
      </Button>
      <Button
        variant="contained"
        startIcon={<ImageIcon />}
        onClick={handleDownloadPNG}
        disabled={exportingFormat === 'png'}
        size="small"
        sx={{ backgroundColor: '#388e3c', '&:hover': { backgroundColor: '#2e7d32' } }}
      >
        {exportingFormat === 'png' ? 'Exporting...' : 'PNG'}
      </Button>
    </Box>
  );

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
      // Unwrap successive { success, data } wrappers (BioAPI + Go backend both wrap)
      let unwrapped = data;
      for (let i = 0; i < 3; i++) {
        if (unwrapped && typeof unwrapped === 'object' && unwrapped.data && typeof unwrapped.data === 'string') {
          try { unwrapped = { ...unwrapped, data: JSON.parse(unwrapped.data) }; } catch (_) { break; }
        }
        if (unwrapped && typeof unwrapped === 'object' && unwrapped.data && typeof unwrapped.data === 'object') {
          // If this level has details.descriptors, stop here — this is the payload level
          if (unwrapped.details && unwrapped.details.descriptors) break;
          unwrapped = unwrapped.data;
        } else {
          break;
        }
      }

      // Now unwrapped should be the innermost payload (e.g. { workflow_id, pdb_id, details: { descriptors } })
      if (unwrapped.details && unwrapped.details.descriptors) {
        structureData = unwrapped.details.descriptors;
      } else if (unwrapped.descriptors) {
        structureData = unwrapped.descriptors;
      } else if (data.STRUCTURE_PREPARATION && data.STRUCTURE_PREPARATION.descriptors) {
        structureData = data.STRUCTURE_PREPARATION.descriptors;
      } else if (data.structure_preparation && data.structure_preparation.descriptors) {
        structureData = data.structure_preparation.descriptors;
      } else if (unwrapped.atom_count || unwrapped.residue_count || unwrapped.chain_count) {
        structureData = {
          num_atoms: unwrapped.atom_count,
          num_residues: unwrapped.residue_count,
          num_chains: unwrapped.chain_count,
          hetatm_count: unwrapped.hetatm_count,
          has_hydrogens: unwrapped.has_hydrogens,
          has_ligands: unwrapped.has_ligands,
        };
      } else if (typeof unwrapped === 'object' && Object.keys(unwrapped).length > 0) {
        structureData = unwrapped;
      } else {
        structureData = { ...data };
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

    // Extract descriptors from various possible nesting levels
    const d = structureData.descriptors || structureData.details?.descriptors || structureData;

    const pdbId = d.pdb_id || structureData.pdb_id || results?.pdbId || results?.pdb_id || '';
    const classification = d.protein_classification || '';
    const analysisMethod = d.analysis_method || '';
    const chains = Array.isArray(d.chain_information) ? d.chain_information : [];
    const aminoAcids = d.amino_acid_composition && typeof d.amino_acid_composition === 'object' ? d.amino_acid_composition : {};
    const com = d.center_of_mass && typeof d.center_of_mass === 'object' ? d.center_of_mass : null;
    const ss = d.secondary_structure && typeof d.secondary_structure === 'object' ? d.secondary_structure : null;
    const qm = d.quality_metrics && typeof d.quality_metrics === 'object' ? d.quality_metrics : null;

    // Summary metrics
    const metrics = [
      { label: 'Atoms', value: d.num_atoms ?? structureData.num_atoms, icon: '⚛' },
      { label: 'Residues', value: d.num_residues ?? structureData.num_residues, icon: '🧬' },
      { label: 'Chains', value: d.num_chains ?? structureData.num_chains, icon: '🔗' },
      { label: 'Mol. Weight', value: d.molecular_weight ?? structureData.molecular_weight, suffix: ' Da', format: 'weight', icon: '⚖' },
      { label: 'Models', value: d.num_models, icon: '📐' },
    ].filter(m => m.value != null);

    const classificationColors = {
      peptide: '#FF9800', small_protein: '#2196F3', medium_protein: '#4CAF50', large_protein: '#9C27B0',
    };

    // Sort amino acids by count descending
    const sortedAA = Object.entries(aminoAcids)
      .map(([code, count]) => ({ code, count: Math.round(Number(count)) }))
      .sort((a, b) => b.count - a.count);
    const maxAA = sortedAA.length > 0 ? sortedAA[0].count : 1;

    return (
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Structure Analysis
          </Typography>
          {pdbId && (
            <Chip label={`PDB: ${pdbId.toUpperCase()}`} color="primary" variant="outlined" />
          )}
          {classification && (
            <Chip
              label={classification.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              sx={{ backgroundColor: classificationColors[classification] || '#757575', color: 'white' }}
            />
          )}
          {analysisMethod && (
            <Chip label={analysisMethod.replace(/_/g, ' ')} size="small" variant="outlined" color="success" />
          )}
        </Box>

        {/* Summary Metric Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {metrics.map((m) => (
            <Grid item xs={6} sm={4} md key={m.label}>
              <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#fafafa' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {m.label}
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#1a237e' }}>
                  {m.format === 'weight'
                    ? Number(m.value).toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : Math.round(Number(m.value)).toLocaleString()}
                  {m.suffix && (
                    <Typography component="span" variant="body2" color="text.secondary">
                      {m.suffix}
                    </Typography>
                  )}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper sx={{ p: 3, mb: 3 }}>
          {/* Chain Information */}
          {chains.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Chain Information
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Chain ID</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Residues</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Atoms</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {chains.map((chain, i) => (
                      <TableRow key={chain.chain_id || i}>
                        <TableCell>
                          <Chip label={chain.chain_id || `Chain ${i + 1}`} size="small" color="primary" variant="outlined" />
                        </TableCell>
                        <TableCell align="right">{Math.round(Number(chain.num_residues || 0)).toLocaleString()}</TableCell>
                        <TableCell align="right">{Math.round(Number(chain.num_atoms || 0)).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Secondary Structure */}
          {ss && ss.method !== 'no_data_available' && (ss.helix_percentage > 0 || ss.sheet_percentage > 0 || ss.coil_percentage > 0) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Secondary Structure
              </Typography>
              <Box sx={{ display: 'flex', height: 28, borderRadius: 1, overflow: 'hidden', mb: 1 }}>
                {ss.helix_percentage > 0 && (
                  <Box sx={{ width: `${ss.helix_percentage}%`, backgroundColor: '#5C6BC0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.7rem' }}>
                      {ss.helix_percentage >= 8 ? `${Number(ss.helix_percentage).toFixed(1)}%` : ''}
                    </Typography>
                  </Box>
                )}
                {ss.sheet_percentage > 0 && (
                  <Box sx={{ width: `${ss.sheet_percentage}%`, backgroundColor: '#66BB6A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.7rem' }}>
                      {ss.sheet_percentage >= 8 ? `${Number(ss.sheet_percentage).toFixed(1)}%` : ''}
                    </Typography>
                  </Box>
                )}
                {ss.coil_percentage > 0 && (
                  <Box sx={{ width: `${ss.coil_percentage}%`, backgroundColor: '#BDBDBD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#333', fontWeight: 'bold', fontSize: '0.7rem' }}>
                      {ss.coil_percentage >= 8 ? `${Number(ss.coil_percentage).toFixed(1)}%` : ''}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#5C6BC0' }} />
                  <Typography variant="caption">Helix ({Number(ss.helix_percentage).toFixed(1)}%)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#66BB6A' }} />
                  <Typography variant="caption">Sheet ({Number(ss.sheet_percentage).toFixed(1)}%)</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#BDBDBD' }} />
                  <Typography variant="caption">Coil ({Number(ss.coil_percentage).toFixed(1)}%)</Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Amino Acid Composition */}
          {sortedAA.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Amino Acid Composition
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {sortedAA.map(({ code, count }) => (
                  <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ width: 32, fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' }}>
                      {code}
                    </Typography>
                    <Box sx={{ flex: 1, height: 18, backgroundColor: '#f0f0f0', borderRadius: 1, overflow: 'hidden' }}>
                      <Box sx={{
                        height: '100%',
                        width: `${(count / maxAA) * 100}%`,
                        backgroundColor: '#4CAF50',
                        borderRadius: 1,
                        minWidth: count > 0 ? 4 : 0,
                      }} />
                    </Box>
                    <Typography variant="caption" sx={{ width: 28, fontFamily: 'monospace', textAlign: 'right' }}>
                      {count}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Quality Metrics */}
          {qm && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                Quality Metrics
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {qm.completeness != null && (
                  <Chip label={`Completeness: ${(Number(qm.completeness) * 100).toFixed(1)}%`} variant="outlined" />
                )}
                {qm.resolution != null && (
                  <Chip label={`Resolution: ${Number(qm.resolution).toFixed(2)} \u00C5`} variant="outlined" />
                )}
                {qm.experimental_method && (
                  <Chip label={qm.experimental_method} variant="outlined" />
                )}
              </Box>
            </Box>
          )}

          {/* Center of Mass */}
          {com && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                Center of Mass
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                x: {Number(com.x).toFixed(2)}, y: {Number(com.y).toFixed(2)}, z: {Number(com.z).toFixed(2)}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* 3D Protein Structure Visualization */}
        <Box sx={{ mb: 3 }}>
          <ProteinViewer3D
            pdbId={results?.pdbId || results?.pdb_id || workflow?.pdb_id || workflow?.pdbId}
            workflowId={params?.id}
            stage="structure_preparation"
            bindingSites={null}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <DownloadButtonGroup />
        </Box>

        <BlockchainProvenanceCard blockchain={results?.blockchain} />

        {onProceedToNextStage && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<NavigateNext />}
              onClick={() => onProceedToNextStage('binding_site_analysis')}
              sx={{
                background: 'linear-gradient(45deg, #4CAF50 30%, #66BB6A 90%)',
                color: 'white',
                px: 4,
                '&:hover': { background: 'linear-gradient(45deg, #388E3C 30%, #4CAF50 90%)' },
              }}
            >
              Proceed to Binding Site Analysis
            </Button>
          </Box>
        )}
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
          <DownloadButtonGroup />
        </Box>

        {/* AI-Enhanced Druggability Scoring */}
        <SmartDruggabilityCard
          bindingSites={bindingSites}
          pdbId={data?.pdb_id || data?.pdbId || workflow?.pdb_id || workflow?.pdbId || results?.pdbId || results?.pdb_id}
        />

        {/* Blockchain Provenance Record */}
        <BlockchainProvenanceCard blockchain={results?.blockchain} />

        {onProceedToNextStage && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<NavigateNext />}
              onClick={() => onProceedToNextStage('virtual_screening')}
              sx={{
                background: 'linear-gradient(45deg, #4CAF50 30%, #66BB6A 90%)',
                color: 'white',
                px: 4,
                '&:hover': { background: 'linear-gradient(45deg, #388E3C 30%, #4CAF50 90%)' },
              }}
            >
              Proceed to Virtual Screening
            </Button>
          </Box>
        )}
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

    const isOpenMM = data.method && data.method.toLowerCase().includes('openmm');
    const methodLabel = isOpenMM
      ? 'OpenMM (AMBER ff14SB + GAFF2 + GBn2)'
      : 'Analytical Energy Minimisation';

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6">
              Molecular Dynamics Simulation Results
            </Typography>
            <Chip
              label={methodLabel}
              size="small"
              color={isOpenMM ? 'success' : 'warning'}
              variant="outlined"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
          <DownloadButtonGroup />
        </Box>

        {isOpenMM && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Genuine molecular dynamics simulation completed using OpenMM with AMBER ff14SB protein force field,
            GAFF2 ligand parameterisation, and GBn2 implicit solvent (Langevin NVT ensemble).
          </Alert>
        )}
        {!isOpenMM && data.method && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Results computed using analytical energy minimisation (Lennard-Jones + Coulomb + H-bond potentials).
            Install OpenMM for full molecular dynamics simulation.
          </Alert>
        )}

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

        {/* Blockchain Provenance Record */}
        <BlockchainProvenanceCard blockchain={results?.blockchain} />

        {onProceedToNextStage && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<NavigateNext />}
              onClick={() => onProceedToNextStage('lead_optimization')}
              sx={{
                background: 'linear-gradient(45deg, #4CAF50 30%, #66BB6A 90%)',
                color: 'white',
                px: 4,
                '&:hover': { background: 'linear-gradient(45deg, #388E3C 30%, #4CAF50 90%)' },
              }}
            >
              Proceed to Lead Optimization
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  const renderOptimizationResults = (data) => {
    if (!data || !data.optimized_compounds) {
      return <Typography>No lead optimization data available.</Typography>;
    }

    const classificationColor = (cls) => {
      switch (cls) {
        case 'advance': return 'success';
        case 'optimize': return 'warning';
        case 'deprioritize': return 'error';
        default: return 'default';
      }
    };

    const classificationLabel = (cls) => {
      switch (cls) {
        case 'advance': return 'Advance';
        case 'optimize': return 'Optimize';
        case 'deprioritize': return 'Deprioritize';
        default: return cls;
      }
    };

    const paretoFrontColor = (front) => {
      if (front === 0) return 'success';
      if (front === 1) return 'warning';
      return 'default';
    };

    const isV2 = data.method?.includes('v2');

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Lead Optimization Analysis
          </Typography>
          <DownloadButtonGroup />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`Method: ${data.method || 'RDKit Lead Optimization'}`}
            color="primary"
            variant="outlined"
            size="small"
          />
          {isV2 && (
            <Chip label="Advanced SAR + Pareto + Analog Generation" color="success" variant="outlined" size="small" />
          )}
        </Box>

        {/* Summary Cards Row 1 */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.dark', color: 'white' }}>
              <Typography variant="h4">{data.advance_count || 0}</Typography>
              <Typography variant="body2">Advance</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.dark', color: 'white' }}>
              <Typography variant="h4">{data.optimize_count || 0}</Typography>
              <Typography variant="body2">Optimize</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.dark', color: 'white' }}>
              <Typography variant="h4">{data.deprioritize_count || 0}</Typography>
              <Typography variant="body2">Deprioritize</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.800', color: 'white' }}>
              <Typography variant="h4">{data.compounds_analyzed || 0}</Typography>
              <Typography variant="body2">Total Analyzed</Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Summary Cards Row 2 — v2 advanced stats */}
        {isV2 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {data.pareto_summary && (
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'success.main' }}>
                  <Typography variant="h5" color="success.main">{data.pareto_summary.front_sizes?.[0] || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">Pareto Front 0</Typography>
                </Paper>
              </Grid>
            )}
            {data.analogs_count > 0 && (
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'info.main' }}>
                  <Typography variant="h5" color="info.main">{data.analogs_count}</Typography>
                  <Typography variant="caption" color="text.secondary">Analogs Generated</Typography>
                </Paper>
              </Grid>
            )}
            {data.mmp_analysis && (
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'secondary.main' }}>
                  <Typography variant="h5" color="secondary.main">{data.mmp_analysis.transformations_found || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">MMP Transformations</Typography>
                </Paper>
              </Grid>
            )}
            {data.rgroup_decomposition && (
              <Grid item xs={6} sm={3}>
                <Paper sx={{ p: 2, textAlign: 'center', border: '1px solid', borderColor: 'warning.main' }}>
                  <Typography variant="h5" color="warning.main">{data.rgroup_decomposition.r_groups?.length || 0}</Typography>
                  <Typography variant="caption" color="text.secondary">R-Group Positions</Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}

        {/* Aggregate Metrics */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5">{data.average_qed?.toFixed(3) || 'N/A'}</Typography>
              <Typography variant="caption" color="text.secondary">Avg QED Score</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5">{data.average_synthetic_accessibility?.toFixed(1) || 'N/A'}</Typography>
              <Typography variant="caption" color="text.secondary">Avg SA Score</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5">{data.lipinski_pass_count || 0}/{data.compounds_analyzed || 0}</Typography>
              <Typography variant="caption" color="text.secondary">Pass Lipinski</Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="h5">{data.pains_clean_count || 0}/{data.compounds_analyzed || 0}</Typography>
              <Typography variant="caption" color="text.secondary">PAINS Clean</Typography>
            </Paper>
          </Grid>
        </Grid>

        {data.summary?.recommendation && (
          <Alert severity="info" sx={{ mb: 3 }}>
            {data.summary.recommendation}
          </Alert>
        )}

        {/* Compound Details Table (with Pareto column if available) */}
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                {data.pareto_summary && <TableCell>Pareto</TableCell>}
                <TableCell>Compound</TableCell>
                <TableCell>Classification</TableCell>
                <TableCell>Drug-likeness</TableCell>
                <TableCell>QED</TableCell>
                <TableCell>SA Score</TableCell>
                <TableCell>Lipinski</TableCell>
                <TableCell>PAINS</TableCell>
                <TableCell>logP</TableCell>
                <TableCell>MW</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.optimized_compounds.map((compound, index) => (
                <TableRow key={index} sx={{
                  bgcolor: compound.classification === 'advance' ? 'rgba(76, 175, 80, 0.08)' :
                           compound.classification === 'deprioritize' ? 'rgba(244, 67, 54, 0.08)' : 'inherit',
                }}>
                  <TableCell>{compound.rank || index + 1}</TableCell>
                  {data.pareto_summary && (
                    <TableCell>
                      <Chip label={`F${compound.pareto_front ?? '?'}`} size="small" color={paretoFrontColor(compound.pareto_front)} variant="outlined" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{compound.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={classificationLabel(compound.classification)} color={classificationColor(compound.classification)} size="small" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={Math.min(100, (compound.drug_likeness || 0) * 100)}
                        sx={{ width: 60, height: 8, borderRadius: 4 }}
                        color={compound.drug_likeness >= 0.6 ? 'success' : compound.drug_likeness >= 0.4 ? 'warning' : 'error'} />
                      <Typography variant="body2">{compound.drug_likeness?.toFixed(2)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{compound.qed?.toFixed(3)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={Math.min(100, ((10 - (compound.synthetic_accessibility || 5)) / 9) * 100)}
                        sx={{ width: 50, height: 8, borderRadius: 4 }} />
                      <Typography variant="body2">{compound.synthetic_accessibility?.toFixed(1)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {compound.lipinski_pass
                      ? <Chip label={`Pass (${compound.lipinski_violations || 0})`} color="success" size="small" variant="outlined" />
                      : <Chip label={`Fail (${compound.lipinski_violations})`} color="error" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell>
                    {compound.pains_pass
                      ? <Chip label="Clean" color="success" size="small" variant="outlined" />
                      : <Chip label="Alert" color="error" size="small" variant="outlined" />}
                  </TableCell>
                  <TableCell>{compound.logp?.toFixed(2)}</TableCell>
                  <TableCell>{compound.molecular_weight?.toFixed(0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ===== MMP Analysis Section ===== */}
        {data.mmp_analysis && data.mmp_analysis.transformations?.length > 0 && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">Matched Molecular Pair Analysis</Typography>
                <Chip label={`${data.mmp_analysis.transformations_found} transformations`} size="small" color="secondary" variant="outlined" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Structural transformations between compound pairs correlated with activity changes.
                More negative &Delta; Docking = better binding.
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Compound A</TableCell>
                      <TableCell>Compound B</TableCell>
                      <TableCell>Core</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>&Delta; Docking</TableCell>
                      <TableCell>&Delta; QED</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.mmp_analysis.transformations.slice(0, 15).map((t, i) => (
                      <TableRow key={i} sx={{
                        bgcolor: t.delta_docking_score < -0.5 ? 'rgba(76,175,80,0.08)' :
                                 t.delta_docking_score > 0.5 ? 'rgba(244,67,54,0.08)' : 'inherit',
                      }}>
                        <TableCell><Typography variant="body2">{t.compound_a}</Typography></TableCell>
                        <TableCell><Typography variant="body2">{t.compound_b}</Typography></TableCell>
                        <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{t.core_smiles?.slice(0, 30)}{t.core_smiles?.length > 30 ? '...' : ''}</Typography></TableCell>
                        <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{t.transformation_from?.slice(0, 20)}</Typography></TableCell>
                        <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{t.transformation_to?.slice(0, 20)}</Typography></TableCell>
                        <TableCell>
                          <Typography variant="body2" color={t.delta_docking_score < 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                            {t.delta_docking_score?.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color={t.delta_qed > 0 ? 'success.main' : t.delta_qed < 0 ? 'error.main' : 'text.secondary'}>
                            {t.delta_qed > 0 ? '+' : ''}{t.delta_qed?.toFixed(3)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {data.mmp_analysis.top_beneficial_transformations?.length > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Top Beneficial Transformations</Typography>
                  {data.mmp_analysis.top_beneficial_transformations.slice(0, 5).map((t, i) => (
                    <Typography key={i} variant="body2">
                      {t.compound_a} &rarr; {t.compound_b}: {t.transformation_from} &rarr; {t.transformation_to} (&Delta;docking: {t.delta_docking_score?.toFixed(2)})
                    </Typography>
                  ))}
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>
        )}

        {/* ===== R-Group Decomposition Section ===== */}
        {data.rgroup_decomposition && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">R-Group Decomposition</Typography>
                <Chip label={`${data.rgroup_decomposition.r_groups?.length || 0} positions`} size="small" color="warning" variant="outlined" />
                <Chip label={`${(data.rgroup_decomposition.decomposition_success_rate * 100).toFixed(0)}% success`} size="small" variant="outlined" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Core scaffold: <strong style={{ fontFamily: 'monospace' }}>{data.rgroup_decomposition.core_smiles}</strong> ({data.rgroup_decomposition.core_num_atoms} atoms)
              </Typography>
              {data.rgroup_decomposition.r_groups?.map((rg, rgi) => (
                <Box key={rgi} sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Position {rg.position}</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Substituent</TableCell>
                          <TableCell>Compounds</TableCell>
                          <TableCell>Avg Activity</TableCell>
                          <TableCell>Count</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rg.substituents?.map((sub, si) => (
                          <TableRow key={si}>
                            <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{sub.smiles}</Typography></TableCell>
                            <TableCell><Typography variant="caption">{sub.compounds?.join(', ')}</Typography></TableCell>
                            <TableCell>
                              <Typography variant="body2" color={sub.avg_activity < -5 ? 'success.main' : 'text.primary'}>
                                {sub.avg_activity?.toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell>{sub.count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        )}

        {/* ===== Pareto Front Visualization ===== */}
        {data.pareto_summary && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">Multi-Objective Pareto Ranking</Typography>
                <Chip label={`${data.pareto_summary.n_fronts} fronts`} size="small" color="success" variant="outlined" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Compounds ranked across {data.pareto_summary.objectives_used?.join(', ')}. Front 0 = non-dominated (best trade-off).
              </Typography>
              {data.pareto_summary.front_sizes?.map((size, fi) => (
                <Box key={fi} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip label={`Front ${fi}`} size="small" color={paretoFrontColor(fi)} />
                    <Typography variant="body2">{size} compound{size !== 1 ? 's' : ''}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {data.optimized_compounds.filter(c => c.pareto_front === fi).map((c, ci) => (
                      <Paper key={ci} sx={{ p: 1, px: 1.5, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold">{c.name}</Typography>
                        {c.pareto_objectives && (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {Object.entries(c.pareto_objectives).map(([key, val]) => (
                              <Chip key={key} label={`${key.slice(0, 3)}: ${val?.toFixed(2)}`} size="small" variant="outlined"
                                sx={{ fontSize: '0.65rem', height: 20 }} />
                            ))}
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Box>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        )}

        {/* Per-compound detail accordions */}
        {data.optimized_compounds.map((compound, index) => (
          <Accordion key={index} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', minWidth: 30 }}>
                  #{compound.rank || index + 1}
                </Typography>
                <Typography variant="subtitle2" sx={{ flex: 1 }}>
                  {compound.name}
                </Typography>
                {compound.pareto_front != null && (
                  <Chip label={`P${compound.pareto_front}`} size="small" color={paretoFrontColor(compound.pareto_front)} variant="outlined" sx={{ mr: 0.5 }} />
                )}
                <Chip label={classificationLabel(compound.classification)} color={classificationColor(compound.classification)} size="small" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Drug-likeness: {compound.drug_likeness?.toFixed(3)}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {/* Property Profile */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Molecular Properties</Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow><TableCell>Molecular Weight</TableCell><TableCell>{compound.molecular_weight?.toFixed(2)} Da</TableCell></TableRow>
                      <TableRow><TableCell>logP</TableCell><TableCell>{compound.logp?.toFixed(2)}</TableCell></TableRow>
                      <TableRow><TableCell>H-Bond Donors</TableCell><TableCell>{compound.hbd}</TableCell></TableRow>
                      <TableRow><TableCell>H-Bond Acceptors</TableCell><TableCell>{compound.hba}</TableCell></TableRow>
                      <TableRow><TableCell>TPSA</TableCell><TableCell>{compound.tpsa?.toFixed(1)} A&sup2;</TableCell></TableRow>
                      <TableRow><TableCell>Rotatable Bonds</TableCell><TableCell>{compound.rotatable_bonds}</TableCell></TableRow>
                      <TableRow><TableCell>Aromatic Rings</TableCell><TableCell>{compound.aromatic_rings}</TableCell></TableRow>
                      <TableRow><TableCell>Fraction sp3</TableCell><TableCell>{compound.fraction_csp3?.toFixed(3)}</TableCell></TableRow>
                      <TableRow><TableCell>Heavy Atoms</TableCell><TableCell>{compound.heavy_atom_count}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </Grid>

                {/* Scores & Flags */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Drug Development Profile</Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow><TableCell>QED Score</TableCell><TableCell>{compound.qed?.toFixed(4)}</TableCell></TableRow>
                      <TableRow><TableCell>SA Score</TableCell><TableCell>{compound.synthetic_accessibility?.toFixed(2)} / 10</TableCell></TableRow>
                      <TableRow>
                        <TableCell>Lipinski</TableCell>
                        <TableCell>
                          <Chip label={compound.lipinski_pass ? 'Pass' : 'Fail'} color={compound.lipinski_pass ? 'success' : 'error'} size="small" />
                          {' '}({compound.lipinski_violations} violation{compound.lipinski_violations !== 1 ? 's' : ''})
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Lead-like</TableCell>
                        <TableCell><Chip label={compound.lead_like ? 'Yes' : 'No'} color={compound.lead_like ? 'success' : 'default'} size="small" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Veber Rules</TableCell>
                        <TableCell><Chip label={compound.veber_pass ? 'Pass' : 'Fail'} color={compound.veber_pass ? 'success' : 'warning'} size="small" /></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>PAINS</TableCell>
                        <TableCell>
                          <Chip label={compound.pains_pass ? 'Clean' : 'Alert'} color={compound.pains_pass ? 'success' : 'error'} size="small" />
                          {compound.pains_alerts?.length > 0 && (
                            <Typography variant="caption" color="error" sx={{ ml: 1 }}>{compound.pains_alerts.join(', ')}</Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {compound.admet_flags?.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">ADMET Flags:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {compound.admet_flags.map((flag, i) => (
                          <Chip key={i} label={flag.replace(/_/g, ' ')} size="small" color="warning" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {compound.structural_alerts?.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" color="error">Structural Alerts:</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {compound.structural_alerts.map((alert, i) => (
                          <Chip key={i} label={alert.replace(/_/g, ' ')} size="small" color="error" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Grid>

                {/* Pareto objectives */}
                {compound.pareto_objectives && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>Pareto Multi-Objective Scores</Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {Object.entries(compound.pareto_objectives).map(([key, val]) => (
                        <Paper key={key} sx={{ p: 1, px: 2, textAlign: 'center' }}>
                          <Typography variant="h6">{val?.toFixed(3)}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{key}</Typography>
                        </Paper>
                      ))}
                      <Paper sx={{ p: 1, px: 2, textAlign: 'center', bgcolor: compound.pareto_front === 0 ? 'success.dark' : 'grey.800', color: 'white' }}>
                        <Typography variant="h6">Front {compound.pareto_front}</Typography>
                        <Typography variant="caption">Pareto Rank #{compound.pareto_rank}</Typography>
                      </Paper>
                    </Box>
                  </Grid>
                )}

                {/* Upstream Data */}
                {(compound.docking_score || compound.stability_verdict || compound.interaction_energy) && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>Upstream Pipeline Data</Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {compound.docking_score != null && (
                        <Chip label={`Docking: ${compound.docking_score.toFixed(2)} kcal/mol`} size="small" variant="outlined" />
                      )}
                      {compound.stability_verdict && (
                        <Chip label={`Stability: ${compound.stability_verdict}`} size="small"
                          color={compound.stability_verdict.toLowerCase() === 'stable' ? 'success' : 'warning'} variant="outlined" />
                      )}
                      {compound.interaction_energy != null && (
                        <Chip label={`Interaction: ${compound.interaction_energy.toFixed(2)} kcal/mol`} size="small" variant="outlined" />
                      )}
                    </Box>
                  </Grid>
                )}

                {/* Bioisosteric Replacement Suggestions */}
                {compound.bioisostere_suggestions?.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>Bioisosteric Replacements</Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Original</TableCell>
                            <TableCell>Replacement</TableCell>
                            <TableCell>Product SMILES</TableCell>
                            <TableCell>&Delta; QED</TableCell>
                            <TableCell>&Delta; SA</TableCell>
                            <TableCell>Lipinski</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {compound.bioisostere_suggestions.map((bs, bsi) => (
                            <TableRow key={bsi}>
                              <TableCell>{bs.original_group}</TableCell>
                              <TableCell>{bs.replacement_group}</TableCell>
                              <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{bs.product_smiles?.slice(0, 40)}{bs.product_smiles?.length > 40 ? '...' : ''}</Typography></TableCell>
                              <TableCell>
                                <Typography variant="body2" color={bs.predicted_qed_change > 0 ? 'success.main' : bs.predicted_qed_change < 0 ? 'error.main' : 'text.secondary'}>
                                  {bs.predicted_qed_change > 0 ? '+' : ''}{bs.predicted_qed_change?.toFixed(3)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color={bs.predicted_sa_change < 0 ? 'success.main' : bs.predicted_sa_change > 0 ? 'error.main' : 'text.secondary'}>
                                  {bs.predicted_sa_change > 0 ? '+' : ''}{bs.predicted_sa_change?.toFixed(1)}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip label={bs.lipinski_pass ? 'Pass' : 'Fail'} size="small" color={bs.lipinski_pass ? 'success' : 'error'} variant="outlined" />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                )}

                {/* Pharmacophore features */}
                {data.pharmacophore_data?.pharmacophore_models?.find(pm => pm.compound_name === compound.name) && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>Pharmacophore Features</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {data.pharmacophore_data.pharmacophore_models
                        .find(pm => pm.compound_name === compound.name)
                        ?.features?.map((f, fi) => (
                          <Chip key={fi} label={`${f.type} (${f.position?.map(p => p.toFixed(1)).join(', ')})`}
                            size="small" variant="outlined" sx={{ fontSize: '0.65rem' }} />
                        ))}
                    </Box>
                  </Grid>
                )}

                {/* Suggestions */}
                {compound.suggestions?.length > 0 && (
                  <Grid item xs={12}>
                    <Alert severity={compound.classification === 'advance' ? 'success' : compound.classification === 'optimize' ? 'warning' : 'error'} sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>Optimization Suggestions</Typography>
                      {compound.suggestions.map((suggestion, i) => (
                        <Typography key={i} variant="body2" sx={{ mb: 0.5 }}>&bull; {suggestion}</Typography>
                      ))}
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))}

        {/* ===== Generated Analogs Section ===== */}
        {data.analogs_generated?.length > 0 && (
          <Accordion sx={{ mb: 2, mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">Generated Analogs</Typography>
                <Chip label={`${data.analogs_generated.length} analogs`} size="small" color="info" variant="outlined" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Near-neighbor analogs generated via fragment growing and bioisosteric replacement from top parent compounds.
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Parent</TableCell>
                      <TableCell>Analog SMILES</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>QED</TableCell>
                      <TableCell>SA</TableCell>
                      <TableCell>MW</TableCell>
                      <TableCell>Improvement</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.analogs_generated.map((analog, ai) => (
                      <TableRow key={ai}>
                        <TableCell><Typography variant="body2" fontWeight="bold">{analog.parent_name}</Typography></TableCell>
                        <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{analog.analog_smiles?.slice(0, 45)}{analog.analog_smiles?.length > 45 ? '...' : ''}</Typography></TableCell>
                        <TableCell><Chip label={analog.method?.replace(/_/g, ' ')} size="small" variant="outlined" sx={{ fontSize: '0.6rem' }} /></TableCell>
                        <TableCell>{analog.qed?.toFixed(3)}</TableCell>
                        <TableCell>{analog.sa_score?.toFixed(1)}</TableCell>
                        <TableCell>{analog.molecular_weight?.toFixed(0)}</TableCell>
                        <TableCell><Typography variant="caption">{analog.predicted_improvement}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* ===== Consensus Pharmacophore ===== */}
        {data.pharmacophore_data?.consensus_pharmacophore && (
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">Consensus Pharmacophore</Typography>
                <Chip label={`${data.pharmacophore_data.consensus_pharmacophore.features?.length || 0} features`} size="small" variant="outlined" />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Pharmacophore features conserved across {data.pharmacophore_data.consensus_pharmacophore.compounds_used} top compounds (within 2&Aring; tolerance).
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Feature Type</TableCell>
                      <TableCell>Position (x, y, z)</TableCell>
                      <TableCell>Radius</TableCell>
                      <TableCell>Contributing Compounds</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.pharmacophore_data.consensus_pharmacophore.features?.map((f, fi) => (
                      <TableRow key={fi}>
                        <TableCell><Chip label={f.type} size="small" variant="outlined" /></TableCell>
                        <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>({f.position?.map(p => p.toFixed(1)).join(', ')})</Typography></TableCell>
                        <TableCell>{f.radius?.toFixed(1)} &Aring;</TableCell>
                        <TableCell><Typography variant="caption">{f.compounds_contributing?.join(', ')}</Typography></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Failed compounds */}
        {data.failed_compounds?.length > 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">{data.failed_compounds.length} compound(s) failed analysis:</Typography>
            {data.failed_compounds.map((c, i) => (
              <Typography key={i} variant="body2">&bull; {c.name}: {c.error}</Typography>
            ))}
          </Alert>
        )}

        {/* Blockchain Provenance Record */}
        <BlockchainProvenanceCard blockchain={data?.blockchain} />

        {data.total_computation_time_seconds != null && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'right' }}>
            Analysis completed in {data.total_computation_time_seconds}s
          </Typography>
        )}
      </Box>
    );
  };

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

        {/* Ligand Preparation Details */}
        {isVinaDocking && data.ligand_preparation && (
          <Accordion sx={{ mb: 3, borderRadius: 2, '&:before': { display: 'none' } }} defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ borderRadius: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="subtitle1" fontWeight="bold">Ligand Preparation</Typography>
                <Chip
                  label={`${data.ligand_preparation.compounds_passed_validation} prepared`}
                  size="small"
                  color="success"
                  variant="outlined"
                />
                {data.ligand_preparation.compounds_failed_validation > 0 && (
                  <Chip
                    label={`${data.ligand_preparation.compounds_failed_validation} filtered`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Protonation pH</Typography>
                  <Typography variant="body1" fontWeight="bold">{data.ligand_preparation.protonation_pH}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Conformers per Ligand</Typography>
                  <Typography variant="body1" fontWeight="bold">{data.ligand_preparation.conformers_generated}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Force Field</Typography>
                  <Typography variant="body1" fontWeight="bold">{data.ligand_preparation.force_field}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Minimization Iterations</Typography>
                  <Typography variant="body1" fontWeight="bold">{data.ligand_preparation.max_iterations}</Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Preparation Pipeline
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {data.ligand_preparation.steps.map((step, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle sx={{ fontSize: 16, color: '#16a34a' }} />
                    <Typography variant="body2">{step}</Typography>
                  </Box>
                ))}
              </Box>
              {data.ligand_preparation.validation_thresholds && (
                <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Validation Thresholds
                  </Typography>
                  <Typography variant="body2">
                    MW &le; {data.ligand_preparation.validation_thresholds.max_mw} Da &nbsp;&bull;&nbsp;
                    Heavy atoms &le; {data.ligand_preparation.validation_thresholds.max_heavy_atoms} &nbsp;&bull;&nbsp;
                    Rotatable bonds &le; {data.ligand_preparation.validation_thresholds.max_rotatable_bonds}
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        )}

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
            <DownloadButtonGroup />
          </Box>

          {/* Blockchain Provenance Record */}
          <BlockchainProvenanceCard blockchain={data?.blockchain} />

          {onProceedToNextStage && (
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<NavigateNext />}
                onClick={() => onProceedToNextStage('molecular_dynamics')}
                sx={{
                  background: 'linear-gradient(45deg, #4CAF50 30%, #66BB6A 90%)',
                  color: 'white',
                  px: 4,
                  '&:hover': { background: 'linear-gradient(45deg, #388E3C 30%, #4CAF50 90%)' },
                }}
              >
                Proceed to Molecular Dynamics
              </Button>
            </Box>
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

  const content = (() => {
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
  })();

  return <div ref={resultsRef}>{content}</div>;
}

export default WorkflowResults;


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
} from '@mui/material';
import { ExpandMore, Download, HourglassEmpty, ErrorOutline } from '@mui/icons-material';
import { saveAs } from 'file-saver';
// Import 3D viewers
import ProteinViewer3D from './ProteinViewer3D';
// Alias for backward compatibility
const ProteinViewer = ProteinViewer3D;

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function WorkflowResults({ results, stage, activeTab = 0, workflow = null }) {
  // Initialize blockchain state from persisted workflow data
  const blockchainData = workflow?.blockchain || {};
  const [blockchainCommitted, setBlockchainCommitted] = useState(!!blockchainData.transactionHash);
  const [ipfsHash, setIpfsHash] = useState(blockchainData.ipfsHash || null);
  const [blockchainTxHash, setBlockchainTxHash] = useState(blockchainData.transactionHash || null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState(blockchainData.verified ? blockchainData.verificationData : null);
  const [currentTab, setCurrentTab] = useState(activeTab);
  const params = useParams();
  
  console.log('🔗 WorkflowResults blockchain initialization:');
  console.log('  - workflow.blockchain:', blockchainData);
  console.log('  - blockchainCommitted:', blockchainCommitted);
  console.log('  - ipfsHash:', ipfsHash);
  console.log('  - blockchainTxHash:', blockchainTxHash);
  console.log('  - verificationResult:', verificationResult);

  console.log('🔍 WorkflowResults component received:');
  console.log('  - results:', JSON.stringify(results, null, 2));
  console.log('  - stage:', stage);
  console.log('  - activeTab:', activeTab);
  console.log('  - results type:', typeof results);
  console.log('  - results is null?', results === null);
  console.log('  - results is undefined?', results === undefined);

  // Initialize 3Dmol.js viewer for binding site visualization
  useEffect(() => {
    if (stage !== 'binding_site_analysis') return;
    if (!results?.binding_sites && !results?.binding_site_analysis?.binding_sites) return;
    if (!params?.id) return;

    console.log('Initializing 3D viewer for binding site analysis');

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
          console.error('Viewer container not found');
          return;
        }

        // Clear any existing content
        viewerElement.innerHTML = '';

        // Fetch the PDB structure
        console.log('Fetching PDB structure...');
        const response = await fetch(`/api/workflow/${params.id}/processed-structure`);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDB: ${response.statusText}`);
        }
        
        const pdbData = await response.text();
        if (!pdbData || !pdbData.trim()) {
          throw new Error('Empty PDB data received');
        }

        console.log('Creating 3D viewer...');
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
        console.log('Adding binding sites to viewer:', bindingSites.length);
        
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
              console.log(`Highlighting binding site ${index + 1} with residues:`, residueIds);
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
        
        console.log('3D viewer initialized successfully');
        
      } catch (error) {
        console.error('Error initializing 3D viewer:', error);
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
      
      console.log(`Stored blockchain commit info for ${stage}:`, recentCommits[params.id][stage]);
    } catch (error) {
      console.error('Error committing to blockchain:', error);
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
      console.error('Error verifying results:', error);
      alert('Failed to verify results: ' + error.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const generateResultsHash = (results) => {
    return btoa(JSON.stringify(results)).slice(0, 32);
  };

  const handleDownloadResults = () => {
    if (!results) {
      console.log('No results available for download');
      return;
    }

    try {
      let csvContent = '';
      
      if (stage === 'binding_site_analysis') {
        // Handle binding site analysis results
        const bindingSites = results.binding_sites || results.binding_site_analysis?.binding_sites || [];
        
        if (bindingSites.length === 0) {
          console.log('No binding sites found for export');
          alert('No binding site data available for export');
          return;
        }
        
        // Create CSV header for binding sites
        const csvHeader = 'Site ID,Score,Volume (Å³),Druggability,Hydrophobicity,Center X,Center Y,Center Z,Residue Count\n';
        
        // Create CSV rows for each binding site
        const csvRows = bindingSites.map(site => {
          const centerId = site.center || {};
          return [
            site.id || 'N/A',
            (site.score || 0).toFixed(3),
            (site.volume || 0).toFixed(2),
            (site.druggability || 0).toFixed(3),
            (site.hydrophobicity || 0).toFixed(3),
            (centerId.x || 0).toFixed(2),
            (centerId.y || 0).toFixed(2),
            (centerId.z || 0).toFixed(2),
            (site.residues?.length || 0)
          ].map(val => `"${val}"`).join(',');
        }).join('\n');
        
        // Add metadata header
        const metadata = [
          `"Workflow ID","${params.id}"`,
          `"Analysis Stage","Binding Site Analysis"`,
          `"Generated On","${new Date().toISOString()}"`,
          `"Status","${results.status || 'Completed'}"`,
          `"Method","${results.method || results.binding_site_analysis?.method || 'fpocket'}"`,
          `"Total Binding Sites","${bindingSites.length}"`,
          '',  // Empty line separator
          '"Binding Site Analysis Results"',
          csvHeader.trim()
        ].join('\n');
        
        csvContent = metadata + '\n' + csvRows;
        
      } else {
        // Handle structure preparation results (existing logic)
        let structureData = {};
        if (stage === 'structure_preparation' && results.details?.descriptors) {
          structureData = results.details.descriptors;
        } else if (results.STRUCTURE_PREPARATION?.descriptors) {
          structureData = results.STRUCTURE_PREPARATION.descriptors;
        } else if (results.structure_preparation?.descriptors) {
          structureData = results.structure_preparation.descriptors;
        }
        
        if (Object.keys(structureData).length === 0) {
          console.log('No structure data found for export');
          alert('No structure data available for export');
          return;
        }

        // Create CSV content for structure data
        const csvHeader = 'Property,Value\n';
        const csvRows = Object.entries(structureData).map(([key, value]) => {
          const propertyName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const propertyValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 
                              (typeof value === 'number' ? value.toFixed(2) : value);
          return `"${propertyName}","${propertyValue}"`;
        }).join('\n');

        // Add metadata header
        const metadata = [
          `"Workflow ID","${params.id}"`,
          `"Analysis Stage","${stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}"`,
          `"Generated On","${new Date().toISOString()}"`,
          `"Status","${results.status || 'Completed'}"`,
          '',  // Empty line separator
          '"Structure Analysis Results"',
          csvHeader.trim()
        ].join('\n');

        csvContent = metadata + '\n' + csvRows;
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
      console.log('CSV results downloaded successfully');
    } catch (error) {
      console.error('Error downloading CSV results:', error);
    }
  };

  const renderStructurePreparation = (data) => {
    console.log('Structure preparation data:', data);
    console.log('descriptors: ', data.data.details.descriptors);
    let structureData = {};

    if (typeof data === 'object' && data !== null) {
      if (data.details && data.details.descriptors) {
        console.log('Found bioapi format with details.descriptors');
        structureData = data.details.descriptors;
      } else if (data.STRUCTURE_PREPARATION && data.STRUCTURE_PREPARATION.descriptors) {
        console.log('Found STRUCTURE_PREPARATION.descriptors format');
        structureData = data.STRUCTURE_PREPARATION.descriptors;
      } else if (data.atom_count || data.residue_count || data.chain_count) {
        console.log('Found direct properties format');
        structureData = {
          num_atoms: data.atom_count,
          num_residues: data.residue_count,
          num_chains: data.chain_count,
          hetatm_count: data.hetatm_count,
          has_hydrogens: data.has_hydrogens,
          has_ligands: data.has_ligands,
        };
      } else if (data.structure_preparation && data.structure_preparation.descriptors) {
        console.log('Found structure_preparation.descriptors format');
        structureData = data.structure_preparation.descriptors;
      }
    }

    structureData = data.data.details.descriptors;
    console.log('Extracted structure data:', structureData);
    

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
                {Object.entries(structureData).map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell sx={{ verticalAlign: 'top', fontWeight: 'medium' }}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </TableCell>
                    <TableCell>
                      {typeof value === 'boolean' 
                        ? (value ? 'Yes' : 'No') 
                        : typeof value === 'number' 
                        ? value.toFixed(2) 
                        : typeof value === 'object' && value !== null
                        ? (
                          <Box sx={{ p: 1, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                            <Table size="small" sx={{ minWidth: 'auto' }}>
                              <TableBody>
                                {Object.entries(value).map(([subKey, subValue]) => (
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
                                      {typeof subValue === 'number' 
                                        ? subValue.toFixed(2) 
                                        : typeof subValue === 'object' && subValue !== null
                                        ? (
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
                                                    <TableCell sx={{ 
                                                      py: 0.5, 
                                                      px: 0.75, 
                                                      fontSize: '0.8rem',
                                                      fontWeight: 400
                                                    }}>
                                                      {typeof nestedValue === 'number' 
                                                        ? nestedValue.toFixed(2) 
                                                        : typeof nestedValue === 'object' && nestedValue !== null
                                                        ? JSON.stringify(nestedValue, null, 2)
                                                        : String(nestedValue)
                                                      }
                                                    </TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </Box>
                                        )
                                        : String(subValue)
                                      }
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        )
                        : value
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* 3D Protein Structure Visualization */}
          <Box sx={{ mt: 4, mb: 3 }}>
            {console.log("=== WORKFLOW RESULTS DEBUG ===")}
            {console.log("Results object:", results)}
            {console.log("Workflow object:", workflow)}
            {console.log("PDB ID from results?.pdbId:", results?.pdbId)}
            {console.log("PDB ID from results?.pdb_id:", results?.pdb_id)}
            {console.log("PDB ID from workflow?.pdb_id:", workflow?.pdb_id)}
            {console.log("PDB ID from workflow?.pdbId:", workflow?.pdbId)}
            {console.log("=== END WORKFLOW RESULTS DEBUG ===")}
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
    console.log('Rendering binding sites with data:', data);
    let bindingSites = [];

    if (data?.binding_sites && Array.isArray(data.binding_sites) && data.binding_sites.length > 0) {
      console.log('Found binding sites in data.binding_sites');
      bindingSites = data.binding_sites;
    } else if (data?.binding_site_analysis?.binding_sites && Array.isArray(data.binding_site_analysis.binding_sites) && data.binding_site_analysis.binding_sites.length > 0) {
      console.log('Found binding sites in data.binding_site_analysis.binding_sites');
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

        {/* 3D Protein Structure with Binding Sites */}
        <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
            Binding Site Visualization
          </Typography>
          
          {/* 3D Viewer Container */}
          <Box sx={{ position: 'relative', height: '600px', border: '1px solid #ddd', borderRadius: 1, mb: 3 }}>
            <div 
              id={`molviewer-${params?.id}`} 
              style={{ width: '100%', height: '100%', position: 'relative' }}
            >
              <Box 
                sx={{ 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  zIndex: 1
                }}
              >
                <CircularProgress />
                <Typography variant="body2" sx={{ mt: 1 }}>Loading 3D structure...</Typography>
              </Box>
            </div>
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

        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          Binding Site Details
        </Typography>
        {bindingSites.map((site, index) => (
          <Accordion key={index} sx={{ mb: 2, '&:before': { display: 'none' }, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ backgroundColor: '#f8f9fa' }}>
              <Typography sx={{ fontWeight: 'medium' }}>
                Binding Site {index + 1} (Score: {site.score?.toFixed(2) || 'N/A'})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Volume</TableCell>
                      <TableCell>{site.volume.toFixed(2)} Å³</TableCell>
                    </TableRow>
                    {site.druggability && (
                      <TableRow>
                        <TableCell>Druggability</TableCell>
                        <TableCell>{site.druggability.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                    {site.hydrophobicity && (
                      <TableRow>
                        <TableCell>Hydrophobicity</TableCell>
                        <TableCell>{site.hydrophobicity.toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell>Center</TableCell>
                      <TableCell>({site.center.x.toFixed(2)}, {site.center.y.toFixed(2)}, {site.center.z.toFixed(2)})</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Residues</TableCell>
                      <TableCell>{site.residues.length} residues</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Residue List</TableCell>
                      <TableCell sx={{ maxWidth: '400px', overflowX: 'auto' }}>
                        {site.residues.map(r => `${r.name}${r.number}${r.chain}`).join(', ')}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="contained" startIcon={<Download />} onClick={handleDownloadResults} sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}>
            Download Results
          </Button>
        </Box>

        {/* Blockchain/IPFS Integration Section */}
        <Paper sx={{ p: 3, mt: 3, borderRadius: 2, backgroundColor: 'rgba(25, 118, 210, 0.02)' }}>
          <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
            🔗 Blockchain & IPFS Integration
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
            Commit your binding site analysis results to blockchain for permanent provenance and integrity verification.
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {!blockchainCommitted ? (
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

  const renderMDResults = (data) => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Molecular Dynamics Results
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Simulation Summary
      </Typography>
      <TableContainer component={Paper} sx={{ mb: 3 }}>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Duration</TableCell>
              <TableCell>{data.duration} ns</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Temperature</TableCell>
              <TableCell>{data.temperature} K</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>RMSD</TableCell>
              <TableCell>{data.rmsd.toFixed(2)} Å</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {data.trajectories.map((traj, index) => (
        <Accordion key={index}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography>Trajectory {index + 1}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>Trajectory visualization will be available here</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );

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
    console.log('Rendering Virtual Screening Results with data:', data);

    if (!data || data.status !== 'completed') {
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

    return (
      <Box>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Virtual Screening Top Compounds
        </Typography>
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Compound ID</TableCell>
                  <TableCell>Docking Score</TableCell>
                  <TableCell>SMILES</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.top_compounds.map((compound) => (
                  <TableRow key={compound.id}>
                    <TableCell>{compound.id}</TableCell>
                    <TableCell>{compound.score.toFixed(3)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{compound.smiles}</TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined">View 3D</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" startIcon={<Download />} onClick={handleDownloadResults} sx={{ backgroundColor: '#1976d2', '&:hover': { backgroundColor: '#1565c0' } }}>
              Download Report
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  };

  const renderStageResults = () => {
    console.log('Rendering results for stage:', stage, 'with data:', results);

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


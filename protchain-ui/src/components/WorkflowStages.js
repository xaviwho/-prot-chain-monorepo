'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Biotech,
  Science,
  Search,
  Timeline,
  TrendingUp,
  CheckCircle,
  PlayArrow,
  CloudUpload,
} from '@mui/icons-material';

export default function WorkflowStages({
  workflowId,
  currentStage,
  onStructureAnalysisComplete,
  onBindingSiteAnalysisComplete,
  onVirtualScreeningComplete
}) {
  const [pdbId, setPdbId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [completedStages, setCompletedStages] = useState(new Set());

  // Compound library selection state
  const [compoundSource, setCompoundSource] = useState('fda_approved');
  const [compoundFile, setCompoundFile] = useState(null);
  const [uploadingCompounds, setUploadingCompounds] = useState(false);
  const [customCompoundsReady, setCustomCompoundsReady] = useState(false);
  const [compoundCount, setCompoundCount] = useState(0);
  const [compoundWarnings, setCompoundWarnings] = useState([]);

  // Fetch workflow state on component mount and when workflowId changes
  useEffect(() => {
    const fetchWorkflowState = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/v1/workflows/${workflowId}`, { headers });
        if (response.ok) {
          const data = await response.json();
          setWorkflowData(data);
          
          // Update completed stages based on API response
          if (data.completed_stages) {
            setCompletedStages(new Set(data.completed_stages));
          }
          
          // Check for blockchain commits in localStorage (stage-specific)
          const recentCommits = JSON.parse(localStorage.getItem('recentBlockchainCommits') || '{}');
          
          if (recentCommits[workflowId]) {
            // Store stage-specific blockchain data
            data.blockchainByStage = recentCommits[workflowId];
            
            // Add general blockchain data for backward compatibility (use structure_preparation as default)
            if (recentCommits[workflowId].structure_preparation) {
              data.blockchain = {
                transaction_hash: recentCommits[workflowId].structure_preparation.txHash,
                ipfs_hash: recentCommits[workflowId].structure_preparation.ipfsHash,
                timestamp: recentCommits[workflowId].structure_preparation.timestamp
              };
            }
            
            setWorkflowData({...data});
            
            // Mark stages as completed based on their blockchain commits
            const newCompletedStages = new Set(data.completed_stages || []);
            
            if (recentCommits[workflowId].structure_preparation) {
              newCompletedStages.add('structure_preparation');
            }
            
            if (recentCommits[workflowId].binding_site_analysis) {
              newCompletedStages.add('binding_site_analysis');
              
              // Auto-advance to next stage (Virtual Screening) after binding site analysis
              if (data.stage === 'binding_site_analysis') {
                data.stage = 'virtual_screening';
                setWorkflowData({...data});
              }
            }
            
            setCompletedStages(newCompletedStages);
          }
        }
      } catch (error) {
      }
    };

    if (workflowId) {
      fetchWorkflowState();
    }
  }, [workflowId]);

  const stages = [
    {
      id: 'structure_preparation',
      title: 'Structure Preparation',
      description: 'Process and validate protein structure',
      icon: <Biotech />,
      color: '#4CAF50',
    },
    {
      id: 'binding_site_analysis',
      title: 'Binding Site Analysis',
      description: 'Identify potential drug binding sites',
      icon: <Science />,
      color: '#66BB6A',
    },
    {
      id: 'virtual_screening',
      title: 'Virtual Screening',
      description: 'Screen compound libraries for potential hits',
      icon: <Search />,
      color: '#81C784',
    },
    {
      id: 'molecular_dynamics',
      title: 'Molecular Dynamics',
      description: 'Simulate protein-ligand interactions',
      icon: <Timeline />,
      color: '#A5D6A7',
    },
    {
      id: 'lead_optimization',
      title: 'Lead Optimization',
      description: 'Optimize lead compounds for drug development',
      icon: <TrendingUp />,
      color: '#2E7D32',
    },
  ];

  const getCurrentStageIndex = () => {
    // Use workflow data from API instead of currentStage prop
    const apiCurrentStage = workflowData?.stage || currentStage;
    return stages.findIndex(stage => stage.id === apiCurrentStage);
  };

  const getStageStatus = (stageId) => {
    // Check if stage is completed based on blockchain commits
    const recentCommits = JSON.parse(localStorage.getItem('recentBlockchainCommits') || '{}');
    const workflowCommits = recentCommits[workflowId] || {};
    
    if (workflowCommits[stageId]) {
      return 'completed';
    }
    
    // Check if stage is completed based on API data
    if (workflowData?.completed_stages?.includes(stageId)) {
      return 'completed';
    }
    
    // Sequential stage activation logic
    const stageOrder = ['structure_preparation', 'binding_site_analysis', 'virtual_screening', 'molecular_dynamics', 'lead_optimization'];
    const currentStageIndex = stageOrder.indexOf(stageId);
    
    // Structure preparation is always active initially
    if (stageId === 'structure_preparation') {
      return workflowCommits['structure_preparation'] ? 'completed' : 'active';
    }
    
    // For subsequent stages, check if previous stage is blockchain committed
    if (currentStageIndex > 0) {
      const previousStage = stageOrder[currentStageIndex - 1];
      const isPreviousStageCommitted = workflowCommits[previousStage];
      
      if (isPreviousStageCommitted) {
        return 'active';
      } else {
        return 'pending';
      }
    }
    
    return 'pending';
  };

  const handleStructureProcessing = async () => {
    if (!pdbId.trim()) {
      setError('Please enter a PDB ID');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      
      // Get the auth token
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/workflow/${workflowId}/structure`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pdbId: pdbId.trim(),
          stage: 'structure_preparation'
        }),
      });

      if (!response.ok) {
        throw new Error(`Structure processing failed: ${response.statusText}`);
      }

      const results = await response.json();
      
      setSuccess('Structure processed successfully!');
      setCompletedStages(prev => new Set([...prev, 'structure_preparation']));
      
      // Refresh workflow state to update progress immediately
      try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        
        const workflowResponse = await fetch(`/api/v1/workflows/${workflowId}`, { headers });
        if (workflowResponse.ok) {
          const updatedWorkflowData = await workflowResponse.json();
          setWorkflowData(updatedWorkflowData);
          
          if (updatedWorkflowData.completed_stages) {
            setCompletedStages(new Set(updatedWorkflowData.completed_stages));
          }
          
        }
      } catch (refreshError) {
      }
      
      if (onStructureAnalysisComplete) {
        // Include the PDB ID that was searched in the results
        const resultsWithPdbId = {
          ...results,
          pdbId: pdbId.trim().toUpperCase()
        };
        onStructureAnalysisComplete(resultsWithPdbId);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBindingSiteAnalysis = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      
      // Get the auth token
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/workflow/${workflowId}/direct-binding-site-analysis`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          stage: 'binding_site_analysis'
        }),
      });

      if (!response.ok) {
        throw new Error(`Binding site analysis failed: ${response.statusText}`);
      }

      const results = await response.json();
      
      setSuccess('Binding site analysis completed!');
      setCompletedStages(prev => new Set([...prev, 'binding_site_analysis']));
      
      if (onBindingSiteAnalysisComplete) {
        onBindingSiteAnalysisComplete(results);
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVirtualScreening = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      
      // Get the auth token
      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/workflow/${workflowId}/virtual-screening`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          compound_library: compoundSource,
          max_compounds: 50
        }),
      });

      if (!response.ok) {
        throw new Error(`Virtual screening failed: ${response.statusText}`);
      }

      const results = await response.json();

      setSuccess(`Virtual screening completed! Found ${results.hits_found || 0} promising compounds.`);
      setCompletedStages(prev => new Set([...prev, 'virtual_screening']));

      // Notify parent with virtual screening results
      if (onVirtualScreeningComplete) {
        onVirtualScreeningComplete(results);
      }
      
      // Refresh workflow state to update progress immediately
      try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        
        const workflowResponse = await fetch(`/api/v1/workflows/${workflowId}`, { headers });
        if (workflowResponse.ok) {
          const updatedWorkflowData = await workflowResponse.json();
          setWorkflowData(updatedWorkflowData);
          
          if (updatedWorkflowData.completed_stages) {
            setCompletedStages(new Set(updatedWorkflowData.completed_stages));
          }
          
        }
      } catch (refreshError) {
      }
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompoundUpload = async () => {
    if (!compoundFile) return;
    setUploadingCompounds(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', compoundFile);

      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`/api/workflow/${workflowId}/upload-compounds`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setCustomCompoundsReady(true);
        setCompoundCount(data.count);
        setCompoundWarnings(data.warnings || []);
        setSuccess(`${data.count} compounds parsed successfully!`);
      } else {
        setError(data.error || 'Failed to parse compounds');
        setCompoundWarnings(data.warnings || []);
      }
    } catch (err) {
      setError(`Compound upload failed: ${err.message}`);
    } finally {
      setUploadingCompounds(false);
    }
  };

  const handleStageAction = async (stageId) => {
    switch (stageId) {
      case 'structure_preparation':
        await handleStructureProcessing();
        break;
      case 'binding_site_analysis':
        await handleBindingSiteAnalysis();
        break;
      case 'virtual_screening':
        await handleVirtualScreening();
        break;
      case 'molecular_dynamics':
      case 'lead_optimization':
        setError(`${stages.find(s => s.id === stageId)?.title} is not yet implemented`);
        break;
      default:
        break;
    }
  };

  const renderStageCard = (stage, index) => {
    const status = getStageStatus(stage.id);
    const isActive = status === 'active';
    const isCompleted = status === 'completed';
    const isPending = status === 'pending';
    
    return (
      <Grid item xs={12} md={6} lg={4} key={stage.id}>
        <Card 
          sx={{ 
            height: '100%',
            border: isActive ? `2px solid ${stage.color}` : '1px solid #e0e0e0',
            boxShadow: isActive ? 3 : 1,
            opacity: isPending ? 0.6 : 1,
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box 
                sx={{ 
                  p: 1, 
                  borderRadius: '50%', 
                  backgroundColor: isCompleted ? '#4CAF50' : stage.color + '20',
                  color: isCompleted ? 'white' : stage.color,
                  mr: 2 
                }}
              >
                {isCompleted ? <CheckCircle /> : stage.icon}
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="h3">
                  {stage.title}
                </Typography>
                <Chip 
                  label={status.toUpperCase()} 
                  size="small" 
                  color={isCompleted ? 'success' : isActive ? 'primary' : 'default'}
                />
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {stage.description}
            </Typography>

            {/* Compound library selector for virtual screening */}
            {stage.id === 'virtual_screening' && isActive && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Compound Library
                </Typography>
                <ToggleButtonGroup
                  value={compoundSource}
                  exclusive
                  onChange={(e, val) => {
                    if (val !== null) {
                      setCompoundSource(val);
                      setError(null);
                    }
                  }}
                  size="small"
                  fullWidth
                  sx={{ mb: 1.5 }}
                >
                  <ToggleButton value="fda_approved" sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                    FDA Approved (41)
                  </ToggleButton>
                  <ToggleButton value="fragments" sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                    Fragments (15)
                  </ToggleButton>
                  <ToggleButton value="custom" sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                    Custom Upload
                  </ToggleButton>
                </ToggleButtonGroup>

                {compoundSource === 'custom' && (
                  <Box sx={{
                    p: 1.5,
                    border: '1px dashed #bbb',
                    borderRadius: 1,
                    backgroundColor: '#fafafa',
                  }}>
                    {!customCompoundsReady ? (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Button
                            variant="outlined"
                            component="label"
                            size="small"
                            startIcon={<CloudUpload />}
                            disabled={uploadingCompounds}
                            sx={{ textTransform: 'none' }}
                          >
                            {compoundFile ? compoundFile.name : 'Choose CSV / SDF'}
                            <input
                              type="file"
                              hidden
                              accept=".csv,.sdf"
                              onChange={(e) => setCompoundFile(e.target.files?.[0] || null)}
                            />
                          </Button>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={handleCompoundUpload}
                            disabled={!compoundFile || uploadingCompounds}
                            sx={{ textTransform: 'none' }}
                          >
                            {uploadingCompounds ? (
                              <CircularProgress size={18} sx={{ color: 'white' }} />
                            ) : (
                              'Upload & Parse'
                            )}
                          </Button>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          CSV needs <strong>name</strong> and <strong>smiles</strong> columns. Max 500 compounds.
                        </Typography>
                      </>
                    ) : (
                      <Box>
                        <Chip
                          label={`${compoundCount} custom compounds ready`}
                          color="success"
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Button
                          size="small"
                          onClick={() => {
                            setCustomCompoundsReady(false);
                            setCompoundFile(null);
                            setCompoundCount(0);
                            setCompoundWarnings([]);
                          }}
                          sx={{ textTransform: 'none', fontSize: '0.7rem' }}
                        >
                          Change
                        </Button>
                        {compoundWarnings.length > 0 && (
                          <Alert severity="warning" sx={{ mt: 1, py: 0 }}>
                            <Typography variant="caption">
                              {compoundWarnings.length} warning{compoundWarnings.length > 1 ? 's' : ''}: {compoundWarnings[0]}
                              {compoundWarnings.length > 1 && ` (+${compoundWarnings.length - 1} more)`}
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {/* Show blockchain/IPFS verification links for completed stages (stage-specific) */}
            {isCompleted && (workflowData?.blockchainByStage?.[stage.id] || workflowData?.blockchain) && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="success.main" sx={{ mb: 1, fontWeight: 'bold' }}>
                  ✓ Blockchain Verified
                </Typography>
                {/* Display stage-specific blockchain data if available, otherwise use fallback */}
                {(() => {
                  const stageData = workflowData?.blockchainByStage?.[stage.id];
                  const fallbackData = workflowData?.blockchain;
                  const txHash = stageData?.txHash || fallbackData?.transaction_hash;
                  const ipfsHash = stageData?.ipfsHash || fallbackData?.ipfs_hash;
                  
                  return (
                    <>
                      {txHash && (
                        <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                          <strong>Tx Hash:</strong> 
                          <a 
                            href={`https://nsllab-kit.onrender.com/purechain/api/v1/tx/${txHash}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#1976d2', textDecoration: 'none' }}
                          >
                            {txHash.substring(0, 10)}...
                          </a>
                          {' | '}
                          <a 
                            href={`https://nsllab-kit.onrender.com/purechain/api/v1/tx/${txHash}/receipt`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#1976d2', textDecoration: 'none' }}
                          >
                            Receipt
                          </a>
                        </Typography>
                      )}
                      {ipfsHash && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                          <strong>IPFS:</strong> 
                          <a 
                            href={`https://gateway.pinata.cloud/ipfs/${ipfsHash}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#1976d2', textDecoration: 'none' }}
                          >
                            {ipfsHash.substring(0, 10)}...
                          </a>
                        </Typography>
                      )}
                    </>
                  );
                })()}
              </Box>
            )}
            
            {stage.id === 'structure_preparation' && isActive && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  label="PDB ID"
                  value={pdbId}
                  onChange={(e) => setPdbId(e.target.value.toUpperCase())}
                  placeholder="e.g., 1ABC"
                  size="small"
                  fullWidth
                  disabled={loading}
                  sx={{ mb: 1 }}
                />
              </Box>
            )}
            
            {(isActive || (stage.id === 'structure_preparation' && !isCompleted)) && (
              <Button
                variant="contained"
                onClick={() => handleStageAction(stage.id)}
                disabled={loading || (stage.id === 'structure_preparation' && !pdbId.trim()) || (stage.id === 'virtual_screening' && compoundSource === 'custom' && !customCompoundsReady)}
                startIcon={loading ? <CircularProgress size={20} /> : <PlayArrow />}
                fullWidth
                sx={{ backgroundColor: stage.color }}
              >
                {loading ? 'Processing...' : `Run ${stage.title}`}
              </Button>
            )}
          </CardContent>
        </Card>
      </Grid>
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Drug Discovery Pipeline
      </Typography>
      
      {/* Progress indicator */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Pipeline Progress
        </Typography>
        {(() => {
          const total = stages.length;
          const completed = stages.filter(s => getStageStatus(s.id) === 'completed').length;
          const percentage = total > 0 ? (completed / total) * 100 : 0;
          return (
            <>
              <LinearProgress
                variant="determinate"
                value={percentage}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(76, 175, 80, 0.15)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    backgroundColor: '#4CAF50',
                  },
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {completed} of {total} stages completed
              </Typography>
            </>
          );
        })()}
      </Paper>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {stages.map((stage, index) => renderStageCard(stage, index))}
      </Grid>
    </Box>
  );
}

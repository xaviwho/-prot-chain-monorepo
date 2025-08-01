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
} from '@mui/material';
import {
  Biotech,
  Science,
  Search,
  Timeline,
  TrendingUp,
  CheckCircle,
  PlayArrow,
} from '@mui/icons-material';

export default function WorkflowStages({ 
  workflowId, 
  currentStage, 
  onStructureAnalysisComplete, 
  onBindingSiteAnalysisComplete 
}) {
  const [pdbId, setPdbId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [completedStages, setCompletedStages] = useState(new Set());

  // Fetch workflow state on component mount and when workflowId changes
  useEffect(() => {
    const fetchWorkflowState = async () => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}`);
        if (response.ok) {
          const data = await response.json();
          setWorkflowData(data);
          
          // Update completed stages based on API response
          if (data.completed_stages) {
            setCompletedStages(new Set(data.completed_stages));
          }
          
          // Check for blockchain commits in localStorage (stage-specific)
          const recentCommits = JSON.parse(localStorage.getItem('recentBlockchainCommits') || '{}');
          console.log('DEBUG: recentCommits from localStorage:', recentCommits);
          console.log('DEBUG: recentCommits for workflowId:', recentCommits[workflowId]);
          
          if (recentCommits[workflowId]) {
            // Store stage-specific blockchain data
            data.blockchainByStage = recentCommits[workflowId];
            console.log('DEBUG: blockchainByStage set to:', data.blockchainByStage);
            
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
        console.error('Failed to fetch workflow state:', error);
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
    // Check if stage is completed based on API data
    if (workflowData?.completed_stages?.includes(stageId)) {
      return 'completed';
    }
    
    // Use API current stage for determining active stage
    const apiCurrentStage = workflowData?.stage || currentStage;
    if (stageId === apiCurrentStage) {
      return 'active';
    }
    
    // Determine if stage should be pending based on workflow progression
    const currentIndex = getCurrentStageIndex();
    const stageIndex = stages.findIndex(s => s.id === stageId);
    
    // If this stage comes before the current stage, it should be completed
    if (stageIndex < currentIndex) {
      return 'completed';
    }
    
    // If this is the next stage after completed stages, make it active
    if (workflowData?.completed_stages?.length > 0 && stageIndex === workflowData.completed_stages.length) {
      return 'active';
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
      console.log('Processing structure for PDB ID:', pdbId);
      
      const response = await fetch(`/api/workflow/${workflowId}/structure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdbId: pdbId.trim(),
          stage: 'structure_preparation'
        }),
      });

      if (!response.ok) {
        throw new Error(`Structure processing failed: ${response.statusText}`);
      }

      const results = await response.json();
      console.log('Structure processing results:', results);
      
      setSuccess('Structure processed successfully!');
      setCompletedStages(prev => new Set([...prev, 'structure_preparation']));
      
      // Refresh workflow state to update progress immediately
      try {
        const workflowResponse = await fetch(`/api/workflows/${workflowId}`);
        if (workflowResponse.ok) {
          const updatedWorkflowData = await workflowResponse.json();
          setWorkflowData(updatedWorkflowData);
          
          if (updatedWorkflowData.completed_stages) {
            setCompletedStages(new Set(updatedWorkflowData.completed_stages));
          }
          
          console.log('Workflow state refreshed after structure processing:', updatedWorkflowData);
        }
      } catch (refreshError) {
        console.error('Failed to refresh workflow state:', refreshError);
      }
      
      if (onStructureAnalysisComplete) {
        onStructureAnalysisComplete(results);
      }
      
    } catch (err) {
      console.error('Structure processing error:', err);
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
      console.log('Starting binding site analysis for workflow:', workflowId);
      
      const response = await fetch(`/api/workflow/${workflowId}/direct-binding-site-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stage: 'binding_site_analysis'
        }),
      });

      if (!response.ok) {
        throw new Error(`Binding site analysis failed: ${response.statusText}`);
      }

      const results = await response.json();
      console.log('Binding site analysis results:', results);
      
      setSuccess('Binding site analysis completed!');
      setCompletedStages(prev => new Set([...prev, 'binding_site_analysis']));
      
      if (onBindingSiteAnalysisComplete) {
        onBindingSiteAnalysisComplete(results);
      }
      
    } catch (err) {
      console.error('Binding site analysis error:', err);
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
      console.log('Starting REAL virtual screening for workflow:', workflowId);
      
      const response = await fetch(`/api/workflow/${workflowId}/virtual-screening`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          compound_library: 'fda_approved',
          max_compounds: 50
        }),
      });

      if (!response.ok) {
        throw new Error(`Virtual screening failed: ${response.statusText}`);
      }

      const results = await response.json();
      console.log('REAL virtual screening results:', results);
      
      setSuccess(`Virtual screening completed! Found ${results.hits_found || 0} promising compounds.`);
      setCompletedStages(prev => new Set([...prev, 'virtual_screening']));
      
      // Refresh workflow state to update progress immediately
      try {
        const workflowResponse = await fetch(`/api/workflows/${workflowId}`);
        if (workflowResponse.ok) {
          const updatedWorkflowData = await workflowResponse.json();
          setWorkflowData(updatedWorkflowData);
          
          if (updatedWorkflowData.completed_stages) {
            setCompletedStages(new Set(updatedWorkflowData.completed_stages));
          }
          
          console.log('Workflow state refreshed after virtual screening:', updatedWorkflowData);
        }
      } catch (refreshError) {
        console.error('Failed to refresh workflow state:', refreshError);
      }
      
    } catch (err) {
      console.error('Virtual screening error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
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
            
            {/* Show blockchain/IPFS verification links for completed stages (stage-specific) */}
            {console.log(`DEBUG: Stage ${stage.id} - isCompleted:`, isCompleted, 'blockchainByStage:', workflowData?.blockchainByStage, 'stage data:', workflowData?.blockchainByStage?.[stage.id])}
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
                disabled={loading || (stage.id === 'structure_preparation' && !pdbId.trim())}
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
        <LinearProgress 
          variant="determinate" 
          value={workflowData?.progress?.percentage || 0} 
          sx={{ height: 8, borderRadius: 4 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {workflowData?.progress?.completed || 0} of {workflowData?.progress?.total || 5} stages completed
        </Typography>
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

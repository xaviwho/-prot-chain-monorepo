'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  Button,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack,
  Science,
  Biotech,
  Timeline,
  Assessment,
} from '@mui/icons-material';
import WorkflowStages from '@/components/WorkflowStages';
import WorkflowResults from '@/components/WorkflowResults';

function TabPanel({ children, value, index }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function WorkflowDetailPage() {
  const [workflow, setWorkflow] = useState(null);
  const [results, setResults] = useState(null);
  const [stage, setStage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [proteinInfo, setProteinInfo] = useState(null);
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/v1/workflows/${params.id}`, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch workflow: ${response.statusText}`);
        }
        const responseData = await response.json();
        
        // Handle different response structures
        const workflowData = responseData.data || responseData;
        console.log('Fetched workflow data:', workflowData);
        
        setWorkflow(workflowData);
        setStage(workflowData.stage || 'structure_preparation');
        
        // Extract protein info from workflow name or description
        const proteinName = extractProteinName(workflowData.name);
        setProteinInfo({
          name: proteinName,
          pdbId: extractPDBId(workflowData.name) || 'Unknown',
          description: getProteinDescription(proteinName)
        });
      } catch (err) {
        console.error('Error fetching workflow:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchWorkflow();
    }
  }, [params.id]);

  const extractProteinName = (workflowName) => {
    // Try to extract meaningful protein name from workflow name
    if (workflowName?.toLowerCase().includes('amyloid')) return 'Amyloid Beta';
    if (workflowName?.toLowerCase().includes('insulin')) return 'Insulin';
    if (workflowName?.toLowerCase().includes('hemoglobin')) return 'Hemoglobin';
    if (workflowName?.toLowerCase().includes('lysozyme')) return 'Lysozyme';
    return 'Unknown Protein';
  };

  const extractPDBId = (workflowName) => {
    // Try to extract PDB ID from workflow name
    const pdbMatch = workflowName?.match(/[0-9][A-Za-z0-9]{3}/);
    return pdbMatch ? pdbMatch[0].toUpperCase() : null;
  };

  const getProteinDescription = (proteinName) => {
    const descriptions = {
      'Amyloid Beta': 'Peptide associated with Alzheimer\'s disease pathology',
      'Insulin': 'Hormone regulating glucose metabolism',
      'Hemoglobin': 'Oxygen-carrying protein in red blood cells',
      'Lysozyme': 'Antimicrobial enzyme found in secretions',
      'Unknown Protein': 'Protein structure for drug discovery analysis'
    };
    return descriptions[proteinName] || 'Protein structure for analysis';
  };

  const getWorkflowTitle = () => {
    if (!workflow) return 'Loading...';
    
    // Try to get PDB ID from various sources
    let pdbId = null;
    
    // First, try to get from workflow results if available
    if (workflow.results) {
      try {
        const resultsData = typeof workflow.results === 'string' 
          ? JSON.parse(workflow.results) 
          : workflow.results;
        pdbId = resultsData?.pdb_id || resultsData?.pdbId || resultsData?.Pdb_Id;
      } catch (e) {
        console.log('Could not parse workflow results for PDB ID');
      }
    }
    
    // If not found, try to extract from workflow name
    if (!pdbId) {
      pdbId = extractPDBId(workflow.name);
    }
    
    // Use PDB ID if found, otherwise use workflow name, or default
    const displayName = pdbId || workflow.name || 'Workflow';
    return `${displayName} - Drug Discovery Analysis`;
  };

  const getStageStatus = () => {
    switch (stage) {
      case 'structure_preparation': return { label: 'Structure Analysis', color: 'success' };
      case 'binding_site_analysis': return { label: 'Binding Site Analysis', color: 'success' };
      case 'virtual_screening': return { label: 'Virtual Screening', color: 'success' };
      case 'molecular_dynamics': return { label: 'Molecular Dynamics', color: 'success' };
      case 'lead_optimization': return { label: 'Lead Optimization', color: 'success' };
      default: return { label: 'Initializing', color: 'default' };
    }
  };

  const handleStructureAnalysisComplete = (analysisResults) => {
    console.log('Structure analysis completed:', analysisResults);
    setResults(analysisResults);
    setStage('structure_preparation');
    setActiveTab(1); // Switch to results tab
  };

  const handleBindingSiteAnalysisComplete = (analysisResults) => {
    console.log('Binding site analysis completed:', analysisResults);
    setResults(analysisResults);
    setStage('binding_site_analysis');
    setActiveTab(1); // Switch to results tab
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ ml: 2 }}>Loading workflow...</Typography>
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6">Error Loading Workflow</Typography>
          {error}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/workflows')}>
          Back to Workflows
        </Button>
      </Container>
    );
  }

  if (!workflow) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning">Workflow not found</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/workflows')} sx={{ mt: 2 }}>
          Back to Workflows
        </Button>
      </Container>
    );
  }

  const stageStatus = getStageStatus();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button 
          startIcon={<ArrowBack />} 
          onClick={() => router.push('/workflows')}
          sx={{ mb: 2, color: '#4CAF50' }}
        >
          Back to Workflows
        </Button>
        
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h4" gutterBottom>
                {getWorkflowTitle()}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Protein structure analysis and drug discovery pipeline
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip 
                  label={stageStatus.label} 
                  color={stageStatus.color} 
                  icon={<Science />}
                />
                {proteinInfo?.pdbId !== 'Unknown' && (
                  <Chip label={`PDB: ${proteinInfo.pdbId}`} variant="outlined" />
                )}
                <Chip 
                  label={(() => {
                    if (workflow.created_at) {
                      try {
                        const date = new Date(workflow.created_at);
                        if (!isNaN(date.getTime())) {
                          return date.toLocaleDateString();
                        }
                      } catch (e) {
                        console.log('Error parsing date:', e);
                      }
                    }
                    return new Date().toLocaleDateString(); // Use current date as fallback
                  })()} 
                  variant="outlined" 
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card sx={{ bgcolor: '#4CAF50', color: 'white' }}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Biotech sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h6">Drug Discovery</Typography>
                  <Typography variant="body2">Protein Analysis Pipeline</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {/* Main Content */}
      <Paper sx={{ width: '100%' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, val) => setActiveTab(val)} 
          variant="fullWidth"
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            '& .MuiTab-root': {
              color: 'text.secondary',
            },
            '& .Mui-selected': {
              color: '#4CAF50 !important',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#4CAF50',
            }
          }}
        >
          <Tab 
            icon={<Timeline />} 
            label="Pipeline" 
            iconPosition="start"
          />
          <Tab 
            icon={<Assessment />} 
            label="Results & Analysis" 
            iconPosition="start"
          />
        </Tabs>
        
        <TabPanel value={activeTab} index={0}>
          <WorkflowStages
            workflowId={params.id}
            currentStage={stage}
            onStructureAnalysisComplete={handleStructureAnalysisComplete}
            onBindingSiteAnalysisComplete={handleBindingSiteAnalysisComplete}
          />
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          {results ? (
            <WorkflowResults
              workflowId={params.id}
              results={results}
              stage={stage}
              workflow={workflow}
            />
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Science sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Analysis Results Yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Run the pipeline stages to generate analysis results
              </Typography>
            </Box>
          )}
        </TabPanel>
      </Paper>
    </Container>
  );
}

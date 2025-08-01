'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ScienceIcon from '@mui/icons-material/Science';
import OnboardingManager from '../../components/OnboardingManager';

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [showNewWorkflowDialog, setShowNewWorkflowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState(null);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [error, setError] = useState(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [userId, setUserId] = useState(null);
  
  const handleLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem('token');
    // Redirect to login page
    window.location.href = '/';
  };

  const fetchWorkflows = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Validate token format (should be header.payload.signature)
      if (!token || token.split('.').length !== 3) {
        console.error('Invalid token format - please log out and log in again');
        setError('Authentication error - please log out and log in again');
        setInvalidToken(true);
        return;
      }

      // Extract user ID from JWT token for onboarding
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.user_id) {
          setUserId(payload.user_id);
        }
      } catch (e) {
        console.warn('Could not parse JWT payload for user ID:', e);
      }

      const res = await fetch('/api/v1/workflows', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch workflows');
      }
      
      // Log the raw response for debugging
      const responseText = await res.text();
      console.log('Raw API response:', responseText);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Parsed response data:', data);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Invalid response format from server');
      }
      
      // Check if data has the expected structure
      if (data && typeof data === 'object') {
        // Handle different response formats
        if (Array.isArray(data)) {
          // If the API returns an array directly
          setWorkflows(data);
        } else if (data.payload && Array.isArray(data.payload)) {
          // If the API returns {payload: [...workflows]}
          setWorkflows(data.payload);
        } else if (data.data && Array.isArray(data.data)) {
          // If the API returns {data: [...workflows]}
          setWorkflows(data.data);
        } else if (data.workflows && Array.isArray(data.workflows)) {
          // If the API returns {workflows: [...workflows]}
          setWorkflows(data.workflows);
        } else {
          // If we can't find workflows in any expected location
          console.error('Unexpected response structure:', data);
          setWorkflows([]);
          setError('No workflows data found in server response');
        }
      } else {
        console.error('Invalid response data:', data);
        setWorkflows([]);
        setError('Invalid response format from server');
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleCreateWorkflow = async () => {
    try {
      if (!newWorkflowName) {
        throw new Error('Workflow name is required');
      }
      setError(null);

      const token = localStorage.getItem('token');
      
      // Validate token format (should be header.payload.signature)
      if (!token || token.split('.').length !== 3) {
        setError('Authentication error - please log out and log in again');
        setInvalidToken(true);
        return;
      }
      
      const res = await fetch('/api/v1/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newWorkflowName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create workflow');
      }

      setShowNewWorkflowDialog(false);
      setNewWorkflowName('');
      fetchWorkflows(); // Refresh the list
    } catch (err) {
      console.error('Error creating workflow:', err);
      setError(err.message);
    }
  };

  const openDeleteDialog = (workflow) => {
    setWorkflowToDelete(workflow);
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setWorkflowToDelete(null);
    setShowDeleteDialog(false);
  };

  const handleDeleteWorkflow = async () => {
    if (!workflowToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/v1/workflows/${workflowToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete workflow');
      }

      setWorkflows(workflows.filter((w) => w.id !== workflowToDelete.id));
      closeDeleteDialog();
    } catch (err) {
      console.error('Error deleting workflow:', err);
      setError(err.message);
    }
  };

  const extractProteinName = (workflowName) => {
    if (workflowName?.toLowerCase().includes('amyloid')) return 'Amyloid Beta';
    if (workflowName?.toLowerCase().includes('insulin')) return 'Insulin';
    if (workflowName?.toLowerCase().includes('hemoglobin')) return 'Hemoglobin';
    if (workflowName?.toLowerCase().includes('lysozyme')) return 'Lysozyme';
    if (workflowName?.toLowerCase().includes('1abc')) return 'Lysozyme';
    if (workflowName?.toLowerCase().includes('1ins')) return 'Insulin';
    return 'Unknown Protein';
  };

  const extractPDBId = (workflowName) => {
    const pdbMatch = workflowName?.match(/[0-9][A-Za-z0-9]{3}/);
    return pdbMatch ? pdbMatch[0].toUpperCase() : null;
  };

  const getProteinDescription = (proteinName) => {
    const descriptions = {
      'Amyloid Beta': 'Alzheimer\'s disease research',
      'Insulin': 'Diabetes treatment research',
      'Hemoglobin': 'Blood disorder research',
      'Lysozyme': 'Antimicrobial research',
      'Unknown Protein': 'Drug discovery analysis'
    };
    return descriptions[proteinName] || 'Protein analysis';
  };

  const getWorkflowTitle = (workflow) => {
    // Use the actual workflow name instead of extracting protein names
    return `${workflow.name} - Drug Discovery`;
  };

  const getStageProgress = (workflow) => {
    // Calculate REAL progress based on completed stages
    const completedStages = workflow.completed_stages || [];
    const totalStages = 5; // structure_preparation, binding_site_analysis, virtual_screening, molecular_dynamics, results_analysis
    
    const progress = Math.round((completedStages.length / totalStages) * 100);
    
    // Determine current stage based on completed stages
    if (completedStages.includes('results_analysis')) {
      return { stage: 'Complete', progress: 100, color: 'success' };
    } else if (completedStages.includes('molecular_dynamics')) {
      return { stage: 'Results Analysis', progress: 80, color: 'info' };
    } else if (completedStages.includes('virtual_screening')) {
      return { stage: 'Molecular Dynamics', progress: 60, color: 'info' };
    } else if (completedStages.includes('binding_site_analysis')) {
      return { stage: 'Virtual Screening', progress: 40, color: 'info' };
    } else if (completedStages.includes('structure_preparation')) {
      return { stage: 'Binding Site Analysis', progress: 20, color: 'info' };
    } else {
      return { stage: 'Structure Preparation', progress: 0, color: 'default' };
    }
  };

  const renderWorkflowCard = (workflow) => {
    const proteinName = extractProteinName(workflow.name);
    const description = getProteinDescription(proteinName);
    const title = getWorkflowTitle(workflow);
    const progress = getStageProgress(workflow);
    
    return (
      <Grid item xs={12} sm={6} md={4} key={workflow.id}>
        <Card sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          '&:hover': { boxShadow: 4 },
          transition: 'box-shadow 0.2s'
        }}>
          <CardContent sx={{ flexGrow: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Box sx={{ 
                p: 1, 
                borderRadius: '50%', 
                bgcolor: '#4CAF50', 
                color: 'white',
                mr: 2 
              }}>
                <ScienceIcon />
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              </Box>
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Current Stage: {progress.stage}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {progress.progress}%
                </Typography>
              </Box>
              <Box sx={{ 
                width: '100%', 
                height: 6, 
                bgcolor: 'grey.200', 
                borderRadius: 3,
                overflow: 'hidden'
              }}>
                <Box sx={{ 
                  width: `${progress.progress}%`, 
                  height: '100%', 
                  bgcolor: progress.color === 'success' ? '#4CAF50' : 'grey.400',
                  transition: 'width 0.3s ease'
                }} />
              </Box>
            </Box>
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Created: {new Date(workflow.created_at).toLocaleDateString()}
            </Typography>
            {workflow.updated_at && (
              <Typography variant="body2" color="text.secondary">
                Last updated: {new Date(workflow.updated_at).toLocaleDateString()}
              </Typography>
            )}
          </CardContent>
          <CardActions sx={{ p: 2, pt: 0 }}>
            <Button 
              component={Link} 
              href={`/workflows/${workflow.id}`} 
              size="small" 
              variant="contained"
              fullWidth
              sx={{ mr: 1 }}
            >
              Open Analysis
            </Button>
            <IconButton
              onClick={() => openDeleteDialog(workflow)}
              color="error"
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </CardActions>
        </Card>
      </Grid>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }} 
          onClose={() => setError(null)}
          action={
            invalidToken && (
              <Button color="inherit" size="small" onClick={handleLogout}>
                Re-login
              </Button>
            )
          }
        >
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ color: 'text.primary' }}>
          My Workflows
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            component={Link}
            href="/organizations"
            sx={{ bgcolor: '#2e7d32', color: 'white', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            Organizations
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ScienceIcon />}
            onClick={() => setShowNewWorkflowDialog(true)}
          >
            New Workflow
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {workflows.length > 0 ? (
          workflows.map(renderWorkflowCard)
        ) : (
          <Typography sx={{ ml: 2, mt: 2 }}>No workflows found. Create one to get started.</Typography>
        )}
      </Grid>

      {/* New Workflow Dialog */}
      <Dialog open={showNewWorkflowDialog} onClose={() => setShowNewWorkflowDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create New Workflow</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Workflow Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newWorkflowName}
            onChange={(e) => setNewWorkflowName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewWorkflowDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateWorkflow} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={closeDeleteDialog} fullWidth maxWidth="xs">
        <DialogTitle>Delete Workflow?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the workflow "{workflowToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteWorkflow} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
      
      {/* Onboarding System */}
      <OnboardingManager userId={userId} />
    </Container>
  );
}
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
  // Initialize workflows from localStorage if available
  const getInitialWorkflows = () => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cachedWorkflows');
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (e) {
        // Ignore corrupt cache
      }
    }
    return [];
  };

  const [workflows, setWorkflows] = useState(getInitialWorkflows);
  const [showNewWorkflowDialog, setShowNewWorkflowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState(null);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [error, setError] = useState(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [userId, setUserId] = useState(null);
  
  const handleLogout = () => {
    // Clear token from localStorage
    localStorage.removeItem('token');
    // Redirect to login page
    window.location.href = '/';
  };

  // Define a constant backend API URL to avoid initialization issues
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
  
  const fetchWorkflows = async () => {
    try {
      // Show cached workflows while we fetch fresh data
      const cachedWorkflows = localStorage.getItem('cachedWorkflows');
      if (cachedWorkflows) {
        try {
          setWorkflows(JSON.parse(cachedWorkflows));
        } catch (e) {
          // Ignore corrupt cache
        }
      }

      // Try multiple token sources for robustness
      let token = localStorage.getItem('token');
      if (!token) {
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
        if (tokenCookie) {
          token = tokenCookie.split('=')[1];
        }
      }

      // Validate token format (should be header.payload.signature)
      if (!token || token.split('.').length !== 3) {
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
        // JWT payload parse failed — non-critical
      }

      const timestamp = new Date().getTime();
      const res = await fetch(`/api/v1/workflows?_=${timestamp}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('Authentication error - please log out and log in again');
          setInvalidToken(true);
          return;
        }
        throw new Error(`Failed to fetch workflows: ${res.status} ${res.statusText}`);
      }

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        throw new Error('Invalid response format from server');
      }

      let workflowData = [];
      if (data === null || data === undefined) {
        workflowData = [];
      } else if (Array.isArray(data)) {
        workflowData = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) {
          workflowData = data.data;
        } else if (data.success === true && data.data === null) {
          workflowData = [];
        } else if (data.success === true && typeof data.data === 'object' && !Array.isArray(data.data)) {
          workflowData = [data.data];
        } else if (Array.isArray(data.payload)) {
          workflowData = data.payload;
        } else if (Array.isArray(data.workflows)) {
          workflowData = data.workflows;
        } else if (data.id && data.name) {
          workflowData = [data];
        } else {
          setError('Could not retrieve workflows from server response');
        }
      }

      if (workflowData && workflowData.length > 0) {
        const sanitizedWorkflows = workflowData.map(w => ({
          id: w.id,
          name: w.name || 'Unnamed Workflow',
          description: w.description || '',
          status: w.status || 'draft',
          created_at: w.created_at || new Date().toISOString(),
          updated_at: w.updated_at || w.created_at || new Date().toISOString(),
        }));

        localStorage.setItem('cachedWorkflows', JSON.stringify(sanitizedWorkflows));
        setWorkflows(sanitizedWorkflows);
        setError(null);
      } else if (workflowData) {
        setWorkflows([]);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Component mount and cleanup effect
  useEffect(() => {
    // First, load from localStorage if available (this happens in getInitialWorkflows)
    // Then fetch from API to ensure we have the latest data
    fetchWorkflows();

    // Set up storage event listener to sync across tabs
    const handleStorageChange = (event) => {
      if (event.key === 'cachedWorkflows' && event.newValue) {
        try {
          setWorkflows(JSON.parse(event.newValue));
        } catch (e) {
          // Ignore corrupt data from other tabs
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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
      
      // Use Next.js API route for creating workflows
      const response = await fetch(`/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newWorkflowName || 'New Workflow',
          description: newWorkflowDescription || 'A new protein analysis workflow',
        }),
      });

      if (!response.ok) {
        let detail = 'Failed to create workflow';
        try {
          const data = await response.json();
          detail = data?.error || data?.message || detail;
        } catch (_) {
          try {
            detail = await response.text();
          } catch (_) {
            // Fallback to default error
          }
        }
        throw new Error(detail);
      }
      
      const responseData = await response.json();

      // Normalize: backend may return object directly or {success, data}
      let createdWorkflow = null;
      if (responseData?.success === true && responseData?.data) {
        createdWorkflow = responseData.data;
      } else if (responseData?.id) {
        createdWorkflow = responseData;
      } else if (responseData?.data?.id) {
        createdWorkflow = responseData.data;
      }

      if (createdWorkflow) {
        const currentWorkflows = [...(workflows || [])];
        const newWorkflows = [createdWorkflow, ...currentWorkflows];

        // Save to localStorage before updating React state for persistence
        localStorage.setItem('cachedWorkflows', JSON.stringify(newWorkflows));
        setWorkflows(newWorkflows);
      }
      setNewWorkflowName('');
      setNewWorkflowDescription('');
      setShowNewWorkflowDialog(false);
      
      // Keep the optimistically added workflow — don't re-fetch immediately
    } catch (err) {
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
        let detail = 'Failed to delete workflow';
        try {
          const data = await res.json();
          detail = data?.error || data?.message || detail;
        } catch (_) {
          try {
            const text = await res.text();
            if (text) detail = `${detail} (status ${res.status}): ${text}`;
          } catch (_) {}
        }
        throw new Error(detail);
      }

      setWorkflows(workflows.filter((w) => w.id !== workflowToDelete.id));
      closeDeleteDialog();
    } catch (err) {
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
    // Calculate progress from blockchain commits + local completions in localStorage
    const stageOrder = [
      { id: 'structure_preparation', label: 'Structure Preparation' },
      { id: 'binding_site_analysis', label: 'Binding Site Analysis' },
      { id: 'virtual_screening', label: 'Virtual Screening' },
      { id: 'molecular_dynamics', label: 'Molecular Dynamics' },
      { id: 'lead_optimization', label: 'Lead Optimization' },
    ];
    const totalStages = stageOrder.length;

    // Check blockchain commits from localStorage
    let recentCommits = {};
    try {
      recentCommits = JSON.parse(localStorage.getItem('recentBlockchainCommits') || '{}');
    } catch (e) { /* ignore */ }
    const workflowCommits = recentCommits[workflow.id] || {};

    // Check local (non-blockchain) completions
    let localCompletions = {};
    try {
      localCompletions = JSON.parse(localStorage.getItem('stageCompletions') || '{}');
    } catch (e) { /* ignore */ }
    const workflowLocalCompletions = localCompletions[workflow.id] || {};

    // Count completed stages (blockchain or local)
    let completed = 0;
    let currentLabel = stageOrder[0].label;

    for (let i = 0; i < stageOrder.length; i++) {
      const stageId = stageOrder[i].id;
      const isCommitted = !!workflowCommits[stageId];
      const isLocallyCompleted = !!workflowLocalCompletions[stageId];

      if (isCommitted || isLocallyCompleted) {
        completed++;
      } else {
        currentLabel = stageOrder[i].label;
        break;
      }

      // If all done
      if (i === stageOrder.length - 1) {
        currentLabel = 'Complete';
      }
    }

    const progress = Math.round((completed / totalStages) * 100);
    const color = progress === 100 ? 'success' : progress > 0 ? 'info' : 'default';

    return { stage: currentLabel, progress, color };
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
                bgcolor: '#16a34a', 
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
                  bgcolor: progress.color === 'success' ? '#16a34a' : progress.color === 'info' ? '#2196F3' : 'grey.400',
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
            placeholder="e.g., 1ABC Lysozyme Analysis, 1INS Insulin Study"
            helperText="Include a 4-character PDB ID (e.g., 1ABC, 1INS) to automatically load protein structures"
          />
          <TextField
            margin="dense"
            id="description"
            label="Description (optional)"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={newWorkflowDescription}
            onChange={(e) => setNewWorkflowDescription(e.target.value)}
            sx={{ mt: 2 }}
            placeholder="Describe what this workflow will analyze..."
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
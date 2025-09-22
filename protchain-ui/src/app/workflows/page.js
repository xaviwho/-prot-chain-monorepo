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
  // Critical fix: Initialize workflows from localStorage if available
  const getInitialWorkflows = () => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cachedWorkflows');
        if (cached) {
          console.log('Initializing with cached workflows');
          return JSON.parse(cached);
        }
      } catch (e) {
        console.error('Failed to load cached workflows:', e);
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
  
  const fetchWorkflows = async (skipLogging = false) => {
    try {
      // First check for any local cached workflows
      const cachedWorkflows = localStorage.getItem('cachedWorkflows');
      if (cachedWorkflows) {
        try {
          const parsed = JSON.parse(cachedWorkflows);
          console.log('Found cached workflows:', parsed);
          setWorkflows(parsed);
        } catch (e) {
          console.warn('Failed to parse cached workflows:', e);
        }
      }
      
      // Try multiple token sources for robustness
      let token = localStorage.getItem('token');
      if (!token) {
        // Fallback to cookies if localStorage is empty
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
        if (tokenCookie) {
          token = tokenCookie.split('=')[1];
        }
      }
      
      console.log('Token retrieval:', {
        fromLocalStorage: !!localStorage.getItem('token'),
        fromCookies: !!document.cookie.includes('token='),
        tokenExists: !!token,
        tokenLength: token ? token.length : 0
      });
      
      // Validate token format (should be header.payload.signature)
      if (!token || token.split('.').length !== 3) {
        console.error('Invalid token format - please log out and log in again');
        console.error('Token details:', { token: token ? token.substring(0, 20) + '...' : 'null' });
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

      console.log('Fetching workflows directly from backend API...');
      
      // IMPORTANT FIX: Use direct backend API call instead of Next.js API route
      // This bypasses any potential caching or proxy issues
      const timestamp = new Date().getTime();
      // Log the token for debugging (first 10 chars only for security)
      if (token) {
        console.log(`Using token: ${token.substring(0, 10)}...`);
      }
      
      console.log('Making API request with token:', token.substring(0, 20) + '...');
      
      const res = await fetch(`/api/v1/workflows?_=${timestamp}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Force fresh data
        credentials: 'include', // Include cookies
      });
      
      if (!res.ok) {
        // Check if it's an authentication error (401)
        if (res.status === 401) {
          console.error('Authentication failed - token may be invalid or expired');
          setError('Authentication error - please log out and log in again');
          setInvalidToken(true);
          return;
        }
        throw new Error(`Failed to fetch workflows: ${res.status} ${res.statusText}`);
      }
      
      // Log the raw response for debugging
      const responseText = await res.text();
      !skipLogging && console.log('Raw API response:', responseText);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
        !skipLogging && console.log('Parsed response data:', data);
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Invalid response format from server');
      }
      
      let workflowData = [];
      // Add debug output to help diagnose the exact response format
      !skipLogging && console.log('Response data type:', typeof data);
      if (data === null || data === undefined) {
        !skipLogging && console.log('No data returned from API');
        workflowData = [];
      } else if (Array.isArray(data)) {
        !skipLogging && console.log('Data is an array with', data.length, 'items');
        workflowData = data;
      } else if (data && typeof data === 'object') {
        // Check common response patterns
        if (Array.isArray(data.data)) {
          !skipLogging && console.log('Found data.data array with', data.data.length, 'items');
          workflowData = data.data;
        } else if (data.success === true && data.data === null) {
          !skipLogging && console.log('Found {success: true, data: null}');
          workflowData = [];
        } else if (data.success === true && typeof data.data === 'object' && !Array.isArray(data.data)) {
          !skipLogging && console.log('Found single object in data.data');
          workflowData = [data.data];
        } else if (Array.isArray(data.payload)) {
          !skipLogging && console.log('Found data.payload array with', data.payload.length, 'items');
          workflowData = data.payload;
        } else if (Array.isArray(data.workflows)) {
          !skipLogging && console.log('Found data.workflows array with', data.workflows.length, 'items');
          workflowData = data.workflows;
        } else {
          // Last resort: try to use the whole object if it has expected workflow properties
          !skipLogging && console.log('Unexpected response structure:', Object.keys(data));
          if (data.id && data.name) {
            !skipLogging && console.log('Object appears to be a single workflow, using as array');
            workflowData = [data];
          } else {
            console.warn('Could not extract workflows from response:', data);
            setError('Could not retrieve workflows from server response');
          }
        }
      }

      // Only update localStorage if we got actual workflow data
      if (workflowData && workflowData.length > 0) {
        console.log(`Saving ${workflowData.length} workflows to localStorage`); 
        
        // Ensure each workflow has required fields to prevent rendering errors
        const sanitizedWorkflows = workflowData.map(w => ({
          id: w.id,
          name: w.name || 'Unnamed Workflow',
          description: w.description || '',
          status: w.status || 'draft',
          created_at: w.created_at || new Date().toISOString(),
          updated_at: w.updated_at || w.created_at || new Date().toISOString(),
        }));
        
        // Save to localStorage for persistence across page refreshes
        localStorage.setItem('cachedWorkflows', JSON.stringify(sanitizedWorkflows));
        
        // Now update state
        setWorkflows(sanitizedWorkflows);
        
        // Clear any previous error on successful fetch
        setError(null);
      } else if (workflowData) {
        // Empty array case - still valid but no workflows
        setWorkflows([]);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
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
          const updatedWorkflows = JSON.parse(event.newValue);
          console.log('LocalStorage updated in another tab, syncing workflows:', updatedWorkflows);
          setWorkflows(updatedWorkflows);
        } catch (e) {
          console.error('Error parsing workflows from storage event:', e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Monitor workflows state changes
  useEffect(() => {
    console.log('Workflows state updated:', workflows);
  }, [workflows]);

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
        // TODO: REMOVE
        console.log(`response is ${response}`)
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
      
      // Directly parse the response here
      const responseData = await response.json();
      console.log('Create workflow API response:', responseData);

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
        console.log('Adding new workflow to state:', createdWorkflow);
        
        // Make a stable copy of current workflows + new one
        const currentWorkflows = [...(workflows || [])];
        const newWorkflows = [createdWorkflow, ...currentWorkflows];
        
        console.log('Updated workflows collection:', newWorkflows);
        
        // Important: Save to localStorage BEFORE updating React state
        // This ensures persistence across page reloads
        localStorage.setItem('cachedWorkflows', JSON.stringify(newWorkflows));
        
        // Now update React state
        setWorkflows(newWorkflows);
        
        // Verify the workflow was saved to localStorage
        const verifyCache = localStorage.getItem('cachedWorkflows');
        console.log('Verified localStorage workflows after save:', verifyCache ? 
          `Found ${JSON.parse(verifyCache).length} workflows in cache` : 'No cache found');
      } else {
        console.error('No valid workflow was returned from create API');
      }
      setNewWorkflowName('');
      setNewWorkflowDescription('');
      setShowNewWorkflowDialog(false);
      
      // Don't refresh from server immediately after creating
      // This prevents the race condition that's causing workflows to disappear
      console.log('Workflow created successfully - persistence enabled via localStorage');
      // Just keep the optimistically added workflow in state
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
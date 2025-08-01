'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';

export default function WorkflowRegistration({ workflowId, onRegistrationComplete }) {
  const [workflowName, setWorkflowName] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const registerWorkflow = async () => {
    if (!workflowId) return;
    
    setRegistering(true);
    setError(null);
    setSuccess(false);
    
    try {
      console.log(`Registering workflow: ${workflowId}`);
      
      // Use the new direct workflow registration endpoint
      const response = await fetch(`/api/workflow/${workflowId}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowName: workflowName || workflowId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Registration failed with status: ${response.status}`);
      }
      
      console.log('Registration successful:', data);
      setSuccess(true);
      
      if (onRegistrationComplete) {
        onRegistrationComplete(data);
      }
    } catch (err) {
      console.error('Error registering workflow:', err);
      setError(err.message);
    } finally {
      setRegistering(false);
    }
  };
  
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Register Workflow with Backend
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 2 }}>
        This workflow needs to be registered with the backend system before binding site analysis can be performed.
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Workflow registered successfully! You can now proceed with binding site analysis.
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <TextField
          label="Workflow Name (optional)"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          placeholder="Enter a name for this workflow"
          fullWidth
          sx={{ mr: 2 }}
          disabled={registering}
        />
        
        <Button
          variant="contained"
          color="primary"
          onClick={registerWorkflow}
          disabled={registering}
        >
          {registering ? 'Registering...' : 'Register Workflow'}
        </Button>
      </Box>
      
      {registering && (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
          <CircularProgress size={24} sx={{ mr: 1 }} />
          <Typography variant="body2">Registering workflow with backend...</Typography>
        </Box>
      )}
      
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Workflow ID: {workflowId}
      </Typography>
    </Paper>
  );
}

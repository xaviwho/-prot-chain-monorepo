'use client';

import { useState, useEffect } from 'react';
import {
  Box, Button, Typography, TextField, Paper, 
  Container, CircularProgress, Alert, Stack, Divider
} from '@mui/material';

export default function DebugApiWorkflows() {
  const [token, setToken] = useState('');
  const [apiUrl, setApiUrl] = useState('http://localhost:8082');
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [response, setResponse] = useState('');
  const [error, setError] = useState(null);
  const [newWorkflowName, setNewWorkflowName] = useState('Debug Test Workflow');
  const [userId, setUserId] = useState('');
  const [decodedToken, setDecodedToken] = useState({});

  useEffect(() => {
    // Try to get token from localStorage on component mount
    const storedToken = localStorage.getItem('token') || '';
    setToken(storedToken);
    
    // Try to parse token for debugging
    if (storedToken) {
      try {
        const tokenParts = storedToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          setDecodedToken(payload);
          setUserId(payload.id || payload.user_id || '');
        }
      } catch (e) {
        console.error('Failed to parse token:', e);
      }
    }
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Using token: ${token.substring(0, 10)}...`);
      
      const timestamp = new Date().getTime();
      const res = await fetch(`${apiUrl}/api/v1/workflows?_=${timestamp}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const rawResponse = await res.text();
      console.log('Raw API Response:', rawResponse);
      setResponse(rawResponse);
      
      if (!res.ok) {
        throw new Error(`API Error: ${res.status} - ${rawResponse}`);
      }
      
      try {
        const data = JSON.parse(rawResponse);
        console.log('Parsed Response:', data);
        
        if (data.success && data.data) {
          setWorkflows(data.data);
        } else {
          setWorkflows([]);
        }
      } catch (e) {
        console.error('Failed to parse API response:', e);
        throw new Error('Invalid JSON response from API');
      }
    } catch (err) {
      console.error('Error fetching workflows:', err);
      setError(err.message);
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  const createTestWorkflow = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${apiUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newWorkflowName,
          description: 'Debug test workflow created at ' + new Date().toISOString(),
        }),
      });
      
      const rawResponse = await response.text();
      console.log('Create Workflow Raw Response:', rawResponse);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${rawResponse}`);
      }
      
      alert('Workflow created successfully! Fetching updated workflows...');
      fetchWorkflows();
    } catch (err) {
      console.error('Error creating workflow:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" gutterBottom>
        Workflow API Debug Tool
      </Typography>
      
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Authentication</Typography>
        <TextField
          fullWidth
          label="JWT Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          margin="normal"
          variant="outlined"
          multiline
          rows={2}
        />
        
        <Typography variant="h6" gutterBottom>Decoded Token Info:</Typography>
        <pre style={{background: '#f5f5f5', padding: '10px', overflowX: 'auto'}}>
          {JSON.stringify(decodedToken, null, 2)}
        </pre>
        
        <TextField
          fullWidth
          label="User ID (from token)"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          margin="normal"
          variant="outlined"
        />
        
        <TextField
          fullWidth
          label="API URL"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          margin="normal"
          variant="outlined"
        />
      </Paper>
      
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={fetchWorkflows}
          disabled={loading || !token}
        >
          {loading ? <CircularProgress size={24} /> : 'Fetch Workflows'}
        </Button>
        
        <TextField
          label="New Workflow Name"
          value={newWorkflowName}
          onChange={(e) => setNewWorkflowName(e.target.value)}
          variant="outlined"
          sx={{ flexGrow: 1 }}
        />
        
        <Button 
          variant="contained" 
          color="secondary" 
          onClick={createTestWorkflow}
          disabled={loading || !token}
        >
          Create Test Workflow
        </Button>
      </Stack>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6">Raw API Response:</Typography>
        <Paper elevation={1} sx={{ p: 2, background: '#f5f5f5', overflowX: 'auto' }}>
          <pre>{response || 'No response yet'}</pre>
        </Paper>
      </Box>
      
      <Divider sx={{ mb: 3 }} />
      
      <Typography variant="h6" gutterBottom>
        Workflows ({workflows.length})
      </Typography>
      
      {workflows.length > 0 ? (
        <Box>
          {workflows.map((workflow) => (
            <Paper key={workflow.id} elevation={2} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6">{workflow.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                ID: {workflow.id}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Status: {workflow.status}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Created: {new Date(workflow.created_at).toLocaleString()}
              </Typography>
            </Paper>
          ))}
        </Box>
      ) : (
        <Typography>No workflows found.</Typography>
      )}
    </Container>
  );
}

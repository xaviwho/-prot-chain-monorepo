'use client';

import { useState, useEffect } from 'react';

export default function DebugWorkflows() {
  const [apiResponse, setApiResponse] = useState(null);
  const [error, setError] = useState(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    // Get token from localStorage when component mounts
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  const testApi = async () => {
    try {
      setError(null);
      
      // Make direct API call to backend (not going through Next.js API route)
      const backendUrl = 'http://localhost:8082/api/v1/workflows';
      console.log('Making direct API call to:', backendUrl);
      console.log('Using token:', token ? `Bearer ${token.substring(0, 10)}...` : 'No token');
      
      const response = await fetch(backendUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('Response status:', response.status);
      
      const text = await response.text();
      console.log('Raw response:', text);
      
      try {
        const json = JSON.parse(text);
        console.log('Parsed JSON:', json);
        setApiResponse(json);
      } catch (e) {
        setError(`Failed to parse response as JSON: ${e.message}`);
        setApiResponse(text);
      }
    } catch (err) {
      console.error('API test error:', err);
      setError(err.message);
    }
  };

  const createTestWorkflow = async () => {
    try {
      setError(null);
      
      // Make direct API call to create a workflow
      const backendUrl = 'http://localhost:8082/api/v1/workflows';
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          name: `Test Workflow ${new Date().toISOString()}`,
          description: 'Created for debugging' 
        }),
      });
      
      console.log('Create response status:', response.status);
      
      const text = await response.text();
      console.log('Create response:', text);
      
      try {
        const json = JSON.parse(text);
        console.log('Parsed create response:', json);
        setApiResponse(json);
        // Fetch updated list
        setTimeout(testApi, 1000);
      } catch (e) {
        setError(`Failed to parse create response as JSON: ${e.message}`);
        setApiResponse(text);
      }
    } catch (err) {
      console.error('Create workflow error:', err);
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Workflow API Debugger</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="token" style={{ display: 'block', marginBottom: '5px' }}>Auth Token:</label>
          <input 
            id="token"
            type="text" 
            value={token} 
            onChange={(e) => setToken(e.target.value)} 
            style={{ width: '100%', padding: '8px' }} 
          />
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={testApi} 
            style={{ 
              padding: '10px 15px', 
              background: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer' 
            }}
          >
            Test GET Workflows API
          </button>
          
          <button 
            onClick={createTestWorkflow} 
            style={{ 
              padding: '10px 15px', 
              background: '#2196F3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer' 
            }}
          >
            Create Test Workflow
          </button>
        </div>
      </div>
      
      {error && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div>
        <h2>API Response:</h2>
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '15px', 
          borderRadius: '4px',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {apiResponse ? JSON.stringify(apiResponse, null, 2) : 'No response yet'}
        </pre>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

const PDBViewer = ({ pdbId, workflowId, style = {} }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pdbUrl, setPdbUrl] = useState('');

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined') return;
    
    // Return if neither pdbId nor workflowId is provided
    if (!pdbId && !workflowId) {
      console.log('No PDB ID or workflow ID provided');
      setLoading(false);
      return;
    }

    console.log('PDBViewer initializing with:', { pdbId, workflowId });
    
    const setupViewer = async () => {
      try {        
        // Determine the PDB URL
        let url = '';
        if (workflowId) {
          // For workflow structures, use our API
          url = `/api/workflow/${workflowId}/processed-structure`;
        } else if (pdbId) {
          // For PDB structures, use RCSB
          url = `https://files.rcsb.org/view/${pdbId}.pdb`;
        }
        
        if (!url) {
          throw new Error('No valid PDB source available');
        }
        
        // Set the URL for the iframe
        setPdbUrl(url);
        setLoading(false);
      } catch (err) {
        console.error('Error in PDBViewer:', err);
        setError(err.message);
        setLoading(false);
      }
    };
    
    setupViewer();
  }, [pdbId, workflowId]);

  return (
    <Box sx={{ width: '100%', height: '400px', ...style }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Typography color="error">{error}</Typography>
        </Box>
      ) : (
        <iframe
          src={`/pdb-viewer.html?pdbUrl=${encodeURIComponent(pdbUrl)}`}
          style={{ 
            width: '100%', 
            height: '100%',
            border: '1px solid #e0e0e0',
            borderRadius: '4px'
          }}
          title="PDB Structure Viewer"
        />
      )}
    </Box>
  );
};

export default PDBViewer;

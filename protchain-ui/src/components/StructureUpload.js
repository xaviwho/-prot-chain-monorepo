'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  TextField,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SearchIcon from '@mui/icons-material/Search';
import { retrieveProteinDetail } from '@/lib/api';

export default function StructureUpload({ onUploadComplete, workflowId }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [pdbId, setPdbId] = useState('');
  const [searchMode, setSearchMode] = useState(true); // true = search, false = upload

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.pdb')) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError('Please select a valid PDB file');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Upload the structure file and get immediate results
      const response = await fetch(`/api/workflow/${workflowId}/structure`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process structure file');
      }

      const data = await response.json();
      console.log('Structure processing completed with data:', data);
      
      // The API returns results immediately, no polling needed
      // Check for real bioapi response format: {details: {descriptors: {...}}}
      if (data && data.details && data.details.descriptors) {
        console.log('✅ Structure analysis successful, calling onUploadComplete with:', data);
        onUploadComplete({
          status: 'success',
          ...data
        });
      } else {
        console.error('❌ Unexpected API response format:', data);
        throw new Error('No structure analysis results received. Expected format: {details: {descriptors: {...}}}');
      }
    } catch (err) {
      console.error('Structure processing error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handlePdbSearch = async () => {
    if (!pdbId.trim()) {
      setError('Please enter a valid PDB ID');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      console.log('Searching for PDB ID:', pdbId);
      const response = await retrieveProteinDetail(pdbId);

      if (!response || !response.metadata || !response.file) {
        throw new Error('Failed to fetch protein data. Please check the PDB ID and try again.');
      }

      // Send PDB ID directly to backend (no file upload needed)
      // Backend will fetch the real PDB file from RCSB database
      const uploadResponse = await fetch(`/api/workflow/${workflowId}/structure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdbId: pdbId.trim().toUpperCase()
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to process structure');
      }

      const data = await uploadResponse.json();
      console.log('Structure processing completed with data:', data);
      
      // The API returns results immediately, no polling needed
      // Check for real bioapi response format: {details: {descriptors: {...}}}
      if (data && data.details && data.details.descriptors) {
        console.log('✅ PDB structure analysis successful, calling onUploadComplete with:', data);
        onUploadComplete({
          status: 'success',
          ...data,
          pdbId: pdbId.trim().toUpperCase(), // Include the PDB ID that was searched
          metadata: response.metadata.payload
        });
      } else {
        console.error('❌ Unexpected PDB API response format:', data);
        throw new Error('No structure analysis results received. Expected format: {details: {descriptors: {...}}}');
      }
    } catch (err) {
      console.error('PDB search error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Prepare Protein Structure
      </Typography>
      <Typography color="textSecondary" paragraph>
        Search for a PDB structure or upload your own file.
        The structure will be prepared for analysis including:
        - Adding missing hydrogens
        - Optimizing hydrogen bonds
        - Generating molecular descriptors
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Button
          variant={searchMode ? 'contained' : 'outlined'}
          onClick={() => setSearchMode(true)}
          sx={{ 
            mr: 1,
            ...(searchMode && {
              backgroundColor: '#4caf50',
              '&:hover': {
                backgroundColor: '#45a049'
              }
            })
          }}
        >
          Search PDB
        </Button>
        <Button
          variant={!searchMode ? 'contained' : 'outlined'}
          onClick={() => setSearchMode(false)}
          sx={{
            ...(!searchMode && {
              backgroundColor: '#4caf50',
              '&:hover': {
                backgroundColor: '#45a049'
              }
            })
          }}
        >
          Upload File
        </Button>
      </Box>

      {searchMode ? (
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="PDB ID"
            value={pdbId}
            onChange={(e) => setPdbId(e.target.value.toUpperCase())}
            placeholder="Enter PDB ID (e.g., 1ABC)"
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            startIcon={<SearchIcon />}
            onClick={handlePdbSearch}
            disabled={uploading || !pdbId.trim()}
            fullWidth
            sx={{
              backgroundColor: '#4caf50',
              '&:hover': {
                backgroundColor: '#45a049'
              },
              '&:disabled': {
                backgroundColor: '#cccccc'
              }
            }}
          >
            {uploading ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                Processing Structure...
              </>
            ) : (
              'Search and Process Structure'
            )}
          </Button>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              p: 3,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              mb: 2,
            }}
          >
            <input
              type="file"
              accept=".pdb"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="structure-file-input"
            />
            <label htmlFor="structure-file-input">
              <Button
                component="span"
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                disabled={uploading}
              >
                Select PDB File
              </Button>
            </label>
            
            {file && (
              <Typography sx={{ mt: 2 }}>
                Selected: {file.name}
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!file || uploading}
            fullWidth
            sx={{
              backgroundColor: '#4caf50',
              '&:hover': {
                backgroundColor: '#45a049'
              },
              '&:disabled': {
                backgroundColor: '#cccccc'
              }
            }}
          >
            {uploading ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                Processing Structure...
              </>
            ) : (
              'Upload and Process Structure'
            )}
          </Button>
        </>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Paper>
  );
}

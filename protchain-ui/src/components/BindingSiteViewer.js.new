'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, CircularProgress, List, ListItem, ListItemText, Divider, Alert, Chip, Paper, Tabs, Tab } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import ScienceIcon from '@mui/icons-material/Science';
import { normalizePath } from '../utils/pathUtils';
import WorkflowRegistration from './WorkflowRegistration';
import { useTheme } from '@mui/material/styles';

const BindingSiteViewer = ({ workflowId, pdbUrl, style = {} }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bindingSites, setBindingSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState({
    exists: false,
    hasInputFile: false,
    hasProcessedFile: false,
    hasResultsFile: false,
    isRegistered: false,
    message: 'Checking workflow status...'
  });
  const theme = useTheme();

  useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      return;
    }

    const fetchBindingSites = async () => {
      try {
        const response = await fetch(`/api/workflow/${workflowId}/binding-sites`);
        if (!response.ok) {
          if (response.status === 404) {
            setBindingSites([]);
            setError('No binding site analysis results found. Please run the binding site analysis.');
          } else {
            throw new Error(`Failed to fetch binding sites: ${response.status}`);
          }
        } else {
          const data = await response.json();
          setBindingSites(data.binding_sites || []);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching binding sites:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    validateWorkflowFiles();
    fetchBindingSites();
  }, [workflowId]);

  // Validate workflow files
  const validateWorkflowFiles = async () => {
    if (!workflowId) return false;
    
    try {
      console.log('Validating workflow files...');
      const response = await fetch(`/api/workflow/${workflowId}/validate-files`);
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Failed to validate workflow files:', data.error);
        return false;
      }
      
      console.log('Workflow validation result:', data);
      
      // Update workflow status based on validation results
      setWorkflowStatus({
        exists: data.exists,
        hasInputFile: data.hasInputFile,
        hasProcessedFile: data.hasProcessedFile,
        hasResultsFile: data.hasResultsFile,
        isRegistered: data.isRegistered,
        message: data.message
      });
      
      setNeedsRegistration(!data.isRegistered);
      
      return data.exists && data.hasInputFile && data.hasProcessedFile && data.hasResultsFile;
    } catch (err) {
      console.error('Error validating workflow files:', err);
      return false;
    }
  };

  // Function to run binding site analysis
  const runBindingSiteAnalysis = async () => {
    if (!workflowId) return;
    
    try {
      // Validate and prepare workflow first
      const isReady = await validateAndPrepareWorkflow();
      if (!isReady) {
        console.log('Workflow is not ready for binding site analysis');
        return;
      }
      
      setAnalyzing(true);
      setError(null);
      
      console.log('Running binding site analysis...');
      const response = await fetch(`/api/workflow/${workflowId}/binding-site-analysis`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run binding site analysis');
      }
      
      console.log('Binding site analysis completed:', data);
      
      // Fetch the updated binding sites
      const sitesResponse = await fetch(`/api/workflow/${workflowId}/binding-sites`);
      const sitesData = await sitesResponse.json();
      
      if (sitesResponse.ok) {
        setBindingSites(sitesData.binding_sites || []);
        setError(null);
      } else {
        console.error('Error fetching binding sites after analysis:', sitesData.error);
      }
    } catch (err) {
      console.error('Error running binding site analysis:', err);
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Function to run direct binding site analysis
  const runBypassBindingSiteAnalysis = async () => {
    if (!workflowId) return;
    
    try {
      // Validate and prepare workflow first
      const isReady = await validateAndPrepareWorkflow();
      if (!isReady) {
        console.log('Workflow is not ready for binding site analysis');
        return;
      }
      
      setAnalyzing(true);
      setError(null);
      
      console.log('Running direct binding site analysis...');
      const response = await fetch(`/api/workflow/${workflowId}/direct-binding-site-analysis`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run binding site analysis');
      }
      
      console.log('Direct binding site analysis completed:', data);
      setBindingSites(data.binding_sites || []);
      
    } catch (err) {
      console.error('Error running direct binding site analysis:', err);
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Function to run structure preparation
  const runStructurePreparation = async () => {
    if (!workflowId) return;
    
    try {
      setAnalyzing(true);
      setError(null);
      
      console.log('Running structure preparation...');
      const response = await fetch(`/api/workflow/${workflowId}/structure-preparation`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to run structure preparation');
      }
      
      console.log('Structure preparation completed:', data);
      
      // Re-validate workflow files after structure preparation
      await validateWorkflowFiles();
      
    } catch (err) {
      console.error('Error running structure preparation:', err);
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };
  
  // Function to download files
  const downloadFile = async (filename) => {
    if (!workflowId) return;
    
    try {
      console.log(`Downloading ${filename}...`);
      const response = await fetch(`/api/workflow/${workflowId}/download/${filename}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to download ${filename}`);
      }
      
      // Get the file content as blob
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (err) {
      console.error(`Error downloading ${filename}:`, err);
      setError(err.message);
    }
  };

  // Validate and prepare workflow for binding site analysis
  const validateAndPrepareWorkflow = async () => {
    if (!workflowId) return false;
    
    try {
      // Validate workflow files first
      console.log('Validating workflow before analysis...');
      const response = await fetch(`/api/workflow/${workflowId}/validate-files`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to validate workflow files');
      }
      
      console.log('Workflow validation result:', data);
      setWorkflowStatus({
        exists: data.exists,
        hasInputFile: data.hasInputFile,
        hasProcessedFile: data.hasProcessedFile,
        hasResultsFile: data.hasResultsFile,
        isRegistered: data.isRegistered,
        message: data.message
      });
      
      // Check if workflow needs registration
      if (!data.isRegistered) {
        console.log('Workflow needs registration, attempting to register...');
        setNeedsRegistration(true);
        
        // Try to register the workflow automatically
        const regResponse = await fetch(`/api/workflow/${workflowId}/register`, {
          method: 'POST',
        });
        
        const regData = await regResponse.json();
        
        if (!regResponse.ok) {
          console.error('Auto-registration failed:', regData.error);
          throw new Error('Workflow registration failed. Please register the workflow manually.');
        }
        
        console.log('Workflow registered successfully:', regData);
        setNeedsRegistration(false);
      }
      
      // Check if we're missing required files
      if (!data.hasInputFile) {
        throw new Error('Input PDB file not found. Please upload a real protein structure first.');
      }
      
      // If we don't have processed files, we need to run structure preparation
      if (!data.hasProcessedFile || !data.hasResultsFile) {
        console.log('Structure preparation needed before binding site analysis');
        throw new Error('Structure preparation needs to be completed before running binding site analysis.');
      }
      
      // Validate the workflow files one more time
      await validateWorkflowFiles();
      
      // Check if we still have missing files
      if (!workflowStatus.hasInputFile) {
        throw new Error('Input PDB file not found. Please upload a real protein structure first.');
      }
      
      if (!workflowStatus.hasProcessedFile || !workflowStatus.hasResultsFile) {
        throw new Error('Structure preparation needs to be completed before running binding site analysis.');
      }
      
      return true; // Workflow is valid and ready for binding site analysis
    } catch (err) {
      console.error('Error validating workflow:', err);
      setError(err.message);
      return false;
    }
  };

  // Render binding site list
  const renderBindingSiteList = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          {error}
        </Alert>
      );
    }

    if (bindingSites.length === 0) {
      return (
        <Alert severity="info" sx={{ mb: 2 }}>
          No binding site analysis results available for this workflow.
        </Alert>
      );
    }

    return (
      <List>
        {bindingSites.map((site, index) => (
          <React.Fragment key={index}>
            <ListItem 
              button 
              onClick={() => setSelectedSite(site)}
              selected={selectedSite === site}
              sx={{ 
                borderLeft: selectedSite === site 
                  ? `4px solid ${theme.palette.primary.main}` 
                  : '4px solid transparent',
                bgcolor: selectedSite === site ? 'rgba(0, 0, 0, 0.04)' : 'transparent'
              }}
            >
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="subtitle1">
                      Binding Site {index + 1}
                    </Typography>
                    <Chip 
                      label={`Score: ${site.score.toFixed(2)}`} 
                      size="small" 
                      color={site.score > 0.5 ? "success" : "default"}
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" component="span">
                      Volume: {site.volume.toFixed(2)} Å³
                    </Typography>
                    <Typography variant="body2" component="span" sx={{ ml: 2 }}>
                      Residues: {site.residues.length}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
            {index < bindingSites.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    );
  };

  // File uploader component for protein structures
  const FileUploader = ({ workflowId, onUploadComplete }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const fileInputRef = useRef(null);
  
    const handleFileChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
  
      // Check if it's a PDB file
      if (!file.name.toLowerCase().endsWith('.pdb')) {
        setUploadError('Please upload a PDB file (.pdb extension)');
        return;
      }
  
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(false);
  
      try {
        const formData = new FormData();
        formData.append('file', file);
  
        // Upload the file
        const response = await fetch(`/api/workflow/${workflowId}/upload-structure`, {
          method: 'POST',
          body: formData,
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error || 'Failed to upload file');
        }
  
        setUploadSuccess(true);
        console.log('File uploaded successfully:', data);
        
        // Trigger validation after successful upload
        if (onUploadComplete) {
          setTimeout(onUploadComplete, 500); // Small delay to ensure file is processed
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        setUploadError(error.message);
      } finally {
        setUploading(false);
      }
    };
  
    const triggerFileInput = () => {
      fileInputRef.current.click();
    };
  
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <input
          type="file"
          accept=".pdb"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={triggerFileInput}
          disabled={uploading}
          sx={{ mb: 2 }}
        >
          {uploading ? 'Uploading...' : 'Upload Protein Structure (PDB)'}
        </Button>
        {uploadError && (
          <Alert severity="error" sx={{ mt: 1, width: '100%' }}>
            {uploadError}
          </Alert>
        )}
        {uploadSuccess && (
          <Alert severity="success" sx={{ mt: 1, width: '100%' }}>
            Protein structure uploaded successfully!
          </Alert>
        )}
        <Typography variant="caption" sx={{ mt: 1, textAlign: 'center' }}>
          Upload the original protein structure file (PDB format).
          <br />
          After uploading, run Structure Preparation to generate the processed file for binding site analysis.
        </Typography>
      </Box>
    );
  };

  // Main render
  return (
    <Box sx={{ ...style }}>
      <Typography variant="h5" gutterBottom>
        Binding Site Analysis
      </Typography>
      
      {needsRegistration && (
        <Box sx={{ mb: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This workflow needs to be registered with the backend before proceeding.
          </Alert>
          <WorkflowRegistration 
            workflowId={workflowId} 
            onRegistered={() => {
              setNeedsRegistration(false);
              validateWorkflowFiles();
            }}
          />
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Workflow Status
        </Typography>
        <List dense>
          <ListItem>
            <ListItemText 
              primary="Workflow Directory" 
              secondary={workflowStatus.exists ? "Found" : "Not found"} 
              secondaryTypographyProps={{ 
                color: workflowStatus.exists ? "success.main" : "error.main" 
              }}
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Input PDB File" 
              secondary={workflowStatus.hasInputFile ? "Found" : "Not found"} 
              secondaryTypographyProps={{ 
                color: workflowStatus.hasInputFile ? "success.main" : "error.main" 
              }}
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Processed Structure" 
              secondary={workflowStatus.hasProcessedFile ? "Found" : "Not found"} 
              secondaryTypographyProps={{ 
                color: workflowStatus.hasProcessedFile ? "success.main" : "error.main" 
              }}
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Results File" 
              secondary={workflowStatus.hasResultsFile ? "Found" : "Not found"} 
              secondaryTypographyProps={{ 
                color: workflowStatus.hasResultsFile ? "success.main" : "error.main" 
              }}
            />
          </ListItem>
          <ListItem>
            <ListItemText 
              primary="Backend Registration" 
              secondary={workflowStatus.isRegistered ? "Registered" : "Not registered"} 
              secondaryTypographyProps={{ 
                color: workflowStatus.isRegistered ? "success.main" : "error.main" 
              }}
            />
          </ListItem>
        </List>
        
        {workflowStatus.message && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {workflowStatus.message}
          </Alert>
        )}
      </Box>
      
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Binding Site Analysis
        </Typography>
        
        <Box sx={{ mt: 3, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={runBypassBindingSiteAnalysis}
            disabled={analyzing || needsRegistration || !workflowStatus.hasInputFile || !workflowStatus.hasProcessedFile || !workflowStatus.hasResultsFile}
            startIcon={analyzing ? <CircularProgress size={20} /> : null}
          >
            {analyzing ? 'Analyzing...' : 'Run Binding Site Analysis'}
          </Button>
          
          {!workflowStatus.hasInputFile && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning">
                Please upload a real protein structure file (PDB format) before running binding site analysis.
              </Alert>
              <Box sx={{ mt: 2, mb: 2 }}>
                <FileUploader workflowId={workflowId} onUploadComplete={validateWorkflowFiles} />
              </Box>
            </Box>
          )}
          
          {workflowStatus.hasInputFile && !workflowStatus.hasProcessedFile && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning">
                Please run structure preparation before binding site analysis.
              </Alert>
              <Box sx={{ mt: 2, mb: 2 }}>
                <Button 
                  variant="contained" 
                  color="secondary"
                  onClick={runStructurePreparation}
                  disabled={analyzing}
                  startIcon={<ScienceIcon />}
                >
                  Run Structure Preparation
                </Button>
              </Box>
            </Box>
          )}
          
          {workflowStatus.hasProcessedFile && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info">
                Structure preparation completed. You can now run binding site analysis.
              </Alert>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button 
                  variant="outlined" 
                  color="primary"
                  onClick={() => downloadFile('processed.pdb')}
                  startIcon={<DownloadIcon />}
                >
                  Download Processed Structure
                </Button>
                {workflowStatus.hasResultsFile && (
                  <Button 
                    variant="outlined" 
                    color="primary"
                    onClick={() => downloadFile('results.json')}
                    startIcon={<DownloadIcon />}
                  >
                    Download Results JSON
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Box>
        
        {analyzing && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            <CircularProgress size={24} sx={{ mr: 2 }} />
            <Typography variant="body2">
              Analyzing protein structure for binding sites...
            </Typography>
          </Box>
        )}
      </Box>
      
      {bindingSites.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Binding Sites Found: {bindingSites.length}
          </Typography>
          {renderBindingSiteList()}
        </Box>
      )}
      
      {selectedSite && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Selected Binding Site Details
          </Typography>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1">
              Score: {selectedSite.score.toFixed(2)}
            </Typography>
            <Typography variant="body2">
              Volume: {selectedSite.volume.toFixed(2)} Å³
            </Typography>
            <Typography variant="body2">
              Hydrophobicity: {selectedSite.hydrophobicity.toFixed(2)}
            </Typography>
            <Typography variant="body2">
              Druggability: {selectedSite.druggability.toFixed(2)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              Center: ({selectedSite.center.x.toFixed(2)}, {selectedSite.center.y.toFixed(2)}, {selectedSite.center.z.toFixed(2)})
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 2 }}>
              Residues: {selectedSite.residues.length}
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
              <Typography variant="body2" component="div">
                {selectedSite.residues.map((residue, index) => (
                  <Chip 
                    key={index} 
                    label={`${residue.name}${residue.number}`} 
                    size="small" 
                    sx={{ m: 0.5 }}
                  />
                ))}
              </Typography>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default BindingSiteViewer;

'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, Button, ButtonGroup, Slider, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { Stage } from 'ngl';

export default function ProteinViewer({ workflowId, pdbData = null }) {
  const viewerRef = useRef(null);
  const stageRef = useRef(null);
  const componentRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [representation, setRepresentation] = useState('cartoon');
  const [colorScheme, setColorScheme] = useState('chainname');
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (!viewerRef.current) return;

    // Initialize NGL Stage
    const stage = new Stage(viewerRef.current, {
      backgroundColor: 'white',
      quality: 'medium',
      sampleLevel: 1
    });
    
    stageRef.current = stage;

    // Force initial resize after stage creation
    setTimeout(() => {
      if (stage) {
        stage.handleResize();
        console.log('ProteinViewer: Initial resize completed');
      }
    }, 100);

    // Load protein structure
    loadProteinStructure();

    // Handle window resize
    const handleResize = () => {
      if (stage) {
        stage.handleResize();
      }
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (stage) {
        stage.dispose();
      }
    };
  }, [workflowId]);

  const loadProteinStructure = async () => {
    if (!stageRef.current) {
      console.log('ProteinViewer: Stage not initialized yet');
      return;
    }
    
    console.log('ProteinViewer: Starting to load structure for workflowId:', workflowId);
    setLoading(true);
    setError(null);
    
    try {
      let structureData;
      
      if (pdbData) {
        console.log('ProteinViewer: Using provided PDB data');
        structureData = pdbData;
      } else if (workflowId) {
        // Fetch PDB file from workflow uploads
        const pdbUrl = `/api/uploads/${workflowId}/input.pdb`;
        console.log('ProteinViewer: Fetching PDB from:', pdbUrl);
        const response = await fetch(pdbUrl);
        console.log('ProteinViewer: Fetch response status:', response.status);
        if (!response.ok) {
          throw new Error(`Failed to load protein structure file: ${response.status} ${response.statusText}`);
        }
        structureData = await response.text();
        console.log('ProteinViewer: PDB data length:', structureData.length);
        console.log('ProteinViewer: PDB data preview:', structureData.substring(0, 200));
      } else {
        throw new Error('No protein structure data available');
      }

      if (!structureData || structureData.length === 0) {
        throw new Error('Empty protein structure data received');
      }

      console.log('ProteinViewer: Loading structure into NGL...');
      // Load structure into NGL
      const component = await stageRef.current.loadFile(
        new Blob([structureData], { type: 'text/plain' }),
        { ext: 'pdb', name: `Workflow ${workflowId}` }
      );
      
      console.log('ProteinViewer: Structure loaded successfully, component:', component);
      componentRef.current = component;
      
      // Add default representation
      console.log('ProteinViewer: Adding representation:', representation, 'with color scheme:', colorScheme);
      component.addRepresentation(representation, {
        colorScheme: colorScheme,
        opacity: opacity
      });
      
      // Center and zoom to fit
      console.log('ProteinViewer: Centering view...');
      stageRef.current.autoView();
      
      // Force resize after structure is loaded and centered
      setTimeout(() => {
        if (stageRef.current) {
          stageRef.current.handleResize();
          stageRef.current.autoView();
          console.log('ProteinViewer: Post-load resize and autoView completed');
        }
      }, 200);
      
      console.log('ProteinViewer: Structure loading completed successfully');
      setLoading(false);
    } catch (err) {
      console.error('ProteinViewer: Error loading protein structure:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const updateRepresentation = (newRep, newColor = colorScheme, newOpacity = opacity) => {
    if (!componentRef.current) return;
    
    // Clear existing representations
    componentRef.current.removeAllRepresentations();
    
    // Add new representation
    componentRef.current.addRepresentation(newRep, {
      colorScheme: newColor,
      opacity: newOpacity
    });
    
    setRepresentation(newRep);
    setColorScheme(newColor);
    setOpacity(newOpacity);
  };

  const handleRepresentationChange = (newRep) => {
    updateRepresentation(newRep);
  };

  const handleColorSchemeChange = (newColor) => {
    updateRepresentation(representation, newColor);
  };

  const handleOpacityChange = (event, newOpacity) => {
    updateRepresentation(representation, colorScheme, newOpacity);
  };

  const resetView = () => {
    if (stageRef.current) {
      stageRef.current.autoView();
    }
  };

  const toggleFullscreen = () => {
    if (stageRef.current) {
      stageRef.current.toggleFullscreen();
    }
  };

  if (error) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error" gutterBottom>
          Error loading protein structure
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
        <Button onClick={loadProteinStructure} sx={{ mt: 2 }}>
          Retry
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Visualization Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Visualization Controls
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          {/* Representation Selection */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Representation</InputLabel>
            <Select
              value={representation}
              label="Representation"
              onChange={(e) => handleRepresentationChange(e.target.value)}
            >
              <MenuItem value="cartoon">Cartoon</MenuItem>
              <MenuItem value="backbone">Backbone</MenuItem>
              <MenuItem value="ball+stick">Ball & Stick</MenuItem>
              <MenuItem value="spacefill">Space Fill</MenuItem>
              <MenuItem value="ribbon">Ribbon</MenuItem>
              <MenuItem value="rope">Rope</MenuItem>
              <MenuItem value="tube">Tube</MenuItem>
              <MenuItem value="surface">Surface</MenuItem>
            </Select>
          </FormControl>

          {/* Color Scheme Selection */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Color Scheme</InputLabel>
            <Select
              value={colorScheme}
              label="Color Scheme"
              onChange={(e) => handleColorSchemeChange(e.target.value)}
            >
              <MenuItem value="chainname">Chain</MenuItem>
              <MenuItem value="resname">Residue</MenuItem>
              <MenuItem value="element">Element</MenuItem>
              <MenuItem value="secondary">Secondary Structure</MenuItem>
              <MenuItem value="bfactor">B-Factor</MenuItem>
              <MenuItem value="hydrophobicity">Hydrophobicity</MenuItem>
            </Select>
          </FormControl>

          {/* Opacity Slider */}
          <Box sx={{ width: 150 }}>
            <Typography variant="body2" gutterBottom>
              Opacity
            </Typography>
            <Slider
              value={opacity}
              onChange={handleOpacityChange}
              min={0.1}
              max={1}
              step={0.1}
              size="small"
              valueLabelDisplay="auto"
            />
          </Box>

          {/* Action Buttons */}
          <ButtonGroup size="small">
            <Button onClick={resetView}>Reset View</Button>
            <Button onClick={toggleFullscreen}>Fullscreen</Button>
          </ButtonGroup>
        </Box>
      </Paper>

      {/* 3D Viewer Container */}
      <Paper sx={{ position: 'relative', height: '600px', overflow: 'hidden' }}>
        {loading && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              zIndex: 1
            }}
          >
            <Typography>Loading protein structure...</Typography>
          </Box>
        )}
        
        {error && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              zIndex: 1,
              p: 2
            }}
          >
            <Typography color="error" variant="h6" gutterBottom>
              Error Loading Structure
            </Typography>
            <Typography color="error" variant="body2" sx={{ textAlign: 'center' }}>
              {error}
            </Typography>
            <Button 
              variant="outlined" 
              onClick={loadProteinStructure} 
              sx={{ mt: 2 }}
            >
              Retry
            </Button>
          </Box>
        )}
        
        <div
          ref={viewerRef}
          style={{
            width: '100%',
            height: '100%',
            border: '1px solid #ddd'
          }}
        />
      </Paper>

      {/* Instructions */}
      <Paper sx={{ p: 2, mt: 2, backgroundColor: '#f5f5f5' }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Controls:</strong> Left click + drag to rotate • Right click + drag to translate • Scroll to zoom • 
          Use the controls above to change visualization style and colors
        </Typography>
      </Paper>
    </Box>
  );
}

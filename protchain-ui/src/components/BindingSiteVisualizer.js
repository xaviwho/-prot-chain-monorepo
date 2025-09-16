'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, Slider, FormControl, InputLabel, Select, MenuItem, Paper, Grid, CircularProgress } from '@mui/material';
import * as Papa from 'papaparse';

const BindingSiteVisualizer = ({ bindingSites = [], pdbId = '1AMC', selectedPocketId = null, onPocketSelect = null }) => {
  const viewerRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [uniqueSites, setUniqueSites] = useState(new Set());
  const [sphereSize, setSphereSize] = useState(1.0);
  const [opacity, setOpacity] = useState(0.8);
  const [colorScheme, setColorScheme] = useState('rainbow');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);

  // Color schemes
  const colorSchemes = {
    rainbow: (index, total) => {
      const hue = (index / total) * 360;
      return `hsl(${hue}, 70%, 60%)`;
    },
    spectrum: (index, total) => {
      const colors = ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', 
                    '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff'];
      return colors[index % colors.length];
    },
    viridis: (index, total) => {
      const colors = ['#440154', '#3b528b', '#21908c', '#5dc863', '#fde725'];
      return colors[index % colors.length];
    },
    random: () => {
      return `#${Math.floor(Math.random()*16777215).toString(16)}`;
    }
  };

  // Load 3Dmol.js library
  useEffect(() => {
    const load3Dmol = () => {
      if (window.$3Dmol) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/1.8.0/3Dmol-min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load 3Dmol.js'));
        document.head.appendChild(script);
      });
    };

    load3Dmol().catch(console.error);
  }, []);

  // Initialize 3Dmol viewer with proper error handling
  useEffect(() => {
    if (!window.$3Dmol || viewer) return;

    const initializeViewer = () => {
      // Check if container exists
      if (!viewerRef.current) {
        console.error('Viewer container ref not available');
        return;
      }

      // Check if container is in DOM
      if (!document.contains(viewerRef.current)) {
        console.error('Viewer container not in DOM');
        return;
      }

      try {
        console.log('Creating 3Dmol viewer...');
        const newViewer = window.$3Dmol.createViewer(viewerRef.current, {
          defaultcolors: window.$3Dmol.rasmolElementColors
        });
        
        if (!newViewer) {
          console.error('Failed to create 3Dmol viewer instance');
          return;
        }

        newViewer.setBackgroundColor(0x000000);
        
        // Load PDB structure
        const loadStructure = async () => {
          try {
            setIsLoading(true);
            const pdbUrl = `https://files.rcsb.org/download/${pdbId}.pdb`;
            const response = await fetch(pdbUrl);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch PDB: ${response.status}`);
            }
            
            const pdbData = await response.text();
            
            newViewer.addModel(pdbData, 'pdb');
            newViewer.setStyle({}, {cartoon: {color: 'spectrum'}});
            newViewer.zoomTo();
            newViewer.render();
            setIsLoading(false);
            
            console.log('PDB structure loaded successfully');
          } catch (error) {
            console.error('Failed to load PDB structure:', error);
            setIsLoading(false);
          }
        };

        loadStructure();
        setViewer(newViewer);
        
      } catch (error) {
        console.error('Error initializing 3Dmol viewer:', error);
        setIsLoading(false);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      // Double-check container availability
      if (viewerRef.current) {
        initializeViewer();
      } else {
        // Fallback with timeout
        setTimeout(() => {
          if (viewerRef.current) {
            initializeViewer();
          } else {
            console.error('Viewer container still not available after timeout');
          }
        }, 500);
      }
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [pdbId]);

  // No need for CSV data conversion - we'll work directly with bindingSites
  useEffect(() => {
    if (bindingSites && bindingSites.length > 0) {
      const sites = new Set();
      bindingSites.forEach((site, index) => {
        const siteId = site.id || site.pocket_id || (index + 1);
        sites.add(siteId.toString());
      });
      setUniqueSites(sites);
    }
  }, [bindingSites]);

  // Convert color string to 3Dmol color
  const colorToHex = (colorStr) => {
    if (colorStr.startsWith('#')) {
      return parseInt(colorStr.substring(1), 16);
    } else if (colorStr.startsWith('hsl')) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = colorStr;
      return parseInt(ctx.fillStyle.substring(1), 16);
    }
    return 0xffffff;
  };

  // Update visualization with fpocket-style rendering
  const updateVisualization = () => {
    updateVisualizationWithSelection(selectedSite);
  };

  // Generate fewer surface points for cleaner visualization
  const generateSurfacePoints = (centerX, centerY, centerZ, radius) => {
    const points = [];
    const numPoints = 8; // Reduced from 20
    
    for (let i = 0; i < numPoints; i++) {
      const theta = (i / numPoints) * 2 * Math.PI;
      for (let j = 0; j < 4; j++) { // Reduced from numPoints/2
        const phi = (j / 4) * Math.PI;
        
        const x = centerX + radius * Math.sin(phi) * Math.cos(theta);
        const y = centerY + radius * Math.sin(phi) * Math.sin(theta);
        const z = centerZ + radius * Math.cos(phi);
        
        points.push({ x, y, z });
      }
    }
    
    return points;
  };

  // Handle site click without breaking the viewer
  const handleSiteClick = (siteId) => {
    setSelectedSite(siteId);
    console.log(`Clicked on binding site ${siteId}`);
    
    // Notify parent component
    if (onPocketSelect) {
      onPocketSelect(siteId);
    }
    
    // Focus on the site
    focusOnSite(siteId);
  };

  // Update visualization when controls change
  useEffect(() => {
    if (viewer && bindingSites.length > 0) {
      updateVisualizationWithSelection(selectedSite);
    }
  }, [sphereSize, opacity, colorScheme, selectedSite, bindingSites, viewer]);

  // Handle external pocket selection from table
  useEffect(() => {
    if (selectedPocketId && viewer && bindingSites && bindingSites.length > 0) {
      focusOnSite(selectedPocketId.toString());
    }
  }, [selectedPocketId, viewer, bindingSites]);

  const resetView = () => {
    if (viewer) {
      viewer.zoomTo();
      viewer.render();
    }
  };

  const focusOnSite = (siteId) => {
    if (!viewer || !bindingSites) return;
    
    // Find the binding site by ID
    const site = bindingSites.find(s => 
      (s.id || s.pocket_id || bindingSites.indexOf(s) + 1).toString() === siteId.toString()
    );
    
    if (site && site.center) {
      console.log('Focusing on site:', siteId, 'at coordinates:', site.center);
      
      // Highlight the selected binding site by making it more prominent
      updateVisualizationWithSelection(siteId);
      
      // Move camera to focus on the binding site without clearing
      const center = site.center;
      
      // Simply render without moving camera to avoid clearing
      viewer.render();
      
      setSelectedSite(siteId);
      console.log('Camera focused on binding site', siteId);
    }
  };

  // Update visualization with selection highlighting - CLEAN VERSION
  const updateVisualizationWithSelection = (selectedSiteId) => {
    if (!viewer || !bindingSites || bindingSites.length === 0) return;
    
    console.log('Updating visualization with', bindingSites.length, 'binding sites');
    
    // Clear ALL existing shapes but keep the protein structure
    viewer.removeAllShapes();
    
    // Show all binding sites but with smaller spheres for better visibility
    const sitesToShow = bindingSites;
    
    sitesToShow.forEach((site, index) => {
      const siteId = site.id || site.pocket_id || (index + 1);
      const colorFunction = colorSchemes[colorScheme];
      const colorStr = colorFunction(index, sitesToShow.length);
      const color = colorToHex(colorStr);
      const isSelected = siteId.toString() === selectedSiteId?.toString();
      
      // Show main binding site sphere with size based on volume/druggability and user controls
      if (site.center) {
        const { x, y, z } = site.center;
        // Use much larger base radius and apply user sphere size control
        const baseRadius = 5.0 * sphereSize; // Apply user sphere size multiplier
        const volumeScale = site.volume ? Math.min(site.volume / 200, 2.0) : 1.0;
        const scoreScale = site.druggability_score ? Math.max(site.druggability_score, 0.5) : 1.0;
        const radius = baseRadius * volumeScale * scoreScale;
        
        console.log(`Adding sphere for site ${siteId} at (${x}, ${y}, ${z}) with radius ${radius.toFixed(1)}`);
        
        // Add binding site sphere
        viewer.addSphere({
          center: { x, y, z },
          radius: isSelected ? radius * 1.3 : radius,
          color: isSelected ? 0xff0000 : color, // Red for selected
          alpha: isSelected ? 0.9 : (index < 10 ? opacity : opacity * 0.7), // Apply user opacity control
          clickable: true,
          callback: () => {
            handleSiteClick(siteId);
          }
        });
      }
    });
    
    console.log(`Added ${sitesToShow.length} spheres to viewer`);
    viewer.render();
  };

  const sitesArray = Array.from(uniqueSites);
  const colorFunction = colorSchemes[colorScheme];

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Visualization Controls
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Typography gutterBottom>Sphere Size: {sphereSize}</Typography>
            <Slider
              value={sphereSize}
              onChange={(e, value) => setSphereSize(value)}
              min={0.1}
              max={3.0}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <Typography gutterBottom>Opacity: {opacity}</Typography>
            <Slider
              value={opacity}
              onChange={(e, value) => setOpacity(value)}
              min={0.1}
              max={1.0}
              step={0.1}
              valueLabelDisplay="auto"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Color Scheme</InputLabel>
              <Select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value)}
                label="Color Scheme"
              >
                <MenuItem value="rainbow">Rainbow</MenuItem>
                <MenuItem value="spectrum">Spectrum</MenuItem>
                <MenuItem value="viridis">Viridis</MenuItem>
                <MenuItem value="random">Random</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              onClick={resetView}
              fullWidth
              sx={{ height: '56px' }}
            >
              Reset View
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Viewer Container */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          ref={viewerRef}
          sx={{
            width: '100%',
            height: 500,
            backgroundColor: '#000',
            borderRadius: 1,
            position: 'relative'
          }}
          id="binding-site-viewer-container"
        >
          {isLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                textAlign: 'center'
              }}
            >
              <CircularProgress sx={{ color: 'white', mb: 2 }} />
              <Typography>Loading structure...</Typography>
            </Box>
          )}
        </Box>
      </Paper>

    </Box>
  );
};

export default BindingSiteVisualizer;

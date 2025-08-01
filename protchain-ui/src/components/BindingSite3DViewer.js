'use client';

import { useState, useEffect, useRef } from 'react';
import { Box, Typography, CircularProgress, Button, Select, MenuItem, FormControl, InputLabel, Slider, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * A component for visualizing binding sites in 3D using NGL Viewer
 */
export default function BindingSite3DViewer({ workflowId, bindingSites = [] }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [displayStyle, setDisplayStyle] = useState('cartoon');
  const [bindingSiteStyle, setBindingSiteStyle] = useState('surface');
  const [opacity, setOpacity] = useState(0.8);
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const theme = useTheme();

  // Load the NGL Viewer library
  useEffect(() => {
    const loadNGL = async () => {
      try {
        // Check if NGL is already loaded
        if (window.NGL) {
          return window.NGL;
        }

        // Load NGL script
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/ngl@0.10.4/dist/ngl.js';
        script.async = true;
        
        // Wait for script to load
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        
        return window.NGL;
      } catch (error) {
        console.error('Failed to load NGL:', error);
        setError('Failed to load 3D viewer library');
        return null;
      }
    };

    loadNGL().then((NGL) => {
      if (NGL) {
        console.log('NGL loaded successfully');
      }
    });
  }, []);

  // Initialize the viewer once NGL is loaded
  useEffect(() => {
    if (!window.NGL || !containerRef.current) return;
    
    try {
      // Create a new viewer instance
      const stage = new window.NGL.Stage(containerRef.current);
      stage.setParameters({ backgroundColor: 'white' });
      
      // Enable tooltips
      stage.mouseControls.add('hoverPick', (pickingProxy) => {
        if (pickingProxy && pickingProxy.atom) {
          const atom = pickingProxy.atom;
          const residue = atom.residue;
          console.log(`Hovering over ${residue.resname}${residue.resno}:${atom.chainname}`);
        }
      });

      // Set viewer
      setViewer(stage);
      
      // Load the protein structure
      loadProteinStructure(stage);
      
    } catch (error) {
      console.error('Error initializing NGL viewer:', error);
      setError('Failed to initialize 3D viewer');
    }
    
    // Clean up on unmount
    return () => {
      if (viewer) {
        viewer.dispose();
      }
    };
  }, [containerRef.current, window.NGL]);

  // Load the protein structure
  const loadProteinStructure = async (stage) => {
    if (!stage || !workflowId) return;
    
    setLoading(true);
    
    try {
      // Load the processed structure from the API
      const url = `/api/workflow/${workflowId}/processed-structure`;
      
      // Load the structure
      const component = await stage.loadFile(url, { ext: 'pdb' });
      
      // Set default representation
      component.addRepresentation(displayStyle, {
        sele: 'protein',
        color: 'chainname'
      });
      
      // Add ligand representation if present
      component.addRepresentation('licorice', {
        sele: 'ligand',
        color: 'element'
      });
      
      // Store the component reference
      viewerRef.current = component;
      
      // Auto center and zoom
      stage.autoView();
      
      // If binding sites are available, visualize them
      if (bindingSites && bindingSites.length > 0) {
        // Select the first binding site by default
        setSelectedSite(bindingSites[0]);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading protein structure:', error);
      setError('Failed to load protein structure');
      setLoading(false);
    }
  };

  // Update when binding sites change
  useEffect(() => {
    if (bindingSites && bindingSites.length > 0 && !selectedSite) {
      setSelectedSite(bindingSites[0]);
    }
  }, [bindingSites]);

  // Visualize the selected binding site
  useEffect(() => {
    if (!viewer || !viewerRef.current || !selectedSite) return;
    
    try {
      // Clear previous binding site representations
      viewer.eachComponent((comp) => {
        comp.removeRepresentation(comp.reprList.filter(repr => repr.name.includes('binding-site')));
      });
      
      // Handle different binding site data formats
      console.log('Selected binding site data:', selectedSite);
      
      let residueSelection = '';
      
      // Check if residues exist and have the expected format
      if (selectedSite.residues && Array.isArray(selectedSite.residues)) {
        // Handle bioapi format: residues with res_name, chain_id, res_num
        if (selectedSite.residues.length > 0 && selectedSite.residues[0].res_num) {
          residueSelection = selectedSite.residues.map(res => 
            `${res.res_num}:${res.chain_id || 'A'}`
          ).join(' or ');
        }
        // Handle alternative format: residues with number, chain
        else if (selectedSite.residues.length > 0 && selectedSite.residues[0].number) {
          residueSelection = selectedSite.residues.map(res => 
            `${res.number}:${res.chain || 'A'}`
          ).join(' or ');
        }
      }
      
      console.log('Generated residue selection:', residueSelection);
      
      // Add binding site representation if we have residues
      if (residueSelection) {
        try {
          const representation = viewerRef.current.addRepresentation(bindingSiteStyle, {
            sele: residueSelection,
            color: theme.palette.primary.main,
            opacity: opacity,
            name: 'binding-site'
          });
          console.log('Added binding site representation');
        } catch (error) {
          console.error('Error adding binding site representation:', error);
        }
      }
      
      // Create a sphere at the binding site center if center exists
      if (selectedSite.center) {
        try {
          const shape = new window.NGL.Shape('binding-site-center');
          shape.addSphere(
            [selectedSite.center.x, selectedSite.center.y, selectedSite.center.z], 
            theme.palette.secondary.main, 
            2.0
          );
          
          const shapeComp = viewer.addComponentFromObject(shape);
          shapeComp.addRepresentation('buffer');
          console.log('Added binding site center sphere');
        } catch (error) {
          console.error('Error adding binding site center:', error);
        }
      }
      
      // Focus on the binding site if we have a selection
      if (residueSelection) {
        try {
          viewer.autoView(residueSelection);
        } catch (error) {
          console.error('Error focusing on binding site:', error);
          // Fallback: just auto view the entire structure
          viewer.autoView();
        }
      } else {
        // No specific residues, just auto view the structure
        viewer.autoView();
      }
      
    } catch (error) {
      console.error('Error visualizing binding site:', error);
    }
  }, [selectedSite, viewer, bindingSiteStyle, opacity, theme]);

  // Update protein representation when display style changes
  useEffect(() => {
    if (!viewer || !viewerRef.current) return;
    
    try {
      // Update the protein representation
      viewerRef.current.removeAllRepresentations();
      
      // Add protein representation
      viewerRef.current.addRepresentation(displayStyle, {
        sele: 'protein',
        color: 'chainname'
      });
      
      // Add ligand representation if present
      viewerRef.current.addRepresentation('licorice', {
        sele: 'ligand',
        color: 'element'
      });
      
      // Re-add binding site representation if a site is selected
      if (selectedSite) {
        const residueSelection = selectedSite.residues.map(res => 
          `${res.number}:${res.chain}`
        ).join(' or ');
        
        if (residueSelection) {
          viewerRef.current.addRepresentation(bindingSiteStyle, {
            sele: residueSelection,
            color: theme.palette.primary.main,
            opacity: opacity,
            name: 'binding-site'
          });
        }
      }
    } catch (error) {
      console.error('Error updating protein representation:', error);
    }
  }, [displayStyle]);

  // Render binding site selector
  const renderBindingSiteSelector = () => {
    if (!bindingSites || bindingSites.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          No binding sites available
        </Typography>
      );
    }

    return (
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel id="binding-site-select-label">Binding Site</InputLabel>
        <Select
          labelId="binding-site-select-label"
          value={selectedSite ? bindingSites.indexOf(selectedSite) : ''}
          label="Binding Site"
          onChange={(e) => setSelectedSite(bindingSites[e.target.value])}
        >
          {bindingSites.map((site, index) => (
            <MenuItem key={index} value={index}>
              Site {index + 1} (Score: {site.score.toFixed(2)}, Volume: {site.volume.toFixed(0)} Å³)
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  // Render display style selector
  const renderDisplayStyleSelector = () => {
    return (
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel id="display-style-select-label">Protein Style</InputLabel>
        <Select
          labelId="display-style-select-label"
          value={displayStyle}
          label="Protein Style"
          onChange={(e) => setDisplayStyle(e.target.value)}
        >
          <MenuItem value="cartoon">Cartoon</MenuItem>
          <MenuItem value="surface">Surface</MenuItem>
          <MenuItem value="licorice">Licorice</MenuItem>
          <MenuItem value="ball+stick">Ball & Stick</MenuItem>
          <MenuItem value="spacefill">Spacefill</MenuItem>
        </Select>
      </FormControl>
    );
  };

  // Render binding site style selector
  const renderBindingSiteStyleSelector = () => {
    return (
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel id="binding-site-style-select-label">Binding Site Style</InputLabel>
        <Select
          labelId="binding-site-style-select-label"
          value={bindingSiteStyle}
          label="Binding Site Style"
          onChange={(e) => setBindingSiteStyle(e.target.value)}
        >
          <MenuItem value="surface">Surface</MenuItem>
          <MenuItem value="licorice">Licorice</MenuItem>
          <MenuItem value="ball+stick">Ball & Stick</MenuItem>
          <MenuItem value="spacefill">Spacefill</MenuItem>
        </Select>
      </FormControl>
    );
  };

  // Render opacity slider
  const renderOpacitySlider = () => {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography id="opacity-slider" gutterBottom>
          Binding Site Opacity
        </Typography>
        <Slider
          value={opacity}
          onChange={(e, newValue) => setOpacity(newValue)}
          aria-labelledby="opacity-slider"
          step={0.1}
          marks
          min={0.1}
          max={1}
        />
      </Box>
    );
  };

  // Render binding site details
  const renderBindingSiteDetails = () => {
    if (!selectedSite) return null;

    return (
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          Binding Site {bindingSites.indexOf(selectedSite) + 1} Details
        </Typography>
        <Typography variant="body2">
          Score: {selectedSite.score.toFixed(2)}
        </Typography>
        <Typography variant="body2">
          Volume: {selectedSite.volume.toFixed(2)} Å³
        </Typography>
        {selectedSite.druggability && (
          <Typography variant="body2">
            Druggability: {selectedSite.druggability.toFixed(2)}
          </Typography>
        )}
        {selectedSite.hydrophobicity && (
          <Typography variant="body2">
            Hydrophobicity: {selectedSite.hydrophobicity.toFixed(2)}
          </Typography>
        )}
        <Typography variant="body2">
          Center: ({selectedSite.center.x.toFixed(2)}, {selectedSite.center.y.toFixed(2)}, {selectedSite.center.z.toFixed(2)})
        </Typography>
        <Typography variant="body2">
          Residues: {selectedSite.residues.length}
        </Typography>
      </Paper>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, height: '100%' }}>
      {/* 3D Viewer */}
      <Box sx={{ flex: 3, position: 'relative', height: { xs: '300px', md: '400px' } }}>
        {loading && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </Box>

      {/* Controls */}
      <Box sx={{ flex: 1, p: 2, minWidth: '250px' }}>
        <Typography variant="h6" gutterBottom>
          Binding Site Visualization
        </Typography>
        
        {renderBindingSiteSelector()}
        {renderDisplayStyleSelector()}
        {renderBindingSiteStyleSelector()}
        {renderOpacitySlider()}
        {renderBindingSiteDetails()}
        
        <Button 
          variant="outlined" 
          color="primary" 
          fullWidth
          onClick={() => viewer && viewer.autoView()}
        >
          Reset View
        </Button>
      </Box>
    </Box>
  );
}

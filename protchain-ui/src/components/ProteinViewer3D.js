'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Button } from '@mui/material';


/**
 * Loads the Mol* library dynamically to avoid SSR issues
 * @returns {Promise<void>} Promise that resolves when library is loaded
 */
const loadMolstarLibrary = async () => {
  // Check if library is already loaded
  if (window.molstar) {
    return;
  }

  // Load CSS first
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://unpkg.com/molstar@latest/build/viewer/molstar.css';
  document.head.appendChild(css);

  // Then load the script
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/molstar@latest/build/viewer/molstar.js';
  script.async = true;

  return new Promise((resolve, reject) => {
    script.onload = () => {
      // Wait a bit for molstar to initialize
      setTimeout(resolve, 100);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
};


/**
 * Fetches PDB data directly from RCSB using PDB ID
 * @param {string} pdbId - The PDB ID to fetch
 * @returns {Promise<string>} Promise that resolves to PDB data string
 */
const fetchPDBData = async (pdbId) => {
  try {
    
    // Fetch directly from RCSB PDB
    const pdbUrl = `https://files.rcsb.org/download/${pdbId}.pdb`;
    
    const pdbResponse = await fetch(pdbUrl);
    
    if (pdbResponse.ok) {
      const pdbData = await pdbResponse.text();
      return pdbData;
    }
    
    // Try alternative RCSB endpoint
    const altUrl = `https://files.rcsb.org/view/${pdbId}.pdb`;
    
    const altResponse = await fetch(altUrl);
    
    if (altResponse.ok) {
      const pdbData = await altResponse.text();
      return pdbData;
    }
    
    // If all else fails, throw an error
    throw new Error(`Unable to fetch protein structure data for PDB ID: ${pdbId}. Please check the PDB ID and try again.`);
    
  } catch (error) {
    throw error;
  }
};

/**
 * Fetches real binding pockets from BioAPI using geometric cavity detection
 * @param {string} pdbId - The PDB ID to analyze
 * @returns {Promise<Array>} Promise that resolves to array of binding sites
 */
const fetchRealBindingPockets = async (pdbId) => {
  try {
    
    // Call our new API endpoint that connects to BioAPI
    const response = await fetch(`/api/workflow/${pdbId}/binding-pockets`);
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    const bindingSites = data.binding_sites || [];
    
    
    return bindingSites;
    
  } catch (error) {
    return []; // Return empty array on error, don't fail the viewer
  }
};

/**
 * Waits for a DOM element to become available with retry logic
 * @param {React.RefObject} elementRef - React ref to the element
 * @param {number} maxAttempts - Maximum number of retry attempts
 * @returns {Promise<HTMLElement>} Promise that resolves to the DOM element
 */
const waitForElement = async (elementRef, maxAttempts = 10) => {
  for (let attempts = 0; attempts < maxAttempts; attempts++) {
    if (elementRef.current) {
      return elementRef.current;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Element not found after maximum attempts');
};

// Molstar handles styling automatically with good defaults
// This function is kept for compatibility but not used

/**
 * Add pocket spheres to Molstar viewer like in the reference image
 * @param {Object} viewer - Molstar viewer instance  
 * @param {Array} bindingSites - Array of binding site objects with center coordinates
 */
const addPocketSpheresToMolstar = async (viewer, bindingSites) => {
  if (!bindingSites || bindingSites.length === 0) {
    return;
  }

  
  try {
    // Create shapes for each pocket
    const shapes = [];
    
    for (let index = 0; index < bindingSites.length; index++) {
      const site = bindingSites[index];
      const siteId = site.id || (index + 1);
      const center = site.center || { x: 0, y: 0, z: 0 };
      const volume = site.volume || 100;
      const score = site.druggability_score || site.score || 0;
      
      // Calculate sphere radius from volume
      const radius = Math.pow((3 * volume) / (4 * Math.PI), 1/3) * 0.1;
      
      // Color based on druggability score
      let color;
      if (score >= 0.7) {
        color = { r: 220, g: 50, b: 47 }; // Red - high druggability
      } else if (score >= 0.5) {
        color = { r: 245, g: 124, b: 0 }; // Orange - medium druggability  
      } else {
        color = { r: 251, g: 192, b: 45 }; // Yellow - lower druggability
      }
      
      
      // Create sphere shape data
      const sphere = {
        kind: 'sphere',
        center: [center.x, center.y, center.z],
        radius: Math.max(radius, 2.0), // Minimum radius for visibility
        color: color,
        alpha: 0.7,
        label: `Pocket ${siteId}`
      };
      
      shapes.push(sphere);
    }
    
    // Try to add shapes to Molstar viewer
    if (viewer.builders?.structure?.shape && shapes.length > 0) {
      
      // Create shape representation
      const shapeData = {
        shapes: shapes,
        label: 'Binding Pockets'
      };
      
      try {
        await viewer.builders.structure.shape.fromData(shapeData);
      } catch (shapeError) {
      }
    } else {
    }
    
  } catch (error) {
  }
};

// Molstar library loading function restored

/**
 * Initializes and configures the Molstar viewer with protein data and real binding site pockets
 * @param {HTMLElement} container - DOM container for the viewer
 * @param {string} pdbId - PDB ID to fetch data for
 * @param {Array} providedBindingSites - Optional pre-provided binding sites
 * @param {string} stage - Current workflow stage to determine if binding sites should be shown
 * @returns {Promise<Object>} Promise that resolves to the configured viewer
 */
const initializeViewer = async (container, pdbId, providedBindingSites = null, stage = 'binding_site_analysis') => {
  // Validate prerequisites
  if (!container) {
    throw new Error('Viewer container not found');
  }
  
  if (!pdbId) {
    throw new Error('PDB ID is required');
  }
  
  if (!window.molstar) {
    throw new Error('Molstar library not available');
  }

  
  try {
    // Create the Molstar viewer instance with interactive features
    const viewer = await window.molstar.Viewer.create(container, {
      layoutIsExpanded: false,
      layoutShowControls: true,
      layoutShowRemoteState: false,
      layoutShowSequence: true,
      layoutShowLog: false,
      layoutShowLeftPanel: true,
      layoutShowRightPanel: false,
      viewportShowExpand: true,
      viewportShowSelectionMode: true,
      viewportShowAnimation: false,
      viewportShowSettings: true,
      pdbProvider: 'rcsb',
      extensions: [],
      collapseLeftPanel: false,
      collapseRightPanel: true,
    });


    // Fetch and load protein data
    const pdbData = await fetchPDBData(pdbId);
    
    if (!pdbData || pdbData.length === 0) {
      throw new Error('No PDB data available');
    }

    // Load structure from PDB data
    const data = await viewer.loadStructureFromData(pdbData, 'pdb', { dataLabel: `Protein ${pdbId}` });

    // Fetch real binding pockets only for binding site analysis stage
    let bindingSitesToUse = [];
    if (stage === 'binding_site_analysis') {
      bindingSitesToUse = providedBindingSites;
      if (!bindingSitesToUse) {
        try {
          bindingSitesToUse = await fetchRealBindingPockets(pdbId);
        } catch (error) {
          bindingSitesToUse = [];
        }
      }
    }

    // Add real binding site pocket visualization using Molstar's representation system
    if (bindingSitesToUse && bindingSitesToUse.length > 0) {
      await addPocketSpheresToMolstar(viewer, bindingSitesToUse);
    } else {
    }
    

    return { viewer, bindingSites: bindingSitesToUse };
  } catch (error) {
    throw error;
  }
};

/**
 * 3D Protein Structure Viewer Component
 * 
 * Displays protein structures using 3Dmol.js with optional binding site highlighting
 * 
 * @param {Object} props - Component properties
 * @param {string} props.pdbId - PDB ID to fetch and display (required)
 * @param {string} props.workflowId - ID of the workflow (optional, for backward compatibility)
 * @param {string} props.stage - Current stage of the workflow (unused but kept for compatibility)
 * @param {Array} props.bindingSites - Array of binding sites to highlight on the structure
 */
function ProteinViewer3D({ 
  pdbId = '1AMC', 
  workflowId = null, 
  stage = 'structure_preparation',
  bindingSites = null,
  selectedPocketId = null,
  onPocketSelect = null
}) {
  // Refs and state management
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [realBindingSites, setRealBindingSites] = useState(null);

  // Use provided pdbId or default to 2HIU if none provided
  const targetPdbId = pdbId || '2HIU';
  
  // Debug logging to see what PDB ID we're actually using

  /**
   * Handle pocket click to highlight specific pocket in 3D viewer
   */
  const handlePocketClick = async (pocket) => {
    
    // Fix: Only set selected pocket if it's different from current selection
    setSelectedPocket(prevSelected => {
      if (prevSelected === pocket.id) {
        return null; // Deselect if clicking the same pocket
      }
      return pocket.id; // Select the new pocket
    });
    
    
    // Try to focus camera and highlight pocket in Molstar
    if (viewer && pocket) {
      try {
        // Focus camera on pocket center
        const center = [pocket.center.x, pocket.center.y, pocket.center.z];
        
        // Try to access Molstar's camera system
        if (viewer.canvas3d?.camera) {
          const camera = viewer.canvas3d.camera;
          
          // Simple camera focus attempt
          if (typeof camera.focus === 'function') {
            await camera.focus(center, 1500);
          } else if (typeof camera.setState === 'function') {
            await camera.setState({
              target: { x: center[0], y: center[1], z: center[2] },
              radius: 25
            }, 1500);
          }
        }
        
        // Highlight the pocket sphere in Molstar (if available)
        await highlightPocketInMolstar(viewer, pocket);
        
      } catch (error) {
      }
    }
  };

  /**
   * Highlight a specific pocket in the Molstar viewer
   */
  const highlightPocketInMolstar = async (viewer, pocket) => {
    try {
      // Clear previous selections
      if (viewer.managers?.interactivity?.lociSelects) {
        viewer.managers.interactivity.lociSelects.clear();
      }
      
      // Create a sphere representation for the pocket
      const center = [pocket.center.x, pocket.center.y, pocket.center.z];
      const radius = Math.pow(pocket.volume / (4/3 * Math.PI), 1/3); // Approximate radius from volume
      
      // Try to create a sphere representation at the pocket location
      if (viewer.builders?.structure?.representation) {
        const sphereParams = {
          type: 'ball-and-stick',
          color: pocket.druggability_score >= 0.7 ? 'red' : 
                 pocket.druggability_score >= 0.5 ? 'orange' : 'yellow',
          size: radius,
          alpha: 0.6
        };
        
      }
      
    } catch (error) {
    }
  };

  /**
   * Effect to load Molstar library first
   */
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        await loadMolstarLibrary();
        setLoading(false); // Allow container to render
      } catch (err) {
        setError('Failed to load 3D viewer library');
        setLoading(false);
      }
    };

    loadLibrary();
  }, []);

  /**
   * Effect to initialize viewer after container is rendered
   */
  useEffect(() => {
    if (loading || error || !window.molstar) {
      return;
    }

    // Add a small delay to ensure DOM is fully rendered
    const timer = setTimeout(() => {
      if (!containerRef.current) {
        setError('Viewer container not found');
        return;
      }

      const setupViewer = async () => {
        try {
          
          const result = await initializeViewer(containerRef.current, targetPdbId, bindingSites, stage);
          setViewer(result.viewer);
          setRealBindingSites(result.bindingSites);
        } catch (err) {
          setError(err.message || 'Failed to load protein structure');
        }
      };

      setupViewer();
    }, 100); // 100ms delay

    return () => clearTimeout(timer);
  }, [loading, error, targetPdbId, bindingSites, stage]);

  /**
   * Effect to handle pocket selection from table clicks
   */
  useEffect(() => {
    if (!viewer || !realBindingSites || !selectedPocketId) {
      return;
    }

    // Find the selected pocket
    const selectedPocket = realBindingSites.find(pocket => 
      (pocket.id || pocket.pocket_id) === selectedPocketId
    );

    if (!selectedPocket) {
      return;
    }


    // Focus camera on the selected pocket
    const focusOnPocket = async () => {
      try {
        if (selectedPocket.center) {
          const { x, y, z } = selectedPocket.center;
          
          // Try multiple methods to focus the camera
          const plugin = viewer.plugin;
          
          // Method 1: Try camera controls
          if (plugin?.canvas3d?.camera) {
            const camera = plugin.canvas3d.camera;
            const target = { x, y, z };
            
            // Set camera target and update
            camera.setState({
              target,
              radius: 20, // Zoom level
              alpha: camera.state.alpha, // Keep current rotation
              beta: camera.state.beta
            });
            
          }
          
          // Method 2: Try behavior manager
          else if (plugin?.managers?.camera) {
            await plugin.managers.camera.focusLoci([{
              kind: 'element-loci',
              elements: [{
                unit: { id: 0 },
                indices: [0]
              }]
            }]);
            
          }
          
          // Method 3: Direct canvas manipulation
          else if (plugin?.canvas3d?.requestDraw) {
            plugin.canvas3d.requestDraw(true);
          }
        }
      } catch (error) {
      }
    };

    focusOnPocket();
  }, [viewer, realBindingSites, selectedPocketId]);

  // Cleanup effect for viewer resources
  useEffect(() => {
    return () => {
      if (viewer && viewer.dispose) {
        try {
          viewer.dispose();
        } catch (e) {
          // Ignore cleanup errors - viewer might already be destroyed
        }
      }
    };
  }, [viewer]);

  /**
   * Handle window resize events to maintain proper viewer dimensions
   */
  useEffect(() => {
    const handleResize = () => {
      if (viewer && viewer.handleResize && containerRef.current) {
        viewer.handleResize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewer]);

  // Render loading state
  if (loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height={400}>
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading 3D protein structure...
        </Typography>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="body2">
          {error}
        </Typography>
      </Alert>
    );
  }

  // Render the main viewer interface
  return (
    <Box>
      {/* Header - Clean title without pocket info */}
      <Typography variant="h6" gutterBottom>
        3D Protein Structure
      </Typography>

      {/* 3D Viewer Container */}
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: 500,
          border: '1px solid #ddd',
          borderRadius: 1,
          backgroundColor: '#000',
          position: 'relative',
          overflow: 'hidden',
          '& .msp-plugin': {
            width: '100% !important',
            height: '100% !important',
            position: 'relative !important'
          },
          '& .msp-layout-expanded': {
            position: 'relative !important',
            width: '100% !important',
            height: '100% !important'
          }
        }}
      />

      {/* Usage instructions */}
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Use mouse to rotate, zoom, and pan the structure. 
        {bindingSites && bindingSites.length > 0 && ' Binding site pockets are shown as colored spheres with residue highlighting.'}
      </Typography>
    </Box>
  );
}

export default ProteinViewer3D;
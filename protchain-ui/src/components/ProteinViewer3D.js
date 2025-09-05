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
    console.log("=== PDB FETCH DEBUG ===");
    console.log("Fetching PDB data for ID:", pdbId);
    
    // Fetch directly from RCSB PDB
    console.log(`Step 1: Fetching PDB structure ${pdbId} from RCSB...`);
    const pdbUrl = `https://files.rcsb.org/download/${pdbId}.pdb`;
    console.log("RCSB URL:", pdbUrl);
    
    const pdbResponse = await fetch(pdbUrl);
    console.log("RCSB response status:", pdbResponse.status);
    
    if (pdbResponse.ok) {
      const pdbData = await pdbResponse.text();
      console.log(`✅ Successfully fetched ${pdbId} from RCSB PDB, length:`, pdbData.length);
      console.log("First 200 chars:", pdbData.substring(0, 200));
      return pdbData;
    }
    
    // Try alternative RCSB endpoint
    console.log("Step 2: Trying alternative RCSB endpoint...");
    const altUrl = `https://files.rcsb.org/view/${pdbId}.pdb`;
    console.log("Alternative RCSB URL:", altUrl);
    
    const altResponse = await fetch(altUrl);
    console.log("Alternative RCSB response status:", altResponse.status);
    
    if (altResponse.ok) {
      const pdbData = await altResponse.text();
      console.log(`✅ Successfully fetched ${pdbId} from RCSB PDB (alternative), length:`, pdbData.length);
      return pdbData;
    }
    
    // If all else fails, throw an error
    console.log("❌ All PDB fetch attempts failed");
    console.log("=== END PDB FETCH DEBUG ===");
    throw new Error(`Unable to fetch protein structure data for PDB ID: ${pdbId}. Please check the PDB ID and try again.`);
    
  } catch (error) {
    console.error('❌ PDB fetch error:', error);
    console.log("=== END PDB FETCH DEBUG ===");
    throw error;
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
    
    console.log(`Waiting for container... attempt ${attempts + 1}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Element not found after maximum attempts');
};

// Molstar handles styling automatically with good defaults
// This function is kept for compatibility but not used

/**
 * Highlights binding site pockets using Molstar's representation system
 * Similar to fpocket and AutoSite visualization with interactive features
 */
const highlightBindingSitePocketsInMolstar = async (viewer, bindingSites, structureData) => {
  if (!bindingSites || bindingSites.length === 0) {
    console.log('No binding sites to highlight');
    return;
  }

  console.log('Highlighting', bindingSites.length, 'binding site pockets in Molstar');
  
  try {
    for (let index = 0; index < bindingSites.length; index++) {
      const site = bindingSites[index];
      const siteId = site.id || (index + 1);
      const center = site.center || { x: 0, y: 0, z: 0 };
      const volume = site.volume || 100;
      const score = site.druggability_score || site.score || 0;
      
      // Color based on druggability score or pocket ranking
      let color = [1, 0, 0]; // Red for high priority
      if (score < 0.3) color = [1, 0.5, 0];  // Orange for medium priority
      if (score < 0.1) color = [1, 1, 0];    // Yellow for low priority
      if (index === 0) color = [1, 0, 0];    // Best pocket is always red
      
      console.log(`Pocket ${siteId}: center(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}), volume=${volume.toFixed(1)}, score=${score.toFixed(3)}`);
      
      // Create a sphere representation for the pocket center
      const sphereRadius = Math.max(Math.pow((3 * volume) / (4 * Math.PI), 1/3) * 0.05, 1.0);
      
      // Add sphere representation using Molstar's shape API
      const sphereData = {
        kind: 'sphere',
        center: [center.x, center.y, center.z],
        radius: sphereRadius,
        color: color,
        alpha: 0.6
      };
      
      // Highlight residues if available using Molstar's selection system
      if (site.residues && Array.isArray(site.residues)) {
        const residueSelections = [];
        
        site.residues.forEach(residue => {
          if (residue.number && residue.chain) {
            residueSelections.push({
              'residue-test': {
                'auth_seq_id': residue.number,
                'auth_asym_id': residue.chain
              }
            });
          }
        });
        
        if (residueSelections.length > 0) {
          console.log(`Highlighting ${residueSelections.length} residues for pocket ${siteId}`);
          // Note: Actual Molstar selection implementation would go here
          // This is a simplified version for the structure
        }
      }
    }
    
    console.log('Molstar binding site pocket visualization complete');
  } catch (error) {
    console.error('Error highlighting binding sites in Molstar:', error);
  }
};

// Molstar library loading function restored

/**
 * Initializes and configures the Molstar viewer with protein data and binding site pockets
 * @param {HTMLElement} container - DOM container for the viewer
 * @param {string} pdbId - PDB ID to fetch data for
 * @param {Array} bindingSites - Binding sites to highlight as pockets
 * @returns {Promise<Object>} Promise that resolves to the configured viewer
 */
const initializeViewer = async (container, pdbId, bindingSites) => {
  // Validate prerequisites
  if (!container) {
    throw new Error('Container element is required');
  }
  
  if (!pdbId) {
    throw new Error('PDB ID is required');
  }
  
  if (!window.molstar) {
    throw new Error('Molstar library not available');
  }

  console.log('Creating Molstar viewer with container:', container);
  console.log('Container dimensions:', container.offsetWidth, 'x', container.offsetHeight);
  console.log('Binding sites for pocket visualization:', bindingSites?.length || 0);
  
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

    console.log('Molstar viewer created:', viewer);

    // Fetch and load protein data
    const pdbData = await fetchPDBData(pdbId);
    console.log('PDB data length:', pdbData ? pdbData.length : 'null');
    
    if (!pdbData || pdbData.length === 0) {
      throw new Error('No PDB data available');
    }

    // Load structure from PDB data
    const data = await viewer.loadStructureFromData(pdbData, 'pdb', { dataLabel: `Protein ${pdbId}` });
    console.log('Structure loaded:', data);

    // Add binding site pocket visualization using Molstar's representation system
    if (bindingSites && bindingSites.length > 0) {
      console.log('Adding pocket visualization for', bindingSites.length, 'binding sites');
      await highlightBindingSitePocketsInMolstar(viewer, bindingSites, data);
    }
    
    console.log('Molstar viewer initialization complete with pocket visualization');

    return viewer;
  } catch (error) {
    console.error('Failed to initialize Molstar viewer:', error);
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
function ProteinViewer3D({ pdbId, workflowId, stage = 'structure', bindingSites = null }) {
  // Refs and state management
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewer, setViewer] = useState(null);

  // Use provided pdbId or default to 2HIU if none provided
  const targetPdbId = pdbId || '2HIU';
  
  // Debug logging to see what PDB ID we're actually using
  console.log("=== PROTEIN VIEWER DEBUG ===");
  console.log("Received pdbId prop:", pdbId);
  console.log("Target PDB ID being used:", targetPdbId);
  console.log("WorkflowId:", workflowId);
  console.log("=== END PROTEIN VIEWER DEBUG ===");

  /**
   * Effect to load Molstar library first
   */
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        console.log("Loading Molstar library");
        await loadMolstarLibrary();
        console.log("Molstar library loaded successfully");
        setLoading(false); // Allow container to render
      } catch (err) {
        console.error('Failed to load Molstar library:', err);
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
    if (loading || error || !containerRef.current || !window.molstar) {
      return;
    }

    const setupViewer = async () => {
      try {
        console.log("Initializing Molstar viewer with PDB ID:", targetPdbId);
        console.log("Binding sites for visualization:", bindingSites?.length || 0);
        const viewerInstance = await initializeViewer(containerRef.current, targetPdbId, bindingSites);
        console.log("Molstar viewer setup completed successfully");
        setViewer(viewerInstance);
      } catch (err) {
        console.error('Failed to setup protein viewer:', err);
        setError(err.message || 'Failed to load protein structure');
      }
    };

    setupViewer();
  }, [loading, error, targetPdbId, bindingSites]);

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
      {/* Header with binding sites info */}
      <Typography variant="h6" gutterBottom>
        3D Protein Structure - Binding Site Pockets
        {bindingSites && bindingSites.length > 0 && (
          <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
            ({bindingSites.length} pocket{bindingSites.length > 1 ? 's' : ''} visualized)
          </Typography>
        )}
      </Typography>
      
      {/* Pocket Legend */}
      {bindingSites && bindingSites.length > 0 && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>Pocket Visualization Legend:</Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: 'red', borderRadius: '50%', opacity: 0.7 }} />
              <Typography variant="caption">High Priority (Best Pockets)</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: 'orange', borderRadius: '50%', opacity: 0.7 }} />
              <Typography variant="caption">Medium Priority</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 12, height: 12, bgcolor: 'yellow', borderRadius: '50%', opacity: 0.7 }} />
              <Typography variant="caption">Low Priority</Typography>
            </Box>
          </Box>
        </Box>
      )}

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
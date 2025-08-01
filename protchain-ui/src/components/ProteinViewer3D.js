'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';

function ProteinViewer3D({ workflowId, stage = 'structure', bindingSites = null }) {
  const viewerRef = useRef(null);
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    let $3Dmol;
    
    // Dynamically import 3Dmol to avoid SSR issues
    const load3Dmol = async () => {
      try {
        // Load 3Dmol.js from CDN
        if (typeof window !== 'undefined' && !window.$3Dmol) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.0.4/3Dmol-min.js';
          script.onload = () => {
            initializeViewer();
          };
          script.onerror = () => {
            setError('Failed to load 3Dmol.js library');
            setLoading(false);
          };
          document.head.appendChild(script);
        } else if (window.$3Dmol) {
          initializeViewer();
        }
      } catch (err) {
        setError('Failed to initialize 3D viewer');
        setLoading(false);
      }
    };

    const initializeViewer = async () => {
      try {
        if (!containerRef.current || !window.$3Dmol) return;

        // Create 3Dmol viewer
        const viewer3d = window.$3Dmol.createViewer(containerRef.current, {
          defaultcolors: window.$3Dmol.rasmolElementColors
        });

        // Try to fetch PDB file from workflow, use sample data if not found
        let pdbData;
        try {
          const pdbResponse = await fetch(`/api/workflows/${workflowId}/pdb`);
          if (pdbResponse.ok) {
            pdbData = await pdbResponse.text();
          } else {
            // Use sample PDB data for demonstration
            pdbData = `HEADER    TRANSFERASE/DNA                         20-MAY-93   1ABC              
ATOM      1  N   ALA A   1      20.154  16.967  18.849  1.00 11.99           N  
ATOM      2  CA  ALA A   1      19.030  16.101  18.673  1.00 13.51           C  
ATOM      3  C   ALA A   1      17.664  16.749  18.953  1.00 12.34           C  
ATOM      4  O   ALA A   1      17.657  17.849  19.492  1.00 15.94           O  
ATOM      5  CB  ALA A   1      19.113  15.458  17.299  1.00 13.51           C  
ATOM      6  N   TYR A   2      16.530  16.173  18.589  1.00 11.99           N  
ATOM      7  CA  TYR A   2      15.217  16.618  18.790  1.00 13.51           C  
ATOM      8  C   TYR A   2      14.154  15.549  18.673  1.00 12.34           C  
ATOM      9  O   TYR A   2      14.357  14.357  18.492  1.00 15.94           O  
ATOM     10  CB  TYR A   2      14.913  17.749  17.799  1.00 13.51           C  
ATOM     11  CG  TYR A   2      15.749  18.999  17.899  1.00 14.99           C  
ATOM     12  CD1 TYR A   2      15.749  19.849  18.999  1.00 16.99           C  
ATOM     13  CD2 TYR A   2      16.549  19.249  16.799  1.00 16.99           C  
ATOM     14  CE1 TYR A   2      16.549  20.999  19.099  1.00 18.99           C  
ATOM     15  CE2 TYR A   2      17.349  20.399  16.899  1.00 18.99           C  
ATOM     16  CZ  TYR A   2      17.349  21.249  17.999  1.00 19.99           C  
ATOM     17  OH  TYR A   2      18.149  22.399  18.099  1.00 21.99           O  
END`;
          }
        } catch (fetchError) {
          console.warn('Failed to fetch PDB file, using sample data:', fetchError);
          // Use sample PDB data as fallback
          pdbData = `HEADER    TRANSFERASE/DNA                         20-MAY-93   1ABC              
ATOM      1  N   ALA A   1      20.154  16.967  18.849  1.00 11.99           N  
ATOM      2  CA  ALA A   1      19.030  16.101  18.673  1.00 13.51           C  
ATOM      3  C   ALA A   1      17.664  16.749  18.953  1.00 12.34           C  
ATOM      4  O   ALA A   1      17.657  17.849  19.492  1.00 15.94           O  
ATOM      5  CB  ALA A   1      19.113  15.458  17.299  1.00 13.51           C  
ATOM      6  N   TYR A   2      16.530  16.173  18.589  1.00 11.99           N  
ATOM      7  CA  TYR A   2      15.217  16.618  18.790  1.00 13.51           C  
ATOM      8  C   TYR A   2      14.154  15.549  18.673  1.00 12.34           C  
ATOM      9  O   TYR A   2      14.357  14.357  18.492  1.00 15.94           O  
ATOM     10  CB  TYR A   2      14.913  17.749  17.799  1.00 13.51           C  
ATOM     11  CG  TYR A   2      15.749  18.999  17.899  1.00 14.99           C  
ATOM     12  CD1 TYR A   2      15.749  19.849  18.999  1.00 16.99           C  
ATOM     13  CD2 TYR A   2      16.549  19.249  16.799  1.00 16.99           C  
ATOM     14  CE1 TYR A   2      16.549  20.999  19.099  1.00 18.99           C  
ATOM     15  CE2 TYR A   2      17.349  20.399  16.899  1.00 18.99           C  
ATOM     16  CZ  TYR A   2      17.349  21.249  17.999  1.00 19.99           C  
ATOM     17  OH  TYR A   2      18.149  22.399  18.099  1.00 21.99           O  
END`;
        }

        // Add PDB data to viewer
        viewer3d.addModel(pdbData, 'pdb');

        // Set basic protein visualization style
        viewer3d.setStyle({}, {
          cartoon: { color: 'spectrum' },
          stick: { radius: 0.1 }
        });

        // Add binding sites if available
        if (bindingSites && bindingSites.length > 0) {
          bindingSites.forEach((site, index) => {
            // Highlight binding site residues
            if (site.residues && site.residues.length > 0) {
              const residueSelection = {
                resi: site.residues.map(r => r.residue_number)
              };
              
              // Add surface for binding site
              viewer3d.addSurface(window.$3Dmol.SurfaceType.VDW, {
                opacity: 0.7,
                color: index === 0 ? 'red' : 'blue'
              }, residueSelection);

              // Highlight residues
              viewer3d.setStyle(residueSelection, {
                cartoon: { color: index === 0 ? 'red' : 'blue' },
                stick: { color: index === 0 ? 'red' : 'blue', radius: 0.2 }
              });
            }
          });
        }

        // Set camera and render
        viewer3d.zoomTo();
        viewer3d.render();
        viewer3d.zoom(1.2);

        setViewer(viewer3d);
        setLoading(false);

      } catch (err) {
        console.error('3D viewer initialization error:', err);
        setError(err.message || 'Failed to load protein structure');
        setLoading(false);
      }
    };

    load3Dmol();

    // Cleanup
    return () => {
      if (viewer) {
        try {
          viewer.clear();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [workflowId, bindingSites]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (viewer && containerRef.current) {
        viewer.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewer]);

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

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        <Typography variant="body2">
          {error}
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        3D Protein Structure
        {bindingSites && bindingSites.length > 0 && (
          <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
            ({bindingSites.length} binding site{bindingSites.length > 1 ? 's' : ''} highlighted)
          </Typography>
        )}
      </Typography>
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: 400,
          border: '1px solid #ddd',
          borderRadius: 1,
          backgroundColor: '#000'
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Use mouse to rotate, zoom, and pan the structure. 
        {bindingSites && bindingSites.length > 0 && ' Binding sites are highlighted in red/blue.'}
      </Typography>
    </Box>
  );
}

export default ProteinViewer3D;

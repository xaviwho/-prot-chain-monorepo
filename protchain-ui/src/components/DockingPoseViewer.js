'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Chip,
} from '@mui/material';
import { Close } from '@mui/icons-material';

/**
 * DockingPoseViewer — renders the docked ligand pose overlaid on the protein
 * in 3Dmol.js inside a MUI Dialog.
 *
 * Props:
 *   compound    – object with { name, smiles, vina_score_kcal, pose_sdf, ... }
 *   workflowId  – for fetching the protein PDB from /api/workflow/{id}/processed-structure
 *   pdbId       – fallback for fetching from RCSB
 *   onClose     – callback to close the dialog
 */
const DockingPoseViewer = ({ compound, workflowId, pdbId, onClose }) => {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load 3Dmol.js script if not present
  useEffect(() => {
    if (window.$3Dmol) return;
    const script = document.createElement('script');
    script.src = 'https://3dmol.csb.pitt.edu/build/3Dmol-min.js';
    script.async = true;
    script.onerror = () => setError('Failed to load 3Dmol.js library');
    document.head.appendChild(script);
  }, []);

  // Initialize viewer when compound changes
  useEffect(() => {
    if (!compound) return;

    const tryInit = () => {
      if (!window.$3Dmol) {
        setTimeout(tryInit, 200);
        return;
      }
      setTimeout(initViewer, 100);
    };
    tryInit();

    return () => {
      viewerInstanceRef.current = null;
    };
  }, [compound]);

  const initViewer = async () => {
    if (!viewerRef.current || !window.$3Dmol) return;
    setLoading(true);
    setError(null);

    try {
      const viewer = window.$3Dmol.createViewer(viewerRef.current, {
        backgroundColor: 'white',
        antialias: true,
      });
      viewerInstanceRef.current = viewer;

      // --- Load protein structure ---
      let pdbData = null;

      // Try local processed structure first
      if (workflowId) {
        try {
          const res = await fetch(`/api/workflow/${workflowId}/processed-structure`);
          if (res.ok) pdbData = await res.text();
        } catch (_) {}
      }

      // Fallback: fetch from RCSB
      if (!pdbData && pdbId && pdbId !== 'unknown') {
        try {
          const res = await fetch(`https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`);
          if (res.ok) pdbData = await res.text();
        } catch (_) {}
      }

      if (pdbData && pdbData.includes('ATOM')) {
        viewer.addModel(pdbData, 'pdb');
        viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.8 } });
      }

      // --- Load docked ligand pose ---
      // If compound has all_poses_sdf (array), pick the selected pose; otherwise use pose_sdf
      let poseSdf = compound.pose_sdf;
      const poseIndex = compound.selected_pose_index ?? 0;
      if (compound.all_poses_sdf && Array.isArray(compound.all_poses_sdf) && compound.all_poses_sdf[poseIndex]) {
        poseSdf = compound.all_poses_sdf[poseIndex];
      }

      if (poseSdf) {
        // Detect format: SDF vs PDBQT
        const isSdf = poseSdf.includes('M  END') || poseSdf.includes('$$$$');
        const isPdbqt = poseSdf.includes('ATOM') || poseSdf.includes('REMARK');
        const fmt = isSdf ? 'sdf' : isPdbqt ? 'pdbqt' : 'sdf';

        viewer.addModel(poseSdf, fmt);

        // Style the ligand: sticks with green carbon color scheme
        viewer.setStyle(
          { model: -1 },
          { stick: { colorscheme: 'greenCarbon', radius: 0.15 } }
        );

        // Add translucent surface around the ligand
        viewer.addSurface(
          window.$3Dmol.SurfaceType.VDW,
          { opacity: 0.35, color: 'green' },
          { model: -1 }
        );
      }

      viewer.zoomTo();
      viewer.render();
      setLoading(false);
    } catch (err) {
      console.error('DockingPoseViewer init error:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (!compound) return null;

  const vinaScore = compound.vina_score_kcal ?? compound.predicted_binding_affinity_kcal;
  const poseIdx = compound.selected_pose_index ?? 0;
  const poseLabel = compound.all_poses_scores ? ` (Pose ${poseIdx + 1} of ${compound.all_poses_scores.length})` : '';

  return (
    <Dialog open={!!compound} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h6" component="span">
            Docked Pose: {compound.name}{poseLabel}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            {vinaScore && (
              <Chip
                label={`${vinaScore} kcal/mol`}
                size="small"
                color={vinaScore <= -8 ? 'success' : vinaScore <= -6 ? 'warning' : 'default'}
              />
            )}
            {compound.molecular_weight > 0 && (
              <Chip label={`MW: ${compound.molecular_weight?.toFixed(0)}`} size="small" variant="outlined" />
            )}
            {compound.category && (
              <Chip
                label={compound.category.replace(/_/g, ' ')}
                size="small"
                variant="outlined"
                sx={{ textTransform: 'capitalize' }}
              />
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box
          ref={viewerRef}
          sx={{
            width: '100%',
            height: 500,
            backgroundColor: '#fff',
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            position: 'relative',
          }}
        >
          {loading && (
            <Box sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 10,
            }}>
              <CircularProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>Loading structure...</Typography>
            </Box>
          )}
          {error && (
            <Box sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)', textAlign: 'center',
            }}>
              <Typography color="error">{error}</Typography>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Protein shown as cartoon (spectrum). Docked ligand shown as green sticks with translucent surface.
        </Typography>

        {compound.smiles && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontFamily: 'monospace' }}>
            SMILES: {compound.smiles}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DockingPoseViewer;

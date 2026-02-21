'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button, Slider, FormControl, InputLabel, Select, MenuItem, Paper, Grid, CircularProgress, Chip, Tooltip } from '@mui/material';

/**
 * BindingSiteVisualizer — renders actual pocket-lining residues on the 3D protein
 * using 3Dmol.js.  Each binding site is shown as:
 *   1. Stick representation of pocket-lining residues (coloured per-pocket)
 *   2. Translucent surface over those residues
 *   3. Small sphere at the geometric center of the pocket
 */
const BindingSiteVisualizer = ({ bindingSites = [], pdbId, workflowId, selectedPocketId = null, onPocketSelect = null }) => {
  const viewerRef = useRef(null);
  const viewerInstanceRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [surfaceOpacity, setSurfaceOpacity] = useState(0.35);
  const [showAllPockets, setShowAllPockets] = useState(true);
  const pdbDataRef = useRef(null);

  // Pocket colour palette (distinguishable colours)
  const POCKET_COLORS = [
    '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
    '#469990', '#dcbeff', '#9A6324', '#800000', '#aaffc3',
  ];

  const getPocketColor = (index) => POCKET_COLORS[index % POCKET_COLORS.length];
  const hexToInt = (hex) => parseInt(hex.replace('#', ''), 16);

  // ---- Load 3Dmol.js ----
  useEffect(() => {
    if (window.$3Dmol) return;
    const script = document.createElement('script');
    script.src = 'https://3dmol.csb.pitt.edu/build/3Dmol-min.js';
    script.async = true;
    script.onerror = () => setLoadError('Failed to load 3Dmol.js library');
    document.head.appendChild(script);
  }, []);

  // ---- Build the viewer once 3Dmol + DOM are ready ----
  useEffect(() => {
    if (!viewerRef.current) return;
    const tryInit = () => {
      if (!window.$3Dmol) { setTimeout(tryInit, 200); return; }
      initViewer();
    };
    tryInit();
    return () => { viewerInstanceRef.current = null; };
  }, [pdbId, workflowId]);

  const initViewer = async () => {
    if (!viewerRef.current || !window.$3Dmol) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const v = window.$3Dmol.createViewer(viewerRef.current, {
        backgroundColor: 'white',
        antialias: true,
      });
      viewerInstanceRef.current = v;

      // Fetch PDB data — prefer local processed structure, fallback to RCSB
      let pdbData = null;
      // Try local processed structure first (uses the workflowId from parent)
      const wfId = workflowId || (typeof window !== 'undefined' && window.location.pathname.match(/workflows\/([^/]+)/)?.[1]);
      if (wfId) {
        try {
          const res = await fetch(`/api/workflow/${wfId}/processed-structure`);
          if (res.ok) pdbData = await res.text();
        } catch (_) {}
      }
      if (!pdbData && pdbId && pdbId !== 'unknown' && pdbId !== '1AMC') {
        try {
          const res = await fetch(`https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`);
          if (res.ok) pdbData = await res.text();
        } catch (_) {}
      }
      if (!pdbData || !pdbData.includes('ATOM')) {
        throw new Error('Could not load protein structure');
      }

      pdbDataRef.current = pdbData;
      v.addModel(pdbData, 'pdb');
      v.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.85 } });

      // Render pockets on structure
      renderPockets(v, bindingSites, null);

      v.zoomTo();
      v.render();
      setIsLoading(false);
    } catch (err) {
      setLoadError(err.message);
      setIsLoading(false);
    }
  };

  // ---- Render pocket residues on the structure ----
  const renderPockets = useCallback((viewer, sites, focusSiteId) => {
    if (!viewer || !sites || sites.length === 0) return;

    viewer.removeAllShapes();
    viewer.removeAllSurfaces();

    // Reset protein to base cartoon
    viewer.setStyle({}, { cartoon: { color: 'spectrum', opacity: 0.85 } });

    sites.forEach((site, index) => {
      const siteId = site.site_id || site.id || (index + 1);
      const isFocused = focusSiteId != null && siteId.toString() === focusSiteId.toString();
      const shouldShow = showAllPockets || isFocused;
      if (!shouldShow) return;

      const color = getPocketColor(index);
      const colorInt = hexToInt(color);

      // Collect residue numbers from nearby_residues
      const residueIds = [];
      const residues = site.nearby_residues || site.residues || [];
      residues.forEach((r) => {
        const resNum = r.residue_number || r.res_num || r.number;
        if (resNum != null) residueIds.push(parseInt(resNum));
      });

      if (residueIds.length > 0) {
        // Highlight pocket-lining residues as sticks
        viewer.addStyle(
          { resi: residueIds },
          { stick: { color: color, radius: isFocused ? 0.25 : 0.18 } }
        );

        // Translucent surface over pocket residues
        try {
          viewer.addSurface(
            window.$3Dmol.SurfaceType.VDW,
            { opacity: isFocused ? surfaceOpacity + 0.15 : surfaceOpacity, color: color },
            { resi: residueIds }
          );
        } catch (_) {
          // Surface rendering can sometimes fail — degrade gracefully
        }
      }

      // Small sphere at pocket geometric center
      if (site.center) {
        viewer.addSphere({
          center: { x: site.center.x, y: site.center.y, z: site.center.z },
          radius: isFocused ? 1.8 : 1.2,
          color: colorInt,
          alpha: isFocused ? 0.9 : 0.6,
        });
      }
    });

    viewer.render();
  }, [showAllPockets, surfaceOpacity]);

  // Re-render when controls change
  useEffect(() => {
    if (viewerInstanceRef.current && bindingSites.length > 0) {
      renderPockets(viewerInstanceRef.current, bindingSites, selectedSite);
    }
  }, [selectedSite, showAllPockets, surfaceOpacity, bindingSites, renderPockets]);

  // Handle external pocket selection from table
  useEffect(() => {
    if (selectedPocketId != null) {
      setSelectedSite(selectedPocketId.toString());
      if (viewerInstanceRef.current) {
        renderPockets(viewerInstanceRef.current, bindingSites, selectedPocketId.toString());
        const site = bindingSites.find(
          (s, i) => (s.site_id || s.id || i + 1).toString() === selectedPocketId.toString()
        );
        if (site?.center) {
          viewerInstanceRef.current.zoomTo({ x: site.center.x, y: site.center.y, z: site.center.z }, 12);
          viewerInstanceRef.current.render();
        }
      }
    }
  }, [selectedPocketId]);

  const handleSiteClick = (siteId) => {
    const newId = selectedSite === siteId?.toString() ? null : siteId?.toString();
    setSelectedSite(newId);
    if (onPocketSelect) onPocketSelect(newId ? parseInt(newId) : null);
  };

  const resetView = () => {
    setSelectedSite(null);
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.zoomTo();
      viewerInstanceRef.current.render();
    }
    if (onPocketSelect) onPocketSelect(null);
  };

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <Typography variant="body2" gutterBottom>
              Pocket Surface Opacity: {surfaceOpacity.toFixed(2)}
            </Typography>
            <Slider
              value={surfaceOpacity}
              onChange={(_, v) => setSurfaceOpacity(v)}
              min={0.05}
              max={0.8}
              step={0.05}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Focus Pocket</InputLabel>
              <Select
                value={selectedSite || ''}
                onChange={(e) => handleSiteClick(e.target.value || null)}
                label="Focus Pocket"
              >
                <MenuItem value="">All Pockets</MenuItem>
                {bindingSites.map((site, i) => {
                  const siteId = site.site_id || site.id || i + 1;
                  return (
                    <MenuItem key={siteId} value={siteId.toString()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: getPocketColor(i) }} />
                        Pocket {siteId} — Score: {(site.druggability_score || 0).toFixed(2)}, Vol: {(site.volume || 0).toFixed(0)} A
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <Button variant="contained" onClick={resetView} fullWidth size="small" sx={{ height: 40 }}>
              Reset View
            </Button>
          </Grid>

          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {bindingSites.slice(0, 10).map((site, i) => {
                const siteId = site.site_id || site.id || i + 1;
                return (
                  <Tooltip key={i} title={`Pocket ${siteId}: druggability ${(site.druggability_score || 0).toFixed(2)}`}>
                    <Chip
                      label={`P${siteId}`}
                      size="small"
                      onClick={() => handleSiteClick(siteId)}
                      sx={{
                        backgroundColor: getPocketColor(i),
                        color: '#fff',
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        border: selectedSite === siteId.toString() ? '2px solid #000' : 'none',
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* 3D Viewer */}
      <Paper sx={{ p: 1 }}>
        <Box
          ref={viewerRef}
          sx={{
            width: '100%',
            height: 550,
            backgroundColor: '#fff',
            borderRadius: 1,
            position: 'relative',
          }}
        >
          {isLoading && (
            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 10 }}>
              <CircularProgress sx={{ mb: 1 }} />
              <Typography variant="body2">Loading protein structure...</Typography>
            </Box>
          )}
          {loadError && (
            <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', zIndex: 10 }}>
              <Typography color="error" variant="body2">{loadError}</Typography>
              <Button size="small" sx={{ mt: 1 }} onClick={initViewer}>Retry</Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default BindingSiteVisualizer;

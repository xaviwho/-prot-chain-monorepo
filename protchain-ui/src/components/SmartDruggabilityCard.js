'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  AutoAwesome,
  ExpandMore,
  ExpandLess,
  TrendingUp,
  Science,
  CompareArrows,
} from '@mui/icons-material';

function FeatureBar({ name, value, maxValue = 1.0, importance = 0 }) {
  const pct = Math.min((value / maxValue) * 100, 100);
  const impPct = Math.min(importance * 100, 100);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 500 }}>
          {name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {typeof value === 'number' ? value.toFixed(3) : value}
        </Typography>
      </Box>
      <Tooltip title={`Feature importance: ${(importance * 100).toFixed(1)}%`}>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(0,0,0,0.08)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              background: `linear-gradient(90deg, #7c4dff ${impPct}%, #448aff ${impPct}%)`,
            },
          }}
        />
      </Tooltip>
    </Box>
  );
}

function ScoreComparison({ original, ml, confidence }) {
  const getScoreColor = (score) => {
    if (score >= 0.7) return '#4caf50';
    if (score >= 0.5) return '#ff9800';
    return '#f44336';
  };

  const getScoreLabel = (score) => {
    if (score >= 0.7) return 'High';
    if (score >= 0.5) return 'Medium';
    return 'Low';
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <Paper sx={{ p: 1.5, textAlign: 'center', flex: 1, minWidth: 120 }}>
        <Typography variant="caption" color="text.secondary">
          Geometric Score
        </Typography>
        <Typography
          variant="h5"
          sx={{ color: getScoreColor(original), fontWeight: 'bold' }}
        >
          {original.toFixed(3)}
        </Typography>
        <Chip
          label={getScoreLabel(original)}
          size="small"
          sx={{
            backgroundColor: getScoreColor(original),
            color: 'white',
            fontWeight: 'bold',
          }}
        />
      </Paper>

      <CompareArrows sx={{ color: 'text.secondary' }} />

      <Paper sx={{ p: 1.5, textAlign: 'center', flex: 1, minWidth: 120, border: '2px solid #7c4dff' }}>
        <Typography variant="caption" color="text.secondary">
          ML Score
        </Typography>
        <Typography
          variant="h5"
          sx={{ color: getScoreColor(ml), fontWeight: 'bold' }}
        >
          {ml.toFixed(3)}
        </Typography>
        <Chip
          label={getScoreLabel(ml)}
          size="small"
          sx={{
            backgroundColor: getScoreColor(ml),
            color: 'white',
            fontWeight: 'bold',
          }}
        />
      </Paper>

      <Paper sx={{ p: 1.5, textAlign: 'center', flex: 1, minWidth: 120 }}>
        <Typography variant="caption" color="text.secondary">
          Confidence
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          {(confidence * 100).toFixed(0)}%
        </Typography>
        <Chip
          label={confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low'}
          size="small"
          color={confidence >= 0.8 ? 'success' : confidence >= 0.6 ? 'warning' : 'error'}
        />
      </Paper>
    </Box>
  );
}

export default function SmartDruggabilityCard({ bindingSites = [], pdbId }) {
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSite, setExpandedSite] = useState(null);

  const runAIScoring = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/druggability-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          binding_sites: bindingSites,
          pdb_id: pdbId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get AI scores');
      }

      setPredictions(data.data?.predictions || data.predictions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!bindingSites || bindingSites.length === 0) return null;

  return (
    <Paper sx={{ p: 3, mt: 3, borderRadius: 2, border: '1px solid rgba(124, 77, 255, 0.2)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AutoAwesome sx={{ color: '#7c4dff' }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          AI-Enhanced Druggability Scoring
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Uses machine learning (GradientBoosting) trained on published druggability criteria to
        provide enhanced scoring beyond geometric analysis.
      </Typography>

      {!predictions && !loading && (
        <Button
          variant="contained"
          startIcon={<Science />}
          onClick={runAIScoring}
          sx={{
            background: 'linear-gradient(135deg, #7c4dff 0%, #448aff 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #651fff 0%, #2979ff 100%)' },
          }}
        >
          Run AI Scoring
        </Button>
      )}

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
          <CircularProgress size={24} sx={{ color: '#7c4dff' }} />
          <Typography color="text.secondary">Running ML analysis on {bindingSites.length} binding sites...</Typography>
        </Box>
      )}

      {error && (
        <Box sx={{ mt: 2 }}>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
          <Button size="small" onClick={runAIScoring} sx={{ mt: 1 }}>
            Retry
          </Button>
        </Box>
      )}

      {predictions && predictions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Site</strong></TableCell>
                  <TableCell><strong>Original Score</strong></TableCell>
                  <TableCell><strong>ML Score</strong></TableCell>
                  <TableCell><strong>Confidence</strong></TableCell>
                  <TableCell><strong>Details</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {predictions.map((pred, idx) => {
                  if (pred.error) return null;
                  const isExpanded = expandedSite === idx;

                  return (
                    <TableRow key={idx}>
                      <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                        <Table size="small">
                          <TableBody>
                            <TableRow hover>
                              <TableCell>{pred.site_id || idx + 1}</TableCell>
                              <TableCell>{pred.original_score?.toFixed(3) || 'N/A'}</TableCell>
                              <TableCell>
                                <Chip
                                  label={pred.ml_druggability_score?.toFixed(3)}
                                  size="small"
                                  sx={{
                                    fontWeight: 'bold',
                                    backgroundColor:
                                      pred.ml_druggability_score >= 0.7
                                        ? '#e8f5e9'
                                        : pred.ml_druggability_score >= 0.5
                                        ? '#fff3e0'
                                        : '#ffebee',
                                    color:
                                      pred.ml_druggability_score >= 0.7
                                        ? '#2e7d32'
                                        : pred.ml_druggability_score >= 0.5
                                        ? '#e65100'
                                        : '#c62828',
                                  }}
                                />
                              </TableCell>
                              <TableCell>{(pred.confidence * 100).toFixed(0)}%</TableCell>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    setExpandedSite(isExpanded ? null : idx)
                                  }
                                >
                                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                </IconButton>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={5} sx={{ p: 0, border: 0 }}>
                                <Collapse in={isExpanded}>
                                  <Box sx={{ p: 2, backgroundColor: '#fafafa' }}>
                                    <ScoreComparison
                                      original={pred.original_score || 0}
                                      ml={pred.ml_druggability_score || 0}
                                      confidence={pred.confidence || 0}
                                    />
                                    <Typography
                                      variant="subtitle2"
                                      sx={{ mt: 2, mb: 1, fontWeight: 'bold' }}
                                    >
                                      Feature Analysis
                                    </Typography>
                                    {pred.feature_values &&
                                      Object.entries(pred.feature_values).map(
                                        ([name, value]) => (
                                          <FeatureBar
                                            key={name}
                                            name={name}
                                            value={value}
                                            maxValue={
                                              name === 'volume'
                                                ? 1500
                                                : name === 'nearby_residue_count'
                                                ? 60
                                                : name === 'cavity_points'
                                                ? 500
                                                : name === 'depth_score'
                                                ? 15
                                                : 1.0
                                            }
                                            importance={
                                              pred.feature_importance?.[name] || 0
                                            }
                                          />
                                        )
                                      )}
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={runAIScoring}>
              Re-run Analysis
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Avatar,
  Snackbar
} from '@mui/material';
import {
  Mail as MailIcon,
  Business as BusinessIcon,
  CheckCircle as AcceptIcon,
  Cancel as DeclineIcon
} from '@mui/icons-material';
import ProtectedRoute from '@/components/ProtectedRoute';

function InvitationsPageContent() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState(null);

  const getToken = () =>
    localStorage.getItem('token') ||
    document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/v1/teams/invitations', {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      setInvitations(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError('Failed to load invitations: ' + err.message);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (token, action) => {
    try {
      setProcessing(token);
      setError('');
      const response = await fetch(`/api/v1/teams/invitations/${token}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to ${action} invitation`);
      }

      setSuccess(`Invitation ${action}ed successfully`);
      setInvitations(prev => prev.filter(inv => inv.token !== token));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
        Invitations
      </Typography>
      <Typography variant="body1" sx={{ mb: 4, color: '#424242' }}>
        Pending organization invitations
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {invitations.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <MailIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>No Pending Invitations</Typography>
            <Typography variant="body2" color="text.secondary">
              When someone invites you to an organization, it will appear here.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {invitations.map((inv) => (
            <Grid item xs={12} key={inv.id || inv.token}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" alignItems="center" gap={2}>
                      <Avatar sx={{ bgcolor: '#16a34a' }}>
                        <BusinessIcon />
                      </Avatar>
                      <Box>
                        <Typography variant="h6">
                          {inv.organization?.name || `Organization #${inv.organization_id}`}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Role: <Chip label={inv.role} size="small" sx={{ ml: 0.5 }} />
                          {inv.invited_by_user && (
                            <span> &bull; Invited by {inv.invited_by_user.email}</span>
                          )}
                        </Typography>
                        {inv.expires_at && (
                          <Typography variant="caption" color="text.secondary">
                            Expires {new Date(inv.expires_at).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box display="flex" gap={1}>
                      <Button
                        variant="contained"
                        startIcon={<AcceptIcon />}
                        disabled={!!processing}
                        onClick={() => handleAction(inv.token, 'accept')}
                        sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                      >
                        {processing === inv.token ? <CircularProgress size={20} /> : 'Accept'}
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeclineIcon />}
                        disabled={!!processing}
                        onClick={() => handleAction(inv.token, 'decline')}
                      >
                        Decline
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess('')}
        message={success}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

export default function InvitationsPage() {
  return (
    <ProtectedRoute>
      <InvitationsPageContent />
    </ProtectedRoute>
  );
}

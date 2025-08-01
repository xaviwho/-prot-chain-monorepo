'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Avatar,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Group as GroupIcon,
  AdminPanelSettings as AdminIcon,
  Settings as SettingsIcon,
  Share as ShareIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

function OrganizationsPageContent() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: '',
    description: '',
    domain: ''
  });
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      // Use fetch to call the frontend API endpoint directly
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const response = await fetch('/api/v1/teams/organizations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      if (responseData && responseData.success && Array.isArray(responseData.data)) {
        setOrganizations(responseData.data);
      } else {
        setOrganizations([]);
      }
    } catch (err) {
      console.error('Organizations loading error:', err);
      
      // Handle different types of errors
      if (err.message.includes('Server error:')) {
        setError(`Failed to load organizations: ${err.message}`);
      } else {
        setError(`Failed to load organizations: ${err.message}`);
      }
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!newOrg.name.trim()) {
      setError('Organization name is required');
      return;
    }

    try {
      setCreating(true);
      setError(''); // Clear previous errors
      
      // Use fetch to call the frontend API endpoint directly
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const response = await fetch('/api/v1/teams/organizations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newOrg)
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      // Handle successful response
      if (responseData && responseData.success && responseData.data) {
        setOrganizations(prev => [...prev, responseData.data]);
        setCreateDialogOpen(false);
        setNewOrg({ name: '', description: '', domain: '' });
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (err) {
      console.error('Organization creation error:', err);
      
      // Handle different types of errors
      if (err.response) {
        // Server responded with error status
        const errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
        setError(`Failed to create organization: ${errorMessage}`);
      } else if (err.request) {
        // Network error - backend not running
        setError('Cannot connect to server. Please ensure the backend is running.');
      } else {
        // Other error
        setError(`Failed to create organization: ${err.message}`);
      }
    } finally {
      setCreating(false);
    }
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'enterprise': return 'primary';
      case 'professional': return 'secondary';
      default: return 'default';
    }
  };

  const getPlanLabel = (plan) => {
    if (!plan || typeof plan !== 'string') {
      return 'Free'; // Default plan
    }
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            Organizations
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, color: '#424242', fontSize: '1.1rem' }}>
            Manage your research organizations and teams
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
        >
          Create Organization
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Organizations Grid */}
      {organizations.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <BusinessIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No Organizations Yet
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Create your first organization to start collaborating with your team
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
            >
              Create Organization
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {organizations.map((org) => (
            <Grid item xs={12} md={6} lg={4} key={org.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': { 
                    transform: 'translateY(-2px)',
                    boxShadow: 4
                  }
                }}
                onClick={() => router.push(`/organizations/${org.id}`)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Avatar sx={{ bgcolor: '#2e7d32', width: 48, height: 48 }}>
                      <BusinessIcon />
                    </Avatar>
                    <Box display="flex" gap={1}>
                      <Chip 
                        label={getPlanLabel(org.plan)} 
                        size="small" 
                        color={getPlanColor(org.plan)}
                      />
                      <Tooltip title="Organization Settings">
                        <IconButton 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/organizations/${org.id}/settings`);
                          }}
                        >
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Typography variant="h6" gutterBottom noWrap>
                    {org.name}
                  </Typography>
                  
                  {org.description && (
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {org.description}
                    </Typography>
                  )}

                  {org.domain && (
                    <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                      Domain: {org.domain}
                    </Typography>
                  )}

                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box display="flex" gap={2}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <PeopleIcon fontSize="small" color="action" />
                        <Typography variant="caption">
                          {org.member_count} members
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <GroupIcon fontSize="small" color="action" />
                        <Typography variant="caption">
                          {org.team_count} teams
                        </Typography>
                      </Box>
                    </Box>
                    <Tooltip title="Share Organization">
                      <IconButton 
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Implement share functionality
                        }}
                      >
                        <ShareIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Organization Dialog */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Organization</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Organization Name"
              value={newOrg.name}
              onChange={(e) => setNewOrg(prev => ({ ...prev, name: e.target.value }))}
              margin="normal"
              required
              placeholder="e.g., Biotech Research Lab"
            />
            <TextField
              fullWidth
              label="Description"
              value={newOrg.description}
              onChange={(e) => setNewOrg(prev => ({ ...prev, description: e.target.value }))}
              margin="normal"
              multiline
              rows={3}
              placeholder="Brief description of your organization..."
            />
            <TextField
              fullWidth
              label="Email Domain (Optional)"
              value={newOrg.domain}
              onChange={(e) => setNewOrg(prev => ({ ...prev, domain: e.target.value }))}
              margin="normal"
              placeholder="e.g., company.com"
              helperText="Users with this email domain can auto-join the organization"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateOrganization}
            variant="contained"
            disabled={creating || !newOrg.name.trim()}
            sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            {creating ? <CircularProgress size={20} /> : 'Create Organization'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function OrganizationsPage() {
  return (
    <ProtectedRoute>
      <OrganizationsPageContent />
    </ProtectedRoute>
  );
}

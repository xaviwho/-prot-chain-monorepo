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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Avatar,
  Tooltip,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  Email as EmailIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`org-tabpanel-${index}`}
      aria-labelledby={`org-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function OrganizationDetailPageContent() {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'member',
    teamId: ''
  });
  const [newTeam, setNewTeam] = useState({
    name: '',
    description: ''
  });
  const [inviting, setInviting] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const router = useRouter();
  const params = useParams();
  const orgId = params.id;

  useEffect(() => {
    if (orgId) {
      fetchOrganization();
    }
  }, [orgId]);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || document.cookie.split('token=')[1]?.split(';')[0];
      
      const response = await fetch(`/api/v1/teams/organizations/${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch organization');
      }

      const data = await response.json();
      setOrganization(data.data);
    } catch (err) {
      setError('Failed to load organization: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!inviteData.email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setInviting(true);
      const token = localStorage.getItem('token') || document.cookie.split('token=')[1]?.split(';')[0];
      
      const response = await fetch(`/api/v1/teams/organizations/${orgId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(inviteData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send invitation');
      }

      setInviteDialogOpen(false);
      setInviteData({ email: '', role: 'member', teamId: '' });
      setError('');
      // Show success message
      alert('Invitation sent successfully!');
    } catch (err) {
      setError('Failed to send invitation: ' + err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) {
      setError('Team name is required');
      return;
    }

    try {
      setCreatingTeam(true);
      const token = localStorage.getItem('token') || document.cookie.split('token=')[1]?.split(';')[0];
      
      const response = await fetch(`/api/v1/teams/organizations/${orgId}/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newTeam)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create team');
      }

      const data = await response.json();
      setOrganization(prev => ({
        ...prev,
        teams: [...(prev.teams || []), data.data]
      }));
      setCreateTeamDialogOpen(false);
      setNewTeam({ name: '', description: '' });
      setError('');
    } catch (err) {
      setError('Failed to create team: ' + err.message);
    } finally {
      setCreatingTeam(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <AdminIcon color="primary" />;
      case 'lead': return <AdminIcon color="secondary" />;
      default: return <PersonIcon />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'primary';
      case 'lead': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!organization) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6">Organization not found</Typography>
        <Button onClick={() => router.push('/organizations')} sx={{ mt: 2 }}>
          Back to Organizations
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: '#2e7d32', width: 64, height: 64 }}>
            <BusinessIcon fontSize="large" />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1">
              {organization.name}
            </Typography>
            {organization.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {organization.description}
              </Typography>
            )}
            <Box display="flex" gap={1} mt={1}>
              <Chip label={organization.plan} color="primary" size="small" />
              <Chip label={`Your role: ${organization.user_role}`} color="secondary" size="small" />
            </Box>
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          {organization.user_role === 'admin' && (
            <>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => setInviteDialogOpen(true)}
              >
                Invite User
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateTeamDialogOpen(true)}
                sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
              >
                Create Team
              </Button>
            </>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Overview" />
          <Tab label="Members" />
          <Tab label="Teams" />
          <Tab label="Settings" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <PeopleIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 2 }} />
                <Typography variant="h4" color="primary">
                  {organization.members?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Members
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <GroupIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 2 }} />
                <Typography variant="h4" color="primary">
                  {organization.teams?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Teams
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <AdminIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 2 }} />
                <Typography variant="h4" color="primary">
                  {organization.members?.filter(m => m.role === 'admin').length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Administrators
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Members Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Organization Members</Typography>
          {organization.user_role === 'admin' && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setInviteDialogOpen(true)}
              sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
            >
              Invite Member
            </Button>
          )}
        </Box>
        <Card>
          <List>
            {organization.members?.map((member, index) => (
              <React.Fragment key={member.user_id}>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar>
                      {getRoleIcon(member.role)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.email || member.name || member.user_id}
                    secondary={`Joined ${new Date(member.joined_at).toLocaleDateString()}`}
                  />
                  <ListItemSecondaryAction>
                    <Chip 
                      label={member.role} 
                      color={getRoleColor(member.role)} 
                      size="small" 
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                {index < organization.members.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Card>
      </TabPanel>

      {/* Teams Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">Teams</Typography>
          {organization.user_role === 'admin' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateTeamDialogOpen(true)}
              sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
            >
              Create Team
            </Button>
          )}
        </Box>
        <Grid container spacing={3}>
          {organization.teams?.map((team) => (
            <Grid item xs={12} md={6} key={team.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Avatar sx={{ bgcolor: '#2e7d32' }}>
                      <GroupIcon />
                    </Avatar>
                    <IconButton size="small">
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Typography variant="h6" gutterBottom>
                    {team.name}
                  </Typography>
                  {team.description && (
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {team.description}
                    </Typography>
                  )}
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption">
                      {team.members?.length || 0} members
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Created {new Date(team.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>
          Organization Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Settings panel coming soon...
        </Typography>
      </TabPanel>

      {/* Invite User Dialog */}
      <Dialog 
        open={inviteDialogOpen} 
        onClose={() => setInviteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Invite User to Organization</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={inviteData.email}
              onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
              margin="normal"
              required
              placeholder="user@example.com"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Role</InputLabel>
              <Select
                value={inviteData.role}
                label="Role"
                onChange={(e) => setInviteData(prev => ({ ...prev, role: e.target.value }))}
              >
                <MenuItem value="member">Member</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
            {organization.teams?.length > 0 && (
              <FormControl fullWidth margin="normal">
                <InputLabel>Team (Optional)</InputLabel>
                <Select
                  value={inviteData.teamId}
                  label="Team (Optional)"
                  onChange={(e) => setInviteData(prev => ({ ...prev, teamId: e.target.value }))}
                >
                  <MenuItem value="">No specific team</MenuItem>
                  {organization.teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleInviteUser}
            variant="contained"
            disabled={inviting || !inviteData.email.trim()}
            sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            {inviting ? <CircularProgress size={20} /> : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog 
        open={createTeamDialogOpen} 
        onClose={() => setCreateTeamDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Team</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Team Name"
              value={newTeam.name}
              onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))}
              margin="normal"
              required
              placeholder="e.g., Drug Discovery Team"
            />
            <TextField
              fullWidth
              label="Description"
              value={newTeam.description}
              onChange={(e) => setNewTeam(prev => ({ ...prev, description: e.target.value }))}
              margin="normal"
              multiline
              rows={3}
              placeholder="Brief description of the team's purpose..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateTeamDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateTeam}
            variant="contained"
            disabled={creatingTeam || !newTeam.name.trim()}
            sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            {creatingTeam ? <CircularProgress size={20} /> : 'Create Team'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function OrganizationDetailPage() {
  return (
    <ProtectedRoute>
      <OrganizationDetailPageContent />
    </ProtectedRoute>
  );
}

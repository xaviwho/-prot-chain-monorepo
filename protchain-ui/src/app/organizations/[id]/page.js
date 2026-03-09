'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  InputLabel,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Analytics as AnalyticsIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`org-tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function OrganizationDetailPageContent() {
  const [organization, setOrganization] = useState(null);
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [userRole, setUserRole] = useState('member');

  // Dialog states
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ email: '', role: 'member' });
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [inviting, setInviting] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);

  // Settings states
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '', domain: '' });
  const [saving, setSaving] = useState(false);
  const [deleteOrgDialogOpen, setDeleteOrgDialogOpen] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [removingMember, setRemovingMember] = useState(null);

  const router = useRouter();
  const params = useParams();
  const orgId = params.id;

  const getToken = () =>
    localStorage.getItem('token') ||
    document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];

  // Get current user ID from JWT
  const getCurrentUserId = () => {
    try {
      const token = getToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.user_id || payload.sub || payload.id;
    } catch {
      return null;
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const headers = {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      };

      const [orgRes, membersRes, teamsRes] = await Promise.all([
        fetch(`/api/v1/teams/organizations/${orgId}`, { headers }),
        fetch(`/api/v1/teams/organizations/${orgId}/members`, { headers }),
        fetch(`/api/v1/teams/organizations/${orgId}/teams`, { headers }),
      ]);

      if (!orgRes.ok) throw new Error('Failed to fetch organization');

      const orgData = await orgRes.json();
      const membersData = membersRes.ok ? await membersRes.json() : { data: [] };
      const teamsData = teamsRes.ok ? await teamsRes.json() : { data: [] };

      const org = orgData.data;
      const membersList = Array.isArray(membersData.data) ? membersData.data : [];
      const teamsList = Array.isArray(teamsData.data) ? teamsData.data : [];

      setOrganization(org);
      setMembers(membersList);
      setTeams(teamsList);
      setSettingsForm({ name: org.name || '', description: org.description || '', domain: org.domain || '' });

      // Detect user role from members list
      const currentUserId = getCurrentUserId();
      if (currentUserId) {
        const me = membersList.find(m => m.user_id == currentUserId);
        setUserRole(me?.role || 'member');
      }
    } catch (err) {
      setError('Failed to load organization: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (orgId) fetchData();
  }, [orgId, fetchData]);

  const handleInviteUser = async () => {
    if (!inviteData.email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setInviting(true);
      setError('');
      const response = await fetch(`/api/v1/teams/organizations/${orgId}/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteData),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send invitation');
      }

      setInviteDialogOpen(false);
      setInviteData({ email: '', role: 'member' });
      setSuccess('Invitation sent successfully');
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
      setError('');
      const response = await fetch(`/api/v1/teams/organizations/${orgId}/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTeam),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create team');
      }

      setCreateTeamDialogOpen(false);
      setNewTeam({ name: '', description: '' });
      setSuccess('Team created successfully');
      fetchData();
    } catch (err) {
      setError('Failed to create team: ' + err.message);
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      const response = await fetch(`/api/v1/teams/organizations/${orgId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsForm),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update organization');
      }

      setSuccess('Organization updated successfully');
      fetchData();
    } catch (err) {
      setError('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOrganization = async () => {
    try {
      setDeletingOrg(true);
      setError('');
      const response = await fetch(`/api/v1/teams/organizations/${orgId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete organization');
      }

      router.push('/organizations');
    } catch (err) {
      setError('Failed to delete organization: ' + err.message);
    } finally {
      setDeletingOrg(false);
      setDeleteOrgDialogOpen(false);
    }
  };

  const isAdmin = userRole === 'admin';

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <AdminIcon color="primary" />;
      default: return <PersonIcon />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return 'primary';
      case 'owner': return 'secondary';
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
          <Tooltip title="Back to Organizations">
            <IconButton onClick={() => router.push('/organizations')}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Avatar sx={{ bgcolor: '#16a34a', width: 64, height: 64 }}>
            <BusinessIcon fontSize="large" />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1" sx={{ color: '#1a1a1a', fontWeight: 600 }}>
              {organization.name}
            </Typography>
            {organization.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
                {organization.description}
              </Typography>
            )}
            <Box display="flex" gap={1} mt={1}>
              <Chip label={organization.plan || 'free'} color="primary" size="small" />
              <Chip label={`Your role: ${userRole}`} color="secondary" size="small" />
              {organization.domain && (
                <Chip label={organization.domain} variant="outlined" size="small" />
              )}
            </Box>
          </Box>
        </Box>
        <Box display="flex" gap={1}>
          {isAdmin && (
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
                sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
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
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          sx={{
            '& .MuiTab-root': { color: '#333', fontWeight: 500, fontSize: '0.875rem', minHeight: 48 },
            '& .Mui-selected': { color: '#16a34a', fontWeight: 600 },
            '& .MuiTabs-indicator': { backgroundColor: '#16a34a' },
          }}
        >
          <Tab icon={<AnalyticsIcon />} label="Overview" />
          <Tab icon={<PeopleIcon />} label={`Members (${members.length})`} />
          <Tab icon={<GroupIcon />} label={`Teams (${teams.length})`} />
          <Tab icon={<SettingsIcon />} label="Settings" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <PeopleIcon fontSize="large" />
                  <Typography variant="h6">Members</Typography>
                </Box>
                <Typography variant="h3">{organization.member_count || members.length}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Active researchers</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <GroupIcon fontSize="large" />
                  <Typography variant="h6">Teams</Typography>
                </Box>
                <Typography variant="h3">{organization.team_count || teams.length}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Research teams</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ background: 'linear-gradient(135deg, #7b1fa2 0%, #ab47bc 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <BusinessIcon fontSize="large" />
                  <Typography variant="h6">Plan</Typography>
                </Box>
                <Typography variant="h3" sx={{ textTransform: 'capitalize' }}>
                  {organization.plan || 'Free'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Created {new Date(organization.created_at).toLocaleDateString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Members */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Recent Members
                </Typography>
                {members.length > 0 ? (
                  <List dense>
                    {members.slice(0, 5).map((member) => (
                      <ListItem key={member.user_id || member.id}>
                        <ListItemAvatar>
                          <Avatar>{getRoleIcon(member.role)}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.email || `User #${member.user_id}`}
                          secondary={member.role}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">No members yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Teams */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Teams
                </Typography>
                {teams.length > 0 ? (
                  <List dense>
                    {teams.slice(0, 5).map((team) => (
                      <ListItem key={team.id}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#16a34a' }}><GroupIcon /></Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={team.name}
                          secondary={`${team.member_count || 0} members`}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">No teams yet</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Members Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Organization Members</Typography>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setInviteDialogOpen(true)}
              sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
            >
              Invite Member
            </Button>
          )}
        </Box>
        {members.length > 0 ? (
          <Card>
            <List>
              {members.map((member, index) => (
                <React.Fragment key={member.user_id || member.id}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>{getRoleIcon(member.role)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        [member.first_name, member.last_name].filter(Boolean).join(' ') ||
                        member.email ||
                        `User #${member.user_id}`
                      }
                      secondary={
                        <>
                          {member.email && <span>{member.email} &bull; </span>}
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip label={member.role} color={getRoleColor(member.role)} size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                  {index < members.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </Card>
        ) : (
          <Card sx={{ textAlign: 'center', py: 4 }}>
            <CardContent>
              <PeopleIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No members yet. Invite someone to get started.
              </Typography>
            </CardContent>
          </Card>
        )}
      </TabPanel>

      {/* Teams Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>Teams</Typography>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateTeamDialogOpen(true)}
              sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
            >
              Create Team
            </Button>
          )}
        </Box>
        {teams.length > 0 ? (
          <Grid container spacing={3}>
            {teams.map((team) => (
              <Grid item xs={12} md={6} key={team.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Avatar sx={{ bgcolor: '#16a34a' }}>
                        <GroupIcon />
                      </Avatar>
                    </Box>
                    <Typography variant="h6" gutterBottom>{team.name}</Typography>
                    {team.description && (
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {team.description}
                      </Typography>
                    )}
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="caption">{team.member_count || 0} members</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Created {new Date(team.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card sx={{ textAlign: 'center', py: 4 }}>
            <CardContent>
              <GroupIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No teams yet. Create one to organize your researchers.
              </Typography>
            </CardContent>
          </Card>
        )}
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value={tabValue} index={3}>
        {isAdmin ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>General Settings</Typography>
                  <TextField
                    fullWidth
                    label="Organization Name"
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, name: e.target.value }))}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label="Description"
                    value={settingsForm.description}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, description: e.target.value }))}
                    multiline
                    rows={3}
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    label="Email Domain"
                    value={settingsForm.domain}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, domain: e.target.value }))}
                    margin="normal"
                    placeholder="e.g., company.com"
                  />
                  <Box mt={2}>
                    <Button
                      variant="contained"
                      onClick={handleSaveSettings}
                      disabled={saving}
                      sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
                    >
                      {saving ? <CircularProgress size={20} /> : 'Save Changes'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card sx={{ border: '1px solid', borderColor: 'error.main' }}>
                <CardContent>
                  <Typography variant="h6" color="error" gutterBottom>Danger Zone</Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Deleting an organization removes all teams, members, and invitations permanently.
                  </Typography>
                  <Box mt={2}>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteOrgDialogOpen(true)}
                    >
                      Delete Organization
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">
            You need administrator privileges to modify organization settings.
          </Alert>
        )}
      </TabPanel>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} maxWidth="sm" fullWidth>
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleInviteUser}
            variant="contained"
            disabled={inviting || !inviteData.email.trim()}
            sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
          >
            {inviting ? <CircularProgress size={20} /> : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog open={createTeamDialogOpen} onClose={() => setCreateTeamDialogOpen(false)} maxWidth="sm" fullWidth>
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
          <Button onClick={() => setCreateTeamDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateTeam}
            variant="contained"
            disabled={creatingTeam || !newTeam.name.trim()}
            sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
          >
            {creatingTeam ? <CircularProgress size={20} /> : 'Create Team'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog open={deleteOrgDialogOpen} onClose={() => setDeleteOrgDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Organization</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to permanently delete &quot;{organization.name}&quot;? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOrgDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDeleteOrganization}
            variant="contained"
            disabled={deletingOrg}
            sx={{ bgcolor: '#e53935', '&:hover': { bgcolor: '#c62828' } }}
          >
            {deletingOrg ? <CircularProgress size={20} /> : 'Delete Organization'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
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

export default function OrganizationDetailPage() {
  return (
    <ProtectedRoute>
      <OrganizationDetailPageContent />
    </ProtectedRoute>
  );
}

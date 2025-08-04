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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  Person as PersonIcon,
  Science as ScienceIcon,
  Assignment as ProjectIcon,
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Verified as VerifiedIcon,
  School as SchoolIcon,
  Work as WorkIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Assignment as AssignmentIcon,
  Biotech as BiotechIcon,
  DataUsage as DataUsageIcon
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
      console.log('Fetching organization with ID:', orgId);
      const token = localStorage.getItem('token') || document.cookie.split('token=')[1]?.split(';')[0];
      console.log('Using token:', token ? 'present' : 'missing');
      
      const response = await fetch(`/api/v1/teams/organizations?id=${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        throw new Error('Failed to fetch organization');
      }

      const data = await response.json();
      console.log('Received data:', data);
      console.log('Organization data:', data.data);
      setOrganization(data.data);
    } catch (err) {
      console.error('Fetch error:', err);
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
            <Typography variant="h4" component="h1" sx={{ color: '#1a1a1a', fontWeight: 600 }}>
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
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)} 
          variant="scrollable" 
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              color: '#333333',
              fontWeight: 500,
              fontSize: '0.875rem',
              minHeight: 48,
              '&.Mui-selected': {
                color: '#1976d2',
                fontWeight: 600
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#1976d2'
            }
          }}
        >
          <Tab icon={<AnalyticsIcon />} label="Overview" />
          <Tab icon={<PeopleIcon />} label="Members" />
          <Tab icon={<GroupIcon />} label="Teams" />
          <Tab icon={<ProjectIcon />} label="Projects" />
          <Tab icon={<ScienceIcon />} label="Research" />
          <Tab icon={<StorageIcon />} label="Resources" />
          <Tab icon={<SecurityIcon />} label="Compliance" />
          <Tab icon={<SettingsIcon />} label="Settings" />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        {/* Overview Tab */}
        <Grid container spacing={3}>
          {/* Statistics Cards */}
          <Grid item xs={12} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <PeopleIcon fontSize="large" />
                  <Typography variant="h6">Members</Typography>
                </Box>
                <Typography variant="h3">{organization.member_count}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Active researchers</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <ProjectIcon fontSize="large" />
                  <Typography variant="h6">Projects</Typography>
                </Box>
                <Typography variant="h3">{organization.project_count}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Active projects</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #7b1fa2 0%, #ab47bc 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <ScienceIcon fontSize="large" />
                  <Typography variant="h6">Workflows</Typography>
                </Box>
                <Typography variant="h3">{organization.workflow_count}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Total workflows</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #f57c00 0%, #ffb74d 100%)', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <SchoolIcon fontSize="large" />
                  <Typography variant="h6">Publications</Typography>
                </Box>
                <Typography variant="h3">{organization.publication_count}</Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>Research papers</Typography>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Research Areas */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <ScienceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Research Areas
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Primary Focus: {organization.primary_focus}
                  </Typography>
                </Box>
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {organization.research_areas?.map((area, index) => (
                    <Chip 
                      key={index} 
                      label={area} 
                      variant="outlined" 
                      color="primary"
                      size="small"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Organization Settings Overview */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Configuration
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Compliance Mode" 
                      secondary={organization.settings?.compliance_mode || 'Standard'}
                    />
                    <VerifiedIcon color="success" />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Blockchain Tracking" 
                      secondary={organization.settings?.blockchain_tracking ? 'Enabled' : 'Disabled'}
                    />
                    {organization.settings?.blockchain_tracking && <VerifiedIcon color="success" />}
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Data Retention" 
                      secondary={`${organization.settings?.data_retention_days || 365} days`}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Members Tab */}
      <TabPanel value={tabValue} index={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: '#1a1a1a', fontWeight: 600 }}>Organization Members</Typography>
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
          <Typography variant="h6" sx={{ color: '#1a1a1a', fontWeight: 600 }}>Teams</Typography>
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

      {/* Projects Tab */}
      <TabPanel value={tabValue} index={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" sx={{ color: '#1a1a1a', fontWeight: 600 }}>Research Projects</Typography>
          {organization.user_role === 'admin' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }}
            >
              New Project
            </Button>
          )}
        </Box>
        <Grid container spacing={3}>
          {organization.projects?.map((project) => (
            <Grid item xs={12} md={6} lg={4} key={project.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Avatar sx={{ bgcolor: '#1976d2' }}>
                      <ProjectIcon />
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" noWrap>
                        {project.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {project.status}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {project.description}
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                    {project.tags?.slice(0, 3).map((tag, index) => (
                      <Chip key={index} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption">
                      {project.workflow_count} workflows
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(project.updated_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Research Tab */}
      <TabPanel value={tabValue} index={4}>
        <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>
          <ScienceIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Research Overview
        </Typography>
        <Grid container spacing={3}>
          {/* Research Metrics */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>Research Metrics</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Active Workflows" 
                      secondary={organization.active_workflows || 0}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Completed Studies" 
                      secondary={organization.completed_studies || 0}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Publications" 
                      secondary={organization.publication_count || 0}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Citations" 
                      secondary={organization.citation_count || 0}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Recent Publications */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>Recent Publications</Typography>
                {organization.recent_publications?.length > 0 ? (
                  <List>
                    {organization.recent_publications.slice(0, 5).map((pub, index) => (
                      <ListItem key={index}>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#7b1fa2' }}>
                            <SchoolIcon />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={pub.title}
                          secondary={`${pub.journal} • ${new Date(pub.published_date).getFullYear()}`}
                        />
                        <IconButton size="small">
                          <VisibilityIcon />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No publications yet
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Resources Tab */}
      <TabPanel value={tabValue} index={5}>
        <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>
          <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Research Resources
        </Typography>
        <Grid container spacing={3}>
          {/* Data Storage */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>
                  <DataUsageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Data Storage
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Storage Used: {organization.storage_used || '0 GB'} / {organization.storage_limit || '100 GB'}
                  </Typography>
                </Box>
                <List dense>
                  <ListItem>
                    <ListItemText primary="PDB Files" secondary={`${organization.pdb_count || 0} files`} />
                    <IconButton size="small">
                      <FolderIcon />
                    </IconButton>
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Analysis Results" secondary={`${organization.results_count || 0} files`} />
                    <IconButton size="small">
                      <DescriptionIcon />
                    </IconButton>
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Blockchain Records" secondary={`${organization.blockchain_records || 0} transactions`} />
                    <IconButton size="small">
                      <VerifiedIcon />
                    </IconButton>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Computational Resources */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>
                  <BiotechIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Computational Resources
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="CPU Hours Used" 
                      secondary={`${organization.cpu_hours || 0} hours this month`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="GPU Hours Used" 
                      secondary={`${organization.gpu_hours || 0} hours this month`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Analysis Queue" 
                      secondary={`${organization.queue_length || 0} pending jobs`}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Compliance Tab */}
      <TabPanel value={tabValue} index={6}>
        <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>
          <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Compliance & Security
        </Typography>
        <Grid container spacing={3}>
          {/* Compliance Status */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>Compliance Status</Typography>
                <List>
                  <ListItem>
                    <ListItemText 
                      primary="GDPR Compliance" 
                      secondary="Data protection and privacy"
                    />
                    <VerifiedIcon color="success" />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="HIPAA Compliance" 
                      secondary="Healthcare data protection"
                    />
                    {organization.hipaa_compliant ? <VerifiedIcon color="success" /> : <SecurityIcon color="warning" />}
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="FDA 21 CFR Part 11" 
                      secondary="Electronic records and signatures"
                    />
                    {organization.fda_compliant ? <VerifiedIcon color="success" /> : <SecurityIcon color="warning" />}
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Audit Trail */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Audit Trail</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Recent compliance activities
                </Typography>
                {organization.audit_logs?.slice(0, 5).map((log, index) => (
                  <Box key={index} sx={{ mb: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="caption" display="block">
                      {log.action} - {new Date(log.timestamp).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {log.user} • {log.details}
                    </Typography>
                  </Box>
                )) || (
                  <Typography variant="body2" color="text.secondary">
                    No audit logs available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Settings Tab */}
      <TabPanel value={tabValue} index={7}>
        <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>
          <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Organization Settings
        </Typography>
        {organization.user_role === 'admin' ? (
          <Grid container spacing={3}>
            {/* General Settings */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>General Settings</Typography>
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      label="Organization Name"
                      value={organization.name}
                      margin="normal"
                    />
                    <TextField
                      fullWidth
                      label="Description"
                      value={organization.description}
                      multiline
                      rows={3}
                      margin="normal"
                    />
                    <TextField
                      fullWidth
                      label="Primary Research Focus"
                      value={organization.primary_focus}
                      margin="normal"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Security & Compliance */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 600 }}>Security & Compliance</Typography>
                  <FormControlLabel
                    control={<Switch checked={organization.settings?.blockchain_tracking || false} />}
                    label="Blockchain Tracking"
                  />
                  <FormControlLabel
                    control={<Switch checked={organization.settings?.audit_logging || false} />}
                    label="Audit Logging"
                  />
                  <FormControlLabel
                    control={<Switch checked={organization.settings?.data_encryption || false} />}
                    label="Data Encryption"
                  />
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      fullWidth
                      label="Data Retention (days)"
                      type="number"
                      value={organization.settings?.data_retention_days || 365}
                      margin="normal"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            {/* Danger Zone */}
            <Grid item xs={12}>
              <Card sx={{ border: '1px solid', borderColor: 'error.main' }}>
                <CardContent>
                  <Typography variant="h6" color="error" gutterBottom>
                    Danger Zone
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    These actions cannot be undone. Please proceed with caution.
                  </Typography>
                  <Box display="flex" gap={2} mt={2}>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
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

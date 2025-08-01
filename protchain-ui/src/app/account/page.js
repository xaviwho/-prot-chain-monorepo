'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Avatar,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tab,
  Tabs,
  Alert,
  LinearProgress,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Person,
  Security,
  Notifications,
  Analytics,
  Storage,
  Edit,
  Save,
  Cancel,
  PhotoCamera,
  Key,
  History,
  Settings,
  Upgrade,
  Download,
} from '@mui/icons-material';
import ProtectedRoute from '@/components/ProtectedRoute';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`account-tabpanel-${index}`}
      aria-labelledby={`account-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AccountPage() {
  const [tabValue, setTabValue] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [originalProfile, setOriginalProfile] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    workflow: true,
    collaboration: false,
    security: true,
  });
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userStats, setUserStats] = useState(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  // Fetch user data on component mount
  useEffect(() => {
    fetchUserProfile();
    fetchUserStats();
    fetchUserPreferences();
    // Initialize dark mode from localStorage
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
  }, []);

  // Handle dark mode toggle
  const handleDarkModeToggle = (event) => {
    const newDarkMode = event.target.checked;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', newDarkMode.toString());
    
    // Apply dark mode to document
    if (newDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setUserProfile(data.data);
        setOriginalProfile(data.data);
        setNotifications(data.data.preferences?.notifications || notifications);
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const response = await fetch('/api/user/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setUserStats(data.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const fetchUserPreferences = async () => {
    try {
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const response = await fetch('/api/user/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.data.notifications);
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleProfileSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userProfile),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setOriginalProfile(userProfile);
        setEditMode(false);
        setSuccess('Profile updated successfully!');
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleProfileCancel = () => {
    setUserProfile(originalProfile);
    setEditMode(false);
    setError('');
  };

  const handleNotificationChange = (setting) => async (event) => {
    const newNotifications = {
      ...notifications,
      [setting]: event.target.checked,
    };
    
    setNotifications(newNotifications);
    
    // Save to backend
    try {
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notifications: newNotifications }),
      });
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
      // Revert on error
      setNotifications(notifications);
    }
  };

  const handlePasswordChange = async () => {
    setError('');
    setSuccess('');
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setError('All password fields are required');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    try {
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Password changed successfully!');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setChangePasswordOpen(false);
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setError('Failed to change password');
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const response = await fetch('/api/user/upload-avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setUserProfile({ ...userProfile, avatar: data.avatarUrl });
        setSuccess('Profile picture updated successfully!');
      } else {
        setError(data.error || 'Failed to upload profile picture');
      }
    } catch (err) {
      setError('Failed to upload profile picture');
    }
  };

  // Show loading spinner while data is being fetched
  if (loading || !userProfile) {
    return (
      <ProtectedRoute>
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress sx={{ color: '#40C057' }} />
        </Box>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            Account Settings
          </Typography>
          <Typography variant="body1" sx={{ color: '#424242', fontSize: '1.1rem' }}>
            Manage your profile, security, and preferences
          </Typography>
        </Box>

        {/* Success/Error Alerts */}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Card sx={{ mb: 3 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ 
              borderBottom: 1, 
              borderColor: 'divider',
              '& .MuiTab-root': {
                color: '#666',
                '&.Mui-selected': {
                  color: '#40C057',
                }
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#40C057',
              }
            }}
          >
            <Tab icon={<Person />} label="Profile" />
            <Tab icon={<Security />} label="Security" />
            <Tab icon={<Notifications />} label="Notifications" />
            <Tab icon={<Analytics />} label="Usage" />
            <Tab icon={<Settings />} label="Preferences" />
          </Tabs>
        </Card>

        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                    <Avatar
                      sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
                      src={userProfile.avatar || undefined}
                    >
                      {userProfile.name ? userProfile.name.split(' ').map(n => n[0]).join('') : 'U'}
                    </Avatar>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="avatar-upload"
                      type="file"
                      onChange={handleAvatarUpload}
                    />
                    <label htmlFor="avatar-upload">
                      <IconButton
                        component="span"
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          bgcolor: '#40C057',
                          color: 'white',
                          '&:hover': { bgcolor: '#2fa347' }
                        }}
                        size="small"
                      >
                        <PhotoCamera fontSize="small" />
                      </IconButton>
                    </label>
                  </Box>
                  <Typography variant="h6">{userProfile.name || 'User'}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {userProfile.role || 'User'}
                  </Typography>
                  <Chip label={`${userProfile.plan || 'Free'} Plan`.replace(/^./, c => c.toUpperCase())} sx={{ bgcolor: '#40C057', color: 'white' }} size="small" />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6">Profile Information</Typography>
                    <Button
                      startIcon={editMode ? <Save /> : <Edit />}
                      onClick={editMode ? handleProfileSave : () => setEditMode(true)}
                      variant={editMode ? "contained" : "outlined"}
                      disabled={saving}
                      sx={editMode ? { bgcolor: '#40C057', '&:hover': { bgcolor: '#2fa347' } } : { color: '#40C057', borderColor: '#40C057', '&:hover': { borderColor: '#2fa347', color: '#2fa347' } }}
                    >
                      {saving ? 'Saving...' : (editMode ? 'Save Changes' : 'Edit Profile')}
                    </Button>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Full Name"
                        value={userProfile.name}
                        onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
                        disabled={!editMode}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Email"
                        value={userProfile.email}
                        onChange={(e) => setUserProfile({...userProfile, email: e.target.value})}
                        disabled={!editMode}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Bio"
                        value={userProfile.bio}
                        onChange={(e) => setUserProfile({...userProfile, bio: e.target.value})}
                        disabled={!editMode}
                        multiline
                        rows={3}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Organization"
                        value={userProfile.organization}
                        onChange={(e) => setUserProfile({...userProfile, organization: e.target.value})}
                        disabled={!editMode}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Role"
                        value={userProfile.role}
                        onChange={(e) => setUserProfile({...userProfile, role: e.target.value})}
                        disabled={!editMode}
                        variant="outlined"
                      />
                    </Grid>
                  </Grid>

                  {editMode && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      <Button
                        startIcon={<Cancel />}
                        onClick={handleProfileCancel}
                        variant="outlined"
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Password & Authentication</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Key />}
                      onClick={() => setChangePasswordOpen(true)}
                      sx={{ mb: 2 }}
                    >
                      Change Password
                    </Button>
                  </Box>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Two-Factor Authentication"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Add an extra layer of security to your account
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>API Access</Typography>
                  <Box sx={{ mb: 2 }}>
                    <TextField
                      fullWidth
                      label="API Key"
                      value={apiKeyVisible ? "pk_live_51234567890abcdef" : "••••••••••••••••••••"}
                      InputProps={{
                        readOnly: true,
                        endAdornment: (
                          <Button
                            size="small"
                            onClick={() => setApiKeyVisible(!apiKeyVisible)}
                          >
                            {apiKeyVisible ? 'Hide' : 'Show'}
                          </Button>
                        ),
                      }}
                    />
                  </Box>
                  <Button variant="outlined" size="small">
                    Generate New Key
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Use this key to access ProtChain API programmatically
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Active Sessions</Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Current Session (Windows - Chrome)"
                        secondary="Active now • IP: 192.168.1.100"
                      />
                      <Chip label="Current" color="success" size="small" />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Mobile Session (iPhone - Safari)"
                        secondary="2 hours ago • IP: 192.168.1.101"
                      />
                      <Button size="small" color="error">Revoke</Button>
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={tabValue} index={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3 }}>Notification Preferences</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.email}
                        onChange={handleNotificationChange('email')}
                      />
                    }
                    label="Email Notifications"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Receive important updates via email
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.workflow}
                        onChange={handleNotificationChange('workflow')}
                      />
                    }
                    label="Workflow Notifications"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Get notified when workflows complete or fail
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.collaboration}
                        onChange={handleNotificationChange('collaboration')}
                      />
                    }
                    label="Collaboration Notifications"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Notifications for team invites and shared workflows
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={notifications.security}
                        onChange={handleNotificationChange('security')}
                      />
                    }
                    label="Security Alerts"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Important security-related notifications
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Usage Tab */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Usage Statistics</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ color: '#40C057' }}>{userStats?.stats?.workflows || 0}</Typography>
                        <Typography variant="body2">Workflows</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ color: '#40C057' }}>{userStats?.stats?.analyses || 0}</Typography>
                        <Typography variant="body2">Analyses</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ color: '#40C057' }}>{userStats?.stats?.storage || 0} GB</Typography>
                        <Typography variant="body2">Storage Used</Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ color: '#40C057' }}>{userStats?.stats?.collaborations || 0}</Typography>
                        <Typography variant="body2">Collaborations</Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Storage Usage</Typography>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      {userStats?.stats?.storage || 0} GB of {userStats?.stats?.storageLimit || 10} GB used
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={userStats?.storageUsagePercent || 0} 
                      sx={{ mt: 1, '& .MuiLinearProgress-bar': { backgroundColor: '#40C057' } }} 
                    />
                  </Box>
                  <Button variant="outlined" startIcon={<Upgrade />} size="small">
                    Upgrade Plan
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Recent Activity</Typography>
                  <List>
                    {userStats?.recentActivity?.map((activity, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <History />
                        </ListItemIcon>
                        <ListItemText
                          primary={activity.action}
                          secondary={activity.time}
                        />
                      </ListItem>
                    )) || (
                      <ListItem>
                        <ListItemText
                          primary="No recent activity"
                          secondary="Start using ProtChain to see your activity here"
                        />
                      </ListItem>
                    )}
                  </List>
                  <Button variant="outlined" startIcon={<Download />} size="small">
                    Export Activity Log
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Preferences Tab */}
        <TabPanel value={tabValue} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Appearance</Typography>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={darkMode}
                        onChange={handleDarkModeToggle}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': {
                            color: '#40C057',
                          },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                            backgroundColor: '#40C057',
                          },
                        }}
                      />
                    }
                    label="Dark Mode"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Switch between light and dark themes
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    label="Language"
                    defaultValue="en"
                    SelectProps={{ native: true }}
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </TextField>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Workflow Defaults</Typography>
                  <TextField
                    select
                    fullWidth
                    label="Default Analysis Type"
                    defaultValue="structure"
                    SelectProps={{ native: true }}
                    sx={{ mb: 2 }}
                  >
                    <option value="structure">Structure Analysis</option>
                    <option value="binding">Binding Site Analysis</option>
                    <option value="screening">Virtual Screening</option>
                  </TextField>
                  <FormControlLabel
                    control={<Switch defaultChecked />}
                    label="Auto-save workflows"
                  />
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Data & Privacy</Typography>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Your data is encrypted and stored securely. We never share your research data with third parties.
                  </Alert>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button variant="outlined" startIcon={<Download />}>
                      Export My Data
                    </Button>
                    <Button variant="outlined" color="error">
                      Delete Account
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Change Password Dialog */}
        <Dialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)}>
          <DialogTitle>Change Password</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              type="password"
              label="Current Password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
              sx={{ mb: 2, mt: 1 }}
            />
            <TextField
              fullWidth
              type="password"
              label="New Password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              type="password"
              label="Confirm New Password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setChangePasswordOpen(false);
              setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
              setError('');
            }}>Cancel</Button>
            <Button 
              variant="contained" 
              onClick={handlePasswordChange}
              sx={{ bgcolor: '#40C057', '&:hover': { bgcolor: '#2fa347' } }}
            >
              Change Password
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ProtectedRoute>
  );
}

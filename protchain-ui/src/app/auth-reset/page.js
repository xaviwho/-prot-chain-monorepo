'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function AuthReset() {
  const [isCleared, setIsCleared] = useState(false);
  const router = useRouter();

  const clearAuthData = () => {
    try {
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      // Clear cookies
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });

      setIsCleared(true);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  const goToLogin = () => {
    router.push('/login');
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      bgcolor: 'grey.50',
      p: 2
    }}>
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box display="flex" alignItems="center" gap={2} mb={3}>
            <WarningIcon color="warning" fontSize="large" />
            <Typography variant="h4" component="h1">
              Authentication Reset
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              <strong>JWT Authentication Update</strong>
            </Typography>
            <Typography variant="body2">
              The authentication system has been updated to use standard JWT tokens. 
              If you're experiencing "Failed to fetch workflows" or "invalid token" errors, 
              you need to clear your browser storage and log in again.
            </Typography>
          </Alert>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Why is this needed?
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <InfoIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Updated JWT System" 
                secondary="The platform now uses standard JWT tokens for better security and compatibility"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <InfoIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Old Token Format" 
                secondary="Previous tokens used a custom format that is incompatible with the new system"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <InfoIcon color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="One-Time Fix" 
                secondary="This is a one-time process - once you log in again, everything will work normally"
              />
            </ListItem>
          </List>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Reset Instructions
          </Typography>

          {!isCleared ? (
            <>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Click the button below to automatically clear your browser storage:
              </Typography>
              <Button
                variant="contained"
                color="warning"
                size="large"
                startIcon={<RefreshIcon />}
                onClick={clearAuthData}
                sx={{ mt: 2, mb: 3 }}
                fullWidth
              >
                Clear Authentication Data
              </Button>
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ mb: 3 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>Authentication data cleared successfully!</strong>
                </Typography>
                <Typography variant="body2">
                  Your browser storage has been cleared. You can now log in again to get new, 
                  compatible JWT tokens.
                </Typography>
              </Alert>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<CheckCircleIcon />}
                onClick={goToLogin}
                fullWidth
              >
                Go to Login
              </Button>
            </>
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Manual Reset (Alternative)
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            If the automatic reset doesn't work, you can manually clear your browser data:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="1. Open Browser Developer Tools" 
                secondary="Press F12 or right-click → Inspect"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="2. Go to Application/Storage Tab" 
                secondary="Look for 'Application' or 'Storage' in the developer tools"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="3. Clear Local Storage" 
                secondary="Delete all entries under 'Local Storage' for localhost:3000"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="4. Clear Cookies" 
                secondary="Delete all cookies for localhost:3000"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="5. Refresh and Login" 
                secondary="Refresh the page and log in again"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}

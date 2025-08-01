'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getValidToken } from '@/lib/tokenUtils';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Higher-order component that protects routes requiring authentication
 * Redirects to login if user is not authenticated
 */
export default function ProtectedRoute({ children, redirectTo = '/login' }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuthentication = () => {
      const token = getValidToken();
      
      if (token) {
        setIsAuthenticated(true);
      } else {
        // Clear any invalid tokens and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          // Clear cookies if available
          try {
            const Cookies = require('js-cookie');
            Cookies.remove('token');
          } catch (e) {
            // Cookies not available
          }
        }
        
        // Redirect to login with return URL
        const currentPath = window.location.pathname;
        const returnUrl = encodeURIComponent(currentPath);
        router.push(`${redirectTo}?returnUrl=${returnUrl}`);
        return;
      }
      
      setIsLoading(false);
    };

    checkAuthentication();
  }, [router, redirectTo]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          backgroundColor: '#f5f5f5'
        }}
      >
        <CircularProgress size={60} sx={{ color: '#40C057', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Verifying authentication...
        </Typography>
      </Box>
    );
  }

  // Only render children if authenticated
  return isAuthenticated ? children : null;
}

/**
 * Hook to check if user is authenticated
 * @returns {boolean} True if user is authenticated
 */
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = getValidToken();
    setIsAuthenticated(!!token);
  }, []);

  return isAuthenticated;
};

/**
 * Hook to get current user information from token
 * @returns {object|null} User information or null if not authenticated
 */
export const useUser = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = getValidToken();
    
    if (token) {
      try {
        // Decode JWT payload to get user info
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.user_id || payload.sub,
          email: payload.email,
          name: payload.name,
          exp: payload.exp
        });
      } catch (error) {
        console.error('Error decoding token:', error);
        setUser(null);
      }
    } else {
      setUser(null);
    }
  }, []);

  return user;
};

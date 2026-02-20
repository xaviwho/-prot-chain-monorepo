'use client';

import { useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';

export default function Error({ error, reset }) {
  useEffect(() => {
  }, [error]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Typography variant="h4" sx={{ mb: 2, color: '#333' }}>
        Something went wrong
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: '#666', maxWidth: 500 }}>
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </Typography>
      <Button
        variant="contained"
        onClick={reset}
        sx={{
          backgroundColor: '#2e7d32',
          '&:hover': { backgroundColor: '#1b5e20' },
          textTransform: 'none',
        }}
      >
        Try again
      </Button>
    </Box>
  );
}

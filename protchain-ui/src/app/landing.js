'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Container, 
  Typography, 
  Button, 
  Box, 
  Grid, 
  Card, 
  CardContent,
  AppBar,
  Toolbar,
  Chip,
  Paper
} from '@mui/material';
import { 
  Security, 
  Science, 
  Speed, 
  Verified,
  CloudUpload,
  Analytics,
  Timeline
} from '@mui/icons-material';

export default function LandingPage() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/auth/register');
  };

  const handleSignIn = () => {
    router.push('/auth/login');
  };

  const features = [
    {
      icon: <Security sx={{ fontSize: 40, color: '#1976d2' }} />,
      title: 'Blockchain Verification',
      description: 'Immutable data provenance with PureChain integration ensures complete audit trails for regulatory compliance.'
    },
    {
      icon: <Science sx={{ fontSize: 40, color: '#1976d2' }} />,
      title: 'Advanced Analytics',
      description: 'Real protein structure analysis, binding site detection, and virtual screening with government-grade accuracy.'
    },
    {
      icon: <Speed sx={{ fontSize: 40, color: '#1976d2' }} />,
      title: 'High Performance',
      description: 'Optimized algorithms handle large proteins (10,000+ atoms) with efficient clustering and cavity detection.'
    }
  ];

  const workflows = [
    {
      step: '01',
      title: 'Structure Upload',
      description: 'Upload PDB files or fetch from RCSB database'
    },
    {
      step: '02', 
      title: 'Analysis Pipeline',
      description: 'Automated structure preparation and binding site detection'
    },
    {
      step: '03',
      title: 'Blockchain Commit',
      description: 'Results verified and stored on PureChain with IPFS'
    },
    {
      step: '04',
      title: '3D Visualization',
      description: 'Interactive molecular viewer with binding site highlighting'
    }
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* Navigation */}
      <AppBar position="static" sx={{ backgroundColor: '#1976d2', boxShadow: 'none' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            ProtChain
          </Typography>
          <Button color="inherit" onClick={handleSignIn} sx={{ mr: 2 }}>
            Sign In
          </Button>
          <Button 
            variant="outlined" 
            color="inherit" 
            onClick={handleGetStarted}
            sx={{ borderColor: 'white', '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' } }}
          >
            Get Started
          </Button>
        </Toolbar>
      </AppBar>

      {/* Hero Section */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)', 
        color: 'white', 
        py: 12,
        textAlign: 'center'
      }}>
        <Container maxWidth="lg">
          <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
            Blockchain-Verified
            <br />
            Drug Discovery Platform
          </Typography>
          <Typography variant="h5" sx={{ mb: 4, opacity: 0.9, maxWidth: '800px', mx: 'auto' }}>
            The only protein analysis platform with unbreakable, auditable data provenance. 
            Trusted by biotech companies and government research labs.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button 
              variant="contained" 
              size="large" 
              onClick={handleGetStarted}
              sx={{ 
                backgroundColor: 'white', 
                color: '#1976d2', 
                px: 4, 
                py: 1.5,
                '&:hover': { backgroundColor: '#f5f5f5' }
              }}
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outlined" 
              size="large" 
              sx={{ 
                borderColor: 'white', 
                color: 'white', 
                px: 4, 
                py: 1.5,
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' }
              }}
            >
              Watch Demo
            </Button>
          </Box>
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              icon={<Verified />} 
              label="Government Grade" 
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            <Chip 
              icon={<Security />} 
              label="Blockchain Verified" 
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            <Chip 
              icon={<Science />} 
              label="Real Bioapi" 
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" component="h2" textAlign="center" gutterBottom sx={{ mb: 6, fontWeight: 'bold' }}>
          Why Choose ProtChain?
        </Typography>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card sx={{ height: '100%', textAlign: 'center', p: 3, boxShadow: 3 }}>
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h5" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Workflow Section */}
      <Box sx={{ backgroundColor: '#f5f5f5', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h3" component="h2" textAlign="center" gutterBottom sx={{ mb: 6, fontWeight: 'bold' }}>
            How It Works
          </Typography>
          <Grid container spacing={4}>
            {workflows.map((workflow, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
                  <Typography 
                    variant="h4" 
                    component="div" 
                    sx={{ 
                      color: '#1976d2', 
                      fontWeight: 'bold', 
                      mb: 2,
                      fontSize: '2rem'
                    }}
                  >
                    {workflow.step}
                  </Typography>
                  <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
                    {workflow.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {workflow.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ backgroundColor: '#1976d2', color: 'white', py: 8, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h3" component="h2" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
            Ready to Transform Your Research?
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.9 }}>
            Join leading biotech companies using blockchain-verified protein analysis.
            Start your free trial today.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button 
              variant="contained" 
              size="large" 
              onClick={handleGetStarted}
              sx={{ 
                backgroundColor: 'white', 
                color: '#1976d2', 
                px: 4, 
                py: 1.5,
                '&:hover': { backgroundColor: '#f5f5f5' }
              }}
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outlined" 
              size="large" 
              onClick={handleSignIn}
              sx={{ 
                borderColor: 'white', 
                color: 'white', 
                px: 4, 
                py: 1.5,
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255,255,255,0.1)' }
              }}
            >
              Sign In
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: '#333', color: 'white', py: 4, textAlign: 'center' }}>
        <Container maxWidth="lg">
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            © 2024 ProtChain. All rights reserved. | Blockchain-verified drug discovery platform.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

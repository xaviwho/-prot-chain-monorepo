'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  TextField,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  CloudUpload,
  Science,
  Security,
  Visibility,
  CheckCircle,
  PlayArrow,
  AutoAwesome
} from '@mui/icons-material';

const GuidedTour = ({ open, onClose, onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [tourWorkflowId, setTourWorkflowId] = useState(null);

  const steps = [
    {
      label: 'Create Your First Workflow',
      title: 'Let\'s Create a New Research Project',
      description: 'We\'ll start by creating a workflow to analyze HIV-1 Protease (PDB: 1HPV), a well-studied protein.',
      icon: <Science sx={{ color: '#2e7d32' }} />,
      action: 'create_workflow',
      content: (
        <Card sx={{ mt: 2, backgroundColor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Sample Workflow: HIV-1 Protease Analysis
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              We'll analyze the HIV-1 protease structure to demonstrate ProtChain's capabilities:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip label="PDB ID: 1HPV" size="small" />
              <Chip label="198 residues" size="small" />
              <Chip label="Aspartic protease" size="small" />
              <Chip label="Drug target" size="small" />
            </Box>
            <TextField
              fullWidth
              label="Workflow Name"
              defaultValue="HIV-1 Protease Analysis (Demo)"
              variant="outlined"
              size="small"
              disabled
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              defaultValue="Guided tour analysis of HIV-1 protease binding sites"
              variant="outlined"
              size="small"
              disabled
              multiline
              rows={2}
            />
          </CardContent>
        </Card>
      )
    },
    {
      label: 'Upload Protein Structure',
      title: 'Load the Protein Structure',
      description: 'We\'ll fetch the HIV-1 protease structure directly from the RCSB Protein Data Bank.',
      icon: <CloudUpload sx={{ color: '#2e7d32' }} />,
      action: 'upload_structure',
      content: (
        <Card sx={{ mt: 2, backgroundColor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Fetch from PDB Database
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              ProtChain can automatically fetch structures from RCSB PDB:
            </Typography>
            <TextField
              fullWidth
              label="PDB ID"
              defaultValue="1HPV"
              variant="outlined"
              size="small"
              disabled
              sx={{ mb: 2 }}
            />
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Pro Tip:</strong> You can also upload your own PDB files for proprietary structures.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )
    },
    {
      label: 'Analyze Structure',
      title: 'Run Structure Preparation',
      description: 'ProtChain will analyze the protein structure and identify key molecular properties.',
      icon: <AutoAwesome sx={{ color: '#2e7d32' }} />,
      action: 'analyze_structure',
      content: (
        <Card sx={{ mt: 2, backgroundColor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Structure Analysis Pipeline
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Our analysis will identify:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Chip 
                icon={<CheckCircle sx={{ fontSize: 16 }} />}
                label="Molecular weight and composition" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip 
                icon={<CheckCircle sx={{ fontSize: 16 }} />}
                label="Secondary structure elements" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip 
                icon={<CheckCircle sx={{ fontSize: 16 }} />}
                label="Binding site cavities" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip 
                icon={<CheckCircle sx={{ fontSize: 16 }} />}
                label="Druggability assessment" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start' }}
              />
            </Box>
          </CardContent>
        </Card>
      )
    },
    {
      label: 'Blockchain Verification',
      title: 'Secure Your Results',
      description: 'Results are automatically committed to PureChain blockchain with IPFS storage for immutable provenance.',
      icon: <Security sx={{ color: '#2e7d32' }} />,
      action: 'blockchain_commit',
      content: (
        <Card sx={{ mt: 2, backgroundColor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Blockchain Provenance
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Your results are secured with:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Chip 
                icon={<Security sx={{ fontSize: 16 }} />}
                label="PureChain blockchain commitment" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start', borderColor: '#2e7d32', color: '#2e7d32' }}
              />
              <Chip 
                icon={<Security sx={{ fontSize: 16 }} />}
                label="IPFS distributed storage" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start', borderColor: '#2e7d32', color: '#2e7d32' }}
              />
              <Chip 
                icon={<Security sx={{ fontSize: 16 }} />}
                label="Immutable audit trail" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start', borderColor: '#2e7d32', color: '#2e7d32' }}
              />
            </Box>
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Unique Advantage:</strong> ProtChain is the only platform providing blockchain-verified drug discovery results.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )
    },
    {
      label: 'View Results',
      title: 'Explore Your Analysis',
      description: 'See your protein structure in 3D with binding sites highlighted, plus detailed molecular analysis.',
      icon: <Visibility sx={{ color: '#2e7d32' }} />,
      action: 'view_results',
      content: (
        <Card sx={{ mt: 2, backgroundColor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Interactive Results Dashboard
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              You'll see:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Chip 
                icon={<Visibility sx={{ fontSize: 16 }} />}
                label="3D molecular viewer with binding sites" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip 
                icon={<Visibility sx={{ fontSize: 16 }} />}
                label="Detailed molecular descriptors" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip 
                icon={<Visibility sx={{ fontSize: 16 }} />}
                label="Downloadable CSV reports" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start' }}
              />
              <Chip 
                icon={<Visibility sx={{ fontSize: 16 }} />}
                label="Blockchain verification links" 
                variant="outlined" 
                size="small"
                sx={{ justifyContent: 'flex-start' }}
              />
            </Box>
          </CardContent>
        </Card>
      )
    }
  ];

  const handleNext = async () => {
    const currentStep = steps[activeStep];
    
    if (currentStep.action) {
      setIsProcessing(true);
      
      try {
        // Simulate the action (in real implementation, these would be actual API calls)
        await simulateAction(currentStep.action);
        setCompletedSteps(prev => new Set([...prev, activeStep]));
      } catch (error) {
        console.error('Tour action failed:', error);
      } finally {
        setIsProcessing(false);
      }
    }

    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      onComplete(tourWorkflowId);
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const handleSkip = () => {
    onClose();
  };

  const simulateAction = async (action) => {
    // Simulate API calls with realistic delays
    switch (action) {
      case 'create_workflow':
        await new Promise(resolve => setTimeout(resolve, 1000));
        setTourWorkflowId('tour-' + Date.now());
        break;
      case 'upload_structure':
        await new Promise(resolve => setTimeout(resolve, 1500));
        break;
      case 'analyze_structure':
        await new Promise(resolve => setTimeout(resolve, 3000));
        break;
      case 'blockchain_commit':
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      case 'view_results':
        await new Promise(resolve => setTimeout(resolve, 500));
        break;
      default:
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const currentStep = steps[activeStep];

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 2,
          minHeight: '600px'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ 
            backgroundColor: '#2e7d32', 
            borderRadius: '50%', 
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {currentStep.icon}
          </Box>
          <Box>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
              {currentStep.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Step {activeStep + 1} of {steps.length}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label} completed={completedSteps.has(index)}>
              <StepLabel>
                <Typography variant="subtitle1" sx={{ fontWeight: index === activeStep ? 'bold' : 'normal' }}>
                  {step.label}
                </Typography>
              </StepLabel>
              {index === activeStep && (
                <StepContent>
                  <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
                    {step.description}
                  </Typography>
                  {step.content}
                </StepContent>
              )}
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleSkip} color="inherit">
          Skip Tour
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} sx={{ mr: 1 }} disabled={isProcessing}>
            Back
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={isProcessing}
          startIcon={isProcessing ? <CircularProgress size={16} /> : 
                     activeStep === steps.length - 1 ? <CheckCircle /> : <PlayArrow />}
          sx={{ 
            backgroundColor: '#2e7d32',
            '&:hover': { backgroundColor: '#1b5e20' },
            minWidth: '140px'
          }}
        >
          {isProcessing ? 'Processing...' : 
           activeStep === steps.length - 1 ? 'Complete Tour' : 'Next Step'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GuidedTour;

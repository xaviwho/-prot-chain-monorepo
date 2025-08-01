'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Chip,
  Divider
} from '@mui/material';
import {
  Science,
  Security,
  Timeline,
  PlayArrow,
  CheckCircle
} from '@mui/icons-material';

const OnboardingWelcome = ({ open, onClose, onStartTour }) => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      label: 'Welcome to ProtChain',
      title: 'Blockchain-Verified Drug Discovery',
      description: 'You\'ve joined the only protein analysis platform with unbreakable, auditable data provenance.',
      icon: <Security sx={{ fontSize: 40, color: '#2e7d32' }} />,
      features: [
        'Government-grade security',
        'Blockchain verification',
        'Real bioapi analysis'
      ]
    },
    {
      label: 'Your First Workflow',
      title: 'Let\'s Analyze Your First Protein',
      description: 'We\'ll guide you through creating a complete protein analysis workflow in just a few minutes.',
      icon: <Science sx={{ fontSize: 40, color: '#2e7d32' }} />,
      features: [
        'Structure preparation',
        'Binding site detection',
        '3D visualization'
      ]
    },
    {
      label: 'Blockchain Provenance',
      title: 'Secure Your Research',
      description: 'Every result is automatically verified and stored on PureChain with IPFS for complete audit trails.',
      icon: <Timeline sx={{ fontSize: 40, color: '#2e7d32' }} />,
      features: [
        'Immutable data records',
        'Regulatory compliance',
        'Research integrity'
      ]
    }
  ];

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    } else {
      onStartTour();
    }
  };

  const handleBack = () => {
    setActiveStep(activeStep - 1);
  };

  const handleSkip = () => {
    onClose();
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
          minHeight: '500px'
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
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
            {currentStep.title}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Card sx={{ mb: 3, backgroundColor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              {currentStep.label}
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.6 }}>
              {currentStep.description}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold', color: '#2e7d32' }}>
              Key Features:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {currentStep.features.map((feature, index) => (
                <Chip
                  key={index}
                  icon={<CheckCircle sx={{ fontSize: 16 }} />}
                  label={feature}
                  variant="outlined"
                  sx={{ 
                    borderColor: '#2e7d32',
                    color: '#2e7d32',
                    '& .MuiChip-icon': { color: '#2e7d32' }
                  }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>

        {activeStep === steps.length - 1 && (
          <Box sx={{ 
            backgroundColor: '#e8f5e8', 
            p: 3, 
            borderRadius: 2,
            border: '1px solid #2e7d32'
          }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#2e7d32', mb: 1 }}>
              🚀 Ready to Get Started?
            </Typography>
            <Typography variant="body2" sx={{ color: '#1b5e20' }}>
              We'll guide you through analyzing a sample protein (HIV-1 Protease) so you can see 
              ProtChain's full capabilities in action. This takes about 3-5 minutes.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleSkip} color="inherit">
          Skip Tour
        </Button>
        <Box sx={{ flex: 1 }} />
        {activeStep > 0 && (
          <Button onClick={handleBack} sx={{ mr: 1 }}>
            Back
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleNext}
          startIcon={activeStep === steps.length - 1 ? <PlayArrow /> : null}
          sx={{ 
            backgroundColor: '#2e7d32',
            '&:hover': { backgroundColor: '#1b5e20' }
          }}
        >
          {activeStep === steps.length - 1 ? 'Start Guided Tour' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OnboardingWelcome;

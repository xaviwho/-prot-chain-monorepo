'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Tab,
  Tabs,
  Container
} from '@mui/material';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Terminal as TerminalIcon,
  Code as CodeIcon,
  Verified as VerifiedIcon,
  Science as ScienceIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  ContentCopy as CopyIcon,
  GitHub as GitHubIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
  AutoAwesome as AIIcon,
  Link as LinkIcon
} from '@mui/icons-material';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`pureprot-tabpanel-${index}`}
      aria-labelledby={`pureprot-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

function CodeBlock({ children, title, language = 'bash' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Paper 
      sx={{ 
        bgcolor: '#1e1e1e', 
        color: '#d4d4d4', 
        p: 2, 
        mb: 2,
        position: 'relative',
        fontFamily: 'Monaco, Consolas, "Courier New", monospace'
      }}
    >
      {title && (
        <Typography variant="caption" sx={{ color: '#569cd6', mb: 1, display: 'block' }}>
          {title}
        </Typography>
      )}
      <Box sx={{ position: 'relative' }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <code>{children}</code>
        </pre>
        <IconButton
          onClick={handleCopy}
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            color: copied ? '#4CAF50' : '#888',
            '&:hover': { color: copied ? '#4CAF50' : '#fff' }
          }}
          size="small"
        >
          {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Paper>
  );
}

function PureProtPageContent() {
  const [tabValue, setTabValue] = useState(0);

  const features = [
    {
      icon: <ScienceIcon sx={{ color: '#2e7d32' }} />,
      title: 'End-to-End Workflow',
      description: 'Complete pipeline from data acquisition to verifiable results'
    },
    {
      icon: <StorageIcon sx={{ color: '#2e7d32' }} />,
      title: 'Automated Data Fetching',
      description: 'Download and prepare bioactivity data from ChEMBL database'
    },
    {
      icon: <AIIcon sx={{ color: '#2e7d32' }} />,
      title: 'Custom AI Models',
      description: 'Train Support Vector Regression models on custom datasets'
    },
    {
      icon: <SecurityIcon sx={{ color: '#2e7d32' }} />,
      title: 'Blockchain Verification',
      description: 'Records results on PureChain blockchain for integrity verification'
    },
    {
      icon: <SpeedIcon sx={{ color: '#2e7d32' }} />,
      title: 'RDKit-Powered',
      description: 'Binding affinity prediction and drug-like property calculations'
    },
    {
      icon: <TerminalIcon sx={{ color: '#2e7d32' }} />,
      title: 'CLI Interface',
      description: 'Simple and intuitive command-line interface for automation'
    }
  ];

  const workflowSteps = [
    {
      step: 1,
      title: 'Fetch Data for Target',
      command: 'python PureProt.py fetch-data "CHEMBL4822" --output "braf_data.csv"',
      description: 'Download training data for BRAF target from ChEMBL database'
    },
    {
      step: 2,
      title: 'Train Custom AI Model',
      command: 'python PureProt.py train-model "braf_data.csv" --output "braf_model.joblib"',
      description: 'Train a new AI model on the downloaded data'
    },
    {
      step: 3,
      title: 'Screen Molecule',
      command: 'python PureProt.py screen "MyBrafTest-01" --smiles "CNC(=O)c1cc(c(cn1)Oc1ccc(cc1)F)NC(=O)C(C)(C)C" --model "braf_model.joblib"',
      description: 'Screen a molecule using your custom-trained model'
    },
    {
      step: 4,
      title: 'Verify Result',
      command: 'python PureProt.py verify "<your_job_id>"',
      description: 'Verify the result matches the blockchain record'
    },
    {
      step: 5,
      title: 'View Job History',
      command: 'python PureProt.py history',
      description: 'View summary of all past screening jobs'
    }
  ];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Hero Section */}
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
          <TerminalIcon sx={{ fontSize: 48, color: '#2e7d32', mr: 2 }} />
          <Typography variant="h2" component="h1" sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>
            PureProt CLI
          </Typography>
        </Box>
        <Typography variant="h5" color="text.secondary" sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>
          AI-Blockchain Enabled Virtual Screening Tool for Drug Discovery
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 900, mx: 'auto' }}>
          A command-line interface tool that provides transparent, reproducible, and user-friendly virtual screening workflows. 
          Seamlessly integrates automated data fetching, AI model training, molecular screening, and blockchain-based verification.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<GitHubIcon />}
            href="https://github.com/xaviwho/PureProt"
            target="_blank"
            sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            View on GitHub
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<DownloadIcon />}
            href="https://github.com/xaviwho/PureProt/archive/refs/heads/main.zip"
            sx={{ borderColor: '#2e7d32', color: '#2e7d32', '&:hover': { borderColor: '#1b5e20', bgcolor: '#f1f8e9' } }}
          >
            Download CLI
          </Button>
        </Box>
      </Box>

      {/* Trust Badges */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 6, flexWrap: 'wrap' }}>
        <Chip icon={<VerifiedIcon />} label="Blockchain Verified" color="primary" />
        <Chip icon={<AIIcon />} label="AI-Powered" color="secondary" />
        <Chip icon={<TerminalIcon />} label="CLI Interface" />
        <Chip icon={<LinkIcon />} label="ChEMBL Integration" />
      </Box>

      {/* Features Grid */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" sx={{ textAlign: 'center', mb: 4, color: '#1a1a1a' }}>
          Key Features
        </Typography>
        <Grid container spacing={3}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Box sx={{ mb: 2 }}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Tabs Section */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} centered>
            <Tab label="Quick Start" />
            <Tab label="Full Workflow" />
            <Tab label="Integration" />
            <Tab label="CLI Reference" />
          </Tabs>
        </Box>

        {/* Quick Start Tab */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            Quick Start Guide
          </Typography>
          
          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            1. Installation
          </Typography>
          <CodeBlock title="Clone and Setup">
{`git clone https://github.com/xaviwho/PureProt.git
cd PureProt
python -m venv venv
# Windows
venv\\Scripts\\activate
# macOS/Linux  
source venv/bin/activate
pip install -r requirements.txt`}
          </CodeBlock>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            2. Configure Blockchain
          </Typography>
          <CodeBlock title="Create .env file">
{`TEST_PRIVATE_KEY="your_private_key_here"`}
          </CodeBlock>
          <Alert severity="info" sx={{ mb: 3 }}>
            The private key is used for blockchain verification on PureChain. The testnet is configured for gas-free transactions.
          </Alert>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            3. Run Your First Screening
          </Typography>
          <CodeBlock title="Screen a molecule">
{`python PureProt.py screen "TestJob-01" --smiles "CCO" --model "default"`}
          </CodeBlock>
        </TabPanel>

        {/* Full Workflow Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            Complete Workflow Example
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Here's a complete end-to-end workflow using BRAF as an example target:
          </Typography>

          {workflowSteps.map((step, index) => (
            <Accordion key={index} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip label={`Step ${step.step}`} color="primary" size="small" />
                  <Typography variant="h6">{step.title}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {step.description}
                </Typography>
                <CodeBlock>
                  {step.command}
                </CodeBlock>
              </AccordionDetails>
            </Accordion>
          ))}
        </TabPanel>

        {/* Integration Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            Integration with ProtChain
          </Typography>
          
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
              Unified Blockchain Verification
            </Typography>
            Both PureProt CLI and ProtChain web platform use the same PureChain blockchain for result verification, 
            ensuring seamless interoperability between command-line and web-based workflows.
          </Alert>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Import PureProt Results into ProtChain
          </Typography>
          <CodeBlock title="Export results for ProtChain">
{`# View your PureProt job history
python PureProt.py history

# The results are stored in pureprot_results.json
# You can import these results into ProtChain workflows`}
          </CodeBlock>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Verify Results Across Platforms
          </Typography>
          <CodeBlock title="Cross-platform verification">
{`# Verify a PureProt result using the job ID
python PureProt.py verify "job_12345"

# The same blockchain verification works in ProtChain web interface`}
          </CodeBlock>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Workflow Integration Examples
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <PlayIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Batch Processing"
                secondary="Use PureProt CLI for large-scale screening, then import results into ProtChain for visualization"
                primaryTypographyProps={{ color: '#1a1a1a', fontWeight: 'bold' }}
                secondaryTypographyProps={{ color: '#424242' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <VerifiedIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Result Verification"
                secondary="Verify results from either platform using the same blockchain infrastructure"
                primaryTypographyProps={{ color: '#1a1a1a', fontWeight: 'bold' }}
                secondaryTypographyProps={{ color: '#424242' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CodeIcon color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Automation"
                secondary="Automate screening pipelines with PureProt CLI, visualize in ProtChain web interface"
                primaryTypographyProps={{ color: '#1a1a1a', fontWeight: 'bold' }}
                secondaryTypographyProps={{ color: '#424242' }}
              />
            </ListItem>
          </List>
        </TabPanel>

        {/* CLI Reference Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            CLI Command Reference
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Data Management
          </Typography>
          <CodeBlock title="Fetch training data from ChEMBL">
{`python PureProt.py fetch-data <target_id> --output <filename>

# Example:
python PureProt.py fetch-data "CHEMBL4822" --output "braf_data.csv"`}
          </CodeBlock>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Model Training
          </Typography>
          <CodeBlock title="Train custom AI model">
{`python PureProt.py train-model <data_file> --output <model_file>

# Example:
python PureProt.py train-model "braf_data.csv" --output "braf_model.joblib"`}
          </CodeBlock>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Molecular Screening
          </Typography>
          <CodeBlock title="Screen molecules">
{`python PureProt.py screen <job_name> --smiles <smiles_string> [--model <model_file>]

# Using default model:
python PureProt.py screen "TestJob" --smiles "CCO"

# Using custom model:
python PureProt.py screen "TestJob" --smiles "CCO" --model "custom_model.joblib"`}
          </CodeBlock>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Verification & History
          </Typography>
          <CodeBlock title="Verify and view results">
{`# Verify a specific job
python PureProt.py verify <job_id>

# View all job history
python PureProt.py history`}
          </CodeBlock>
        </TabPanel>
      </Box>

      {/* Call to Action */}
      <Box sx={{ textAlign: 'center', bgcolor: '#f5f5f5', p: 4, borderRadius: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
          Ready to Get Started?
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, color: '#424242', fontSize: '1.1rem' }}>
          Download PureProt CLI and start performing verifiable virtual screening today.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<GitHubIcon />}
            href="https://github.com/xaviwho/PureProt"
            target="_blank"
            sx={{ bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}
          >
            Get Started on GitHub
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<LinkIcon />}
            href="/workflows"
            sx={{ borderColor: '#2e7d32', color: '#2e7d32', '&:hover': { borderColor: '#1b5e20', bgcolor: '#f1f8e9' } }}
          >
            Try ProtChain Web Interface
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default function PureProtPage() {
  return (
    <ProtectedRoute>
      <PureProtPageContent />
    </ProtectedRoute>
  );
}

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
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Link as LinkIcon,
  Biotech as BiotechIcon,
  Analytics as AnalyticsIcon,
  CompareArrows as CompareIcon,
  Hub as HubIcon,
  FindInPage as FindIcon,
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
      icon: <AIIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: 'Consensus AI Ensemble',
      description: '3-model ensemble (SVR + Random Forest + Gradient Boosting) with 2048-bit Morgan fingerprints for robust pIC50 prediction'
    },
    {
      icon: <BiotechIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: 'AutoDock Vina Docking',
      description: 'Real molecular docking with automatic binding site detection, score normalization, and batch processing'
    },
    {
      icon: <CompareIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: 'Hybrid AI+Docking Scoring',
      description: 'Weighted consensus combining AI predictions with docking scores (alpha-optimized on validation sets)'
    },
    {
      icon: <SecurityIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: 'PureChain Blockchain Audit',
      description: 'SHA-256 hash chains for models, proteins, parameters, and results on zero-gas PureChain (PoA)'
    },
    {
      icon: <AnalyticsIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: 'Full Evaluation Suite',
      description: 'Enrichment Factor, BEDROC, AUC-ROC/PR metrics with Leave-One-Target-Out cross-validation'
    },
    {
      icon: <StorageIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: 'ChEMBL Data Pipeline',
      description: 'Automated bioactivity data fetching and preparation for 20 benchmark targets (10 DUD-E + 10 ChEMBL)'
    },
    {
      icon: <HubIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: 'Scaffold Diversity Analysis',
      description: 'Murcko scaffold extraction, novelty metrics, and Tanimoto similarity for evaluating hit diversity'
    },
    {
      icon: <SpeedIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: 'Deterministic Reproducibility',
      description: '100% reproducible results across runs with fixed seeds, deterministic tie-breaking, and canonical SMILES'
    },
    {
      icon: <TerminalIcon sx={{ color: '#2e7d32', fontSize: 36 }} />,
      title: '15+ CLI Commands',
      description: 'Full command-line interface covering data, training, screening, docking, hybrid scoring, and verification'
    }
  ];

  const workflowSteps = [
    {
      step: 1,
      title: 'Fetch Data for Target',
      command: 'python PureProt.py fetch-data "CHEMBL4822" --output "braf_data.csv"',
      description: 'Download and prepare bioactivity data for BRAF target from ChEMBL database'
    },
    {
      step: 2,
      title: 'Train Consensus AI Model',
      command: 'python PureProt.py train-model "braf_data.csv" --output "braf_model.joblib"',
      description: 'Train a 3-model ensemble (SVR + Random Forest + Gradient Boosting) on the dataset'
    },
    {
      step: 3,
      title: 'Prepare Protein for Docking',
      command: 'python PureProt.py prep-protein receptor.pdb --output receptor.pdbqt',
      description: 'Prepare the protein structure for molecular docking with AutoDock Vina'
    },
    {
      step: 4,
      title: 'Find Binding Site',
      command: 'python PureProt.py find-binding-site receptor.pdb --method auto',
      description: 'Automatically detect binding site center coordinates and box dimensions'
    },
    {
      step: 5,
      title: 'Run Hybrid Screening',
      command: 'python PureProt.py hybrid-screen braf_data.csv --model braf_model.joblib --protein receptor.pdbqt --center "15.5,22.3,10.1"',
      description: 'Combined AI + Vina docking consensus scoring with alpha-weighted ranking'
    },
    {
      step: 6,
      title: 'Verify Results on Blockchain',
      command: 'python PureProt.py verify "<your_job_id>"',
      description: 'Verify the result hash matches the PureChain blockchain record'
    },
    {
      step: 7,
      title: 'View Job History',
      command: 'python PureProt.py history',
      description: 'View summary of all past screening jobs with blockchain audit trails'
    }
  ];

  const cliCommands = [
    { category: 'Data Management', commands: [
      { name: 'fetch-data', args: '<target_id> [--output <file>]', desc: 'Fetch and prepare bioactivity data from ChEMBL' },
      { name: 'convert', args: '<input.smi> <output.csv>', desc: 'Convert .smi SMILES file to PureProt CSV format' },
    ]},
    { category: 'Model Training', commands: [
      { name: 'train-model', args: '<dataset.csv> [--output <model.joblib>]', desc: 'Train 3-model consensus ensemble (SVR + RF + GB)' },
      { name: 'benchmark', args: '<dataset.csv> [--limit N]', desc: 'Run benchmark evaluation with enrichment metrics' },
    ]},
    { category: 'AI Screening', commands: [
      { name: 'screen', args: '<molecule_id> --smiles <SMILES> [--model <file>]', desc: 'Screen a single molecule with consensus AI prediction' },
      { name: 'batch', args: '<molecules.csv> [--model <file>] [--output <file>]', desc: 'Batch AI screening of molecules from CSV' },
    ]},
    { category: 'Molecular Docking', commands: [
      { name: 'prep-protein', args: '<receptor.pdb> [--output <file>]', desc: 'Prepare protein structure for Vina docking' },
      { name: 'find-binding-site', args: '<receptor.pdb> [--method auto|ligand|center]', desc: 'Auto-detect binding site coordinates' },
      { name: 'dock', args: '<mol_id> --smiles <S> --receptor <R> --center X Y Z', desc: 'Dock a single molecule with AutoDock Vina' },
      { name: 'dock-batch', args: '<molecules.csv> --receptor <R> --center X Y Z', desc: 'Batch Vina docking with score normalization' },
    ]},
    { category: 'Hybrid Scoring', commands: [
      { name: 'hybrid-screen', args: '<molecules.csv> --model <M> --protein <P> --center <X,Y,Z>', desc: 'Combined AI+docking consensus screening (alpha-weighted)' },
      { name: 'compare', args: '--ai-results <F> --docking-results <F> --hybrid-results <F>', desc: 'Compare AI-only, docking-only, and hybrid results' },
    ]},
    { category: 'Blockchain', commands: [
      { name: 'connect', args: '', desc: 'Test connection to PureChain blockchain' },
      { name: 'verify', args: '<job_id>', desc: 'Verify a screening result against blockchain record' },
      { name: 'history', args: '', desc: 'Show all past screening jobs with audit trails' },
    ]},
  ];

  const benchmarkTargets = [
    { id: 'AKT1', family: 'Kinase', source: 'DUD-E', actives: 293, decoys: 16450 },
    { id: 'EGFR', family: 'Kinase', source: 'DUD-E', actives: 542, decoys: 35050 },
    { id: 'SRC', family: 'Kinase', source: 'DUD-E', actives: 524, decoys: 34500 },
    { id: 'VEGFR2', family: 'Kinase', source: 'DUD-E', actives: 409, decoys: 24950 },
    { id: 'ESR1_ago', family: 'Nuclear receptor', source: 'DUD-E', actives: 383, decoys: 20685 },
    { id: 'PPARG', family: 'Nuclear receptor', source: 'DUD-E', actives: 484, decoys: 25260 },
    { id: 'DRD3', family: 'GPCR', source: 'DUD-E', actives: 480, decoys: 34050 },
    { id: 'CHEMBL243', family: 'Protease', source: 'ChEMBL', actives: '-', decoys: '-' },
    { id: 'CHEMBL279', family: 'Kinase', source: 'ChEMBL', actives: '-', decoys: '-' },
    { id: 'CHEMBL240', family: 'Ion channel', source: 'ChEMBL', actives: '-', decoys: '-' },
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
        <Typography variant="h5" color="text.secondary" sx={{ mb: 2, maxWidth: 800, mx: 'auto' }}>
          AI-Blockchain Enabled Virtual Screening Tool for Drug Discovery
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 900, mx: 'auto' }}>
          A modular CLI protocol combining a 3-model Consensus AI ensemble with AutoDock Vina molecular docking,
          verified on PureChain blockchain. Deterministic, reproducible, and paper-publishable virtual screening.
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
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 6, flexWrap: 'wrap' }}>
        <Chip icon={<VerifiedIcon />} label="Blockchain Verified" color="success" />
        <Chip icon={<AIIcon />} label="3-Model Consensus AI" color="secondary" />
        <Chip icon={<BiotechIcon />} label="AutoDock Vina" color="primary" />
        <Chip icon={<TerminalIcon />} label="15+ CLI Commands" />
        <Chip icon={<LinkIcon />} label="ChEMBL + DUD-E" />
        <Chip icon={<AnalyticsIcon />} label="EF / BEDROC / AUC" />
      </Box>

      {/* Features Grid */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" sx={{ textAlign: 'center', mb: 4, color: '#1a1a1a' }}>
          Key Features
        </Typography>
        <Grid container spacing={3}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={6} lg={4} key={index}>
              <Card sx={{ height: '100%', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 } }}>
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

      {/* Architecture Overview */}
      <Paper sx={{ p: 4, mb: 6, bgcolor: '#fafafa' }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#1a1a1a' }}>
          Architecture Overview
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <AIIcon sx={{ fontSize: 40, color: '#1565c0', mb: 1 }} />
              <Typography variant="h6" gutterBottom>Consensus AI Layer</Typography>
              <Typography variant="body2" color="text.secondary">
                SVR + Random Forest + Gradient Boosting ensemble with 2048-bit Morgan fingerprints
                and 10 physicochemical descriptors. All seeds fixed at 42 for determinism.
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <BiotechIcon sx={{ fontSize: 40, color: '#2e7d32', mb: 1 }} />
              <Typography variant="h6" gutterBottom>Docking Layer</Typography>
              <Typography variant="body2" color="text.secondary">
                AutoDock Vina molecular docking with automatic binding site detection,
                score normalization (0-1 scale), and hybrid consensus scoring (alpha * AI + (1-alpha) * docking).
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ textAlign: 'center', p: 2 }}>
              <SecurityIcon sx={{ fontSize: 40, color: '#e65100', mb: 1 }} />
              <Typography variant="h6" gutterBottom>Blockchain Layer</Typography>
              <Typography variant="body2" color="text.secondary">
                PureChain PoA network (Chain ID 900520900520, zero gas fees).
                DrugScreeningVerifier smart contract with SHA-256 hash chains for full audit trail.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs Section */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} centered variant="scrollable" scrollButtons="auto">
            <Tab label="Quick Start" />
            <Tab label="Full Workflow" />
            <Tab label="CLI Reference" />
            <Tab label="Benchmarks" />
            <Tab label="Integration" />
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
            2. Docker Alternative
          </Typography>
          <CodeBlock title="Run with Docker (includes Vina binary)">
{`docker build -t pureprot .
docker run -it pureprot screen "TestJob-01" --smiles "CCO"`}
          </CodeBlock>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            3. Configure Blockchain
          </Typography>
          <CodeBlock title="Create .env file">
{`TEST_PRIVATE_KEY="your_private_key_here"
# PureChain testnet is pre-configured (zero gas fees)`}
          </CodeBlock>
          <Alert severity="info" sx={{ mb: 3 }}>
            PureChain testnet is configured for zero-gas transactions. No ETH or tokens needed.
          </Alert>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            4. Run Your First Screening
          </Typography>
          <CodeBlock title="AI screening with blockchain audit">
{`# Screen a single molecule
python PureProt.py screen "TestJob-01" --smiles "CCO"

# Batch screening from CSV
python PureProt.py batch molecules.csv --output results.csv

# Test blockchain connection
python PureProt.py connect`}
          </CodeBlock>
        </TabPanel>

        {/* Full Workflow Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            Complete Hybrid Screening Workflow
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            End-to-end pipeline: data acquisition, model training, molecular docking, hybrid consensus scoring, and blockchain verification.
          </Typography>

          {workflowSteps.map((step, index) => (
            <Accordion key={index} defaultExpanded={index === 0} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip label={`Step ${step.step}`} color="primary" size="small" />
                  <Typography variant="subtitle1" fontWeight="bold">{step.title}</Typography>
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

          <Alert severity="success" sx={{ mt: 3 }}>
            Every screening result is automatically hashed (SHA-256) and recorded on PureChain blockchain,
            creating an immutable audit trail that can be independently verified.
          </Alert>
        </TabPanel>

        {/* CLI Reference Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            CLI Command Reference
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            All commands follow the pattern: <code>python PureProt.py &lt;command&gt; [args] [options]</code>
          </Typography>

          {cliCommands.map((group, gIdx) => (
            <Box key={gIdx} sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2, color: '#2e7d32', fontWeight: 'bold' }}>
                {group.category}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: '18%' }}>Command</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>Arguments</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.commands.map((cmd, cIdx) => (
                      <TableRow key={cIdx}>
                        <TableCell>
                          <code style={{ color: '#2e7d32', fontWeight: 'bold' }}>{cmd.name}</code>
                        </TableCell>
                        <TableCell>
                          <code style={{ fontSize: '0.85em' }}>{cmd.args}</code>
                        </TableCell>
                        <TableCell>{cmd.desc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Usage Examples
          </Typography>
          <CodeBlock title="Complete hybrid screening pipeline">
{`# 1. Fetch ChEMBL data
python PureProt.py fetch-data "CHEMBL4822" --output "braf_data.csv"

# 2. Train consensus AI ensemble
python PureProt.py train-model "braf_data.csv" --output "braf_model.joblib"

# 3. Prepare protein & find binding site
python PureProt.py prep-protein receptor.pdb --output receptor.pdbqt
python PureProt.py find-binding-site receptor.pdb --method auto

# 4. Hybrid screening (AI + Vina docking)
python PureProt.py hybrid-screen braf_data.csv \\
  --model braf_model.joblib \\
  --protein receptor.pdbqt \\
  --center "15.5,22.3,10.1"

# 5. Compare scoring methods
python PureProt.py compare \\
  --ai-results ai_scores.csv \\
  --docking-results vina_scores.csv \\
  --hybrid-results hybrid_scores.csv

# 6. Verify on blockchain
python PureProt.py verify "BRAF_screen_1234567890"`}
          </CodeBlock>
        </TabPanel>

        {/* Benchmarks Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            Benchmark Panel
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            20 benchmark targets spanning 8 protein families for rigorous evaluation of screening performance.
          </Typography>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e8f5e9' }}>
                <Typography variant="h4" fontWeight="bold" color="#2e7d32">20</Typography>
                <Typography variant="body2" color="text.secondary">Benchmark Targets</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#e3f2fd' }}>
                <Typography variant="h4" fontWeight="bold" color="#1565c0">10</Typography>
                <Typography variant="body2" color="text.secondary">DUD-E Targets</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fff3e0' }}>
                <Typography variant="h4" fontWeight="bold" color="#e65100">10</Typography>
                <Typography variant="body2" color="text.secondary">ChEMBL Targets</Typography>
              </Paper>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#fce4ec' }}>
                <Typography variant="h4" fontWeight="bold" color="#c62828">8</Typography>
                <Typography variant="body2" color="text.secondary">Protein Families</Typography>
              </Paper>
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Target ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Family</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Source</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Actives</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Decoys</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {benchmarkTargets.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell><code>{t.id}</code></TableCell>
                    <TableCell>{t.family}</TableCell>
                    <TableCell>
                      <Chip label={t.source} size="small" color={t.source === 'DUD-E' ? 'primary' : 'warning'} variant="outlined" />
                    </TableCell>
                    <TableCell>{typeof t.actives === 'number' ? t.actives.toLocaleString() : t.actives}</TableCell>
                    <TableCell>{typeof t.decoys === 'number' ? t.decoys.toLocaleString() : t.decoys}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" sx={{ mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Evaluation Metrics
          </Typography>
          <Grid container spacing={2}>
            {[
              { metric: 'EF (1%, 5%, 10%)', desc: 'Enrichment Factor at multiple cutoffs' },
              { metric: 'BEDROC (alpha=20)', desc: 'Boltzmann-Enhanced Discrimination of ROC (top ~8%)' },
              { metric: 'AUC-ROC', desc: 'Area Under the Receiver Operating Characteristic Curve' },
              { metric: 'AUC-PR', desc: 'Area Under the Precision-Recall Curve' },
              { metric: 'LOTO Cross-Validation', desc: 'Leave-One-Target-Out alpha optimization' },
              { metric: 'Scaffold Diversity', desc: 'Murcko scaffold novelty and Tanimoto similarity' },
            ].map((m, i) => (
              <Grid item xs={12} sm={6} key={i}>
                <Paper sx={{ p: 2 }} variant="outlined">
                  <Typography variant="subtitle2" fontWeight="bold">{m.metric}</Typography>
                  <Typography variant="body2" color="text.secondary">{m.desc}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        {/* Integration Tab */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
            Integration with ProtChain
          </Typography>

          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Unified Blockchain Infrastructure
            </Typography>
            Both PureProt CLI and ProtChain web platform use the same PureChain blockchain (Chain ID 900520900520)
            for result verification, ensuring seamless interoperability between command-line and web-based workflows.
          </Alert>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            CLI + Web Platform Workflow
          </Typography>
          <CodeBlock title="Use CLI for batch processing, web for visualization">
{`# 1. Run large-scale screening via CLI
python PureProt.py batch compounds_10k.csv --model my_model.joblib --output results.csv

# 2. Dock top hits
python PureProt.py dock-batch top_hits.csv --receptor target.pdbqt --center 15.5 22.3 10.1

# 3. Results are blockchain-verified and can be viewed in ProtChain web interface
python PureProt.py history`}
          </CodeBlock>

          <Typography variant="h6" sx={{ mt: 3, mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Cross-Platform Verification
          </Typography>
          <CodeBlock title="Verify results from either platform">
{`# Verify CLI results
python PureProt.py verify "job_12345"

# The same blockchain verification is available in ProtChain web interface
# Navigate to Workflows > Select workflow > Blockchain tab`}
          </CodeBlock>

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" sx={{ mb: 2, color: '#1a1a1a', fontWeight: 'bold' }}>
            Integration Capabilities
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><PlayIcon color="success" /></ListItemIcon>
              <ListItemText
                primary="Batch Processing at Scale"
                secondary="Use PureProt CLI for 10k+ compound screening, then import results into ProtChain for visualization and team collaboration"
                primaryTypographyProps={{ fontWeight: 'bold' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><VerifiedIcon color="success" /></ListItemIcon>
              <ListItemText
                primary="Shared Blockchain Audit Trail"
                secondary="All results (CLI and web) are recorded on the same PureChain network with identical verification"
                primaryTypographyProps={{ fontWeight: 'bold' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CompareIcon color="success" /></ListItemIcon>
              <ListItemText
                primary="Hybrid AI + Docking Consensus"
                secondary="Train models via CLI, run docking locally with Vina, then use hybrid scoring for alpha-optimized rankings"
                primaryTypographyProps={{ fontWeight: 'bold' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CodeIcon color="success" /></ListItemIcon>
              <ListItemText
                primary="CI/CD Pipeline Automation"
                secondary="Integrate PureProt CLI into automated screening pipelines with deterministic, reproducible results"
                primaryTypographyProps={{ fontWeight: 'bold' }}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><AnalyticsIcon color="success" /></ListItemIcon>
              <ListItemText
                primary="Rigorous Benchmarking"
                secondary="Evaluate against 20 benchmark targets with EF, BEDROC, AUC metrics and LOTO cross-validation"
                primaryTypographyProps={{ fontWeight: 'bold' }}
              />
            </ListItem>
          </List>
        </TabPanel>
      </Box>

      {/* Call to Action */}
      <Box sx={{ textAlign: 'center', bgcolor: '#f5f5f5', p: 4, borderRadius: 2 }}>
        <Typography variant="h5" gutterBottom sx={{ color: '#1a1a1a', fontWeight: 'bold' }}>
          Ready to Get Started?
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, color: '#424242', fontSize: '1.1rem' }}>
          Download PureProt CLI and start performing reproducible, blockchain-verified virtual screening.
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

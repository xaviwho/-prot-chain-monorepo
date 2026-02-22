'use client';

import { useRouter } from 'next/navigation';
import {
  Container,
  Typography,
  Button,
  Box,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Security,
  Science,
  Speed,
  SmartToy,
  Verified,
  ArrowForward,
  CheckCircle,
} from '@mui/icons-material';

export default function LandingPage() {
  const router = useRouter();

  const features = [
    {
      icon: <Security sx={{ fontSize: 28, color: '#fff' }} />,
      title: 'Blockchain Verification',
      description: 'Immutable data provenance with PureChain integration. Complete audit trails for regulatory compliance.',
    },
    {
      icon: <Science sx={{ fontSize: 28, color: '#fff' }} />,
      title: 'Protein Analysis',
      description: 'Structure analysis, binding site detection, and virtual screening with research-grade accuracy.',
    },
    {
      icon: <Speed sx={{ fontSize: 28, color: '#fff' }} />,
      title: 'High Performance',
      description: 'Optimized algorithms handle large proteins (10,000+ atoms) with efficient clustering and cavity detection.',
    },
    {
      icon: <SmartToy sx={{ fontSize: 28, color: '#fff' }} />,
      title: 'AI-Powered Insights',
      description: 'Built-in AI assistant analyzes your results and suggests next steps in the drug discovery pipeline.',
    },
  ];

  const steps = [
    { num: '01', title: 'Upload Structure', desc: 'Upload PDB files or fetch directly from the RCSB database' },
    { num: '02', title: 'Run Analysis', desc: 'Automated structure preparation and binding site detection' },
    { num: '03', title: 'Verify on Chain', desc: 'Results verified and stored on PureChain with IPFS' },
    { num: '04', title: 'Visualize & Export', desc: 'Interactive 3D viewer with binding site highlighting' },
  ];

  return (
    <Box>
      {/* Hero */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          color: 'white',
          py: { xs: 10, md: 14 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ maxWidth: 720, mx: 'auto', textAlign: 'center' }}>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 800,
                mb: 3,
                fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' },
                lineHeight: 1.15,
                letterSpacing: '-0.02em',
              }}
            >
              Blockchain-Verified{' '}
              <Box component="span" sx={{ color: '#4ade80' }}>
                Drug Discovery
              </Box>{' '}
              Platform
            </Typography>
            <Typography
              variant="h6"
              sx={{
                mb: 5,
                opacity: 0.7,
                fontWeight: 400,
                fontSize: { xs: '1rem', md: '1.15rem' },
                lineHeight: 1.6,
                maxWidth: 600,
                mx: 'auto',
              }}
            >
              The only protein analysis platform with unbreakable, auditable data provenance.
              From structure to lead compound — fully verifiable.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 5 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push('/signup')}
                endIcon={<ArrowForward />}
                sx={{
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  px: 4,
                  py: 1.5,
                  borderRadius: '100px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  '&:hover': { backgroundColor: '#15803d' },
                }}
              >
                Get Started Free
              </Button>
              <Button
                variant="outlined"
                size="large"
                href="#how-it-works"
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: 'white',
                  px: 4,
                  py: 1.5,
                  borderRadius: '100px',
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '1rem',
                  '&:hover': { borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.05)' },
                }}
              >
                Learn More
              </Button>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 3, md: 6 }, flexWrap: 'wrap' }}>
              {[
                { value: '500+', label: 'Researchers' },
                { value: '50k+', label: 'Analyses Run' },
                { value: '99.9%', label: 'Uptime' },
              ].map((stat) => (
                <Box key={stat.label} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#4ade80' }}>
                    {stat.value}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography
            variant="h3"
            component="h2"
            sx={{ fontWeight: 800, color: '#0f172a', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' } }}
          >
            Built for Serious Research
          </Typography>
          <Typography sx={{ color: '#64748b', maxWidth: 540, mx: 'auto', fontSize: '1.05rem' }}>
            Everything you need to go from protein structure to drug candidate, with full traceability.
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {features.map((feature, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card
                sx={{
                  height: '100%',
                  p: 1,
                  border: '1px solid #f1f5f9',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  borderRadius: 3,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.08)',
                  },
                }}
                elevation={0}
              >
                <CardContent>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 2.5,
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2.5,
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 1, fontSize: '1.05rem' }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* How It Works */}
      <Box id="how-it-works" sx={{ backgroundColor: '#f8fafc', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 800, color: '#0f172a', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' } }}
            >
              How It Works
            </Typography>
            <Typography sx={{ color: '#64748b', maxWidth: 480, mx: 'auto', fontSize: '1.05rem' }}>
              Four simple steps from raw structure to verified results.
            </Typography>
          </Box>
          <Grid container spacing={3} alignItems="stretch">
            {steps.map((step, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Box sx={{ textAlign: 'center', height: '100%' }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #16a34a, #15803d)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2.5,
                      fontWeight: 800,
                      fontSize: '1.1rem',
                    }}
                  >
                    {step.num}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', mb: 1, fontSize: '1rem' }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                    {step.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Highlights */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography
              variant="h3"
              component="h2"
              sx={{ fontWeight: 800, color: '#0f172a', mb: 3, fontSize: { xs: '1.75rem', md: '2.25rem' } }}
            >
              Every Result is{' '}
              <Box component="span" sx={{ color: '#16a34a' }}>Tamper-Proof</Box>
            </Typography>
            <Typography sx={{ color: '#64748b', mb: 4, lineHeight: 1.7, fontSize: '1.05rem' }}>
              ProtChain stores analysis hashes on PureChain and full results on IPFS.
              Anyone can independently verify that your published data has not been altered.
            </Typography>
            {[
              'Immutable blockchain receipts for every analysis stage',
              'IPFS-pinned results accessible via public gateway',
              'One-click verification with transaction explorer',
              'Meets FDA 21 CFR Part 11 data integrity guidance',
            ].map((item, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
                <CheckCircle sx={{ color: '#16a34a', fontSize: 20, mt: 0.3 }} />
                <Typography sx={{ color: '#1e293b', fontSize: '0.95rem' }}>{item}</Typography>
              </Box>
            ))}
          </Grid>
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                borderRadius: 4,
                p: 5,
                color: '#fff',
                textAlign: 'center',
              }}
            >
              <Verified sx={{ fontSize: 64, color: '#4ade80', mb: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                Blockchain Verified
              </Typography>
              <Typography sx={{ opacity: 0.6, fontSize: '0.9rem' }}>
                Every workflow stage is cryptographically hashed and committed to PureChain.
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* CTA */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          color: 'white',
          py: { xs: 8, md: 10 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="sm">
          <Typography
            variant="h4"
            component="h2"
            sx={{ fontWeight: 800, mb: 2, fontSize: { xs: '1.5rem', md: '2rem' } }}
          >
            Start Analyzing Proteins in Minutes
          </Typography>
          <Typography sx={{ mb: 4, opacity: 0.85, fontSize: '1.05rem' }}>
            Free to get started. No credit card required.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push('/signup')}
            endIcon={<ArrowForward />}
            sx={{
              backgroundColor: '#fff',
              color: '#16a34a',
              px: 5,
              py: 1.5,
              borderRadius: '100px',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '1.05rem',
              '&:hover': { backgroundColor: '#f0fdf4' },
            }}
          >
            Create Free Account
          </Button>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: '#0f172a', color: '#94a3b8', py: 6 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <Typography sx={{ fontWeight: 700, color: '#fff', mb: 1.5, fontSize: '1rem' }}>
                ProtChain
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.7, maxWidth: 280 }}>
                Blockchain-verified drug discovery platform for biotech researchers and government labs.
              </Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography sx={{ fontWeight: 600, color: '#e2e8f0', mb: 1.5, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Product
              </Typography>
              {['Workflows', 'Protein Analysis', 'CLI Tools', 'Organizations'].map((item) => (
                <Typography key={item} sx={{ fontSize: '0.85rem', mb: 0.75, cursor: 'pointer', '&:hover': { color: '#fff' } }}>
                  {item}
                </Typography>
              ))}
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography sx={{ fontWeight: 600, color: '#e2e8f0', mb: 1.5, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Resources
              </Typography>
              {['Documentation', 'API Reference', 'Status Page', 'Changelog'].map((item) => (
                <Typography key={item} sx={{ fontSize: '0.85rem', mb: 0.75, cursor: 'pointer', '&:hover': { color: '#fff' } }}>
                  {item}
                </Typography>
              ))}
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography sx={{ fontWeight: 600, color: '#e2e8f0', mb: 1.5, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Company
              </Typography>
              {['About', 'Blog', 'Careers', 'Contact'].map((item) => (
                <Typography key={item} sx={{ fontSize: '0.85rem', mb: 0.75, cursor: 'pointer', '&:hover': { color: '#fff' } }}>
                  {item}
                </Typography>
              ))}
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography sx={{ fontWeight: 600, color: '#e2e8f0', mb: 1.5, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Legal
              </Typography>
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((item) => (
                <Typography key={item} sx={{ fontSize: '0.85rem', mb: 0.75, cursor: 'pointer', '&:hover': { color: '#fff' } }}>
                  {item}
                </Typography>
              ))}
            </Grid>
          </Grid>
          <Box sx={{ borderTop: '1px solid #1e293b', pt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontSize: '0.8rem' }}>
              &copy; {new Date().getFullYear()} ProtChain. All rights reserved.
            </Typography>
            <Typography sx={{ fontSize: '0.8rem' }}>
              Blockchain-verified drug discovery
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

'use client';

import { Typography, Paper } from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';

export default function ProjectsDashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Drug Discovery Projects</h1>

      <Paper
        elevation={0}
        sx={{
          p: 6,
          textAlign: 'center',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <ScienceIcon sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Coming Soon
        </Typography>
        <Typography variant="body1" color="text.secondary">
          The Drug Discovery Projects feature is under active development.
          Use the Workflows page to run protein structure analysis and binding site detection.
        </Typography>
      </Paper>
    </div>
  );
}

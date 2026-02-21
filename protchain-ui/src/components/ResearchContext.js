'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Link,
  Button,
  Alert,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  MenuBook,
  Biotech,
  AccountTree,
  Language,
  Refresh,
} from '@mui/icons-material';

export default function ResearchContext({ pdbId, proteinName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchResearch = async () => {
    if (!pdbId) return;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ai/literature-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ pdb_id: pdbId, protein_name: proteinName }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to search literature');
      }

      setData(result.data || result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pdbId) {
      fetchResearch();
    }
  }, [pdbId]);

  if (!pdbId) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">
          PDB ID not available. Run structure analysis first to enable research context.
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
        <CircularProgress size={48} sx={{ mb: 2 }} />
        <Typography color="text.secondary">
          Searching PubMed, UniProt, and RCSB PDB...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button startIcon={<Refresh />} onClick={fetchResearch}>
          Retry Search
        </Button>
      </Box>
    );
  }

  if (!data) return null;

  const pubmed = data.pubmed || [];
  const uniprot = data.uniprot || [];
  const rcsb = data.rcsb || {};

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <MenuBook sx={{ color: '#1565c0' }} />
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Research Context for {pdbId.toUpperCase()}
        </Typography>
        <Button size="small" startIcon={<Refresh />} onClick={fetchResearch} sx={{ ml: 'auto' }}>
          Refresh
        </Button>
      </Box>

      {/* RCSB PDB Structure Info */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountTree sx={{ color: '#e65100' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              RCSB PDB Structure
            </Typography>
            {rcsb.resolution && (
              <Chip label={`${rcsb.resolution}Å`} size="small" color="primary" variant="outlined" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {rcsb.error ? (
            <Alert severity="warning">Could not fetch RCSB data: {rcsb.error}</Alert>
          ) : (
            <Table size="small">
              <TableBody>
                {rcsb.title && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Title</TableCell>
                    <TableCell>{rcsb.title}</TableCell>
                  </TableRow>
                )}
                {rcsb.experimental_method && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Method</TableCell>
                    <TableCell>{rcsb.experimental_method}</TableCell>
                  </TableRow>
                )}
                {rcsb.resolution && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Resolution</TableCell>
                    <TableCell>{rcsb.resolution} Å</TableCell>
                  </TableRow>
                )}
                {rcsb.polymer_entity_count > 0 && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Polymer Entities</TableCell>
                    <TableCell>{rcsb.polymer_entity_count}</TableCell>
                  </TableRow>
                )}
                {rcsb.deposited_atom_count > 0 && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Atom Count</TableCell>
                    <TableCell>{rcsb.deposited_atom_count.toLocaleString()}</TableCell>
                  </TableRow>
                )}
                {rcsb.molecular_weight && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Molecular Weight</TableCell>
                    <TableCell>{rcsb.molecular_weight.toLocaleString()} Da</TableCell>
                  </TableRow>
                )}
                {rcsb.deposit_date && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Deposited</TableCell>
                    <TableCell>{new Date(rcsb.deposit_date).toLocaleDateString()}</TableCell>
                  </TableRow>
                )}
                {rcsb.citation?.title && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Primary Citation</TableCell>
                    <TableCell>
                      {rcsb.citation.title}
                      {rcsb.citation.journal && ` — ${rcsb.citation.journal}`}
                      {rcsb.citation.year && ` (${rcsb.citation.year})`}
                    </TableCell>
                  </TableRow>
                )}
                {rcsb.url && (
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Link</TableCell>
                    <TableCell>
                      <Link href={rcsb.url} target="_blank" rel="noopener">
                        View on RCSB PDB
                      </Link>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </AccordionDetails>
      </Accordion>

      {/* UniProt Protein Function */}
      <Accordion defaultExpanded={uniprot.length > 0}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Biotech sx={{ color: '#2e7d32' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              UniProt Function & Disease
            </Typography>
            <Chip label={`${uniprot.length} entries`} size="small" variant="outlined" />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {uniprot.length === 0 ? (
            <Typography color="text.secondary">No UniProt entries found for {pdbId}.</Typography>
          ) : (
            uniprot.map((entry, idx) => (
              <Paper key={idx} sx={{ p: 2, mb: 2, backgroundColor: '#f8fdf8' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    {entry.protein_name}
                  </Typography>
                  <Link href={entry.url} target="_blank" rel="noopener" variant="caption">
                    {entry.accession}
                  </Link>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Chip label={entry.organism} size="small" variant="outlined" />
                  {entry.gene_names?.map((g) => (
                    <Chip key={g} label={g} size="small" color="primary" variant="outlined" />
                  ))}
                  {entry.sequence_length > 0 && (
                    <Chip label={`${entry.sequence_length} residues`} size="small" variant="outlined" />
                  )}
                </Box>

                {entry.functions?.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                      Function:
                    </Typography>
                    {entry.functions.map((f, i) => (
                      <Typography key={i} variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                        {f}
                      </Typography>
                    ))}
                  </Box>
                )}

                {entry.diseases?.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#c62828' }}>
                      Disease Associations:
                    </Typography>
                    {entry.diseases.map((d, i) => (
                      <Typography key={i} variant="body2" sx={{ mt: 0.5 }}>
                        <strong>{d.name}:</strong> {d.description}
                      </Typography>
                    ))}
                  </Box>
                )}

                {entry.subcellular_locations?.length > 0 && (
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                      Subcellular Location:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {entry.subcellular_locations.join(', ')}
                    </Typography>
                  </Box>
                )}
              </Paper>
            ))
          )}
        </AccordionDetails>
      </Accordion>

      {/* PubMed Papers */}
      <Accordion defaultExpanded={pubmed.length > 0}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Language sx={{ color: '#1565c0' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              PubMed Literature
            </Typography>
            <Chip label={`${pubmed.length} papers`} size="small" variant="outlined" />
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {pubmed.length === 0 ? (
            <Typography color="text.secondary">No PubMed papers found for {pdbId}.</Typography>
          ) : (
            pubmed.map((paper, idx) => (
              <Paper key={idx} sx={{ p: 2, mb: 1.5, backgroundColor: '#f5f9ff' }}>
                <Link
                  href={paper.url}
                  target="_blank"
                  rel="noopener"
                  variant="subtitle2"
                  sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}
                >
                  {paper.title}
                </Link>
                <Typography variant="caption" color="text.secondary">
                  {paper.authors}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Chip label={paper.journal} size="small" variant="outlined" />
                  {paper.year && <Chip label={paper.year} size="small" variant="outlined" />}
                  <Chip label={`PMID: ${paper.pmid}`} size="small" />
                </Box>
              </Paper>
            ))
          )}
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

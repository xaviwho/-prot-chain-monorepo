'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Drawer,
  Box,
  Typography,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import {
  Close,
  Send,
  SmartToy,
  Person,
  AutoAwesome,
  AttachFile,
} from '@mui/icons-material';

const SUGGESTED_QUESTIONS = [
  'Summarize my analysis results',
  'Which binding sites look most druggable?',
  'What does the druggability score mean?',
  'Suggest next steps for this protein',
  'Explain the structure properties',
];

export default function AIChatPanel({ open, onClose, workflowId, workflowResults, stage, workflow }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const MAX_FILE_SIZE = 500 * 1024; // 500KB

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      // Read anyway but will truncate
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      let content = e.target.result;
      const truncated = content.length > MAX_FILE_SIZE;
      if (truncated) {
        content = content.slice(0, MAX_FILE_SIZE);
      }
      setAttachedFile({
        name: file.name,
        content,
        type: file.name.split('.').pop().toLowerCase(),
        truncated,
      });
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    event.target.value = '';
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Prepare workflow context for the API
  const prepareContext = () => {
    const context = {
      workflowName: workflow?.name || '',
      pdbId: workflow?.pdb_id || workflow?.pdbId || '',
      stage: stage || '',
      status: workflow?.status || '',
    };

    if (!workflowResults) return context;

    // Extract relevant data based on current stage
    if (stage === 'binding_site_analysis' || stage === 'completed') {
      const sites = workflowResults.binding_sites ||
        workflowResults.binding_site_analysis?.binding_sites || [];
      context.bindingSites = sites.map((site, i) => ({
        id: site.id || site.pocket_id || i + 1,
        volume: site.volume,
        druggability_score: site.druggability || site.druggability_score || site.score,
        hydrophobicity: site.hydrophobicity || site.hydrophobic_ratio,
        center: site.center,
        nearby_residues: site.nearby_residues?.slice(0, 5),
      }));
    }

    if (stage === 'structure_preparation') {
      const descriptors = workflowResults.details?.descriptors ||
        workflowResults.data?.details?.descriptors ||
        workflowResults.descriptors || {};
      context.structureResults = descriptors;
    }

    // Try to extract PDB ID from results if not in workflow
    if (!context.pdbId) {
      context.pdbId = workflowResults.pdb_id || workflowResults.pdbId || '';
    }

    return context;
  };

  const sendMessage = async (text) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const currentFile = attachedFile;
    const userMessage = {
      role: 'user',
      content: messageText,
      ...(currentFile && { fileName: currentFile.name }),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setAttachedFile(null);
    setLoading(true);

    try {
      const payload = {
        message: messageText,
        history: messages,
        workflowContext: prepareContext(),
      };
      if (currentFile) {
        payload.fileContext = {
          name: currentFile.name,
          content: currentFile.content,
          type: currentFile.type,
        };
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #1a237e 0%, #4a148c 100%)',
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToy />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', lineHeight: 1.2 }}>
              ProtChain AI
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Protein Analysis Assistant
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: '#f5f5f5',
        }}
      >
        {messages.length === 0 ? (
          /* Empty state with suggested questions */
          <Box sx={{ textAlign: 'center', mt: 4 }}>
            <AutoAwesome sx={{ fontSize: 48, color: '#9c27b0', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Ask me anything about your analysis
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              I can help you understand your protein structure results, binding sites, and suggest next steps.
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Suggested questions:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <Chip
                  key={i}
                  label={q}
                  onClick={() => sendMessage(q)}
                  variant="outlined"
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'rgba(156, 39, 176, 0.08)' },
                    maxWidth: '100%',
                  }}
                />
              ))}
            </Box>
          </Box>
        ) : (
          /* Message list */
          messages.map((msg, idx) => (
            <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {msg.fileName && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 4 }}>
                  <Chip
                    icon={<AttachFile sx={{ fontSize: 14 }} />}
                    label={msg.fileName}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                </Box>
              )}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 1,
                }}
              >
                {msg.role === 'assistant' && (
                  <SmartToy sx={{ fontSize: 20, color: '#7c4dff', mt: 0.5, flexShrink: 0 }} />
                )}
                <Paper
                  sx={{
                    p: 1.5,
                    maxWidth: '80%',
                    backgroundColor: msg.role === 'user' ? '#1976d2' : 'white',
                    color: msg.role === 'user' ? 'white' : 'text.primary',
                    borderRadius: msg.role === 'user'
                      ? '16px 16px 4px 16px'
                      : '16px 16px 16px 4px',
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <Box
                      sx={{
                        fontSize: '0.875rem',
                        wordBreak: 'break-word',
                        '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                        '& h1, & h2, & h3': { mt: 1.5, mb: 0.5, fontSize: '0.95rem', fontWeight: 700 },
                        '& h2': { fontSize: '0.9rem' },
                        '& h3': { fontSize: '0.875rem' },
                        '& ul, & ol': { m: 0, pl: 2.5, mb: 1 },
                        '& li': { mb: 0.25 },
                        '& strong': { fontWeight: 700 },
                        '& code': {
                          backgroundColor: 'rgba(0,0,0,0.05)',
                          padding: '1px 4px',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '0.85em',
                        },
                        '& pre': {
                          backgroundColor: 'rgba(0,0,0,0.05)',
                          p: 1,
                          borderRadius: 1,
                          overflow: 'auto',
                          '& code': { backgroundColor: 'transparent', p: 0 },
                        },
                        '& hr': { my: 1, border: 'none', borderTop: '1px solid rgba(0,0,0,0.12)' },
                      }}
                    >
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </Box>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </Typography>
                  )}
                </Paper>
                {msg.role === 'user' && (
                  <Person sx={{ fontSize: 20, color: '#1976d2', mt: 0.5, flexShrink: 0 }} />
                )}
              </Box>
            </Box>
          ))
        )}

        {/* Loading indicator */}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToy sx={{ fontSize: 20, color: '#7c4dff' }} />
            <Paper sx={{ p: 1.5, borderRadius: '16px 16px 16px 4px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  Thinking...
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'white',
        }}
      >
        {/* Attached file chip */}
        {attachedFile && (
          <Box sx={{ mb: 1 }}>
            <Chip
              icon={<AttachFile sx={{ fontSize: 16 }} />}
              label={attachedFile.truncated ? `${attachedFile.name} (truncated)` : attachedFile.name}
              onDelete={() => setAttachedFile(null)}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ maxWidth: '100%' }}
            />
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.txt,.pdb,.sdf,.mol2"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            sx={{
              color: attachedFile ? '#1976d2' : '#9e9e9e',
              width: 40,
              height: 40,
              flexShrink: 0,
            }}
            title="Attach file"
          >
            <AttachFile fontSize="small" />
          </IconButton>
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={4}
            size="small"
            placeholder="Ask about your protein analysis..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '20px',
              },
            }}
          />
          <IconButton
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            sx={{
              backgroundColor: '#1976d2',
              color: 'white',
              '&:hover': { backgroundColor: '#1565c0' },
              '&.Mui-disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' },
              width: 40,
              height: 40,
              flexShrink: 0,
            }}
          >
            <Send fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
}

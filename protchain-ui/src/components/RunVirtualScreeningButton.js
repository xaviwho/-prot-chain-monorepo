import React, { useState } from 'react';
import { Button, CircularProgress, Box, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

const RunVirtualScreeningButton = ({ workflowId, onSuccess, onError, disabled }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const runVirtualScreening = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/workflow/${workflowId}/virtual-screening`, {
                method: 'POST',
                // TODO: Add request body if needed (e.g., compound library selection)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to run virtual screening: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Virtual Screening initiated successfully:', data);
            if (onSuccess) {
                onSuccess(data); // Pass the updated results data back
            }
        } catch (err) {
            console.error('Error running virtual screening:', err);
            setError(err.message);
            if (onError) {
                onError(err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Button
                variant="contained"
                color="primary"
                onClick={runVirtualScreening}
                disabled={loading || disabled}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
            >
                {loading ? 'Running Screening...' : 'Run Virtual Screening'}
            </Button>
            {error && (
                <Typography color="error" variant="caption">
                    Error: {error}
                </Typography>
            )}
        </Box>
    );
};

export default RunVirtualScreeningButton;

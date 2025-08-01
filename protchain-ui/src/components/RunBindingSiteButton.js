'use client';

import { useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';

/**
 * A reusable button component for running binding site analysis
 */
export default function RunBindingSiteButton({ workflowId, onSuccess, variant = "contained" }) {
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  
  const runBindingSiteAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call the direct binding site analysis endpoint
      console.log(`Running binding site analysis for workflow ${workflowId}...`);
      const response = await fetch(`/api/workflow/${workflowId}/direct-binding-site-analysis`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to run binding site analysis: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Binding site analysis completed successfully:', data);
      
      // Show success message
      setShowSuccess(true);
      
      // Wait a moment to ensure the results are saved
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch the latest results to update the UI
      try {
        const refreshRes = await fetch(`/api/workflow/${workflowId}/refresh-results`);
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          console.log('Refreshed results:', refreshData);
          
          // Make sure we have binding site data in the correct format
          if (!refreshData.binding_site_analysis && data.binding_sites) {
            refreshData.binding_site_analysis = {
              binding_sites: data.binding_sites,
              method: data.method || 'reliable_python',
              timestamp: new Date().toISOString()
            };
          }
          
          // Call the success callback with the refreshed data
          if (onSuccess) {
            onSuccess(refreshData);
          }
          
          // Force a page reload if we don't see the binding sites in the UI
          setTimeout(() => {
            const bindingSiteContent = document.querySelector('[role="tabpanel"][aria-labelledby="binding-sites-tab"]');
            if (bindingSiteContent && bindingSiteContent.textContent.includes('No binding site data available')) {
              console.log('Binding site data not showing in UI, forcing page reload...');
              window.location.reload();
            }
          }, 2000);
        }
      } catch (refreshError) {
        console.error('Error refreshing results:', refreshError);
      }
      
      // Force navigation to the binding sites tab
      const bindingSitesTab = document.querySelector('[role="tab"][aria-label="BINDING SITES"]');
      if (bindingSitesTab) {
        bindingSitesTab.click();
      }
      
    } catch (error) {
      console.error('Error running binding site analysis:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Button
        variant={variant}
        color="primary"
        onClick={runBindingSiteAnalysis}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} /> : null}
      >
        {loading ? 'Running Analysis...' : 'RUN BINDING SITE ANALYSIS'}
      </Button>
      
      {/* Success message */}
      <Snackbar 
        open={showSuccess} 
        autoHideDuration={6000} 
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSuccess(false)} severity="success" sx={{ width: '100%' }}>
          Binding site analysis completed successfully! View results in the Binding Sites tab.
        </Alert>
      </Snackbar>
      
      {/* Error message */}
      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}

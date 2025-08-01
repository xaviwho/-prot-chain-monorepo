import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(request, { params }) {
  const { id } = await Promise.resolve(params);
  // Look in uploads directory instead of workflows
  const workflowsDir = path.join(process.cwd(), '..', 'uploads');
  const workflowDir = path.join(workflowsDir, id);
  
  try {
    // First try to fetch from backend
    const bioApiUrl = 'http://localhost:8000';
    console.log('Fetching workflow status from:', `${bioApiUrl}/api/v1/workflows/${id}/status`);
    
    try {
      const response = await fetch(`${bioApiUrl}/api/v1/workflows/${id}/status`);
      
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
      
      // If backend returns "Workflow not found", we'll fall back to local files
      console.log(`Backend couldn't find workflow ${id}, falling back to local files`);
    } catch (backendError) {
      console.log(`Error connecting to backend: ${backendError.message}, falling back to local files`);
    }
    
    // Fallback: Check if we have local files for this workflow
    try {
      await fs.access(workflowDir);
      
      // Try to read results.json if it exists
      const resultsPath = path.join(workflowDir, 'results.json');
      let resultsData = {};
      
      try {
        const resultsContent = await fs.readFile(resultsPath, 'utf-8');
        resultsData = JSON.parse(resultsContent);
      } catch (e) {
        console.log(`No results.json found for workflow ${id} or invalid JSON`);
      }
      
      // Determine workflow status based on local files
      const files = await fs.readdir(workflowDir);
      
      // Construct a response similar to what the backend would provide
      const localStatus = {
        id: id,
        status: resultsData.status || 'COMPLETED', // Assume completed if we have a directory
        name: resultsData.name || `Local Workflow ${id}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Construct steps based on what we know locally
        steps: [
          {
            id: 'structure_preparation',
            status: files.some(f => f.endsWith('.pdb')) ? 'completed' : 'pending',
            name: 'Structure Preparation'
          },
          {
            id: 'binding_site_analysis',
            status: resultsData.binding_site_analysis || resultsData.binding_sites ? 'completed' : 'pending',
            name: 'Binding Site Analysis'
          },
          {
            id: 'virtual_screening',
            status: resultsData.virtual_screening ? 'completed' : 'pending',
            name: 'Virtual Screening'
          },
          {
            id: 'molecular_dynamics',
            status: resultsData.molecular_dynamics ? 'completed' : 'pending',
            name: 'Molecular Dynamics'
          },
          {
            id: 'lead_optimization',
            status: resultsData.lead_optimization ? 'completed' : 'pending',
            name: 'Lead Optimization'
          }
        ]
      };
      
      console.log(`Returning local status for workflow ${id}`);
      return NextResponse.json(localStatus);
    } catch (fsError) {
      // If we can't access the workflow directory, it truly doesn't exist
      console.error(`Workflow directory ${workflowDir} not found:`, fsError);
      return NextResponse.json(
        { error: 'Workflow not found locally or on backend' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error in workflow status API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow status' },
      { status: error.response?.status || 500 }
    );
  }
}

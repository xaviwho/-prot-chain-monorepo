import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(request, { params }) {
  const { id } = await Promise.resolve(params);
  const workflowsDir = path.join(process.cwd(), '..', 'uploads');
  const workflowDir = path.join(workflowsDir, id);
  const resultsFilePath = path.join(workflowDir, 'results.json');
  
  try {
    // First try to fetch from backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    console.log('Fetching workflow results from:', `${apiUrl}/api/v1/workflows/${id}/results`);
    
    try {
      const response = await fetch(`${apiUrl}/api/v1/workflows/${id}/results`);
      
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
      
      // If backend returns error, we'll fall back to local files
      console.log(`Backend couldn't find workflow results for ${id}, falling back to local files`);
    } catch (backendError) {
      console.log(`Error connecting to backend: ${backendError.message}, falling back to local files`);
    }
    
    // Fallback: Check if we have local results.json for this workflow
    try {
      console.log(`Looking for local results file at: ${resultsFilePath}`);
      const resultsContent = await fs.readFile(resultsFilePath, 'utf-8');
      const resultsData = JSON.parse(resultsContent);
      
      console.log(`Successfully read local results for workflow ${id}`);
      return NextResponse.json(resultsData);
    } catch (fsError) {
      console.error(`Results file not found for workflow ${id}:`, fsError);
      return NextResponse.json(
        { error: 'Workflow results not found locally or on backend' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error fetching workflow results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow results' },
      { status: error.response?.status || 500 }
    );
  }
}

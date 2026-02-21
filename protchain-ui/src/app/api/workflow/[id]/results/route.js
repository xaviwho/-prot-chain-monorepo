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
    
    try {
      const authHeader = request.headers.get('authorization');
      const headers = {};
      if (authHeader) headers['Authorization'] = authHeader;

      const response = await fetch(`${apiUrl}/api/v1/workflows/${id}/results`, { headers });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json(data);
      }
      
      // If backend returns error, we'll fall back to local files
    } catch (backendError) {
    }
    
    // Fallback: Check if we have local results.json for this workflow
    try {
      const resultsContent = await fs.readFile(resultsFilePath, 'utf-8');
      const resultsData = JSON.parse(resultsContent);
      
      return NextResponse.json(resultsData);
    } catch (fsError) {
      return NextResponse.json(
        { error: 'Workflow results not found locally or on backend' },
        { status: 404 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch workflow results' },
      { status: error.response?.status || 500 }
    );
  }
}

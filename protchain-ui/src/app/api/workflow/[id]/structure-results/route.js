import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const { id } = await Promise.resolve(params);
  
  try {
    // First try the direct API approach
    const bioApiUrl = 'http://localhost:8000';
    console.log('Fetching workflow results from:', `${bioApiUrl}/api/v1/workflows/${id}/results`);
    
    const response = await fetch(`${bioApiUrl}/api/v1/workflows/${id}/results`);
    
    if (response.ok) {
      const data = await response.json();
      
      // If we have the STRUCTURE_PREPARATION key, return it directly
      if (data && data.STRUCTURE_PREPARATION) {
        return NextResponse.json(data);
      }
    }
    
    // If the API didn't return the structure data, try to read the results.json file directly
    console.log('Attempting to read results.json directly for workflow:', id);
    
    // Path to the structures directory
    const structuresDir = path.join(process.cwd(), '..', 'uploads', 'structures', id);
    const resultsFile = path.join(structuresDir, 'results.json');
    
    console.log('Looking for results file at:', resultsFile);
    
    if (fs.existsSync(resultsFile)) {
      const fileContent = fs.readFileSync(resultsFile, 'utf8');
      const structureData = JSON.parse(fileContent);
      console.log('Found structure data:', structureData);
      return NextResponse.json(structureData);
    }
    
    return NextResponse.json(
      { error: 'Structure results not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching structure results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch structure results' },
      { status: error.response?.status || 500 }
    );
  }
}

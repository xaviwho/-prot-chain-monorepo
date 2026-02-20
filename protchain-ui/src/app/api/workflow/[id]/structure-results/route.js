import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const { id } = await Promise.resolve(params);
  
  try {
    // First try the direct API approach
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    
    const response = await fetch(`${apiUrl}/api/v1/workflows/${id}/results`);
    
    if (response.ok) {
      const data = await response.json();
      
      // If we have the STRUCTURE_PREPARATION key, return it directly
      if (data && data.STRUCTURE_PREPARATION) {
        return NextResponse.json(data);
      }
    }
    
    // If the API didn't return the structure data, try to read the results.json file directly
    
    // Path to the structures directory
    const structuresDir = path.join(process.cwd(), '..', 'uploads', 'structures', id);
    const resultsFile = path.join(structuresDir, 'results.json');
    
    
    if (fs.existsSync(resultsFile)) {
      const fileContent = fs.readFileSync(resultsFile, 'utf8');
      const structureData = JSON.parse(fileContent);
      return NextResponse.json(structureData);
    }
    
    return NextResponse.json(
      { error: 'Structure results not found' },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch structure results' },
      { status: error.response?.status || 500 }
    );
  }
}

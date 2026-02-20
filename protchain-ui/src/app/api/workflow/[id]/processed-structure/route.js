import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const { id } = await Promise.resolve(params);
  
  
  try {
    // Try multiple possible paths to find the processed PDB file
    const possiblePaths = [
      // Current project structure: root uploads directory
      path.join(process.cwd(), '..', 'uploads', id, 'processed.pdb'),
      // Alternative: check for original PDB file
      path.join(process.cwd(), '..', 'uploads', id, `${id}.pdb`),
      // Legacy paths for backward compatibility
      path.join(process.cwd(), '..', 'uploads', 'structures', id, 'processed.pdb'),
      path.join('c:', 'Users', 'Xavie', 'CascadeProjects', 'prot-chain-monorepo', 'uploads', id, 'processed.pdb'),
      path.join('c:', 'Users', 'Xavie', 'CascadeProjects', 'prot-chain-monorepo', 'uploads', id, `${id}.pdb`),
    ];
    
    let pdbContent = null;
    let foundPath = null;
    
    // Try each path until we find one that exists
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        pdbContent = fs.readFileSync(filePath, 'utf8');
        foundPath = filePath;
        break;
      }
    }
    
    if (pdbContent) {
      // Return the PDB content as plain text
      return new Response(pdbContent, {
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
    
    return NextResponse.json(
      { error: 'Processed structure not found' },
      { status: 404 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch processed structure' },
      { status: error.response?.status || 500 }
    );
  }
}

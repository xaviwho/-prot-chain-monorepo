import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Look for PDB file in workflow uploads directory
    const uploadsDir = path.join(process.cwd(), '..', 'uploads', id);
    const pdbPath = path.join(uploadsDir, 'input.pdb');
    
    if (!fs.existsSync(pdbPath)) {
      return NextResponse.json({ error: 'PDB file not found' }, { status: 404 });
    }

    // Read and return PDB file content
    const pdbContent = fs.readFileSync(pdbPath, 'utf8');
    
    return new NextResponse(pdbContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });

  } catch (error) {
    console.error('PDB file retrieval error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retrieve PDB file' },
      { status: 500 }
    );
  }
}
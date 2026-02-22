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
      // Input PDB saved during structure preparation
      path.join(process.cwd(), '..', 'uploads', id, 'input.pdb'),
      // Alternative: check for original PDB file
      path.join(process.cwd(), '..', 'uploads', id, `${id}.pdb`),
      // Legacy paths for backward compatibility
      path.join(process.cwd(), '..', 'uploads', 'structures', id, 'processed.pdb'),
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

    // Fallback: try to get PDB ID from pdb-info.json and fetch from RCSB
    if (!pdbContent) {
      const pdbInfoPath = path.join(process.cwd(), '..', 'uploads', id, 'pdb-info.json');
      if (fs.existsSync(pdbInfoPath)) {
        try {
          const pdbInfo = JSON.parse(fs.readFileSync(pdbInfoPath, 'utf8'));
          if (pdbInfo.pdb_id) {
            const rcsbResponse = await fetch(`https://files.rcsb.org/download/${pdbInfo.pdb_id}.pdb`);
            if (rcsbResponse.ok) {
              pdbContent = await rcsbResponse.text();
              // Save for future use
              const inputPath = path.join(process.cwd(), '..', 'uploads', id, 'input.pdb');
              fs.writeFileSync(inputPath, pdbContent);
            }
          }
        } catch (_) {}
      }
    }

    if (pdbContent) {
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

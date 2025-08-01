import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { id } = params;
  
  try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/pdb/${id}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDB file: ${response.statusText}`);
    }
    
    const pdbData = await response.text();
    return new NextResponse(pdbData, {
      headers: {
        'Content-Type': 'chemical/x-pdb',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error fetching PDB:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDB file' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const { id } = params;
  
  try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/pdb/${id}/analysis`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch PDB analysis: ${response.statusText}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching PDB analysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PDB analysis' },
      { status: 500 }
    );
  }
}

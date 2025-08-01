import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const bioApiUrl = 'http://localhost:8000';
    console.log('Fetching workflows from:', `${bioApiUrl}/api/v1/workflows/templates`);

    // Call the bioapi endpoint
    const res = await fetch(`${bioApiUrl}/api/v1/workflows/templates`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch workflows');
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

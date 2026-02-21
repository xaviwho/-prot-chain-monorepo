import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const authHeader = request.headers.get('authorization');
    const headers = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    // Call the bioapi endpoint
    const res = await fetch(`${apiUrl}/api/v1/workflows/templates`, {
      headers,
    });

    if (!res.ok) {
      throw new Error('Failed to fetch workflows');
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

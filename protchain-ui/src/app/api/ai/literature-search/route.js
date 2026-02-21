import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function POST(request) {
  try {
    const body = await request.json();
    const token = request.headers.get('Authorization') || '';

    const response = await fetch(`${API_URL}/api/v1/literature/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Failed to search literature' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Literature search proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to literature search service' },
      { status: 500 }
    );
  }
}

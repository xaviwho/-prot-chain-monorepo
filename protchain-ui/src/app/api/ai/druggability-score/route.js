import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function POST(request) {
  try {
    const body = await request.json();
    const token = request.headers.get('Authorization') || '';

    const response = await fetch(`${API_URL}/api/v1/binding/ai-druggability-score`, {
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
        { error: data.error || 'Failed to get AI druggability score' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('AI Druggability proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to AI scoring service' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function POST(request) {
  try {
    const url = `${BACKEND_URL}/api/v1/auth/register`;
    const body = await request.text();

    console.log('Proxying register request to Go backend:', url);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
    });

    console.log('Go backend register response status:', resp.status);

    const text = await resp.text();
    console.log('Go backend register response:', text);

    let json;
    try { 
      json = text ? JSON.parse(text) : null; 
    } catch (_) { 
      json = { error: text || 'Invalid JSON response from backend' }; 
    }

    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    console.error('Proxy register failed:', error);
    return NextResponse.json({ error: 'Failed to register with backend' }, { status: 500 });
  }
}

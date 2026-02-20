import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function POST(request) {
  try {
    const url = `${BACKEND_URL}/api/v1/auth/login`;
    const body = await request.text();


    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body,
    });


    const text = await resp.text();

    let json;
    try { 
      json = text ? JSON.parse(text) : null; 
    } catch (_) { 
      json = { error: text || 'Invalid JSON response from backend' }; 
    }

    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to authenticate with backend' }, { status: 500 });
  }
}

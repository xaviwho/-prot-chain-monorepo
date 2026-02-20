import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function GET(request) {
  try {
    const url = `${BACKEND_URL}/api/v1/workflows`;
    let auth = request.headers.get('authorization') || '';
    
    // If no auth header, try to get token from cookies
    if (!auth) {
      const cookies = request.headers.get('cookie') || '';
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch) {
        auth = `Bearer ${tokenMatch[1]}`;
      }
    }


    const resp = await fetch(url, {
      headers: { authorization: auth },
      cache: 'no-store',
    });

    
    const text = await resp.text();
    
    let json;
    try { 
      json = text ? JSON.parse(text) : null; 
    } catch (e) { 
      json = { error: text || 'Invalid JSON' }; 
    }
    
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const url = `${BACKEND_URL}/api/v1/workflows`;
    let auth = request.headers.get('authorization') || '';
    
    // If no auth header, try to get token from cookies
    if (!auth) {
      const cookies = request.headers.get('cookie') || '';
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch) {
        auth = `Bearer ${tokenMatch[1]}`;
      }
    }
    
    const body = await request.text();

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: auth,
        'content-type': 'application/json',
      },
      body,
    });

    const text = await resp.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = { error: text || 'Invalid JSON' }; }
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
  }
}

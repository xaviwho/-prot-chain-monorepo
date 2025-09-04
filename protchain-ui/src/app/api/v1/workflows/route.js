import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8082';

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
        console.log('API Route: Using token from cookies');
      }
    }

    console.log('API Route: Forwarding GET workflows request to backend:', url);
    console.log('API Route: Using auth header:', auth ? 'Bearer token present' : 'No auth token');

    const resp = await fetch(url, {
      headers: { authorization: auth },
      cache: 'no-store',
    });

    console.log('API Route: Backend responded with status:', resp.status);
    
    const text = await resp.text();
    console.log('API Route: Raw response text:', text);
    
    let json;
    try { 
      json = text ? JSON.parse(text) : null; 
      console.log('API Route: Parsed JSON:', json);
    } catch (e) { 
      console.error('API Route: Failed to parse JSON:', e);
      json = { error: text || 'Invalid JSON' }; 
    }
    
    console.log('API Route: Returning data to client');
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    console.error('Proxy GET /workflows failed:', error);
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
        console.log('API Route: Using token from cookies for POST');
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
    console.error('Proxy POST /workflows failed:', error);
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
  }
}

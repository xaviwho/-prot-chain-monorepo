import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const url = `${BACKEND_URL}/api/v1/workflows/${encodeURIComponent(id)}`;
    const auth = request.headers.get('authorization') || '';

    const resp = await fetch(url, {
      method: 'DELETE',
      headers: { authorization: auth },
    });

    const text = await resp.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = { error: text || 'Invalid JSON' }; }
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    console.error('Proxy DELETE /workflows/:id failed:', error);
    return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const url = `${BACKEND_URL}/api/v1/workflows/${encodeURIComponent(id)}`;
    let auth = request.headers.get('authorization') || '';
    
    // If no auth header, try to get token from cookies
    if (!auth) {
      const cookies = request.headers.get('cookie') || '';
      const tokenMatch = cookies.match(/token=([^;]+)/);
      if (tokenMatch) {
        auth = `Bearer ${tokenMatch[1]}`;
        console.log('API Route: Using token from cookies for workflow GET');
      }
    }

    console.log('API Route: Fetching workflow:', url);
    console.log('API Route: Using auth header:', auth ? 'Bearer token present' : 'No auth token');

    const resp = await fetch(url, {
      headers: { authorization: auth },
      cache: 'no-store',
    });

    const text = await resp.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = { error: text || 'Invalid JSON' }; }
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    console.error('Proxy GET /workflows/:id failed:', error);
    return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 });
  }
}

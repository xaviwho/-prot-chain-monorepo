import { NextResponse } from 'next/server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

function proxyHeaders(request) {
  const headers = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

// GET /api/v1/teams/organizations — List user's organizations
export async function GET(request) {
  try {
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations`, {
      headers: proxyHeaders(request),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('List organizations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organizations' },
      { status: 502 }
    );
  }
}

// POST /api/v1/teams/organizations — Create organization
export async function POST(request) {
  try {
    const body = await request.text();
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations`, {
      method: 'POST',
      headers: proxyHeaders(request),
      body,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Create organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create organization' },
      { status: 502 }
    );
  }
}

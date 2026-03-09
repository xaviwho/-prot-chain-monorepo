import { NextResponse } from 'next/server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

function proxyHeaders(request) {
  const headers = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

// GET /api/v1/teams/invitations — List pending invitations for user
export async function GET(request) {
  try {
    const response = await fetch(`${apiUrl}/api/v1/teams/invitations`, {
      headers: proxyHeaders(request),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('List invitations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch invitations' },
      { status: 502 }
    );
  }
}

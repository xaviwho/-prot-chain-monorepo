import { NextResponse } from 'next/server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

function proxyHeaders(request) {
  const headers = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

// GET /api/v1/teams/organizations/[id]/teams — List teams in organization
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations/${id}/teams`, {
      headers: proxyHeaders(request),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('List teams error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams' },
      { status: 502 }
    );
  }
}

// POST /api/v1/teams/organizations/[id]/teams — Create team
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.text();
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations/${id}/teams`, {
      method: 'POST',
      headers: proxyHeaders(request),
      body,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Create team error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create team' },
      { status: 502 }
    );
  }
}

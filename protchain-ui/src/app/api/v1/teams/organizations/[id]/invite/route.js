import { NextResponse } from 'next/server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

function proxyHeaders(request) {
  const headers = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

// POST /api/v1/teams/organizations/[id]/invite — Invite user to organization
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.text();
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations/${id}/invite`, {
      method: 'POST',
      headers: proxyHeaders(request),
      body,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Invite to organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send invitation' },
      { status: 502 }
    );
  }
}

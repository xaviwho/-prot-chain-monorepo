import { NextResponse } from 'next/server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

function proxyHeaders(request) {
  const headers = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

// GET /api/v1/teams/organizations/[id]/members — List organization members
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations/${id}/members`, {
      headers: proxyHeaders(request),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('List members error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch members' },
      { status: 502 }
    );
  }
}

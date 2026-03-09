import { NextResponse } from 'next/server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

function proxyHeaders(request) {
  const headers = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

// GET /api/v1/teams/organizations/[id] — Get organization details
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations/${id}`, {
      headers: proxyHeaders(request),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organization' },
      { status: 502 }
    );
  }
}

// PUT /api/v1/teams/organizations/[id] — Update organization
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.text();
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations/${id}`, {
      method: 'PUT',
      headers: proxyHeaders(request),
      body,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update organization' },
      { status: 502 }
    );
  }
}

// DELETE /api/v1/teams/organizations/[id] — Delete organization
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const response = await fetch(`${apiUrl}/api/v1/teams/organizations/${id}`, {
      method: 'DELETE',
      headers: proxyHeaders(request),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Delete organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete organization' },
      { status: 502 }
    );
  }
}

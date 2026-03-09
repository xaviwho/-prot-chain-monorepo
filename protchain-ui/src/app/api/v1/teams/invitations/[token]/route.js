import { NextResponse } from 'next/server';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

function proxyHeaders(request) {
  const headers = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  return headers;
}

// POST /api/v1/teams/invitations/[token] — Accept or decline invitation
// Body: { action: 'accept' | 'decline' }
export async function POST(request, { params }) {
  try {
    const { token } = await params;
    const { action } = await request.json();

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json(
        { success: false, error: 'Action must be "accept" or "decline"' },
        { status: 400 }
      );
    }

    const response = await fetch(`${apiUrl}/api/v1/teams/invitations/${token}/${action}`, {
      method: 'POST',
      headers: proxyHeaders(request),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Invitation action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process invitation' },
      { status: 502 }
    );
  }
}

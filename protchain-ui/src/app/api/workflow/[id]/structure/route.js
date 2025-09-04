import { NextResponse } from 'next/server';

// The bioapi service URL, should be in an env var but hardcoded for now
const BIOAPI_URL = process.env.BIOAPI_URL || 'http://bioapi:8000';

export async function POST(request, { params }) {
  const { id: workflowId } = await params;

  // 1) Validate params
  if (!workflowId) {
    return NextResponse.json({ error: 'Missing workflow id' }, { status: 400 });
  }

  // 2) Safely parse JSON body
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    try {
      const raw = await request.text();
      if (raw && raw.trim().length > 0) {
        return NextResponse.json(
          { error: 'Malformed JSON body', details: raw.slice(0, 500) },
          { status: 400 }
        );
      }
    } catch (_) {
      // ignore
    }
  }

  // 2b) Normalize known field variants for compatibility
  // - Accept 'pdbId' (frontend camelCase) and map to 'pdb_id' (bioapi expects snake_case)
  // - Accept 'filePath' and map to 'file_path'
  if (body && typeof body === 'object') {
    if (body.pdbId && !body.pdb_id) {
      body.pdb_id = body.pdbId;
    }
    if (body.filePath && !body.file_path) {
      body.file_path = body.filePath;
    }
  }

  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json(
      { error: 'Request body required', hint: 'Include fields like pdbId or file_path depending on bioapi expectations.' },
      { status: 400 }
    );
  }

  // 3) Forward Authorization header if present
  const incomingAuth = request.headers.get('authorization');

  // 4) Timeout
  const controller = new AbortController();
  const timeoutMs = 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${BIOAPI_URL}/api/v1/workflows/${encodeURIComponent(workflowId)}/structure`;
    const backendResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(incomingAuth ? { Authorization: incomingAuth } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = backendResponse.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!backendResponse.ok) {
      const errorPayload = isJson ? await backendResponse.json().catch(() => null) : null;
      const errorText = !errorPayload ? await backendResponse.text().catch(() => '') : '';

      if (errorPayload) {
        return NextResponse.json(errorPayload, { status: backendResponse.status });
      }
      return new NextResponse(errorText || 'Upstream error', { status: backendResponse.status });
    }

    const data = isJson ? await backendResponse.json() : await backendResponse.text();
    return isJson ? NextResponse.json(data) : new NextResponse(data);
  } catch (err) {
    clearTimeout(timeout);

    if (err?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Upstream timeout', timeout_ms: timeoutMs },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Add default workflow name and template if not provided
    if (!body.name) {
      body.name = `Workflow-${new Date().toISOString().slice(0, 10)}`;
    }
    if (!body.template) {
      body.template = 'amyloid_prediction.yaml';
    }

    const bioApiUrl = 'http://localhost:8000';
    console.log('Creating workflow at:', `${bioApiUrl}/api/v1/workflows`);
    
    // Call the bioapi endpoint
    const res = await fetch(`${bioApiUrl}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    
    if (!res.ok) {
      console.error('BioAPI error:', data);
      return NextResponse.json(
        { error: data.detail || 'Failed to start workflow' },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error starting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow' },
      { status: 500 }
    );
  }
}

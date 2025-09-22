import { NextResponse } from 'next/server';

/**
 * POST handler for starting binding site analysis
 */
export async function POST(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  try {
    // Call the backend API to start binding site analysis
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const response = await fetch(`${apiUrl}/api/v1/workflows/${id}/binding-site-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Try to get more detailed error information
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          throw new Error(`Backend error: ${errorData.detail}`);
        }
      } catch (parseError) {
        // If we can't parse the error response, use a generic message
        console.error('Error parsing error response:', parseError);
      }
      
      // Use status-specific error messages
      if (response.status === 400) {
        throw new Error('Invalid request: The workflow may not be in the correct state for binding site analysis');
      } else if (response.status === 404) {
        throw new Error('Workflow not found: This workflow needs to be registered with the backend system');
      } else {
        throw new Error(`Failed to start binding site analysis: ${response.status}`);
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error starting binding site analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start binding site analysis' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

/**
 * GET handler for checking if a workflow exists in the backend
 */
export async function GET(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  try {
    // Call the backend API to check if the workflow exists
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/workflows/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If response is 404, the workflow doesn't exist in the backend
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Workflow not found in backend system' },
          { status: 404 }
        );
      }
      
      throw new Error(`Failed to check workflow: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check workflow' },
      { status: 500 }
    );
  }
}

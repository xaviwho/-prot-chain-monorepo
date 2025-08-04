import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJWTSecret } from '@/lib/jwt-config';

const JWT_SECRET = getJWTSecret();

// Validate JWT token (temporarily bypassed for debugging)
function validateToken(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Return a mock user for development
      console.log('No auth header, returning mock user');
      return { user_id: 'dev-user-1', email: 'test@example.com', name: 'Development User' };
    }

    const token = authHeader.substring(7);
    
    // Try to decode the token to get user info
    try {
      const decoded = jwt.decode(token); // Decode without verification
      if (decoded && decoded.user_id) {
        console.log('Using decoded token data:', decoded.user_id);
        return decoded;
      }
    } catch (decodeError) {
      console.log('Token decode failed, using mock user');
    }
    
    // Fallback to mock user for development
    return { user_id: 'dev-user-1', email: 'test@example.com', name: 'Development User' };
  } catch (error) {
    console.error('JWT validation error (bypassed):', error);
    // Return mock user instead of null to allow development
    return { user_id: 'dev-user-1', email: 'test@example.com', name: 'Development User' };
  }
}

export async function GET(request) {
  try {
    // Validate authentication
    const user = validateToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    console.log('Authenticated user:', user.user_id);

    // For now, return mock workflow data
    // In production, this would fetch from the Go backend
    const mockWorkflows = [
      {
        id: '1',
        name: 'Protein Structure Analysis',
        description: 'Comprehensive protein structure analysis workflow',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        user_id: user.user_id,
        stages: [
          { name: 'Structure Preparation', completed: false },
          { name: 'Binding Site Analysis', completed: false },
          { name: 'Virtual Screening', completed: false },
          { name: 'Lead Optimization', completed: false },
          { name: 'Results Analysis', completed: false }
        ]
      },
      {
        id: '2',
        name: 'Drug Discovery Pipeline',
        description: 'End-to-end drug discovery workflow',
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        updated_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        status: 'completed',
        user_id: user.user_id,
        stages: [
          { name: 'Structure Preparation', completed: true },
          { name: 'Binding Site Analysis', completed: true },
          { name: 'Virtual Screening', completed: true },
          { name: 'Lead Optimization', completed: true },
          { name: 'Results Analysis', completed: true }
        ]
      }
    ];

    return NextResponse.json(mockWorkflows);
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Validate authentication
    const user = validateToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or missing authentication token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Workflow name is required' },
        { status: 400 }
      );
    }

    // Create new workflow
    const newWorkflow = {
      id: Date.now().toString(),
      name,
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
      user_id: user.user_id,
      stages: [
        { name: 'Structure Preparation', completed: false },
        { name: 'Binding Site Analysis', completed: false },
        { name: 'Virtual Screening', completed: false },
        { name: 'Lead Optimization', completed: false },
        { name: 'Results Analysis', completed: false }
      ]
    };

    console.log('Created new workflow:', newWorkflow);

    return NextResponse.json(newWorkflow, { status: 201 });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}

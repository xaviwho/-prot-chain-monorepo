import { NextResponse } from 'next/server';

// Temporary in-memory storage for organizations (in production, this would use a database)
let organizations = [
  {
    id: '1',
    name: 'BioTech Research',
    description: 'Leading biotechnology research organization',
    domain: 'biotech.com',
    plan: 'professional',
    created_at: new Date().toISOString(),
    member_count: 5,
    workflow_count: 12
  }
];

// GET /api/v1/teams/organizations - List user organizations
export async function GET(request) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return all organizations (in production, filter by user)
    return NextResponse.json({
      success: true,
      data: organizations
    });

  } catch (error) {
    console.error('Organizations list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

// POST /api/v1/teams/organizations - Create organization
export async function POST(request) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, description, domain } = await request.json();
    
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Create new organization
    const newOrganization = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description || '',
      domain: domain || '',
      plan: 'free', // Default plan for new organizations
      created_at: new Date().toISOString(),
      member_count: 1,
      workflow_count: 0
    };

    // Add to organizations array
    organizations.push(newOrganization);

    console.log(`Created organization: ${newOrganization.name}`);

    return NextResponse.json({
      success: true,
      data: newOrganization
    });

  } catch (error) {
    console.error('Organization creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}

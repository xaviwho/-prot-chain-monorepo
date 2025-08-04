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

// GET /api/v1/teams/organizations - List user organizations or get specific organization
export async function GET(request) {
  try {
    // Temporarily bypass JWT validation for debugging (matching other endpoints)
    const authHeader = request.headers.get('authorization');
    console.log('Organizations request - auth header present:', !!authHeader);
    
    // Continue without strict authentication for development
    
    // Check if this is a request for a specific organization via query parameter
    const url = new URL(request.url);
    const orgId = url.searchParams.get('id');
    
    if (orgId) {
      console.log('Organization detail request for ID:', orgId);
      console.log('Available organization IDs:', organizations.map(org => org.id));
      
      // Find organization by ID
      const organization = organizations.find(org => org.id === orgId);
      console.log('Found organization:', !!organization);
      
      if (!organization) {
        console.log('Organization not found for ID:', orgId);
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }
      
      console.log('Returning organization data for:', organization.name);
      return NextResponse.json({
        success: true,
        data: organization
      });
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

// DELETE /api/v1/teams/organizations - Delete organization
export async function DELETE(request) {
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

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('id');
    
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Find organization index
    const orgIndex = organizations.findIndex(org => org.id === orgId);
    
    if (orgIndex === -1) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Remove organization from array
    const deletedOrg = organizations.splice(orgIndex, 1)[0];

    console.log(`Deleted organization: ${deletedOrg.name}`);

    return NextResponse.json({
      success: true,
      message: 'Organization deleted successfully',
      data: deletedOrg
    });

  } catch (error) {
    console.error('Organization deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}

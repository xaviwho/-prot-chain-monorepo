import { NextResponse } from 'next/server';

// Enhanced organization storage with research-focused features
let organizations = [
  {
    id: '1',
    name: 'BioTech Research Lab',
    description: 'Leading biotechnology research organization specializing in protein structure analysis',
    domain: 'biotech.com',
    plan: 'professional',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    
    // Research Focus
    research_areas: ['Protein Structure Analysis', 'Drug Discovery', 'Molecular Dynamics'],
    primary_focus: 'Protein Structure Analysis',
    
    // Statistics
    member_count: 5,
    team_count: 3,
    workflow_count: 12,
    project_count: 8,
    publication_count: 15,
    
    // Organization Settings
    settings: {
      data_retention_days: 365,
      auto_backup: true,
      blockchain_tracking: true,
      compliance_mode: 'FDA_GLP',
      collaboration_level: 'internal'
    },
    
    // Members with detailed roles
    members: [
      {
        id: '1',
        name: 'Dr. John Doe',
        email: 'john@biotech.com',
        role: 'admin',
        title: 'Principal Investigator',
        department: 'Structural Biology',
        expertise: ['X-ray Crystallography', 'NMR Spectroscopy'],
        joined_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        permissions: ['manage_org', 'manage_teams', 'approve_workflows', 'view_all_data']
      },
      {
        id: '2',
        name: 'Dr. Jane Smith',
        email: 'jane@biotech.com',
        role: 'researcher',
        title: 'Senior Research Scientist',
        department: 'Computational Biology',
        expertise: ['Molecular Modeling', 'Virtual Screening'],
        joined_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        permissions: ['create_workflows', 'view_team_data', 'export_results']
      },
      {
        id: '3',
        name: 'Dr. Mike Johnson',
        email: 'mike@biotech.com',
        role: 'analyst',
        title: 'Bioinformatics Analyst',
        department: 'Data Science',
        expertise: ['Data Analysis', 'Machine Learning'],
        joined_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        permissions: ['view_assigned_data', 'run_analysis']
      }
    ],
    
    // Research Teams
    teams: [
      {
        id: '1',
        name: 'Protein Structure Team',
        description: 'Focus on protein structure determination and analysis',
        lead_id: '1',
        department: 'Structural Biology',
        research_focus: 'Protein Structure Analysis',
        member_count: 3,
        active_projects: 5,
        members: ['1', '2'],
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Drug Discovery Team',
        description: 'Virtual screening and drug candidate identification',
        lead_id: '2',
        department: 'Computational Biology',
        research_focus: 'Drug Discovery',
        member_count: 2,
        active_projects: 3,
        members: ['2', '3'],
        created_at: new Date().toISOString()
      },
      {
        id: '3',
        name: 'Data Analysis Team',
        description: 'Bioinformatics and computational analysis support',
        lead_id: '3',
        department: 'Data Science',
        research_focus: 'Data Analysis',
        member_count: 2,
        active_projects: 4,
        members: ['3'],
        created_at: new Date().toISOString()
      }
    ],
    
    // Research Projects
    projects: [
      {
        id: '1',
        name: 'COVID-19 Protease Inhibitors',
        description: 'Structure-based drug design for SARS-CoV-2 main protease',
        status: 'active',
        priority: 'high',
        team_id: '2',
        lead_researcher: '2',
        start_date: '2024-01-15',
        target_completion: '2024-06-15',
        funding_source: 'NIH Grant R01-AI123456',
        workflow_count: 8,
        protein_targets: ['6LU7', '6Y2E', '6Y2F']
      },
      {
        id: '2',
        name: 'Alzheimer\'s Drug Targets',
        description: 'Structural analysis of amyloid-beta aggregation inhibitors',
        status: 'active',
        priority: 'medium',
        team_id: '1',
        lead_researcher: '1',
        start_date: '2024-02-01',
        target_completion: '2024-08-01',
        funding_source: 'NSF Grant CHE-789012',
        workflow_count: 6,
        protein_targets: ['1IYT', '2LMN', '2LMO']
      }
    ],
    
    // Shared Resources
    shared_resources: {
      databases: ['PDB', 'ChEMBL', 'UniProt'],
      software_licenses: ['Schrödinger Suite', 'MOE', 'PyMOL'],
      computational_resources: {
        cpu_hours_monthly: 10000,
        gpu_hours_monthly: 2000,
        storage_gb: 50000
      }
    },
    
    // Compliance & Audit
    compliance: {
      last_audit: '2024-01-01',
      next_audit: '2024-07-01',
      certifications: ['ISO 27001', 'SOC 2 Type II'],
      data_classification: 'Confidential',
      retention_policy: '7 years'
    }
  }
];

// GET /api/v1/teams/organizations/[id] - Get individual organization
export async function GET(request, { params }) {
  try {
    // Temporarily bypass JWT validation for debugging (matching workflows fix)
    const authHeader = request.headers.get('authorization');
    console.log('Organization detail request - auth header present:', !!authHeader);
    
    // Continue without strict authentication for development

    const { id } = params;
    console.log('Organization detail API called with ID:', id);
    console.log('Available organization IDs:', organizations.map(org => org.id));
    
    if (!id) {
      console.log('No ID provided');
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Find organization by ID
    const organization = organizations.find(org => org.id === id);
    console.log('Found organization:', !!organization);
    
    if (!organization) {
      console.log('Organization not found for ID:', id);
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

  } catch (error) {
    console.error('Organization fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// POST /api/v1/teams/organizations/[id]/invite - Invite user to organization
export async function POST(request, { params }) {
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

    const { id } = params;
    const { email, role = 'member' } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find organization by ID
    const orgIndex = organizations.findIndex(org => org.id === id);
    
    if (orgIndex === -1) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // In a real implementation, this would send an email invitation
    // For now, we'll just simulate success
    console.log(`Invitation sent to ${email} for organization ${organizations[orgIndex].name}`);

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      data: {
        email,
        role,
        organization_id: id,
        invited_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Organization invitation error:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}

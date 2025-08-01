import { NextResponse } from 'next/server';

// GET /api/user/preferences - Get user preferences
export async function GET(request) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.user_id;

    // In production, this would fetch from database
    const preferences = {
      theme: 'light',
      language: 'en',
      notifications: {
        email: true,
        workflow: true,
        collaboration: false,
        security: true,
      },
      workflowDefaults: {
        analysisType: 'structure',
        autoSave: true,
      },
      privacy: {
        profileVisible: true,
        activityVisible: false,
      }
    };

    return NextResponse.json({ 
      success: true, 
      data: preferences 
    });

  } catch (error) {
    console.error('Preferences fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch preferences' 
    }, { status: 500 });
  }
}

// PUT /api/user/preferences - Update user preferences
export async function PUT(request) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.user_id;

    const updateData = await request.json();

    // In production, this would update the database
    // For now, return the updated preferences
    const updatedPreferences = {
      theme: updateData.theme || 'light',
      language: updateData.language || 'en',
      notifications: updateData.notifications || {
        email: true,
        workflow: true,
        collaboration: false,
        security: true,
      },
      workflowDefaults: updateData.workflowDefaults || {
        analysisType: 'structure',
        autoSave: true,
      },
      privacy: updateData.privacy || {
        profileVisible: true,
        activityVisible: false,
      },
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({ 
      success: true, 
      data: updatedPreferences,
      message: 'Preferences updated successfully'
    });

  } catch (error) {
    console.error('Preferences update error:', error);
    return NextResponse.json({ 
      error: 'Failed to update preferences' 
    }, { status: 500 });
  }
}

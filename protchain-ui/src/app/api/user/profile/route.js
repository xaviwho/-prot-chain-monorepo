import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Simple profile database file path
const profileDbPath = path.join(process.cwd(), 'profile-db.json');

// Initialize profile database if it doesn't exist
function initProfileDb() {
  if (!fs.existsSync(profileDbPath)) {
    fs.writeFileSync(profileDbPath, JSON.stringify({
      profiles: {}
    }), 'utf8');
  }
  return JSON.parse(fs.readFileSync(profileDbPath, 'utf8'));
}

// Save profile database
function saveProfileDb(db) {
  fs.writeFileSync(profileDbPath, JSON.stringify(db, null, 2), 'utf8');
}

// GET /api/user/profile - Get user profile
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

    // Decode JWT to get user info
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.user_id;

    // Load profile database and check for saved profile
    const db = initProfileDb();
    const savedProfile = db.profiles[userId];

    // Use saved profile if exists, otherwise use JWT data with defaults
    const userProfile = savedProfile || {
      id: userId,
      name: payload.name || payload.username || 'User',
      email: payload.email || 'user@example.com',
      bio: 'Computational biologist specializing in protein structure analysis',
      organization: 'BioTech Research Institute',
      role: 'Senior Research Scientist',
      joinDate: new Date().toISOString().split('T')[0],
      avatar: null,
      plan: 'professional',
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          workflow: true,
          collaboration: false,
          security: true,
        }
      }
    };

    return NextResponse.json({ 
      success: true, 
      data: userProfile 
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch profile' 
    }, { status: 500 });
  }
}

// PUT /api/user/profile - Update user profile
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

    // Validate required fields
    if (!updateData.name || !updateData.email) {
      return NextResponse.json({ 
        error: 'Name and email are required' 
      }, { status: 400 });
    }

    // Load profile database
    const db = initProfileDb();
    
    // Save the updated profile permanently
    const updatedProfile = {
      ...updateData,
      id: userId,
      name: updateData.name,
      email: updateData.email,
      bio: updateData.bio || '',
      organization: updateData.organization || '',
      role: updateData.role || '',
      joinDate: '2024-01-15',
      avatar: updateData.avatar || null,
      plan: 'professional',
      updatedAt: new Date().toISOString()
    };
    
    // Save to database
    db.profiles[userId] = updatedProfile;
    saveProfileDb(db);

    return NextResponse.json({ 
      success: true, 
      data: updatedProfile,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ 
      error: 'Failed to update profile' 
    }, { status: 500 });
  }
}

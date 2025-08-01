import { NextResponse } from 'next/server';

// POST /api/user/change-password - Change user password
export async function POST(request) {
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

    const { currentPassword, newPassword, confirmPassword } = await request.json();

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ 
        error: 'All password fields are required' 
      }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ 
        error: 'New passwords do not match' 
      }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ 
        error: 'New password must be at least 8 characters long' 
      }, { status: 400 });
    }

    // In production, this would:
    // 1. Verify current password against database
    // 2. Hash new password
    // 3. Update password in database
    // 4. Invalidate all existing sessions except current one

    // For now, simulate successful password change
    return NextResponse.json({ 
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ 
      error: 'Failed to change password' 
    }, { status: 500 });
  }
}

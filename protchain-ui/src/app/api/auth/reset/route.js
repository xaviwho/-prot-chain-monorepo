import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // This endpoint forces a complete authentication reset
    // It tells the frontend to clear all stored tokens and redirect to login
    
    const response = NextResponse.json({
      success: true,
      message: 'Authentication reset initiated',
      action: 'redirect_to_login'
    });
    
    // Clear any server-side cookies
    response.cookies.set('token', '', {
      expires: new Date(0),
      path: '/'
    });
    
    response.cookies.set('user', '', {
      expires: new Date(0),
      path: '/'
    });
    
    return response;
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Reset failed',
      details: error.message
    }, { status: 500 });
  }
}

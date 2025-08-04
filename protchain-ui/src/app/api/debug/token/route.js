import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJWTSecret } from '@/lib/jwt-config';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const JWT_SECRET = getJWTSecret();
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'No authorization header found',
        hasToken: false,
        jwtSecret: JWT_SECRET.substring(0, 10) + '...' // Show first 10 chars for debugging
      });
    }

    const token = authHeader.substring(7);
    
    // Try to decode without verification first to see the payload
    let decodedWithoutVerification;
    try {
      decodedWithoutVerification = jwt.decode(token);
    } catch (e) {
      decodedWithoutVerification = null;
    }
    
    // Try to verify with current secret
    let verificationResult;
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      verificationResult = { success: true, payload: verified };
    } catch (error) {
      verificationResult = { success: false, error: error.message };
    }
    
    return NextResponse.json({
      hasToken: true,
      tokenLength: token.length,
      tokenParts: token.split('.').length,
      jwtSecret: JWT_SECRET.substring(0, 10) + '...',
      decodedWithoutVerification,
      verificationResult,
      recommendation: verificationResult.success ? 
        'Token is valid' : 
        'Token is invalid - please log out and log in again'
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Debug failed',
      details: error.message
    }, { status: 500 });
  }
}

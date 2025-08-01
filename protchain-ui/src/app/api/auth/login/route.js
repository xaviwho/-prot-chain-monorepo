import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Simple user database file path
const userDbPath = path.join(process.cwd(), 'user-db.json');

// Initialize user database if it doesn't exist
function initUserDb() {
  if (!fs.existsSync(userDbPath)) {
    fs.writeFileSync(userDbPath, JSON.stringify({
      users: {}
    }), 'utf8');
    
    // Add a default user for testing
    const db = { users: {} };
    const defaultUser = {
      name: 'Test User',
      email: 'test@example.com',
      password: crypto.createHash('sha256').update('password123').digest('hex'),
      createdAt: new Date().toISOString()
    };
    db.users[defaultUser.email] = defaultUser;
    fs.writeFileSync(userDbPath, JSON.stringify(db, null, 2), 'utf8');
    return db;
  }
  return JSON.parse(fs.readFileSync(userDbPath, 'utf8'));
}

// Generate a token
function generateToken(userData) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7); // 7 days expiry
  
  // Create JWT header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  // Create JWT payload
  const payload = {
    user_id: userData.id, // Match the Go backend's expected field name
    sub: userData.email,  // Keep sub for standard JWT compliance
    name: userData.name,
    exp: Math.floor(expiryDate.getTime() / 1000)
  };
  
  // Convert header and payload to base64
  const headerBase64 = Buffer.from(JSON.stringify(header))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  const payloadBase64 = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Create signature
  const signatureInput = `${headerBase64}.${payloadBase64}`;
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'development-secret-key')
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // Return standard JWT format: header.payload.signature
  return `${headerBase64}.${payloadBase64}.${signature}`;
}

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    
    // Validate input
    if (!email || !password) {
      return NextResponse.json({
        status: 'error',
        message: 'Email and password are required'
      }, { status: 400 });
    }
    
    // Get user database
    const db = initUserDb();
    
    // Check if user exists
    if (!db.users[email]) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid email or password'
      }, { status: 401 });
    }
    
    // Get user
    const user = db.users[email];
    
    // Hash password for comparison
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
    
    // Check password
    if (user.password !== hashedPassword) {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid email or password'
      }, { status: 401 });
    }
    
    // Generate token
    const token = generateToken(user);
    
    // Return success response
    return NextResponse.json({
      status: 'success',
      message: 'Login successful',
      payload: {
        token,
        user: {
          name: user.name,
          email: user.email
        }
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'An error occurred during login'
    }, { status: 500 });
  }
}

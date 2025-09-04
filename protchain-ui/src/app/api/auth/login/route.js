import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getJWTSecret, getJWTOptions } from '@/lib/jwt-config';

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

// Generate a token using standard JWT library
function generateToken(userData) {
  const JWT_SECRET = getJWTSecret();
  const jwtOptions = getJWTOptions();
  
  // Create JWT payload
  const payload = {
    user_id: userData.id, // Match the Go backend's expected field name
    sub: userData.email,  // Keep sub for standard JWT compliance
    name: userData.name,
    email: userData.email
  };
  
  // Generate token with consistent configuration
  const token = jwt.sign(payload, JWT_SECRET, jwtOptions);
  
  return token;
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
    
    // Ensure user has an ID (for backward compatibility with existing users)
    if (!user.id) {
      // For existing users without IDs, assign one based on email hash
      const crypto = require('crypto');
      user.id = crypto.createHash('md5').update(email).digest('hex');
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
          id: user.id,
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

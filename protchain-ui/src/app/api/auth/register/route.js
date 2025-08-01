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
  }
  return JSON.parse(fs.readFileSync(userDbPath, 'utf8'));
}

// Save user database
function saveUserDb(db) {
  fs.writeFileSync(userDbPath, JSON.stringify(db, null, 2), 'utf8');
}

// Generate a token
function generateToken(userData) {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7); // 7 days expiry
  
  const tokenData = {
    user_id: userData.id, // Match the Go backend's expected field name
    sub: userData.email,  // Keep sub for standard JWT compliance
    name: userData.name,
    exp: Math.floor(expiryDate.getTime() / 1000)
  };
  
  // Convert to base64
  const tokenStr = Buffer.from(JSON.stringify(tokenData)).toString('base64');
  
  // Create signature
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'development-secret-key')
    .update(tokenStr)
    .digest('base64');
  
  return `${tokenStr}.${signature}`;
}

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();
    
    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json({
        status: 'error',
        message: 'Name, email, and password are required'
      }, { status: 400 });
    }
    
    // Get user database
    const db = initUserDb();
    
    // Check if user already exists
    if (db.users[email]) {
      return NextResponse.json({
        status: 'error',
        message: 'Email already registered'
      }, { status: 400 });
    }
    
    // Hash password (in a real app, use bcrypt)
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');
    
    // Create new user
    const newUser = {
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    
    // Add to database
    db.users[email] = newUser;
    saveUserDb(db);
    
    // Generate token
    const token = generateToken(newUser);
    
    // Return success response
    return NextResponse.json({
      status: 'success',
      message: 'User registered successfully',
      payload: {
        token,
        user: {
          name: newUser.name,
          email: newUser.email
        }
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'An error occurred during registration'
    }, { status: 500 });
  }
}

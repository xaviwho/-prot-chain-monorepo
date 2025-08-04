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
  }
  return JSON.parse(fs.readFileSync(userDbPath, 'utf8'));
}

// Save user database
function saveUserDb(db) {
  fs.writeFileSync(userDbPath, JSON.stringify(db, null, 2), 'utf8');
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

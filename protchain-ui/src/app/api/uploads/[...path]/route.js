import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { path: filePath } = await params;
    const fullPath = path.join(process.cwd(), '..', 'uploads', ...filePath);
    
    // Security check - ensure the path is within uploads directory
    const uploadsDir = path.join(process.cwd(), '..', 'uploads');
    const resolvedPath = path.resolve(fullPath);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    // Read file content
    const fileContent = fs.readFileSync(resolvedPath);
    const fileExtension = path.extname(resolvedPath).toLowerCase();
    
    // Set appropriate content type
    let contentType = 'application/octet-stream';
    if (fileExtension === '.pdb') {
      contentType = 'chemical/x-pdb';
    } else if (fileExtension === '.json') {
      contentType = 'application/json';
    } else if (fileExtension === '.txt') {
      contentType = 'text/plain';
    }
    
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
    
  } catch (error) {
    console.error('Error serving file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

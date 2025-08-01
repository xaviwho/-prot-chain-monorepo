import { NextResponse } from 'next/server';
import fs from 'fs';
import { getWorkflowPath, getWorkflowFilePath, normalizePath } from '../../../../../../utils/pathUtils';

/**
 * GET handler for downloading workflow files
 * This allows downloading files like processed.pdb and results.json
 */
export async function GET(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  const filename = resolvedParams.filename;
  
  console.log(`Downloading ${filename} for workflow: ${id}`);
  
  // Validate filename to prevent directory traversal attacks
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json(
      { error: 'Invalid filename' },
      { status: 400 }
    );
  }
  
  // Only allow downloading specific files
  const allowedFiles = ['input.pdb', 'processed.pdb', 'results.json'];
  if (!allowedFiles.includes(filename)) {
    return NextResponse.json(
      { error: 'File not allowed for download' },
      { status: 403 }
    );
  }
  
  try {
    // Get the file path
    const filePath = getWorkflowFilePath(id, filename);
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine content type
    let contentType = 'application/octet-stream';
    if (filename.endsWith('.pdb')) {
      contentType = 'chemical/x-pdb';
    } else if (filename.endsWith('.json')) {
      contentType = 'application/json';
    }
    
    // Create response with appropriate headers
    const response = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString()
      }
    });
    
    return response;
  } catch (err) {
    console.error(`Error downloading file: ${err.message}`);
    return NextResponse.json(
      { error: err.message || 'Failed to download file' },
      { status: 500 }
    );
  }
}

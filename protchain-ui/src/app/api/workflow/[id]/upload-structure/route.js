import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { getWorkflowPath, getWorkflowFilePath, normalizePath } from '../../../../../utils/pathUtils';

/**
 * POST handler for uploading a protein structure file
 * This saves the uploaded PDB file to the workflow directory
 */
export async function POST(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  console.log(`Uploading structure file for workflow: ${id}`);
  
  try {
    // Use the path utility function to get a normalized workflow path
    const workflowDir = getWorkflowPath(id);
    
    // Ensure the workflow directory exists
    if (!existsSync(workflowDir)) {
      console.log(`Creating workflow directory: ${workflowDir}`);
      mkdirSync(workflowDir, { recursive: true });
    }
    
    // Get the target file path for input.pdb
    const inputPath = getWorkflowFilePath(id, 'input.pdb');
    
    // Parse the form data from the request
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    
    // Check if the file is a PDB file
    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.pdb')) {
      return NextResponse.json(
        { error: 'Only PDB files are accepted' },
        { status: 400 }
      );
    }
    
    // Get the file data as an ArrayBuffer
    const fileData = await file.arrayBuffer();
    const buffer = Buffer.from(fileData);
    
    // Write the file to the workflow directory
    await writeFile(inputPath, buffer);
    console.log(`Saved input.pdb to: ${normalizePath(inputPath)}`);
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Protein structure file uploaded successfully',
      filePath: normalizePath(inputPath)
    });
  } catch (err) {
    console.error(`Error uploading structure file: ${err.message}`);
    return NextResponse.json(
      { error: err.message || 'Failed to upload structure file' },
      { status: 500 }
    );
  }
}

// Increase the body size limit for file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * POST handler for directly running binding site analysis
 * This uses a completely different approach to bypass file system access issues
 */
export async function POST(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  try {
    
    // Try multiple possible directory structures with normalized paths
    const basePath = 'C:\\Users\\NSL\\Downloads\\prot-chain';
    
    const possibleDirs = [
      // Structure 1: uploads/structures/id
      path.normalize(path.join(basePath, 'uploads', 'structures', id)),
      // Structure 2: uploads/id
      path.normalize(path.join(basePath, 'uploads', id)),
      // Structure 3: uploads/id/structure
      path.normalize(path.join(basePath, 'uploads', id, 'structure'))
    ];
    
    possibleDirs.forEach(dir => console.log(` - ${dir}`));
    
    // Check each possible directory structure
    let workflowDir = null;
    let pdbPath = null;
    let resultsPath = null;
    let inputPdbPath = null;
    
    for (const dir of possibleDirs) {
      
      try {
        // Use try/catch to handle any file system errors
        if (fs.existsSync(dir)) {
          
          // Check for processed.pdb and results.json
          const testPdbPath = path.join(dir, 'processed.pdb');
          const testResultsPath = path.join(dir, 'results.json');
          const testInputPath = path.join(dir, 'input.pdb');
          
          
          if (fs.existsSync(testPdbPath) && fs.existsSync(testResultsPath)) {
            workflowDir = dir;
            pdbPath = testPdbPath;
            resultsPath = testResultsPath;
            break;
          } else if (fs.existsSync(testInputPath)) {
            // If we only have input.pdb, we can use that instead
            workflowDir = dir;
            pdbPath = testInputPath; // Use input.pdb instead
            inputPdbPath = testInputPath;
            break;
          }
        }
      } catch (err) {
      }
    }
    
    if (!workflowDir) {
      return NextResponse.json(
        { error: `No valid workflow directory found for ID: ${id}` },
        { status: 404 }
      );
    }
    
    
    // If we only have input.pdb but no processed.pdb or results.json, we need to run structure preparation first
    if (inputPdbPath && (!pdbPath || !resultsPath)) {
      return NextResponse.json(
        { error: 'Structure preparation needs to be run first. Please complete that step before running binding site analysis.' },
        { status: 400 }
      );
    }
    
    // Read files directly using fs instead of execSync
    let pdbContent = '';
    let resultsData = {};
    
    try {
      pdbContent = fs.readFileSync(pdbPath, 'utf8');
    } catch (pdbReadError) {
      return NextResponse.json(
        { error: `Could not read PDB file: ${pdbReadError.message}` },
        { status: 500 }
      );
    }
    
    // Read results.json directly using fs
    try {
      const resultsContent = fs.readFileSync(resultsPath, 'utf8');
      resultsData = JSON.parse(resultsContent);
    } catch (resultsReadError) {
      return NextResponse.json(
        { error: `Could not read results.json: ${resultsReadError.message}` },
        { status: 500 }
      );
    }
    
    // Call the backend API directly with the PDB content
    
    // Create a simple request with just the essential data
    const requestData = {
      workflow_id: id,
      pdb_content: pdbContent,
      structure_data: resultsData.STRUCTURE_PREPARATION || {},
      // Convert Windows path to WSL path
      wsl_path: workflowDir.replace(/^C:\\/, '/mnt/c/').replace(/\\/g, '/')
    };
    
    
    // Make the API call
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const authHeader = request.headers.get('authorization');
    const fetchHeaders = { 'Content-Type': 'application/json' };
    if (authHeader) fetchHeaders['Authorization'] = authHeader;

    const response = await fetch(`${apiUrl}/api/v1/direct-binding-analysis`, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(requestData),
    });
    
    // Handle the response
    if (!response.ok) {
      let errorMessage = `Failed to run binding site analysis: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          errorMessage = `Backend error: ${errorData.detail}`;
        }
      } catch (parseError) {
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }
    
    // Return success response
    const data = await response.json();
    return NextResponse.json({
      status: 'success',
      message: 'Binding site analysis started successfully',
      data
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to run binding site analysis' },
      { status: 500 }
    );
  }
}

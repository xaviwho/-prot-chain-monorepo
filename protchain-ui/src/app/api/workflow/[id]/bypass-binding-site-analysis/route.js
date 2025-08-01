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
    console.log(`Starting bypass binding site analysis for workflow: ${id}`);
    
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
    
    console.log('Checking possible directories:');
    possibleDirs.forEach(dir => console.log(` - ${dir}`));
    
    // Check each possible directory structure
    let workflowDir = null;
    let pdbPath = null;
    let resultsPath = null;
    let inputPdbPath = null;
    
    for (const dir of possibleDirs) {
      console.log(`Checking directory: ${dir}`);
      
      try {
        // Use try/catch to handle any file system errors
        if (fs.existsSync(dir)) {
          console.log(`Directory exists: ${dir}`);
          
          // Check for processed.pdb and results.json
          const testPdbPath = path.join(dir, 'processed.pdb');
          const testResultsPath = path.join(dir, 'results.json');
          const testInputPath = path.join(dir, 'input.pdb');
          
          console.log(`Checking for files in ${dir}:`);
          console.log(` - processed.pdb: ${fs.existsSync(testPdbPath)}`);
          console.log(` - results.json: ${fs.existsSync(testResultsPath)}`);
          console.log(` - input.pdb: ${fs.existsSync(testInputPath)}`);
          
          if (fs.existsSync(testPdbPath) && fs.existsSync(testResultsPath)) {
            workflowDir = dir;
            pdbPath = testPdbPath;
            resultsPath = testResultsPath;
            console.log(`Found processed.pdb and results.json in ${dir}`);
            break;
          } else if (fs.existsSync(testInputPath)) {
            // If we only have input.pdb, we can use that instead
            workflowDir = dir;
            pdbPath = testInputPath; // Use input.pdb instead
            inputPdbPath = testInputPath;
            console.log(`Found input.pdb in ${dir} (no processed.pdb yet)`);
            break;
          }
        }
      } catch (err) {
        console.error(`Error checking directory ${dir}:`, err);
      }
    }
    
    if (!workflowDir) {
      console.error(`No valid workflow directory found for ID: ${id}`);
      return NextResponse.json(
        { error: `No valid workflow directory found for ID: ${id}` },
        { status: 404 }
      );
    }
    
    console.log(`Using workflow directory: ${workflowDir}`);
    
    // If we only have input.pdb but no processed.pdb or results.json, we need to run structure preparation first
    if (inputPdbPath && (!pdbPath || !resultsPath)) {
      console.log('Only found input.pdb. Need to run structure preparation first.');
      return NextResponse.json(
        { error: 'Structure preparation needs to be run first. Please complete that step before running binding site analysis.' },
        { status: 400 }
      );
    }
    
    // Read files directly using fs instead of execSync
    let pdbContent = '';
    let resultsData = {};
    
    try {
      console.log(`Reading PDB file: ${pdbPath}`);
      pdbContent = fs.readFileSync(pdbPath, 'utf8');
      console.log(`Successfully read PDB file with ${pdbContent.length} characters`);
    } catch (pdbReadError) {
      console.error('Error reading PDB file:', pdbReadError);
      return NextResponse.json(
        { error: `Could not read PDB file: ${pdbReadError.message}` },
        { status: 500 }
      );
    }
    
    // Read results.json directly using fs
    try {
      console.log(`Reading results file: ${resultsPath}`);
      const resultsContent = fs.readFileSync(resultsPath, 'utf8');
      resultsData = JSON.parse(resultsContent);
      console.log('Successfully parsed results.json');
    } catch (resultsReadError) {
      console.error('Error reading results.json:', resultsReadError);
      return NextResponse.json(
        { error: `Could not read results.json: ${resultsReadError.message}` },
        { status: 500 }
      );
    }
    
    // Call the backend API directly with the PDB content
    console.log('Calling backend binding site analysis endpoint...');
    
    // Create a simple request with just the essential data
    const requestData = {
      workflow_id: id,
      pdb_content: pdbContent,
      structure_data: resultsData.STRUCTURE_PREPARATION || {},
      // Convert Windows path to WSL path
      wsl_path: workflowDir.replace(/^C:\\/, '/mnt/c/').replace(/\\/g, '/')
    };
    
    console.log(`Using WSL path: ${requestData.wsl_path}`);
    
    // Make the API call
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/direct-binding-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
        console.error('Error parsing error response:', parseError);
      }
      
      console.error('Backend API error:', errorMessage);
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }
    
    // Return success response
    const data = await response.json();
    console.log('Successfully started binding site analysis');
    return NextResponse.json({
      status: 'success',
      message: 'Binding site analysis started successfully',
      data
    });
  } catch (error) {
    console.error('Error running binding site analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run binding site analysis' },
      { status: 500 }
    );
  }
}

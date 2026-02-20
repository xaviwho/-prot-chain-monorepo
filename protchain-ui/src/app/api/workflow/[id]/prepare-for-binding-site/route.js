import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * POST handler for preparing a workflow for binding site analysis
 * This ensures the workflow has the correct structure preparation data
 */
export async function POST(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  try {
    // DIRECT SOLUTION: Use the exact path we know works based on the directory listing
    const workflowDir = path.join('C:', 'Users', 'NSL', 'Downloads', 'prot-chain', 'uploads', 'structures', id);
    
    if (!fs.existsSync(workflowDir)) {
      return NextResponse.json(
        { error: `Workflow directory not found: ${workflowDir}` },
        { status: 404 }
      );
    }
    
    // Check if processed.pdb exists
    const processedPdbPath = path.join(workflowDir, 'processed.pdb');
    if (!fs.existsSync(processedPdbPath)) {
      return NextResponse.json(
        { error: 'Processed PDB file not found in workflow directory' },
        { status: 400 }
      );
    }
    
    // Read the processed PDB file content
    const pdbContent = fs.readFileSync(processedPdbPath, 'utf8');
    
    // Read the results.json file if it exists
    const resultsPath = path.join(workflowDir, 'results.json');
    let resultsData = {};
    if (fs.existsSync(resultsPath)) {
      try {
        const resultsContent = fs.readFileSync(resultsPath, 'utf8');
        resultsData = JSON.parse(resultsContent);
      } catch (parseError) {
        return NextResponse.json(
          { error: 'Error parsing results.json file' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Results.json file not found in workflow directory' },
        { status: 400 }
      );
    }
    
    // Ensure we have structure preparation data
    if (!resultsData.STRUCTURE_PREPARATION || resultsData.STRUCTURE_PREPARATION.status !== 'success') {
      return NextResponse.json(
        { error: 'Structure preparation results not found or unsuccessful' },
        { status: 400 }
      );
    }
    
    // Create WSL path for the backend - this is the exact path format needed
    const wslPath = `/mnt/c/Users/NSL/Downloads/prot-chain/uploads/structures/${id}`;
    
    
    // Prepare the data to send to the backend
    const requestData = {
      results: {
        STRUCTURE_PREPARATION: resultsData.STRUCTURE_PREPARATION
      },
      paths: {
        windows_path: workflowDir,
        wsl_path: wslPath,
        workflow_id: id
      },
      // Include additional information to help the backend locate files
      file_paths: {
        processed_pdb: path.join(workflowDir, 'processed.pdb'),
        results_json: path.join(workflowDir, 'results.json')
      }
    };
    
    // Update the workflow in the backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const response = await fetch(`${apiUrl}/api/v1/workflows/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    if (!response.ok) {
      let errorMessage = `Failed to update workflow: ${response.status}`;
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
    
    const data = await response.json();
    return NextResponse.json({
      status: 'success',
      message: 'Workflow prepared for binding site analysis',
      workflow: data
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to prepare workflow for binding site analysis' },
      { status: 500 }
    );
  }
}

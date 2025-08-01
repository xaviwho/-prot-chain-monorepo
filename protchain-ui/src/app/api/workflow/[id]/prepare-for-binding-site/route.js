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
    console.log('Using direct workflow directory path:', workflowDir);
    
    if (!fs.existsSync(workflowDir)) {
      console.error(`Workflow directory not found at: ${workflowDir}`);
      return NextResponse.json(
        { error: `Workflow directory not found: ${workflowDir}` },
        { status: 404 }
      );
    }
    
    // Check if processed.pdb exists
    const processedPdbPath = path.join(workflowDir, 'processed.pdb');
    if (!fs.existsSync(processedPdbPath)) {
      console.error('Processed PDB file not found at:', processedPdbPath);
      return NextResponse.json(
        { error: 'Processed PDB file not found in workflow directory' },
        { status: 400 }
      );
    }
    
    // Read the processed PDB file content
    const pdbContent = fs.readFileSync(processedPdbPath, 'utf8');
    console.log('Successfully read PDB file with length:', pdbContent.length);
    
    // Read the results.json file if it exists
    const resultsPath = path.join(workflowDir, 'results.json');
    let resultsData = {};
    if (fs.existsSync(resultsPath)) {
      try {
        const resultsContent = fs.readFileSync(resultsPath, 'utf8');
        resultsData = JSON.parse(resultsContent);
        console.log('Successfully parsed results.json');
      } catch (parseError) {
        console.error('Error parsing results.json:', parseError);
        return NextResponse.json(
          { error: 'Error parsing results.json file' },
          { status: 500 }
        );
      }
    } else {
      console.error('Results.json file not found at:', resultsPath);
      return NextResponse.json(
        { error: 'Results.json file not found in workflow directory' },
        { status: 400 }
      );
    }
    
    // Ensure we have structure preparation data
    if (!resultsData.STRUCTURE_PREPARATION || resultsData.STRUCTURE_PREPARATION.status !== 'success') {
      console.error('Structure preparation data missing or unsuccessful');
      return NextResponse.json(
        { error: 'Structure preparation results not found or unsuccessful' },
        { status: 400 }
      );
    }
    
    // Create WSL path for the backend - this is the exact path format needed
    const wslPath = `/mnt/c/Users/NSL/Downloads/prot-chain/uploads/structures/${id}`;
    
    console.log('Using exact paths for backend:');
    console.log('- Windows path:', workflowDir);
    console.log('- WSL path:', wslPath);
    
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
    console.log('Sending request to backend API...');
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/workflows/${id}`, {
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
        console.error('Error parsing error response:', parseError);
      }
      
      console.error('Backend API error:', errorMessage);
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('Successfully prepared workflow for binding site analysis');
    return NextResponse.json({
      status: 'success',
      message: 'Workflow prepared for binding site analysis',
      workflow: data
    });
  } catch (error) {
    console.error('Error preparing workflow for binding site analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to prepare workflow for binding site analysis' },
      { status: 500 }
    );
  }
}

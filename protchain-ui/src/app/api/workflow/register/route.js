import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Function to generate a UUID
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * POST handler for registering a local workflow with the backend
 */
export async function POST(request) {
  try {
    const body = await request.json();
    let { workflowId, workflowName, name, description } = body;
    
    // Support both formats - benchmark script uses name/description
    if (name && !workflowName) {
      workflowName = name;
    }
    
    // Generate a new workflowId if not provided (for benchmark script)
    if (!workflowId) {
      workflowId = generateUUID();
      
      // Create workflow directory for benchmark
      const uploadsDir = path.join(process.cwd(), '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const workflowDir = path.join(uploadsDir, workflowId);
      fs.mkdirSync(workflowDir, { recursive: true });
      
      console.log(`Created new workflow directory for benchmark: ${workflowDir}`);
      
      // Return success with the generated ID
      return NextResponse.json({
        id: workflowId,
        name: workflowName || description || 'Benchmark Workflow',
        created_at: new Date().toISOString(),
        status: 'CREATED'
      });
    }
    
    // Check if the workflow directory exists locally
    const uploadsDir = path.join(process.cwd(), '..', '..', '..', '..', 'uploads');
    const structuresDir = path.join(uploadsDir, 'structures');
    const workflowDir = path.join(structuresDir, workflowId);
    
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
        console.error('Error parsing results.json:', parseError);
      }
    }
    
    // Create complete WSL-compatible path for the backend
    const wslPath = `/mnt/c/Users/NSL/Downloads/prot-chain/uploads/structures/${workflowId}`;
    
    console.log('Registering workflow with Windows path:', workflowDir);
    console.log('And WSL path:', wslPath);
    
    // Create a properly formatted workflow object for the backend
    const workflowData = {
      name: workflowName || `Workflow ${workflowId.substring(0, 8)}`,
      template: 'structure-preparation',
      parameters: {
        workflow_id: workflowId,
        pdb_content: pdbContent,
        // Include path information for both Windows and WSL
        paths: {
          windows_path: workflowDir,
          wsl_path: wslPath
        }
      },
      // Important: Include the results in the expected format
      results: {
        STRUCTURE_PREPARATION: resultsData.STRUCTURE_PREPARATION || {
          status: 'success',
          descriptors: resultsData.descriptors || {
            num_residues: 0,
            num_chains: 0,
            num_atoms: 0,
            molecular_weight: 0,
            num_bonds: 0,
            num_rings: 0,
            num_rotatable_bonds: 0,
            num_h_acceptors: 0,
            num_h_donors: 0,
            tpsa: 0,
            logp: 0
          }
        }
      }
    };
    
    console.log(JSON.stringify(workflowData, null, 2));
    
    // Register the workflow with the backend
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData),
    });
    
    if (!response.ok) {
      let errorMessage = `Failed to register workflow: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          errorMessage = `Backend error: ${errorData.detail}`;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    // Also copy the processed.pdb file to the backend's upload directory if needed
    // This step might require additional backend API support
    
    return NextResponse.json({
      status: 'success',
      message: 'Workflow registered successfully',
      workflow: data
    });
  } catch (error) {
    console.error('Error registering workflow:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to register workflow' },
      { status: 500 }
    );
  }
}

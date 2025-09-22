import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Try to get workflow data from the backend API first
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
      const backendResponse = await fetch(`${apiUrl}/api/v1/workflows/${id}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (backendResponse.ok) {
        const workflowData = await backendResponse.json();
        return NextResponse.json(workflowData);
      }
    } catch (backendError) {
      console.log('Backend API not available, using local workflow data');
    }

    // Fallback: Check if we have local results for this workflow
    // Results are saved in the root uploads directory, not protchain-ui/uploads
    const uploadsDir = path.join(process.cwd(), '..', 'uploads', id);
    const resultsPath = path.join(uploadsDir, 'results.json');
    
    console.log('DEBUG: Checking workflow', id);
    console.log('DEBUG: uploadsDir:', uploadsDir);
    console.log('DEBUG: resultsPath:', resultsPath);
    console.log('DEBUG: resultsPath exists:', fs.existsSync(resultsPath));
    
    let workflow = {
      id: id,
      name: `Workflow ${id.substring(0, 8)}`,
      stage: 'structure_preparation',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    // Check for completed stages and calculate progress
    const completedStages = [];
    let currentStage = 'structure_preparation';
    let stageResults = {};
    let blockchainData = {};
    
    // Check structure preparation completion
    if (fs.existsSync(resultsPath)) {
      try {
        const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        console.log('DEBUG: resultsData:', JSON.stringify(resultsData, null, 2));
        console.log('DEBUG: has descriptors:', !!resultsData.details?.descriptors);
        
        if (resultsData.details?.descriptors) {
          completedStages.push('structure_preparation');
          stageResults.structure_preparation = resultsData;
          currentStage = 'binding_site_analysis';
          console.log('DEBUG: Added structure_preparation to completed stages');
        }
      } catch (error) {
        console.error('Error reading results file:', error);
      }
    } else {
      console.log('DEBUG: Results file does not exist');
    }
    
    // Check binding site analysis completion
    const bindingSiteResultsPath = path.join(uploadsDir, 'binding_site_results.json');
    if (fs.existsSync(bindingSiteResultsPath)) {
      try {
        const bindingSiteData = JSON.parse(fs.readFileSync(bindingSiteResultsPath, 'utf8'));
        console.log('DEBUG: bindingSiteData found:', !!bindingSiteData.binding_sites);
        
        if (bindingSiteData.binding_sites && bindingSiteData.binding_sites.length > 0) {
          completedStages.push('binding_site_analysis');
          stageResults.binding_site_analysis = bindingSiteData;
          currentStage = 'virtual_screening';
          console.log('DEBUG: Added binding_site_analysis to completed stages');
        }
      } catch (error) {
        console.error('Error reading binding site results file:', error);
      }
    }
    
    // Check for blockchain/IPFS verification data
    const blockchainPath = path.join(uploadsDir, 'blockchain.json');
    if (fs.existsSync(blockchainPath)) {
      try {
        blockchainData = JSON.parse(fs.readFileSync(blockchainPath, 'utf8'));
      } catch (error) {
        console.error('Error reading blockchain data:', error);
      }
    }
    
    // Update workflow with progress information
    workflow.stage = currentStage;
    workflow.status = completedStages.length > 0 ? 'in_progress' : 'pending';
    workflow.completed_stages = completedStages;
    workflow.progress = {
      completed: completedStages.length,
      total: 5,
      percentage: Math.round((completedStages.length / 5) * 100)
    };
    workflow.results = stageResults;
    workflow.blockchain = blockchainData;

    return NextResponse.json(workflow);

  } catch (error) {
    console.error('Error fetching workflow:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflow data' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Try to update workflow in the backend API
    try {
      const backendResponse = await fetch(`http://localhost:8080/api/v1/workflows/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (backendResponse.ok) {
        const updatedWorkflow = await backendResponse.json();
        return NextResponse.json(updatedWorkflow);
      }
    } catch (backendError) {
      console.log('Backend API not available for workflow update');
    }

    // Fallback: Return the updated data (in a real app, you'd save to a database)
    return NextResponse.json({
      id: id,
      ...body,
      updated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error updating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow' },
      { status: 500 }
    );
  }
}

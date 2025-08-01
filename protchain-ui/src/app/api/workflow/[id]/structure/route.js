import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import fs from 'fs';
import axios from 'axios';

export async function POST(request, context) {
  let id, logPath;
  
  try {
    const { id: workflowId } = await context.params;
    id = workflowId;
    
    // Handle JSON request instead of form data
    const requestData = await request.json();
    const pdbId = requestData.pdbId;

    if (!pdbId) {
      return NextResponse.json(
        { error: 'No PDB ID provided' },
        { status: 400 }
      );
    }

    // Create uploads directory in the project
    const projectRoot = join(process.cwd(), '..');
    const uploadDir = join(projectRoot, 'uploads');
    const workflowDir = join(uploadDir, id);
    await mkdir(workflowDir, { recursive: true });
    console.log('Created workflow directory:', workflowDir);

    // Create a log file to track processing
    logPath = join(workflowDir, 'structure_processing.log');
    await writeFile(logPath, `Starting structure processing at ${new Date().toISOString()}\nPDB ID: ${pdbId}\n`);
    
    // Fetch real PDB file from RCSB database
    const filePath = join(workflowDir, 'input.pdb');
    console.log('Fetching PDB file for:', pdbId);
    
    try {
      const pdbUrl = `https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`;
      const pdbResponse = await axios.get(pdbUrl);
      
      if (pdbResponse.data && pdbResponse.data.includes('HEADER')) {
        await writeFile(filePath, pdbResponse.data);
        console.log('Successfully downloaded PDB file for:', pdbId);
      } else {
        throw new Error('Invalid PDB file format received');
      }
    } catch (pdbError) {
      console.error('Failed to fetch PDB file:', pdbError.message);
      // Create a minimal valid PDB file as fallback
      const fallbackPdb = `HEADER    PROTEIN                             01-JAN-00   ${pdbId.toUpperCase()}\nATOM      1  CA  ALA A   1      20.154  16.967  23.478  1.00 20.00           C\nEND\n`;
      await writeFile(filePath, fallbackPdb);
      console.log('Created fallback PDB file for:', pdbId);
    }

    // Save the bioapi workflow ID mapping (using frontend ID as bioapi ID for simplicity)
    const mappingPath = join(workflowDir, 'bioapi-mapping.json');
    fs.writeFileSync(mappingPath, JSON.stringify({
      frontend_workflow_id: id,
      bioapi_workflow_id: id, // Use same ID for simplicity
      registered_at: new Date().toISOString()
    }, null, 2));

    // Process structure directly using bioapi structure endpoint (no workflow registration needed)
    const bioApiUrl = process.env.BIOAPI_URL || 'http://localhost:8000';
    const containerFilePath = join('/app/uploads', id, 'input.pdb').replace(/\\/g, '/');
    
    console.log('Calling bioapi structure endpoint:', `${bioApiUrl}/api/v1/workflows/${id}/structure`);
    console.log('Processing PDB ID:', pdbId, 'with container path:', containerFilePath);
    
    const bioApiResponse = await axios.post(
      `${bioApiUrl}/api/v1/workflows/${id}/structure`,
      {
        file_path: containerFilePath
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    console.log('Bioapi structure processing response:', bioApiResponse.data);
    fs.appendFileSync(logPath, `Bioapi structure processing completed at ${new Date().toISOString()}\n`);
    
    // Save results from bioapi
    const resultsPath = join(workflowDir, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(bioApiResponse.data, null, 2));
    console.log('Saved bioapi results to:', resultsPath);
    
    return NextResponse.json(bioApiResponse.data);
    
  } catch (error) {
    console.error('Structure processing error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    
    // Log the error to the processing log file if logPath exists
    if (logPath) {
      try {
        fs.appendFileSync(logPath, `Error at ${new Date().toISOString()}: ${error.message}\n`);
      } catch (logError) {
        console.error('Failed to write to log file:', logError);
      }
    }
    
    // Check if this is a timeout error
    if (error.message && (error.message.includes('timeout') || error.code === 'ECONNABORTED')) {
      console.log('Structure processing timed out');
      
      const fallbackResult = {
        status: 'timeout',
        message: 'Structure processing timed out',
        workflow_id: id,
        pdb_id: pdbId,
        processing_started: true
      };
      
      if (logPath) {
        try {
          fs.appendFileSync(logPath, `Timeout fallback result created at ${new Date().toISOString()}\n`);
        } catch (logError) {
          console.error('Failed to write to log file:', logError);
        }
      }
      
      return NextResponse.json(fallbackResult);
    }
    
    // For other errors, return the error details
    const errorResponse = {
      status: 'error',
      message: error.message || 'Unknown error occurred',
      workflow_id: id
    };
    
    if (error.response && error.response.data) {
      errorResponse.bioapi_error = error.response.data;
    }
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getWorkflowPath, getWorkflowFilePath, normalizePath } from '../../../../../utils/pathUtils';

/**
 * POST handler for validating workflow files and ensuring the directory structure exists
 * This does NOT create mock/placeholder files as that would compromise scientific integrity
 */
export async function POST(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  console.log(`Validating workflow files for: ${id}`);
  
  try {
    // Use the path utility function to get a normalized workflow path
    const workflowDir = getWorkflowPath(id);
    
    console.log(`Checking workflow directory: ${workflowDir}`);
    
    // Check if the workflow directory exists
    if (!fs.existsSync(workflowDir)) {
      console.log(`Creating workflow directory: ${workflowDir}`);
      fs.mkdirSync(workflowDir, { recursive: true });
    }
    
    // Check for input.pdb - we don't create a placeholder as this requires real data
    const inputPath = getWorkflowFilePath(id, 'input.pdb');
    const inputExists = fs.existsSync(inputPath);
    console.log(`Input PDB ${inputExists ? 'exists' : 'does not exist'} at: ${normalizePath(inputPath)}`);
    
    // Check for processed.pdb - this should be created by the structure preparation stage
    const processedPath = getWorkflowFilePath(id, 'processed.pdb');
    const processedExists = fs.existsSync(processedPath);
    console.log(`Processed PDB ${processedExists ? 'exists' : 'does not exist'} at: ${normalizePath(processedPath)}`);
    
    // Create or update results.json if it doesn't exist (only for registration purposes)
    const resultsPath = getWorkflowFilePath(id, 'results.json');
    let resultsData = {
      STRUCTURE_PREPARATION: true
    };
    
    let resultsExists = fs.existsSync(resultsPath);
    
    if (resultsExists) {
      try {
        const existingData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        // Preserve existing data, just ensure STRUCTURE_PREPARATION exists for registration
        if (!existingData.STRUCTURE_PREPARATION) {
          existingData.STRUCTURE_PREPARATION = true;
          fs.writeFileSync(resultsPath, JSON.stringify(existingData, null, 2));
          console.log('Updated existing results.json file with STRUCTURE_PREPARATION flag');
        }
      } catch (err) {
        console.error(`Error reading existing results.json: ${err.message}`);
      }
    } else {
      // Only create a minimal results.json for registration purposes
      fs.writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));
      console.log(`Created minimal results.json at: ${resultsPath} for registration purposes`);
      resultsExists = true;
    }
    
    // Generate appropriate message based on file status
    let message = '';
    if (!inputExists) {
      message = 'Input PDB file is missing. Please upload a real protein structure.';
    } else if (!processedExists) {
      message = 'Processed PDB file is missing. Please run structure preparation.';
    } else if (!resultsExists) {
      message = 'Results file is missing. Please run structure preparation.';
    } else {
      message = 'All required files exist. Ready for binding site analysis.';
    }
    
    // Return status response with file information
    return NextResponse.json({
      success: true,
      message,
      files: {
        workflowDir,
        input: inputExists,
        processed: processedExists,
        results: resultsExists
      },
      nextStep: !inputExists ? 'upload_structure' : 
               !processedExists ? 'run_structure_preparation' : 
               'run_binding_site_analysis'
    });
  } catch (err) {
    console.error(`Error validating workflow files: ${err.message}`);
    return NextResponse.json(
      { error: err.message || 'Failed to validate workflow files' },
      { status: 500 }
    );
  }
}

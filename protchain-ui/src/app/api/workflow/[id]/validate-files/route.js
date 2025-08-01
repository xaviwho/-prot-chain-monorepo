import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getWorkflowPath, getWorkflowFilePath, normalizePath } from '../../../../../utils/pathUtils';

/**
 * GET handler for validating workflow files
 * This checks if all required files exist for the workflow
 */
export async function GET(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  console.log(`Validating files for workflow: ${id}`);
  
  // Use the path utility function to get a normalized workflow path
  const workflowDir = getWorkflowPath(id);
  
  console.log(`Using standardized workflow directory: ${workflowDir}`);
  console.log(`Current working directory: ${process.cwd()}`);
  
  // Initialize validation result
  const result = {
    exists: false,
    hasInputFile: false,
    hasProcessedFile: false,
    hasResultsFile: false,
    isRegistered: false,
    workflowDir: null,
    message: 'Workflow not found'
  };
  
  // Check the standardized directory
  try {
    console.log(`Checking directory: ${workflowDir}`);
    
    // Use try/catch for each fs operation to handle any potential errors
    try {
      const dirExists = fs.existsSync(workflowDir);
      console.log(`Directory exists: ${dirExists}`);
      
      if (dirExists) {
        result.exists = true;
        result.workflowDir = workflowDir;
        
        // Check for input.pdb
        try {
          const inputPath = getWorkflowFilePath(id, 'input.pdb');
          result.hasInputFile = fs.existsSync(inputPath);
          console.log(`Input PDB exists: ${result.hasInputFile} at ${normalizePath(inputPath)}`);
        } catch (err) {
          console.error(`Error checking input.pdb: ${err.message}`);
        }
        
        // Check for processed.pdb
        try {
          const processedPath = getWorkflowFilePath(id, 'processed.pdb');
          result.hasProcessedFile = fs.existsSync(processedPath);
          console.log(`Processed PDB exists: ${result.hasProcessedFile} at ${normalizePath(processedPath)}`);
        } catch (err) {
          console.error(`Error checking processed.pdb: ${err.message}`);
        }
        
        // Check for results.json
        try {
          const resultsPath = getWorkflowFilePath(id, 'results.json');
          result.hasResultsFile = fs.existsSync(resultsPath);
          console.log(`Results JSON exists: ${result.hasResultsFile} at ${normalizePath(resultsPath)}`);
          
          if (result.hasResultsFile) {
            console.log(`Found results.json at ${resultsPath}`);
            
            // Check if the workflow is registered by looking at results.json
            try {
              const resultsContent = fs.readFileSync(resultsPath, 'utf8');
              const resultsData = JSON.parse(resultsContent);
              
              if (resultsData && resultsData.STRUCTURE_PREPARATION) {
                result.isRegistered = true;
                console.log('Workflow is registered with the backend');
              }
            } catch (parseErr) {
              console.error(`Error parsing results.json: ${parseErr.message}`);
            }
          }
        } catch (resultsErr) {
          console.error(`Error checking results.json: ${resultsErr.message}`);
        }
      }
      
      // Set appropriate message based on validation results
      if (result.hasInputFile && result.hasProcessedFile && result.hasResultsFile && result.isRegistered) {
        result.message = 'Workflow is ready for binding site analysis';
      } else if (result.hasInputFile && !result.hasProcessedFile) {
        result.message = 'Structure preparation needs to be run first';
      } else if (!result.hasInputFile) {
        result.message = 'Input PDB file not found';
      } else if (!result.isRegistered) {
        result.message = 'Workflow needs to be registered with the backend';
      }
      
      // If we found input.pdb but nothing else, set a specific message
      if (result.hasInputFile && !result.hasProcessedFile && !result.hasResultsFile) {
        result.message = 'Found input.pdb. Structure preparation needs to be run first.';
      }
    } catch (fsErr) {
      console.error(`Error checking directory existence: ${fsErr.message}`);
    }
  } catch (err) {
    console.error(`Error checking directory ${workflowDir}:`, err);
  }
  
  console.log('Validation result:', result);
  
  return NextResponse.json(result);
}

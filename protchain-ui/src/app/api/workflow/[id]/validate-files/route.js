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
  
  
  // Use the path utility function to get a normalized workflow path
  const workflowDir = getWorkflowPath(id);
  
  
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
    
    // Use try/catch for each fs operation to handle any potential errors
    try {
      const dirExists = fs.existsSync(workflowDir);
      
      if (dirExists) {
        result.exists = true;
        result.workflowDir = workflowDir;
        
        // Check for input.pdb
        try {
          const inputPath = getWorkflowFilePath(id, 'input.pdb');
          result.hasInputFile = fs.existsSync(inputPath);
        } catch (err) {
        }
        
        // Check for processed.pdb
        try {
          const processedPath = getWorkflowFilePath(id, 'processed.pdb');
          result.hasProcessedFile = fs.existsSync(processedPath);
        } catch (err) {
        }
        
        // Check for results.json
        try {
          const resultsPath = getWorkflowFilePath(id, 'results.json');
          result.hasResultsFile = fs.existsSync(resultsPath);
          
          if (result.hasResultsFile) {
            
            // Check if the workflow is registered by looking at results.json
            try {
              const resultsContent = fs.readFileSync(resultsPath, 'utf8');
              const resultsData = JSON.parse(resultsContent);
              
              if (resultsData && resultsData.STRUCTURE_PREPARATION) {
                result.isRegistered = true;
              }
            } catch (parseErr) {
            }
          }
        } catch (resultsErr) {
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
    }
  } catch (err) {
  }
  
  
  return NextResponse.json(result);
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getWorkflowPath, getWorkflowFilePath } from '../../../../../utils/pathUtils';

/**
 * GET handler for checking structure processing status
 * This endpoint checks if the structure processing has completed
 */
export async function GET(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  try {
    // Get the workflow directory path
    const workflowDir = getWorkflowPath(id);
    const inputPdbPath = getWorkflowFilePath(id, 'input.pdb');
    const processedPdbPath = getWorkflowFilePath(id, 'processed.pdb');
    const resultsPath = getWorkflowFilePath(id, 'results.json');
    const mappingPath = path.join(workflowDir, 'bioapi-mapping.json');
    
    console.log(`Checking structure processing status for workflow: ${id}`);
    
    // Check if results.json exists locally as fallback
    if (fs.existsSync(resultsPath)) {
      console.log('Local results found - processing completed');
      return NextResponse.json({
        status: 'COMPLETED',
        message: 'Structure processing completed'
      });
    }
    
    // Check if we have a bioapi workflow ID mapping (for real bioapi processing)
    let bioApiWorkflowId = id; // Default to frontend ID
    if (fs.existsSync(mappingPath)) {
      try {
        const mappingContent = fs.readFileSync(mappingPath, 'utf8');
        const mapping = JSON.parse(mappingContent);
        bioApiWorkflowId = mapping.bioapi_workflow_id;
        console.log(`Using bioapi workflow ID for status check: ${bioApiWorkflowId}`);
      } catch (error) {
        console.log('Failed to read bioapi mapping, using frontend ID');
      }
    }

    // Only try bioapi status check if we have a valid bioapi workflow ID
    if (bioApiWorkflowId && bioApiWorkflowId !== id && bioApiWorkflowId !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
      
      try {
        console.log('Checking bioapi status:', `${apiUrl}/api/v1/workflows/${bioApiWorkflowId}/status`);
        
        const response = await axios.get(
          `${apiUrl}/api/v1/workflows/${bioApiWorkflowId}/status`,
          {
            timeout: 5000
          }
        );
        
        console.log('Bioapi status response:', response.data);
        
        return NextResponse.json({
          status: response.data.status || 'PROCESSING',
          message: response.data.message || 'Processing status from bioapi',
          results: response.data.results || null
        });
      } catch (bioApiError) {
        console.error('Failed to check bioapi status:', {
          message: bioApiError.message,
          status: bioApiError.response?.status,
          statusText: bioApiError.response?.statusText,
          url: `${apiUrl}/api/v1/structure/workflows/${bioApiWorkflowId}/status`
        });
        
        // Fall back to local file checking if bioapi is unavailable
      }
    }
    
    // Fall back to local file checking if bioapi is unavailable
    console.log('Falling back to local file status checking');
    
    // Check if input file exists and get its size
    let inputFileSize = 0;
    if (fs.existsSync(inputPdbPath)) {
      const stats = fs.statSync(inputPdbPath);
      inputFileSize = stats.size;
      console.log(`Input PDB file size: ${inputFileSize} bytes`);
    }
    
    // Check if the processed PDB file exists
    const processedPdbExists = fs.existsSync(processedPdbPath);
    
    // Check if the results file exists
    const resultsFileExists = fs.existsSync(resultsPath);
    
    // If both files exist, structure processing is complete
    if (processedPdbExists && resultsFileExists) {
      // Read the results file
      const resultsContent = fs.readFileSync(resultsPath, 'utf8');
      let resultsData = {};
      
      try {
        resultsData = JSON.parse(resultsContent);
        console.log('Successfully parsed results.json');
        
        return NextResponse.json({
          status: 'COMPLETED',
          message: 'Structure processing completed',
          results: resultsData
        });
      } catch (error) {
        console.error('Error parsing results file:', error);
        return NextResponse.json({
          status: 'ERROR',
          message: 'Error parsing results file'
        });
      }
    }
    
    // Check if there's a log file that might indicate an error
    const logPath = getWorkflowFilePath(id, 'structure_processing.log');
    if (fs.existsSync(logPath)) {
      try {
        const logContent = fs.readFileSync(logPath, 'utf8');
        if (logContent.includes('ERROR') || logContent.includes('Exception')) {
          return NextResponse.json({
            status: 'ERROR',
            message: 'Error detected in processing log',
            log: logContent.slice(-500) // Return the last 500 characters of the log
          });
        }
      } catch (logError) {
        console.error('Error reading log file:', logError);
      }
    }
    
    // If only the processed PDB file exists, structure processing is partially complete
    if (processedPdbExists) {
      return NextResponse.json({
        status: 'PROCESSING',
        message: 'Structure processed, waiting for results',
        fileSize: inputFileSize
      });
    }
    
    // If input file is very large, provide a warning
    if (inputFileSize > 5 * 1024 * 1024) { // More than 5MB
      return NextResponse.json({
        status: 'PROCESSING',
        message: 'Processing large PDB file, this may take longer than usual',
        fileSize: inputFileSize
      });
    }
    
    // If neither file exists, structure processing is still in progress
    return NextResponse.json({
      status: 'PENDING',
      message: 'Structure processing in progress',
      fileSize: inputFileSize
    });
    
  } catch (error) {
    console.error('Error checking structure processing status:', error);
    return NextResponse.json(
      { 
        status: 'ERROR',
        error: 'Failed to check structure processing status' 
      },
      { status: 500 }
    );
  }
}

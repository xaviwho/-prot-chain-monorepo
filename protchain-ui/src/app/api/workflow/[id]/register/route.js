import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getWorkflowPath, getWorkflowFilePath, normalizePath } from '../../../../../utils/pathUtils';

/**
 * POST handler for registering a workflow with the backend
 * This creates the necessary directory structure and initializes results.json
 */
// Helper function for more robust Windows to WSL path conversion
function convertToWslPath(windowsPath) {
  if (!windowsPath) return '';
  
  try {
    // Extract drive letter
    const driveLetter = windowsPath.match(/^([A-Za-z]):/)?.[1]?.toLowerCase();
    if (!driveLetter) return windowsPath; // Not a Windows path with drive letter
    
    // Replace backslashes with forward slashes and add /mnt/drive prefix
    const wslPath = `/mnt/${driveLetter}${windowsPath.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/')}`;
    return wslPath;
  } catch (err) {
    // Fallback to simple replacement
    return windowsPath.replace(/^[A-Za-z]:/, '').replace(/\\/g, '/');
  }
}

export async function POST(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  
  try {
    // Use the path utility function to get a normalized workflow path
    const workflowDir = getWorkflowPath(id);
    
    
    // Create the workflow directory if it doesn't exist
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    } else {
    }
    
    // Create a minimal results.json file if it doesn't exist
    const resultsPath = getWorkflowFilePath(id, 'results.json');
    let resultsData = { STRUCTURE_PREPARATION: true };
    
    // If results.json already exists, read it and update the STRUCTURE_PREPARATION field
    if (fs.existsSync(resultsPath)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        resultsData = { ...existingData, STRUCTURE_PREPARATION: true };
      } catch (err) {
        // Continue with the default resultsData
      }
    }
    
    // Write the results.json file
    fs.writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));
    
    // Check if input.pdb exists, if not create a placeholder
    const inputPath = getWorkflowFilePath(id, 'input.pdb');
    if (!fs.existsSync(inputPath)) {
    } else {
      
      // Create processed.pdb as a copy of input.pdb if it doesn't exist
      const processedPath = getWorkflowFilePath(id, 'processed.pdb');
      if (!fs.existsSync(processedPath)) {
        try {
          fs.copyFileSync(inputPath, processedPath);
        } catch (copyErr) {
        }
      } else {
      }
    }
    
    // Call the backend API to register the workflow
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
      const response = await fetch(`${apiUrl}/api/v1/workflows/${id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow_id: id,
          path: normalizePath(workflowDir),
          // For WSL compatibility, also provide the WSL path
          wsl_path: convertToWslPath(normalizePath(workflowDir)),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // Even if backend registration fails, we still created the local directory structure
        return NextResponse.json({
          success: false,
          message: `Local directory created but backend registration failed: ${response.status}`,
          workflowDir,
          backendError: errorData,
        });
      }
      
      const data = await response.json();
      
      return NextResponse.json({
        success: true,
        message: 'Workflow registered successfully',
        workflowDir,
        backendData: data,
      });
    } catch (apiError) {
      
      // Even if backend registration fails, we still created the local directory structure
      return NextResponse.json({
        success: false,
        message: `Local directory created but backend API call failed: ${apiError.message}`,
        workflowDir,
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Failed to register workflow' },
      { status: 500 }
    );
  }
}

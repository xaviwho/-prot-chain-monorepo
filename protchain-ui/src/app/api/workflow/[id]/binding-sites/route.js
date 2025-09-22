import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getWorkflowPath, getWorkflowFilePath, normalizePath } from '../../../../../utils/pathUtils';

/**
 * GET handler for fetching binding site analysis results
 */
export async function GET(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  try {
    // First try to get results from local file system
    const workflowDir = getWorkflowPath(id);
    const resultsPath = getWorkflowFilePath(id, 'results.json');
    
    // Check if results file exists and has binding site data
    if (fs.existsSync(resultsPath)) {
      try {
        const resultsContent = fs.readFileSync(resultsPath, 'utf8');
        const resultsData = JSON.parse(resultsContent);
        
        console.log('Checking for binding site data in:', resultsPath);
        console.log('Results data keys:', Object.keys(resultsData));
        
        // Check for binding sites in binding_site_analysis
        if (resultsData.binding_site_analysis && 
            resultsData.binding_site_analysis.binding_sites && 
            resultsData.binding_site_analysis.binding_sites.length > 0) {
          
          console.log(`Found ${resultsData.binding_site_analysis.binding_sites.length} binding sites in binding_site_analysis`);
          return NextResponse.json({
            binding_sites: resultsData.binding_site_analysis.binding_sites,
            method: resultsData.binding_site_analysis.method || 'unknown',
            binding_site_analysis: resultsData.binding_site_analysis
          });
        }
        
        // Check for direct binding_sites array
        if (resultsData.binding_sites && 
            Array.isArray(resultsData.binding_sites) && 
            resultsData.binding_sites.length > 0) {
          
          console.log(`Found ${resultsData.binding_sites.length} binding sites in direct binding_sites array`);
          return NextResponse.json({
            binding_sites: resultsData.binding_sites,
            method: resultsData.method || 'unknown',
            binding_site_analysis: {
              binding_sites: resultsData.binding_sites,
              method: resultsData.method || 'unknown',
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (parseError) {
        console.error('Error parsing results file:', parseError);
      }
    }
    
    // If no local results, try the backend API
    console.log('No local binding site results found, trying backend API...');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const response = await fetch(`${apiUrl}/api/v1/workflows/${id}/binding-sites`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.binding_sites && data.binding_sites.length > 0) {
        return NextResponse.json(data);
      }
    }
    
    // If backend API fails or returns no binding sites, try to run the guaranteed method
    console.log('Backend API returned no binding sites, running guaranteed binding site detection...');
    
    // Check if we have a processed PDB file
    const pdbPath = getWorkflowFilePath(id, 'processed.pdb');
    if (!fs.existsSync(pdbPath)) {
      return NextResponse.json(
        { error: 'No processed PDB file found. Please run structure preparation first.' },
        { status: 404 }
      );
    }
    
    // Run the guaranteed binding site detection
    const guaranteedResponse = await fetch(`/api/workflow/${id}/guaranteed-binding-sites`, {
      method: 'POST',
    });
    
    if (guaranteedResponse.ok) {
      const guaranteedData = await guaranteedResponse.json();
      console.log('Guaranteed binding site detection succeeded');
      return NextResponse.json(guaranteedData);
    }
    
    // If all methods fail, return an error
    return NextResponse.json(
      { error: 'No binding sites found. Please try a different protein structure.' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching binding sites:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch binding sites' },
      { status: 500 }
    );
  }
}

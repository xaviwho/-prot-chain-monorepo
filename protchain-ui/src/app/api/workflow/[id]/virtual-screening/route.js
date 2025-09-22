import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    console.log('Processing REAL virtual screening for workflow:', id);
    
    // Get the uploads directory path (in root directory, not protchain-ui)
    const rootDir = path.resolve(process.cwd(), '..');
    const uploadsDir = path.join(rootDir, 'uploads', id);
    console.log('DEBUG: uploadsDir:', uploadsDir);
    
    // Check if PDB file exists
    const pdbPath = path.join(uploadsDir, 'input.pdb');
    if (!fs.existsSync(pdbPath)) {
      return NextResponse.json({ 
        error: 'PDB file not found. Please run structure preparation first.' 
      }, { status: 400 });
    }
    
    // Check if binding site analysis results exist
    const resultsPath = path.join(uploadsDir, 'results.json');
    if (!fs.existsSync(resultsPath)) {
      return NextResponse.json({ 
        error: 'Binding site analysis results not found. Please run binding site analysis first.' 
      }, { status: 400 });
    }
    
    // Read binding site analysis results
    let bindingSiteData = null;
    try {
      const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      bindingSiteData = resultsData.binding_site_analysis;
      
      if (!bindingSiteData || !bindingSiteData.binding_sites || bindingSiteData.binding_sites.length === 0) {
        return NextResponse.json({ 
          error: 'No binding sites found. Please run binding site analysis first.' 
        }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json({ 
        error: 'Failed to read binding site analysis results.' 
      }, { status: 400 });
    }
    
    // Use the best binding site (first one, as they're sorted by score)
    const bestBindingSite = bindingSiteData.binding_sites[0];
    console.log('Using binding site for virtual screening:', bestBindingSite);
    
    // Read PDB content
    const pdbContent = fs.readFileSync(pdbPath, 'utf8');
    
    // Get request parameters
    const requestBody = await request.json();
    const compoundLibrary = requestBody.compound_library || 'fda_approved';
    const maxCompounds = requestBody.max_compounds || 50;
    
    // Call REAL bioapi virtual screening
    console.log('Calling REAL bioapi virtual screening...');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const bioApiResponse = await fetch(`${apiUrl}/api/v1/screening/virtual-screening`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflow_id: id,
        binding_site: bestBindingSite,
        pdb_content: pdbContent,
        compound_library: compoundLibrary,
        max_compounds: maxCompounds,
        wsl_path: `/app/uploads/${id}`
      })
    });
    
    if (!bioApiResponse.ok) {
      throw new Error(`BioAPI request failed: ${bioApiResponse.status} ${bioApiResponse.statusText}`);
    }
    
    const bioApiResult = await bioApiResponse.json();
    console.log('REAL bioapi virtual screening result:', bioApiResult);
    
    // Implement polling for long-running virtual screening (compounds take time to dock)
    console.log('Bioapi started virtual screening, polling for results...');
    let screeningResults = null;
    let attempts = 0;
    const maxAttempts = 30; // Poll for up to 3 minutes (30 * 6 seconds)
    
    while (attempts < maxAttempts && !screeningResults) {
      attempts++;
      console.log(`Polling attempt ${attempts}/${maxAttempts} for virtual screening results...`);
      
      // Wait 6 seconds between polls
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Check if results file exists and has virtual screening data
      if (fs.existsSync(resultsPath)) {
        try {
          const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
          if (resultsData.virtual_screening && resultsData.virtual_screening.status === 'success') {
            screeningResults = resultsData.virtual_screening;
            console.log('Found REAL virtual screening results:', screeningResults);
            break;
          }
        } catch (error) {
          console.error('Error reading virtual screening results:', error);
        }
      }
    }
    
    // Return real virtual screening results
    if (screeningResults && screeningResults.top_compounds) {
      return NextResponse.json({
        status: 'success',
        message: 'REAL virtual screening completed successfully',
        method: screeningResults.method || 'autodock_vina_molecular_docking',
        binding_site_used: screeningResults.binding_site_used,
        compounds_screened: screeningResults.compounds_screened,
        hits_found: screeningResults.hits_found,
        top_compounds: screeningResults.top_compounds,
        compound_library: compoundLibrary,
        max_compounds: maxCompounds
      });
    } else {
      return NextResponse.json({ 
        error: 'Virtual screening timed out or no results found',
        debug_info: {
          bioapi_response: bioApiResult,
          polling_attempts: attempts,
          results_file_exists: fs.existsSync(resultsPath),
          uploads_dir: uploadsDir
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in virtual screening:', error);
    return NextResponse.json({ 
      error: 'Internal server error during virtual screening',
      details: error.message 
    }, { status: 500 });
  }
}

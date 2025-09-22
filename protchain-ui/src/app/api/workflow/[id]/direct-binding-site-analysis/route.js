import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    console.log('Processing REAL binding site analysis for workflow:', id);
    
    // Get the uploads directory path (in root directory, not protchain-ui)
    const rootDir = path.resolve(process.cwd(), '..');
    const uploadsDir = path.join(rootDir, 'uploads', id);
    console.log('DEBUG: uploadsDir:', uploadsDir);
    
    // Check if PDB file exists, if not try to fetch it from the workflow data
    const pdbPath = path.join(uploadsDir, 'input.pdb');
    let pdbContent = null;
    let pdbId = null;
    
    if (!fs.existsSync(pdbPath)) {
      console.error(`PDB file not found at: ${pdbPath}`);
      console.error(`Uploads directory exists: ${fs.existsSync(uploadsDir)}`);
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        console.error(`Files in uploads directory: ${files.join(', ')}`);
      }
      
      // Try to get PDB content from blockchain.json or fetch from PDB database
      const blockchainPath = path.join(uploadsDir, 'blockchain.json');
      if (fs.existsSync(blockchainPath)) {
        try {
          const blockchainData = JSON.parse(fs.readFileSync(blockchainPath, 'utf8'));
          console.log('Blockchain data:', JSON.stringify(blockchainData, null, 2));
          
          // Try multiple possible locations for PDB ID
          pdbId = blockchainData.pdbId || 
                       blockchainData.pdb_id || 
                       blockchainData.data?.pdbId || 
                       blockchainData.data?.pdb_id ||
                       blockchainData.results?.pdbId ||
                       blockchainData.results?.pdb_id ||
                       blockchainData.verification_data?.ipfs?.content?.results?.pdbId ||
                       blockchainData.verification_data?.ipfs?.content?.results?.data?.pdb_id ||
                       blockchainData.verification_data?.ipfs?.content?.results?.data?.details?.descriptors?.pdb_id;
          
          console.log('Extracted PDB ID:', pdbId);
          
          if (pdbId) {
            console.log(`Attempting to fetch PDB ${pdbId} from RCSB PDB database...`);
            
            // Fetch PDB from RCSB PDB database
            const pdbResponse = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
            if (pdbResponse.ok) {
              pdbContent = await pdbResponse.text();
              
              // Save the PDB file for future use
              fs.writeFileSync(pdbPath, pdbContent);
              console.log(`Successfully fetched and saved PDB ${pdbId} to ${pdbPath}`);
            } else {
              console.error(`Failed to fetch PDB ${pdbId} from RCSB: ${pdbResponse.statusText}`);
              throw new Error(`Failed to fetch PDB ${pdbId} from RCSB: ${pdbResponse.statusText}`);
            }
          } else {
            console.error('No PDB ID found in blockchain data');
          }
        } catch (error) {
          console.error('Error processing blockchain.json or fetching PDB:', error);
        }
      }
      
      // If we still don't have PDB content, return error
      if (!pdbContent) {
        return NextResponse.json({ 
          error: 'PDB file not found and could not be retrieved. Please complete structure preparation first.',
          details: {
            expected_path: pdbPath,
            uploads_dir_exists: fs.existsSync(uploadsDir),
            available_files: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [],
            blockchain_file_exists: fs.existsSync(path.join(uploadsDir, 'blockchain.json'))
          }
        }, { status: 400 });
      }
    } else {
      // Read existing PDB content
      pdbContent = fs.readFileSync(pdbPath, 'utf8');
    }
    
    // Call REAL bioapi binding site analysis
    console.log('Calling REAL bioapi binding site analysis...');
    let bioApiResponse;
    let bioApiResult;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
      bioApiResponse = await fetch(`${apiUrl}/api/v1/binding/direct-binding-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdb_id: pdbId || "unknown",
          structure_data: pdbContent
        })
      });
      
      if (!bioApiResponse.ok) {
        console.error(`BioAPI request failed: ${bioApiResponse.status} ${bioApiResponse.statusText}`);
        const errorText = await bioApiResponse.text();
        console.error('BioAPI error response:', errorText);
        
        throw new Error(`BioAPI service error: ${bioApiResponse.status} ${bioApiResponse.statusText}. Please ensure the BioAPI service is running on port 8000.`);
      }
      
      bioApiResult = await bioApiResponse.json();
    } catch (fetchError) {
      console.error('Failed to connect to BioAPI:', fetchError);
      throw new Error(`Cannot connect to BioAPI service: ${fetchError.message}. Please ensure the BioAPI service is running on port 8000.`);
    }
    
    console.log('REAL bioapi binding site analysis result:', bioApiResult);
    
    // The bioapi returns results directly in the response, not in a file
    // Check if bioapi result already contains binding sites
    if (bioApiResult && bioApiResult.data && bioApiResult.data.binding_sites) {
      console.log('Found REAL binding site results in bioapi response:', bioApiResult);
      return NextResponse.json({
        status: 'success',
        message: 'REAL binding site analysis completed successfully',
        binding_sites: bioApiResult.data.binding_sites,
        method: bioApiResult.data.method || 'real_geometric_cavity_detection',
        protein_atoms_count: bioApiResult.data.protein_atoms_count,
        pdb_id: pdbId,
        pdbId: pdbId
      });
    }
    
    // Implement polling for long-running analysis (large proteins take time)
    console.log('Bioapi started analysis, polling for results...');
    const resultsPath = path.join(uploadsDir, 'results.json');
    let bindingSiteResults = null;
    let attempts = 0;
    const maxAttempts = 20; // Poll for up to 2 minutes (20 * 6 seconds)
    
    while (attempts < maxAttempts && !bindingSiteResults) {
      attempts++;
      console.log(`Polling attempt ${attempts}/${maxAttempts} for binding site results...`);
      
      // Wait 6 seconds between polls
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // Check if results file exists and has binding site data
      if (fs.existsSync(resultsPath)) {
        try {
          const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
          if (resultsData.binding_site_analysis && resultsData.binding_site_analysis.binding_sites) {
            bindingSiteResults = resultsData.binding_site_analysis;
            console.log('Found REAL binding site results in file:', bindingSiteResults);
            break;
          }
        } catch (error) {
          console.error('Error reading binding site results:', error);
        }
      }
    }
    
    // Return real binding site analysis results
    if (bindingSiteResults && bindingSiteResults.binding_sites) {
      return NextResponse.json({
        status: 'success',
        message: 'REAL binding site analysis completed successfully',
        binding_sites: bindingSiteResults.binding_sites,
        method: bindingSiteResults.method || 'real_geometric_cavity_detection',
        protein_atoms_count: bindingSiteResults.protein_atoms_count
      });
    } else {
      return NextResponse.json({ 
        error: 'Binding site analysis timed out or no results found',
        debug_info: {
          bioapi_response: bioApiResult,
          polling_attempts: attempts,
          results_file_exists: fs.existsSync(resultsPath),
          uploads_dir: uploadsDir
        }
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error in binding site analysis:', error);
    return NextResponse.json({ 
      error: 'Internal server error during binding site analysis',
      details: error.message 
    }, { status: 500 });
  }
}
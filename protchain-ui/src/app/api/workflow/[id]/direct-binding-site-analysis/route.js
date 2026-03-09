import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { commitStageToBlockchain } from '../../../../../utils/blockchainCommit';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Parse request body for optional pdb_id
    let requestBody = {};
    try {
      requestBody = await request.json();
    } catch (_) {}

    // Get the uploads directory path (in root directory, not protchain-ui)
    const rootDir = path.resolve(process.cwd(), '..');
    const uploadsDir = path.join(rootDir, 'uploads', id);

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Check if PDB file exists, if not try to fetch it from the workflow data
    const pdbPath = path.join(uploadsDir, 'input.pdb');
    let pdbContent = null;
    let pdbId = requestBody.pdb_id || requestBody.pdbId || null;

    if (!fs.existsSync(pdbPath)) {
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
      }

      // Try to get PDB ID from pdb-info.json (saved during structure preparation)
      const pdbInfoPath = path.join(uploadsDir, 'pdb-info.json');
      if (!pdbId && fs.existsSync(pdbInfoPath)) {
        try {
          const pdbInfo = JSON.parse(fs.readFileSync(pdbInfoPath, 'utf8'));
          pdbId = pdbInfo.pdb_id;
        } catch (_) {}
      }

      // Fallback: try blockchain.json
      if (!pdbId) {
        const blockchainPath = path.join(uploadsDir, 'blockchain.json');
        if (fs.existsSync(blockchainPath)) {
          try {
            const blockchainData = JSON.parse(fs.readFileSync(blockchainPath, 'utf8'));
            pdbId = blockchainData.pdbId ||
                         blockchainData.pdb_id ||
                         blockchainData.data?.pdbId ||
                         blockchainData.data?.pdb_id ||
                         blockchainData.results?.pdbId ||
                         blockchainData.results?.pdb_id ||
                         blockchainData.verification_data?.ipfs?.content?.results?.pdbId ||
                         blockchainData.verification_data?.ipfs?.content?.results?.data?.pdb_id ||
                         blockchainData.verification_data?.ipfs?.content?.results?.data?.details?.descriptors?.pdb_id;
          } catch (_) {}
        }
      }

      // Fetch PDB from RCSB if we have an ID
      if (pdbId) {
        const pdbResponse = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
        if (pdbResponse.ok) {
          pdbContent = await pdbResponse.text();
          // Save the PDB file for future use
          fs.writeFileSync(pdbPath, pdbContent);
        } else {
          throw new Error(`Failed to fetch PDB ${pdbId} from RCSB: ${pdbResponse.statusText}`);
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
    let bioApiResponse;
    let bioApiResult;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

      // Forward the Authorization header from the incoming request to the Go backend
      const authHeader = request.headers.get('authorization');
      const headers = {
        'Content-Type': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      bioApiResponse = await fetch(`${apiUrl}/api/v1/binding/direct-binding-analysis`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pdb_id: pdbId || "unknown",
          structure_data: pdbContent
        })
      });
      
      if (!bioApiResponse.ok) {
        const errorText = await bioApiResponse.text();
        
        throw new Error(`BioAPI service error: ${bioApiResponse.status} ${bioApiResponse.statusText}. Please ensure the BioAPI service is running on port 8000.`);
      }
      
      bioApiResult = await bioApiResponse.json();
    } catch (fetchError) {
      throw new Error(`Cannot connect to BioAPI service: ${fetchError.message}. Please ensure the BioAPI service is running on port 8000.`);
    }
    
    
    // Extract binding sites from the BioAPI response
    let bindingSites = [];
    let method = 'real_geometric_cavity_detection';

    if (bioApiResult?.data?.binding_sites) {
      bindingSites = bioApiResult.data.binding_sites;
      method = bioApiResult.data.method || method;
    } else if (bioApiResult?.binding_sites) {
      bindingSites = bioApiResult.binding_sites;
      method = bioApiResult.method || method;
    }

    if (bindingSites.length > 0) {
      // Save binding site results to results.json so virtual screening can find them
      const resultsPath = path.join(uploadsDir, 'results.json');
      let existingResults = {};
      if (fs.existsSync(resultsPath)) {
        try {
          existingResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        } catch (_) {}
      }

      existingResults.binding_site_analysis = {
        binding_sites: bindingSites,
        method: method,
        timestamp: new Date().toISOString(),
        pdb_id: pdbId
      };

      fs.writeFileSync(resultsPath, JSON.stringify(existingResults, null, 2));

      // Automatic blockchain commit (non-fatal)
      const blockchainResult = await commitStageToBlockchain(
        id, 'binding_site_analysis', existingResults.binding_site_analysis, request
      );

      return NextResponse.json({
        status: 'success',
        message: 'REAL binding site analysis completed successfully',
        binding_sites: bindingSites,
        binding_site_analysis: existingResults.binding_site_analysis,
        method: method,
        protein_atoms_count: bioApiResult?.data?.protein_atoms_count,
        pdb_id: pdbId,
        pdbId: pdbId,
        blockchain: blockchainResult,
      });
    }

    // Fallback: poll for results file if BioAPI returned async
    const resultsPath = path.join(uploadsDir, 'results.json');
    let bindingSiteResults = null;
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts && !bindingSiteResults) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 6000));

      if (fs.existsSync(resultsPath)) {
        try {
          const resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
          if (resultsData.binding_site_analysis?.binding_sites?.length > 0) {
            bindingSiteResults = resultsData.binding_site_analysis;
            break;
          }
        } catch (_) {}
      }
    }

    if (bindingSiteResults?.binding_sites) {
      return NextResponse.json({
        status: 'success',
        message: 'REAL binding site analysis completed successfully',
        binding_sites: bindingSiteResults.binding_sites,
        binding_site_analysis: bindingSiteResults,
        method: bindingSiteResults.method || method
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
    return NextResponse.json({ 
      error: 'Internal server error during binding site analysis',
      details: error.message 
    }, { status: 500 });
  }
}
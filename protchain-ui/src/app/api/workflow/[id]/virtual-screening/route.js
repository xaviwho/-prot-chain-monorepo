import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import http from 'http';

// Allow up to 10 minutes for long-running docking jobs
export const maxDuration = 600;

/**
 * Long-running POST using Node http module to avoid undici headers timeout.
 */
function longPost(url, headers, body, timeoutMs = 600000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      timeout: timeoutMs,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, statusText: res.statusMessage, text: () => Promise.resolve(data), json: () => Promise.resolve(JSON.parse(data)) }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Get the uploads directory path (in root directory, not protchain-ui)
    const rootDir = path.resolve(process.cwd(), '..');
    const uploadsDir = path.join(rootDir, 'uploads', id);

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

    // Read PDB content
    const pdbContent = fs.readFileSync(pdbPath, 'utf8');

    // Get request parameters
    const requestBody = await request.json();
    const compoundLibrary = requestBody.compound_library || 'fda_approved';
    const maxCompounds = requestBody.max_compounds || 50;
    const dockingMethod = requestBody.docking_method || 'physics'; // "physics" or "vina"
    const compoundRangeStart = requestBody.compound_range_start; // 1-based
    const compoundRangeEnd = requestBody.compound_range_end;     // 1-based, inclusive

    // Load custom compounds if user selected 'custom' library
    let customCompounds = null;
    if (compoundLibrary === 'custom') {
      const parsedPath = path.join(uploadsDir, 'parsed_compounds.json');
      if (!fs.existsSync(parsedPath)) {
        return NextResponse.json({
          error: 'Custom compounds not found. Please upload a compound file first.'
        }, { status: 400 });
      }
      try {
        const parsedData = JSON.parse(fs.readFileSync(parsedPath, 'utf8'));
        customCompounds = parsedData.compounds;
        if (!customCompounds || customCompounds.length === 0) {
          return NextResponse.json({
            error: 'Custom compound file is empty. Please upload a valid compound file.'
          }, { status: 400 });
        }

        // Apply molecule range selection (1-based, inclusive)
        if (compoundRangeStart && compoundRangeEnd) {
          const start = Math.max(0, compoundRangeStart - 1); // convert to 0-based
          const end = Math.min(customCompounds.length, compoundRangeEnd); // slice end is exclusive
          customCompounds = customCompounds.slice(start, end);
          if (customCompounds.length === 0) {
            return NextResponse.json({
              error: `No compounds in range ${compoundRangeStart}-${compoundRangeEnd}. File has ${parsedData.compounds.length} compounds.`
            }, { status: 400 });
          }
        }
      } catch (e) {
        return NextResponse.json({
          error: 'Failed to read parsed compounds file.'
        }, { status: 400 });
      }
    }

    // Call BioAPI via Go backend — route to Vina or physics-based screening
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8082';
    const authHeader = request.headers.get('authorization');
    const fetchHeaders = { 'Content-Type': 'application/json' };
    if (authHeader) fetchHeaders['Authorization'] = authHeader;

    const screeningEndpoint = dockingMethod === 'vina'
      ? `${apiUrl}/api/v1/screening/vina-docking`
      : `${apiUrl}/api/v1/screening/virtual-screening`;

    const postBody = JSON.stringify({
      workflow_id: id,
      binding_site: bestBindingSite,
      pdb_content: pdbContent,
      compound_library: compoundLibrary,
      max_compounds: maxCompounds,
      custom_compounds: customCompounds,
    });

    // Use Node http module to avoid undici headers timeout on long-running docking
    const bioApiResponse = await longPost(screeningEndpoint, fetchHeaders, postBody);

    if (!bioApiResponse.ok) {
      const errorText = await bioApiResponse.text();
      console.error('Virtual screening API error:', bioApiResponse.status, errorText);
      return NextResponse.json({
        error: `Virtual screening failed: ${bioApiResponse.status} ${bioApiResponse.statusText}`,
        details: errorText
      }, { status: bioApiResponse.status });
    }

    const bioApiResult = await bioApiResponse.json();

    // Extract screening data from the response
    // BioAPI returns { success: true, data: { status, top_compounds, ... } }
    const screeningData = bioApiResult.data || bioApiResult;

    if (!screeningData || !screeningData.top_compounds) {
      return NextResponse.json({
        error: 'Virtual screening returned no results',
        debug_info: bioApiResult
      }, { status: 500 });
    }

    // Save virtual screening results to results.json for future reference
    try {
      let existingResults = {};
      if (fs.existsSync(resultsPath)) {
        try { existingResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8')); } catch (_) {}
      }
      existingResults.virtual_screening = {
        ...screeningData,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(resultsPath, JSON.stringify(existingResults, null, 2));
    } catch (saveError) {
      console.error('Failed to save virtual screening results:', saveError);
      // Non-fatal — we still return the results
    }

    // Return virtual screening results
    return NextResponse.json({
      status: 'success',
      message: dockingMethod === 'vina'
        ? 'Vina molecular docking completed successfully'
        : 'Virtual screening completed successfully',
      method: screeningData.method || 'physics_based_scoring',
      binding_site_used: screeningData.binding_site_used,
      compounds_screened: screeningData.compounds_screened,
      compounds_docked: screeningData.compounds_docked,
      hits_found: screeningData.hits_found,
      top_compounds: screeningData.top_compounds,
      scoring_components: screeningData.scoring_components,
      compound_library: compoundLibrary,
      max_compounds: maxCompounds,
      docking_method: dockingMethod,
      total_docking_time_seconds: screeningData.total_docking_time_seconds,
      docking_failures: screeningData.docking_failures,
      exhaustiveness: screeningData.exhaustiveness,
    });

  } catch (error) {
    console.error('Virtual screening error:', error);
    return NextResponse.json({
      error: 'Internal server error during virtual screening',
      details: error.message
    }, { status: 500 });
  }
}

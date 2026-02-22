import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    // Get the uploads directory path
    const rootDir = path.resolve(process.cwd(), '..');
    const uploadsDir = path.join(rootDir, 'uploads', id);

    // Check if PDB file exists
    const pdbPath = path.join(uploadsDir, 'input.pdb');
    if (!fs.existsSync(pdbPath)) {
      return NextResponse.json({
        error: 'PDB file not found. Please run structure preparation first.'
      }, { status: 400 });
    }

    // Read results.json to get binding site and virtual screening data
    const resultsPath = path.join(uploadsDir, 'results.json');
    if (!fs.existsSync(resultsPath)) {
      return NextResponse.json({
        error: 'Previous stage results not found. Please run binding site analysis and virtual screening first.'
      }, { status: 400 });
    }

    let existingResults;
    try {
      existingResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    } catch (error) {
      return NextResponse.json({
        error: 'Failed to read previous results.'
      }, { status: 400 });
    }

    // Require binding site data
    const bindingSiteData = existingResults.binding_site_analysis;
    if (!bindingSiteData || !bindingSiteData.binding_sites || bindingSiteData.binding_sites.length === 0) {
      return NextResponse.json({
        error: 'No binding sites found. Please run binding site analysis first.'
      }, { status: 400 });
    }

    // Require virtual screening results
    const vsData = existingResults.virtual_screening;
    if (!vsData || !vsData.top_compounds || vsData.top_compounds.length === 0) {
      return NextResponse.json({
        error: 'No virtual screening results found. Please run virtual screening first.'
      }, { status: 400 });
    }

    const bestBindingSite = bindingSiteData.binding_sites[0];
    const pdbContent = fs.readFileSync(pdbPath, 'utf8');

    // Get request parameters
    const requestBody = await request.json();
    const temperature = requestBody.temperature || 300.0;
    const nSteps = requestBody.n_steps || 5000;
    const maxCompounds = requestBody.max_compounds || 10;

    // Use top compounds from virtual screening
    const topCompounds = vsData.top_compounds.slice(0, maxCompounds);

    // Call BioAPI via Go backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8082';
    const authHeader = request.headers.get('authorization');
    const fetchHeaders = { 'Content-Type': 'application/json' };
    if (authHeader) fetchHeaders['Authorization'] = authHeader;

    const bioApiResponse = await fetch(`${apiUrl}/api/v1/simulation/molecular-dynamics`, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify({
        workflow_id: id,
        binding_site: bestBindingSite,
        pdb_content: pdbContent,
        top_compounds: topCompounds,
        temperature,
        n_steps: nSteps,
        max_compounds: maxCompounds,
      })
    });

    if (!bioApiResponse.ok) {
      const errorText = await bioApiResponse.text();
      console.error('MD simulation API error:', bioApiResponse.status, errorText);
      return NextResponse.json({
        error: `Molecular dynamics simulation failed: ${bioApiResponse.status} ${bioApiResponse.statusText}`,
        details: errorText
      }, { status: bioApiResponse.status });
    }

    const bioApiResult = await bioApiResponse.json();
    const mdData = bioApiResult.data || bioApiResult;

    if (!mdData || !mdData.compound_results) {
      return NextResponse.json({
        error: 'Molecular dynamics simulation returned no results',
        debug_info: bioApiResult
      }, { status: 500 });
    }

    // Save MD results to results.json
    try {
      existingResults.molecular_dynamics = {
        ...mdData,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(resultsPath, JSON.stringify(existingResults, null, 2));
    } catch (saveError) {
      console.error('Failed to save MD results:', saveError);
    }

    return NextResponse.json({
      status: 'success',
      message: 'Molecular dynamics simulation completed successfully',
      method: mdData.method || 'physics_based_md_simulation',
      temperature_kelvin: mdData.temperature_kelvin,
      simulation_steps: mdData.simulation_steps,
      simulation_time_ns: mdData.simulation_time_ns,
      compounds_simulated: mdData.compounds_simulated,
      compounds_failed: mdData.compounds_failed,
      stable_compounds: mdData.stable_compounds,
      average_rmsd_angstrom: mdData.average_rmsd_angstrom,
      average_interaction_energy_kcal: mdData.average_interaction_energy_kcal,
      compound_results: mdData.compound_results,
      trajectories: mdData.trajectories,
      residue_rmsf_summary: mdData.residue_rmsf_summary,
      binding_site_used: mdData.binding_site_used,
      total_computation_time_seconds: mdData.total_computation_time_seconds,
    });

  } catch (error) {
    console.error('Molecular dynamics error:', error);
    return NextResponse.json({
      error: 'Internal server error during molecular dynamics simulation',
      details: error.message
    }, { status: 500 });
  }
}

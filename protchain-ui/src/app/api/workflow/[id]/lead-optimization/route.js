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

    // Get the uploads directory path
    const rootDir = path.resolve(process.cwd(), '..');
    const uploadsDir = path.join(rootDir, 'uploads', id);

    // Read results.json to get MD and virtual screening data
    const resultsPath = path.join(uploadsDir, 'results.json');
    if (!fs.existsSync(resultsPath)) {
      return NextResponse.json({
        error: 'Previous stage results not found. Please run earlier stages first.'
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

    // Build compound list from MD results (preferred) or virtual screening results
    let compounds = [];
    const mdData = existingResults.molecular_dynamics;
    const vsData = existingResults.virtual_screening;

    if (mdData && mdData.compound_results && mdData.compound_results.length > 0) {
      // Use MD results — these have stability verdicts and interaction energies
      compounds = mdData.compound_results.map((c) => ({
        name: c.compound_name || c.name,
        smiles: c.smiles,
        docking_score: c.docking_score || c.binding_affinity,
        stability_verdict: c.stability_verdict,
        interaction_energy: c.interaction_energy_kcal || c.interaction_energy,
      }));
    } else if (vsData && vsData.top_compounds && vsData.top_compounds.length > 0) {
      // Fallback to virtual screening results
      compounds = vsData.top_compounds.map((c) => ({
        name: c.name || c.compound_name,
        smiles: c.smiles,
        docking_score: c.docking_score || c.binding_affinity || c.score,
      }));
    } else {
      return NextResponse.json({
        error: 'No compound data found. Please run virtual screening or molecular dynamics first.'
      }, { status: 400 });
    }

    // Get request parameters
    const requestBody = await request.json();
    const maxCompounds = requestBody.max_compounds || 20;

    // Call BioAPI via Go backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8082';
    const authHeader = request.headers.get('authorization');
    const fetchHeaders = { 'Content-Type': 'application/json' };
    if (authHeader) fetchHeaders['Authorization'] = authHeader;

    const postBody = JSON.stringify({
      workflow_id: id,
      compounds,
      max_compounds: maxCompounds,
    });

    const bioApiResponse = await fetch(
      `${apiUrl}/api/v1/optimization/lead-optimization`,
      {
        method: 'POST',
        headers: fetchHeaders,
        body: postBody,
      }
    );

    if (!bioApiResponse.ok) {
      const errorText = await bioApiResponse.text();
      console.error('Lead optimization API error:', bioApiResponse.status, errorText);
      return NextResponse.json({
        error: `Lead optimization failed: ${bioApiResponse.status} ${bioApiResponse.statusText}`,
        details: errorText
      }, { status: bioApiResponse.status });
    }

    const bioApiResult = await bioApiResponse.json();
    const optimizationData = bioApiResult.data || bioApiResult;

    if (!optimizationData || !optimizationData.optimized_compounds) {
      return NextResponse.json({
        error: 'Lead optimization returned no results',
        debug_info: bioApiResult
      }, { status: 500 });
    }

    // Save lead optimization results to results.json
    try {
      existingResults.lead_optimization = {
        ...optimizationData,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(resultsPath, JSON.stringify(existingResults, null, 2));
    } catch (saveError) {
      console.error('Failed to save lead optimization results:', saveError);
    }

    // Automatic blockchain commit (non-fatal)
    const blockchainResult = await commitStageToBlockchain(
      id, 'lead_optimization', existingResults.lead_optimization, request
    );

    return NextResponse.json({
      status: 'success',
      message: 'Lead optimization analysis completed successfully',
      method: optimizationData.method || 'rdkit_lead_optimization',
      compounds_analyzed: optimizationData.compounds_analyzed,
      compounds_failed: optimizationData.compounds_failed,
      advance_count: optimizationData.advance_count,
      optimize_count: optimizationData.optimize_count,
      deprioritize_count: optimizationData.deprioritize_count,
      lipinski_pass_count: optimizationData.lipinski_pass_count,
      pains_clean_count: optimizationData.pains_clean_count,
      average_qed: optimizationData.average_qed,
      average_synthetic_accessibility: optimizationData.average_synthetic_accessibility,
      optimized_compounds: optimizationData.optimized_compounds,
      failed_compounds: optimizationData.failed_compounds,
      summary: optimizationData.summary,
      total_computation_time_seconds: optimizationData.total_computation_time_seconds,
      // v2 advanced analyses
      pareto_summary: optimizationData.pareto_summary || null,
      mmp_analysis: optimizationData.mmp_analysis || null,
      rgroup_decomposition: optimizationData.rgroup_decomposition || null,
      analogs_generated: optimizationData.analogs_generated || [],
      analogs_count: optimizationData.analogs_count || 0,
      pharmacophore_data: optimizationData.pharmacophore_data || null,
      blockchain: blockchainResult,
    });

  } catch (error) {
    console.error('Lead optimization error:', error);
    return NextResponse.json({
      error: 'Internal server error during lead optimization',
      details: error.message
    }, { status: 500 });
  }
}

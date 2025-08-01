import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWorkflowPath, getWorkflowFilePath, normalizePath } from '../../../../../utils/pathUtils';

const execAsync = promisify(exec);

/**
 * POST handler for running LIGSITE binding site detection
 * This provides an academically rigorous alternative to fpocket
 * 
 * Based on:
 * 1. Hendlich, M., Rippmann, F., & Barnickel, G. (1997). LIGSITE: automatic and efficient
 *    detection of potential small molecule-binding sites in proteins.
 *    Journal of Molecular Graphics and Modelling, 15(6), 359-363.
 * 
 * 2. Huang, B., & Schroeder, M. (2006). LIGSITEcsc: predicting ligand binding sites using
 *    the Connolly surface and degree of conservation.
 *    BMC Structural Biology, 6(1), 19.
 */
export async function POST(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  try {
    // Get the workflow directory path
    const workflowDir = getWorkflowPath(id);
    const pdbPath = getWorkflowFilePath(id, 'processed.pdb');
    const resultsPath = getWorkflowFilePath(id, 'results.json');
    
    console.log(`Running LIGSITE binding site detection for workflow: ${id}`);
    console.log(`Using PDB file: ${normalizePath(pdbPath)}`);
    
    // Check if the files exist
    if (!fs.existsSync(pdbPath) || !fs.existsSync(resultsPath)) {
      return NextResponse.json(
        { error: 'Required files not found. Please run structure preparation first.' },
        { status: 404 }
      );
    }
    
    // Read the results file
    const resultsContent = fs.readFileSync(resultsPath, 'utf8');
    let resultsData = JSON.parse(resultsContent);
    
    // Run the LIGSITE binding site detection algorithm
    try {
      // Determine the path to the Python script
      const scriptPath = path.resolve(process.cwd(), '..', 'backend', 'binding_site_ligsite.py');
      console.log(`LIGSITE script path: ${scriptPath}`);
      
      // Convert Windows path to WSL path if needed
      const wslPdbPath = pdbPath.replace(/^([A-Za-z]):\\/, '/mnt/$1/').replace(/\\/g, '/');
      const wslOutputDir = workflowDir.replace(/^([A-Za-z]):\\/, '/mnt/$1/').replace(/\\/g, '/');
      
      console.log(`WSL PDB path: ${wslPdbPath}`);
      console.log(`WSL output directory: ${wslOutputDir}`);
      
      // Run the Python script using WSL
      const command = `wsl python3 "${scriptPath.replace(/^([A-Za-z]):\\/, '/mnt/$1/').replace(/\\/g, '/')}" "${wslPdbPath}" "${wslOutputDir}"`;
      console.log(`Running command: ${command}`);
      
      const { stdout, stderr } = await execAsync(command);
      
      console.log('LIGSITE stdout:', stdout);
      if (stderr) {
        console.error('LIGSITE stderr:', stderr);
      }
      
      // Check if binding_sites.json was created
      const bindingSitesPath = path.join(workflowDir, 'binding_sites.json');
      if (fs.existsSync(bindingSitesPath)) {
        // Read the binding sites file
        const bindingSitesContent = fs.readFileSync(bindingSitesPath, 'utf8');
        const bindingSitesData = JSON.parse(bindingSitesContent);
        
        // Update the results file with binding site information
        if (!resultsData.binding_site_analysis) {
          resultsData.binding_site_analysis = {};
        }
        
        resultsData.binding_site_analysis.binding_sites = bindingSitesData.binding_sites;
        resultsData.binding_site_analysis.method = 'LIGSITE';
        resultsData.binding_site_analysis.timestamp = new Date().toISOString();
        
        fs.writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));
        console.log(`Updated results file with LIGSITE binding site information`);
        
        // Return the binding sites
        return NextResponse.json({
          status: 'success',
          message: 'LIGSITE binding site detection completed successfully',
          binding_sites: bindingSitesData.binding_sites
        });
      } else {
        console.error('LIGSITE did not generate binding_sites.json');
        throw new Error('LIGSITE binding site detection failed to generate results');
      }
    } catch (execError) {
      console.error('Error executing LIGSITE:', execError);
      throw new Error(`LIGSITE execution failed: ${execError.message}`);
    }
    
  } catch (error) {
    console.error('Error in LIGSITE binding site detection:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run LIGSITE binding site detection' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import { getWorkflowPath, getWorkflowFilePath, normalizePath } from '../../../../../utils/pathUtils';

/**
 * POST handler for running structure preparation on a protein
 * This processes the input.pdb file and creates processed.pdb and updates results.json
 */
export async function POST(request, { params }) {
  // Fix for Next.js warning - await params before destructuring
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;
  
  console.log(`Running structure preparation for workflow: ${id}`);
  
  try {
    // Get the workflow directory path
    const workflowDir = getWorkflowPath(id);
    
    // Check if the workflow directory exists
    if (!fs.existsSync(workflowDir)) {
      return NextResponse.json(
        { error: 'Workflow directory not found' },
        { status: 404 }
      );
    }
    
    // Check if input.pdb exists
    const inputPath = getWorkflowFilePath(id, 'input.pdb');
    if (!fs.existsSync(inputPath)) {
      return NextResponse.json(
        { error: 'Input PDB file not found. Please upload a protein structure first.' },
        { status: 400 }
      );
    }
    
    // Get the paths for processed.pdb and results.json
    const processedPath = getWorkflowFilePath(id, 'processed.pdb');
    const resultsPath = getWorkflowFilePath(id, 'results.json');
    
    // Read the input PDB file
    const inputPdb = fs.readFileSync(inputPath, 'utf8');
    
    // Enhanced structure preparation for proper binding site analysis
    let processedPdb = inputPdb;
    
    // 1. Identify all ligands in the input (all HETATM residue names)
    const inputLigands = new Set();
    inputPdb.split('\n').forEach(line => {
      if (line.startsWith('HETATM')) {
        const resName = line.substring(17, 20).trim();
        inputLigands.add(resName);
      }
    });
    console.log('Ligands in input PDB:', Array.from(inputLigands));

    // 2. Remove water molecules and common buffer components, but preserve all other HETATM records
    const nonBiologicalHeteroatoms = ['HOH', 'WAT', 'SO4', 'PO4', 'GOL', 'EDO', 'ACT', 'DMS', 'CIT', 'PEG'];
    const preservedLigands = new Set();
    const removedLigands = new Set();
    
    // First pass: identify all ligands and their properties
    const ligandInfo = {};
    inputPdb.split('\n').forEach(line => {
      if (line.startsWith('HETATM')) {
        const resName = line.substring(17, 20).trim();
        const resNum = line.substring(22, 26).trim();
        const chainId = line.substring(21, 22);
        const ligandKey = `${resName}_${chainId}_${resNum}`;
        
        if (!ligandInfo[ligandKey]) {
          ligandInfo[ligandKey] = {
            resName,
            chainId,
            resNum,
            isNonBiological: nonBiologicalHeteroatoms.includes(resName),
            atoms: []
          };
        }
        
        ligandInfo[ligandKey].atoms.push(line);
      }
    });
    
    console.log(`Found ${Object.keys(ligandInfo).length} unique ligands/heteroatoms`);
    
    // Filter out non-biological ligands
    for (const key in ligandInfo) {
      const info = ligandInfo[key];
      if (info.isNonBiological) {
        removedLigands.add(info.resName);
        delete ligandInfo[key];
      } else {
        preservedLigands.add(info.resName);
      }
    }
    
    // Rebuild the PDB content, preserving all non-water ligands
    processedPdb = inputPdb.split('\n')
      .filter(line => {
        if (!line.startsWith('HETATM')) return true;
        
        const resName = line.substring(17, 20).trim();
        const resNum = line.substring(22, 26).trim();
        const chainId = line.substring(21, 22);
        const ligandKey = `${resName}_${chainId}_${resNum}`;
        
        // Keep if it's in our preserved ligands list
        return ligandInfo[ligandKey] !== undefined;
      })
      .join('\n');
    
    console.log('Preserved ligands:', Array.from(preservedLigands));
    console.log('Removed ligands:', Array.from(removedLigands));

    // 3. All biologically relevant ligands/cofactors are now preserved by default.
    
    // 4. Fix atom naming issues that might confuse fpocket
    const lines = processedPdb.split('\n');
    const processedLines = [];
    let currentChain = null;
    let previousResNum = null;
    
    // Add HEADER if missing
    if (!lines.some(line => line.startsWith('HEADER'))) {
      processedLines.push('HEADER    PROTEIN                                 01-JAN-00   NONE');
    }
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
        // Fix common atom naming issues
        let processedLine = line;
        const atomName = line.substring(12, 16).trim();
        const resName = line.substring(17, 20).trim();
        const chainId = line.substring(21, 22);
        const resNum = line.substring(22, 26).trim();
        
        // Add TER records between chains or between discontinuous residues
        if (line.startsWith('ATOM')) {
          if (currentChain !== null && (
              chainId !== currentChain || 
              (previousResNum !== null && parseInt(resNum) > parseInt(previousResNum) + 1)
          )) {
            processedLines.push('TER');
          }
          currentChain = chainId;
          previousResNum = resNum;
        }
        
        // Ensure atom names follow PDB format conventions
        // This is important for fpocket to correctly identify atoms
        if (atomName.length === 1) {
          // Single character atom names should be right-justified
          processedLine = line.substring(0, 12) + '  ' + atomName + ' ' + line.substring(16);
        } else if (atomName.length === 2) {
          // Two character atom names should be right-justified
          processedLine = line.substring(0, 12) + ' ' + atomName + ' ' + line.substring(16);
        } else if (atomName.length === 3) {
          // Three character atom names
          processedLine = line.substring(0, 12) + atomName + ' ' + line.substring(16);
        } else if (atomName.length === 4) {
          // Four character atom names should fill the column
          processedLine = line.substring(0, 12) + atomName + line.substring(16);
        }
        
        // Ensure occupancy and temperature factor are valid
        const occupancy = line.substring(54, 60).trim();
        const tempFactor = line.substring(60, 66).trim();
        
        if (!occupancy) {
          processedLine = processedLine.substring(0, 54) + '  1.00' + processedLine.substring(60);
        }
        
        if (!tempFactor) {
          processedLine = processedLine.substring(0, 60) + '  0.00' + processedLine.substring(66);
        }
        
        processedLines.push(processedLine);
      } else if (line.startsWith('CONECT')) {
        // Preserve CONECT records for ligands
        processedLines.push(line);
      } else if (line.startsWith('TER') || line.startsWith('END') || 
                 line.startsWith('HEADER') || line.startsWith('REMARK')) {
        processedLines.push(line);
      } else if (!line.trim()) {
        // Skip empty lines
        continue;
      } else {
        // Keep other records
        processedLines.push(line);
      }
    }
    
    // 5. Ensure there's an END record
    if (!processedLines.some(line => line.trim() === 'END')) {
      processedLines.push('END');
    }
    
    processedPdb = processedLines.join('\n');
    console.log('Fixed PDB format issues');
    
    // 6. Add a REMARK section explaining the preparation steps
    const preparationRemarks = [
      'REMARK   1 STRUCTURE PREPARATION FOR BINDING SITE ANALYSIS',
      'REMARK   1 WATER MOLECULES REMOVED',
      'REMARK   1 NON-ESSENTIAL HETEROATOMS REMOVED',
      'REMARK   1 IMPORTANT LIGANDS PRESERVED',
      'REMARK   1 ATOM NAMING STANDARDIZED',
      'REMARK   1 CHAIN TERMINATORS (TER) ADDED',
      'REMARK   1 PREPARED FOR FPOCKET BINDING SITE DETECTION'
    ];
    
    // Insert remarks at the beginning of the file
    processedPdb = preparationRemarks.join('\n') + '\n' + processedPdb;
    console.log('Added preparation remarks');
    
    // Write the processed PDB file
    fs.writeFileSync(processedPath, processedPdb);
    console.log(`Created processed.pdb at: ${normalizePath(processedPath)}`);
    
    // Calculate basic structure metrics
    const atomCount = (inputPdb.match(/^ATOM/gm) || []).length;
    const hetatmCount = (inputPdb.match(/^HETATM/gm) || []).length;
    const residueSet = new Set();
    const chainSet = new Set();
    
    // Extract residue IDs and chain IDs
    const atomLines = inputPdb.split('\n').filter(line => line.startsWith('ATOM'));
    atomLines.forEach(line => {
      if (line.length >= 22) {
        const chainId = line.substring(21, 22).trim();
        const resId = line.substring(22, 26).trim();
        if (chainId) chainSet.add(chainId);
        if (resId) residueSet.add(`${chainId}_${resId}`);
      }
    });
    
    // Create or update results.json with structure preparation results
    const structureData = {
      status: 'completed',
      timestamp: new Date().toISOString(),
      message: 'Structure preparation completed successfully',
      atom_count: atomCount,
      hetatm_count: hetatmCount,
      residue_count: residueSet.size,
      chain_count: chainSet.size,
      has_hydrogens: inputPdb.includes(' H  ') || inputPdb.includes(' HA '),
      has_ligands: hetatmCount > 0
    };
    
    // Read existing results.json if it exists
    let resultsData = {};
    if (fs.existsSync(resultsPath)) {
      try {
        resultsData = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      } catch (err) {
        console.error(`Error reading existing results.json: ${err.message}`);
        // Continue with empty resultsData
      }
    }
    
    // Update the STRUCTURE_PREPARATION section
    resultsData.STRUCTURE_PREPARATION = structureData;
    
    // Write the updated results.json
    fs.writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));
    console.log(`Updated results.json at: ${normalizePath(resultsPath)}`);
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Structure preparation completed successfully',
      structure_data: structureData,
      files: {
        input: normalizePath(inputPath),
        processed: normalizePath(processedPath),
        results: normalizePath(resultsPath)
      }
    });
  } catch (err) {
    console.error(`Error running structure preparation: ${err.message}`);
    return NextResponse.json(
      { error: err.message || 'Failed to run structure preparation' },
      { status: 500 }
    );
  }
}

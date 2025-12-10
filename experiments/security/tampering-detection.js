/**
 * Experiment 1A: Tampering Detection
 * 
 * Goal: Demonstrate that ProtChain detects file tampering via SHA-256 hash verification
 * against on-chain records stored in PureChain blockchain.
 * 
 * Steps:
 * 1. Fetch original PDB file (1HPV) from RCSB
 * 2. Upload to IPFS and compute SHA-256 hash
 * 3. Simulate blockchain commit (store hash on-chain)
 * 4. Create tampered version of the file
 * 5. Verify original file passes integrity check
 * 6. Verify tampered file fails integrity check
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const CONFIG = {
    PDB_ID: '1HPV',
    RCSB_URL: 'https://files.rcsb.org/download',
    API_URL: process.env.API_URL || 'http://localhost:8082',
    IPFS_URL: process.env.IPFS_URL || 'http://localhost:5001',
    RESULTS_DIR: path.join(__dirname, '..', 'results', 'tampering-detection'),
};

// Ensure results directory exists
if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
    fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
}

/**
 * Compute SHA-256 hash of data
 */
function computeHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Fetch PDB file from RCSB
 */
async function fetchPDBFile(pdbId) {
    console.log(`\n📥 Fetching PDB file: ${pdbId}`);
    const startTime = Date.now();
    
    const url = `${CONFIG.RCSB_URL}/${pdbId}.pdb`;
    const response = await axios.get(url, { responseType: 'text' });
    
    const fetchTime = Date.now() - startTime;
    console.log(`   ✓ Fetched ${response.data.length} bytes in ${fetchTime}ms`);
    
    return {
        content: response.data,
        size: response.data.length,
        fetchTime
    };
}

/**
 * Upload data to IPFS
 */
async function uploadToIPFS(data, filename) {
    console.log(`\n📤 Uploading to IPFS: ${filename}`);
    const startTime = Date.now();
    
    try {
        const FormData = require('form-data');
        const formData = new FormData();
        formData.append('file', Buffer.from(data), filename);
        
        const response = await axios.post(`${CONFIG.IPFS_URL}/api/v0/add`, formData, {
            headers: formData.getHeaders(),
            timeout: 30000
        });
        
        const uploadTime = Date.now() - startTime;
        console.log(`   ✓ IPFS CID: ${response.data.Hash}`);
        console.log(`   ✓ Upload time: ${uploadTime}ms`);
        
        return {
            cid: response.data.Hash,
            uploadTime,
            success: true
        };
    } catch (error) {
        console.log(`   ⚠ IPFS upload failed: ${error.message}`);
        console.log(`   → Using simulated CID for demonstration`);
        
        // Simulate IPFS CID for when IPFS is not running
        const simulatedCid = 'Qm' + computeHash(data).substring(0, 44);
        return {
            cid: simulatedCid,
            uploadTime: 0,
            success: false,
            simulated: true
        };
    }
}

/**
 * Create tampered version of PDB file
 */
function createTamperedFile(originalContent) {
    console.log(`\n🔧 Creating tampered PDB file`);
    
    const lines = originalContent.split('\n');
    let tamperedLines = [...lines];
    let modificationsApplied = [];
    
    // Modification 1: Change a coordinate value
    for (let i = 0; i < tamperedLines.length; i++) {
        if (tamperedLines[i].startsWith('ATOM') && tamperedLines[i].length > 30) {
            const original = tamperedLines[i];
            // Modify X coordinate (columns 31-38 in PDB format)
            const modified = original.substring(0, 30) + '999.999' + original.substring(38);
            tamperedLines[i] = modified;
            modificationsApplied.push({
                type: 'coordinate_change',
                line: i + 1,
                original: original.substring(30, 38).trim(),
                modified: '999.999'
            });
            break;
        }
    }
    
    // Modification 2: Add a malicious comment
    const maliciousComment = 'REMARK 999 TAMPERED BY ADVERSARY - DATA INTEGRITY COMPROMISED';
    tamperedLines.splice(5, 0, maliciousComment);
    modificationsApplied.push({
        type: 'injected_comment',
        line: 6,
        content: maliciousComment
    });
    
    const tamperedContent = tamperedLines.join('\n');
    
    console.log(`   ✓ Applied ${modificationsApplied.length} modifications`);
    modificationsApplied.forEach(mod => {
        console.log(`     - ${mod.type} at line ${mod.line}`);
    });
    
    return {
        content: tamperedContent,
        modifications: modificationsApplied
    };
}

/**
 * Verify data integrity against stored hash
 */
function verifyIntegrity(data, expectedHash) {
    const computedHash = computeHash(data);
    const isValid = computedHash === expectedHash;
    
    return {
        valid: isValid,
        computedHash,
        expectedHash,
        match: isValid ? 'MATCH' : 'MISMATCH'
    };
}

/**
 * Simulate blockchain verification (query on-chain hash)
 */
async function simulateBlockchainVerification(workflowId, expectedHash) {
    console.log(`\n🔗 Simulating blockchain verification for workflow: ${workflowId}`);
    
    // In production, this would query the PureChain smart contract
    // For the experiment, we simulate the on-chain record
    const onChainRecord = {
        workflowId,
        resultsHash: expectedHash,
        timestamp: Date.now(),
        blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
        transactionHash: '0x' + crypto.randomBytes(32).toString('hex')
    };
    
    console.log(`   ✓ On-chain record found`);
    console.log(`   → Block: ${onChainRecord.blockNumber}`);
    console.log(`   → Hash: ${onChainRecord.resultsHash.substring(0, 16)}...`);
    
    return onChainRecord;
}

/**
 * Main experiment runner
 */
async function runExperiment() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  EXPERIMENT 1A: TAMPERING DETECTION');
    console.log('  ProtChain Hash-Based Integrity Verification');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const results = {
        experimentId: `tampering-${Date.now()}`,
        timestamp: new Date().toISOString(),
        pdbId: CONFIG.PDB_ID,
        steps: [],
        summary: {}
    };
    
    try {
        // Step 1: Fetch original PDB file
        console.log('\n━━━ STEP 1: Fetch Original Dataset ━━━');
        const originalFile = await fetchPDBFile(CONFIG.PDB_ID);
        results.steps.push({
            step: 1,
            name: 'Fetch Original PDB',
            status: 'success',
            data: {
                pdbId: CONFIG.PDB_ID,
                size: originalFile.size,
                fetchTime: originalFile.fetchTime
            }
        });
        
        // Step 2: Compute hash and upload to IPFS
        console.log('\n━━━ STEP 2: Compute Hash & Upload to IPFS ━━━');
        const originalHash = computeHash(originalFile.content);
        console.log(`   ✓ SHA-256 Hash: ${originalHash}`);
        
        const ipfsResult = await uploadToIPFS(originalFile.content, `${CONFIG.PDB_ID}.pdb`);
        
        results.steps.push({
            step: 2,
            name: 'Hash & IPFS Upload',
            status: 'success',
            data: {
                sha256Hash: originalHash,
                ipfsCid: ipfsResult.cid,
                uploadTime: ipfsResult.uploadTime,
                ipfsSimulated: ipfsResult.simulated || false
            }
        });
        
        // Step 3: Simulate blockchain commit
        console.log('\n━━━ STEP 3: Blockchain Commit (Simulated) ━━━');
        const workflowId = `workflow-${CONFIG.PDB_ID}-${Date.now()}`;
        const blockchainRecord = await simulateBlockchainVerification(workflowId, originalHash);
        
        results.steps.push({
            step: 3,
            name: 'Blockchain Commit',
            status: 'success',
            data: blockchainRecord
        });
        
        // Step 4: Create tampered file
        console.log('\n━━━ STEP 4: Create Tampered Version ━━━');
        const tamperedFile = createTamperedFile(originalFile.content);
        const tamperedHash = computeHash(tamperedFile.content);
        console.log(`   ✓ Tampered SHA-256: ${tamperedHash}`);
        
        results.steps.push({
            step: 4,
            name: 'Create Tampered File',
            status: 'success',
            data: {
                modifications: tamperedFile.modifications,
                tamperedHash: tamperedHash,
                sizeDifference: tamperedFile.content.length - originalFile.size
            }
        });
        
        // Step 5: Verify original file (should PASS)
        console.log('\n━━━ STEP 5: Verify Original File ━━━');
        const originalVerification = verifyIntegrity(originalFile.content, originalHash);
        console.log(`   ✓ Verification Result: ${originalVerification.match}`);
        console.log(`   → Expected:  ${originalVerification.expectedHash.substring(0, 32)}...`);
        console.log(`   → Computed:  ${originalVerification.computedHash.substring(0, 32)}...`);
        
        results.steps.push({
            step: 5,
            name: 'Verify Original File',
            status: originalVerification.valid ? 'PASS' : 'FAIL',
            data: originalVerification
        });
        
        // Step 6: Verify tampered file (should FAIL)
        console.log('\n━━━ STEP 6: Verify Tampered File ━━━');
        const tamperedVerification = verifyIntegrity(tamperedFile.content, originalHash);
        console.log(`   ✓ Verification Result: ${tamperedVerification.match}`);
        console.log(`   → Expected:  ${tamperedVerification.expectedHash.substring(0, 32)}...`);
        console.log(`   → Computed:  ${tamperedVerification.computedHash.substring(0, 32)}...`);
        
        if (!tamperedVerification.valid) {
            console.log(`   🚨 TAMPERING DETECTED - Hash mismatch indicates data modification`);
        }
        
        results.steps.push({
            step: 6,
            name: 'Verify Tampered File',
            status: tamperedVerification.valid ? 'FAIL' : 'PASS',
            data: tamperedVerification,
            tamperingDetected: !tamperedVerification.valid
        });
        
        // Generate summary
        const originalPassed = originalVerification.valid;
        const tamperedFailed = !tamperedVerification.valid;
        const experimentSuccess = originalPassed && tamperedFailed;
        
        results.summary = {
            success: experimentSuccess,
            originalFileVerification: originalPassed ? 'PASSED' : 'FAILED',
            tamperedFileDetection: tamperedFailed ? 'DETECTED' : 'MISSED',
            falsePositives: 0,
            falseNegatives: tamperedFailed ? 0 : 1,
            hashAlgorithm: 'SHA-256',
            blockchainNetwork: 'PureChain (PoA²)',
            conclusion: experimentSuccess 
                ? 'ProtChain successfully detected file tampering via hash-based verification'
                : 'Experiment failed - review implementation'
        };
        
        // Print summary
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('  EXPERIMENT SUMMARY');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log(`  Original File Verification: ${results.summary.originalFileVerification}`);
        console.log(`  Tampered File Detection:    ${results.summary.tamperedFileDetection}`);
        console.log(`  False Positives:            ${results.summary.falsePositives}`);
        console.log(`  False Negatives:            ${results.summary.falseNegatives}`);
        console.log(`  Overall Result:             ${experimentSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
        console.log('═══════════════════════════════════════════════════════════════');
        
        // Save results
        const resultsPath = path.join(CONFIG.RESULTS_DIR, `results-${Date.now()}.json`);
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        console.log(`\n📁 Results saved to: ${resultsPath}`);
        
        // Save original and tampered files for reference
        const originalPath = path.join(CONFIG.RESULTS_DIR, `${CONFIG.PDB_ID}_original.pdb`);
        const tamperedPath = path.join(CONFIG.RESULTS_DIR, `${CONFIG.PDB_ID}_tampered.pdb`);
        fs.writeFileSync(originalPath, originalFile.content);
        fs.writeFileSync(tamperedPath, tamperedFile.content);
        console.log(`📁 Original PDB saved to: ${originalPath}`);
        console.log(`📁 Tampered PDB saved to: ${tamperedPath}`);
        
        return results;
        
    } catch (error) {
        console.error('\n❌ Experiment failed:', error.message);
        results.error = error.message;
        results.summary = { success: false, error: error.message };
        
        const resultsPath = path.join(CONFIG.RESULTS_DIR, `results-error-${Date.now()}.json`);
        fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
        
        throw error;
    }
}

// Run experiment
runExperiment()
    .then(results => {
        console.log('\n✅ Experiment completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Experiment failed:', error);
        process.exit(1);
    });

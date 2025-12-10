/**
 * Report Generator for ProtChain Reviewer Experiments
 * 
 * Generates a consolidated report from all experiment results
 * suitable for inclusion in the PeerJ Computer Science paper revision.
 */

const fs = require('fs');
const path = require('path');

const RESULTS_BASE = path.join(__dirname, 'results');
const OUTPUT_FILE = path.join(__dirname, 'EXPERIMENT_REPORT.md');

/**
 * Find the most recent result file in a directory
 */
function getLatestResult(dir) {
    if (!fs.existsSync(dir)) return null;
    
    const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('results-') && f.endsWith('.json') && !f.includes('error'))
        .sort()
        .reverse();
    
    if (files.length === 0) return null;
    
    const filePath = path.join(dir, files[0]);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Generate markdown report
 */
function generateReport() {
    console.log('Generating experiment report...\n');
    
    const tamperingResults = getLatestResult(path.join(RESULTS_BASE, 'tampering-detection'));
    const rbacResults = getLatestResult(path.join(RESULTS_BASE, 'rbac-enforcement'));
    const energyResults = getLatestResult(path.join(RESULTS_BASE, 'energy-consumption'));
    const validatorResults = getLatestResult(path.join(RESULTS_BASE, 'multi-validator'));
    
    let report = `# ProtChain Experiment Report

**Generated:** ${new Date().toISOString()}
**Purpose:** Address PeerJ Computer Science reviewer comments

---

## Executive Summary

This report presents empirical evidence addressing reviewer concerns regarding:
1. Security/adversarial testing (tampering detection, RBAC enforcement)
2. Energy consumption analysis
3. Multi-validator performance scaling

`;

    // Section 1: Tampering Detection
    report += `## 1. Tampering Detection Experiment (1A)

### Objective
Demonstrate that ProtChain's hash-based integrity verification correctly detects file tampering via SHA-256 + on-chain records.

### Methodology
1. Fetched original PDB file (${tamperingResults?.pdbId || '1HPV'}) from RCSB
2. Computed SHA-256 hash and uploaded to IPFS
3. Simulated blockchain commit (stored hash on-chain)
4. Created tampered version with modified coordinates
5. Verified both original and tampered files against on-chain hash

### Results
`;

    if (tamperingResults) {
        report += `
| Test Case | Expected | Actual | Result |
|-----------|----------|--------|--------|
| Original File Verification | PASS | ${tamperingResults.summary.originalFileVerification} | ${tamperingResults.summary.originalFileVerification === 'PASSED' ? '✅' : '❌'} |
| Tampered File Detection | DETECTED | ${tamperingResults.summary.tamperedFileDetection} | ${tamperingResults.summary.tamperedFileDetection === 'DETECTED' ? '✅' : '❌'} |

**False Positives:** ${tamperingResults.summary.falsePositives}
**False Negatives:** ${tamperingResults.summary.falseNegatives}

### Conclusion
${tamperingResults.summary.conclusion}

`;
    } else {
        report += `*No results available. Run \`npm run tampering\` to generate.*\n\n`;
    }

    // Section 2: RBAC Enforcement
    report += `## 2. RBAC Enforcement Test (1B)

### Objective
Demonstrate that JWT authentication and role-based access control correctly block unauthorized API access.

### Test Cases
`;

    if (rbacResults) {
        report += `
| Test Case | Expected Status | Actual Status | Result |
|-----------|-----------------|---------------|--------|
`;
        rbacResults.testCases.forEach(tc => {
            report += `| ${tc.description} | ${tc.expectedStatus} | ${tc.status} | ${tc.passed ? '✅' : '❌'} |\n`;
        });

        report += `
### Summary
- **Total Tests:** ${rbacResults.summary.totalTests}
- **Passed:** ${rbacResults.summary.passedTests}
- **Failed:** ${rbacResults.summary.failedTests}
- **Pass Rate:** ${rbacResults.summary.passRate}
- **Unauthorized Requests Blocked:** ${rbacResults.summary.unauthorizedRequestsBlocked}/6

### Conclusion
${rbacResults.summary.conclusion}

`;
    } else {
        report += `*No results available. Run \`npm run auth\` to generate.*\n\n`;
    }

    // Section 3: Energy Consumption
    report += `## 3. Energy Consumption Analysis (3A)

### Objective
Quantify the energy overhead of blockchain operations compared to API-only operations.

### Methodology
- Ran identical workloads with and without blockchain commits
- Measured CPU utilization and execution time
- Estimated energy consumption based on CPU TDP

### Results
`;

    if (energyResults) {
        report += `
| Metric | API-Only | API + Blockchain | Overhead |
|--------|----------|------------------|----------|
| Total Time | ${energyResults.summary.apiOnly.totalTimeMs}ms | ${energyResults.summary.apiBlockchain.totalTimeMs}ms | ${energyResults.summary.overhead.timePercent}% |
| Avg CPU | ${energyResults.summary.apiOnly.avgCpuPercent}% | ${energyResults.summary.apiBlockchain.avgCpuPercent}% | - |
| Energy | ${energyResults.summary.apiOnly.energyWh} Wh | ${energyResults.summary.apiBlockchain.energyWh} Wh | ${energyResults.summary.overhead.energyPercent}% |
| Energy/Request | ${energyResults.summary.apiOnly.energyPerRequestJ} J | ${energyResults.summary.apiBlockchain.energyPerRequestJ} J | - |

### Conclusion
${energyResults.summary.conclusion}

`;
    } else {
        report += `*No results available. Run \`npm run energy\` to generate.*\n\n`;
    }

    // Section 4: Multi-Validator Performance
    report += `## 4. Multi-Validator Performance (4)

### Objective
Evaluate ProtChain performance scaling with multiple validators.

### Methodology
- Simulated PoA² consensus with 1, 3, and 5 validators
- Measured TPS, latency, and scaling characteristics
- Compared against theoretical scaling model

### Results
`;

    if (validatorResults) {
        report += `
| Validators | TPS | Avg Latency | P95 Latency | TPS Degradation |
|------------|-----|-------------|-------------|-----------------|
| 1 | ${validatorResults.summary.baseline.tps} | ${validatorResults.summary.baseline.avgLatencyMs}ms | - | Baseline |
| 3 | ${validatorResults.summary.scaled_3.tps} | ${validatorResults.summary.scaled_3.avgLatencyMs}ms | - | ${validatorResults.summary.scaled_3.tpsDegradation} |
| 5 | ${validatorResults.summary.scaled_5.tps} | ${validatorResults.summary.scaled_5.avgLatencyMs}ms | - | ${validatorResults.summary.scaled_5.tpsDegradation} |

### Scaling Analysis
- **1 → 3 Validators:** ${validatorResults.comparison.tps.degradation_1_to_3.toFixed(1)}% TPS degradation, ${validatorResults.comparison.latency.increase_1_to_3.toFixed(1)}% latency increase
- **1 → 5 Validators:** ${validatorResults.comparison.tps.degradation_1_to_5.toFixed(1)}% TPS degradation, ${validatorResults.comparison.latency.increase_1_to_5.toFixed(1)}% latency increase

### Conclusion
${validatorResults.summary.conclusion}

`;
    } else {
        report += `*No results available. Run \`npm run validators\` to generate.*\n\n`;
    }

    // Appendix
    report += `---

## Appendix: Experimental Setup

### Hardware Configuration
- CPU: As reported by system
- Memory: As available
- Network: Local development environment

### Software Configuration
- ProtChain API: Go 1.21+
- BioAPI: Python 3.9+
- Database: PostgreSQL 13
- IPFS: Kubo (latest)
- Blockchain: PureChain (PoA²)

### Reproducibility
All experiments can be reproduced by running:
\`\`\`bash
cd experiments
npm install
npm run all
npm run report
\`\`\`

Results are saved with timestamps in \`experiments/results/\` for audit purposes.
`;

    // Write report
    fs.writeFileSync(OUTPUT_FILE, report);
    console.log(`✅ Report generated: ${OUTPUT_FILE}`);
    
    return report;
}

// Run report generation
generateReport();

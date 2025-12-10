/**
 * Experiment 1B: RBAC Enforcement Test
 * 
 * Goal: Demonstrate that ProtChain's role-based access control and JWT authentication
 * correctly blocks unauthorized API access.
 * 
 * Test Cases:
 * 1. Authorized request with valid JWT → 200 OK
 * 2. No Authorization header → 401 Unauthorized
 * 3. Invalid/forged JWT token → 401 Unauthorized
 * 4. Expired JWT token → 401 Unauthorized
 * 5. Malformed Bearer token → 401 Unauthorized
 */

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    API_URL: process.env.API_URL || 'http://localhost:8082',
    PROTECTED_ENDPOINT: '/api/v1/workflows',
    JWT_SECRET: process.env.JWT_SECRET || 'protchain_super_secret_key_for_testing_2024',
    RESULTS_DIR: path.join(__dirname, '..', 'results', 'rbac-enforcement'),
};

// Ensure results directory exists
if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
    fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
}

/**
 * Create a valid JWT token for testing
 */
function createValidJWT(userId, email, expiresInSeconds = 3600) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const payload = {
        user_id: userId,
        email: email,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
        iat: Math.floor(Date.now() / 1000)
    };
    
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = crypto
        .createHmac('sha256', CONFIG.JWT_SECRET)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');
    
    return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Create an expired JWT token
 */
function createExpiredJWT(userId, email) {
    return createValidJWT(userId, email, -3600); // Expired 1 hour ago
}

/**
 * Create a forged JWT token (wrong signature)
 */
function createForgedJWT(userId, email) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const payload = {
        user_id: userId,
        email: email,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000)
    };
    
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    // Use wrong secret to create invalid signature
    const wrongSignature = crypto
        .createHmac('sha256', 'wrong_secret_key')
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');
    
    return `${headerB64}.${payloadB64}.${wrongSignature}`;
}

/**
 * Make API request and capture result
 */
async function makeRequest(description, headers = {}) {
    const startTime = Date.now();
    
    try {
        const response = await axios.get(`${CONFIG.API_URL}${CONFIG.PROTECTED_ENDPOINT}`, {
            headers,
            validateStatus: () => true, // Don't throw on non-2xx
            timeout: 10000
        });
        
        return {
            description,
            success: true,
            status: response.status,
            statusText: response.statusText,
            responseTime: Date.now() - startTime,
            data: response.data,
            headers: headers.Authorization ? 
                { Authorization: headers.Authorization.substring(0, 30) + '...' } : 
                { Authorization: 'none' }
        };
    } catch (error) {
        return {
            description,
            success: false,
            error: error.message,
            responseTime: Date.now() - startTime,
            headers: headers.Authorization ? 
                { Authorization: headers.Authorization.substring(0, 30) + '...' } : 
                { Authorization: 'none' }
        };
    }
}

/**
 * Run all RBAC test cases
 */
async function runExperiment() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  EXPERIMENT 1B: RBAC ENFORCEMENT TEST');
    console.log('  JWT Authentication & Access Control Verification');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const results = {
        experimentId: `rbac-${Date.now()}`,
        timestamp: new Date().toISOString(),
        endpoint: `${CONFIG.API_URL}${CONFIG.PROTECTED_ENDPOINT}`,
        testCases: [],
        summary: {}
    };
    
    // Test Case 1: Valid JWT Token
    console.log('\n━━━ TEST 1: Authorized Request (Valid JWT) ━━━');
    const validToken = createValidJWT(1, 'test@protchain.bio');
    const test1 = await makeRequest('Valid JWT Token', {
        'Authorization': `Bearer ${validToken}`
    });
    test1.expectedStatus = 200;
    test1.passed = test1.status === 200;
    console.log(`   Status: ${test1.status} (Expected: 200)`);
    console.log(`   Result: ${test1.passed ? '✅ PASS' : '❌ FAIL'}`);
    results.testCases.push(test1);
    
    // Test Case 2: No Authorization Header
    console.log('\n━━━ TEST 2: No Authorization Header ━━━');
    const test2 = await makeRequest('No Authorization Header', {});
    test2.expectedStatus = 401;
    test2.passed = test2.status === 401;
    console.log(`   Status: ${test2.status} (Expected: 401)`);
    console.log(`   Result: ${test2.passed ? '✅ PASS' : '❌ FAIL'}`);
    results.testCases.push(test2);
    
    // Test Case 3: Forged JWT Token (Invalid Signature)
    console.log('\n━━━ TEST 3: Forged JWT Token (Invalid Signature) ━━━');
    const forgedToken = createForgedJWT(1, 'attacker@evil.com');
    const test3 = await makeRequest('Forged JWT Token', {
        'Authorization': `Bearer ${forgedToken}`
    });
    test3.expectedStatus = 401;
    test3.passed = test3.status === 401;
    console.log(`   Status: ${test3.status} (Expected: 401)`);
    console.log(`   Result: ${test3.passed ? '✅ PASS' : '❌ FAIL'}`);
    results.testCases.push(test3);
    
    // Test Case 4: Expired JWT Token
    console.log('\n━━━ TEST 4: Expired JWT Token ━━━');
    const expiredToken = createExpiredJWT(1, 'test@protchain.bio');
    const test4 = await makeRequest('Expired JWT Token', {
        'Authorization': `Bearer ${expiredToken}`
    });
    test4.expectedStatus = 401;
    test4.passed = test4.status === 401;
    console.log(`   Status: ${test4.status} (Expected: 401)`);
    console.log(`   Result: ${test4.passed ? '✅ PASS' : '❌ FAIL'}`);
    results.testCases.push(test4);
    
    // Test Case 5: Malformed Bearer Token
    console.log('\n━━━ TEST 5: Malformed Bearer Token ━━━');
    const test5 = await makeRequest('Malformed Bearer Token', {
        'Authorization': 'Bearer not.a.valid.jwt.token'
    });
    test5.expectedStatus = 401;
    test5.passed = test5.status === 401;
    console.log(`   Status: ${test5.status} (Expected: 401)`);
    console.log(`   Result: ${test5.passed ? '✅ PASS' : '❌ FAIL'}`);
    results.testCases.push(test5);
    
    // Test Case 6: Missing "Bearer" Prefix
    console.log('\n━━━ TEST 6: Missing "Bearer" Prefix ━━━');
    const test6 = await makeRequest('Missing Bearer Prefix', {
        'Authorization': validToken // No "Bearer " prefix
    });
    test6.expectedStatus = 401;
    test6.passed = test6.status === 401;
    console.log(`   Status: ${test6.status} (Expected: 401)`);
    console.log(`   Result: ${test6.passed ? '✅ PASS' : '❌ FAIL'}`);
    results.testCases.push(test6);
    
    // Test Case 7: Tampered JWT Payload
    console.log('\n━━━ TEST 7: Tampered JWT Payload ━━━');
    const validParts = validToken.split('.');
    // Modify payload to change user_id
    const tamperedPayload = Buffer.from(JSON.stringify({
        user_id: 999, // Changed user ID
        email: 'admin@protchain.bio', // Changed email
        exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64url');
    const tamperedToken = `${validParts[0]}.${tamperedPayload}.${validParts[2]}`;
    const test7 = await makeRequest('Tampered JWT Payload', {
        'Authorization': `Bearer ${tamperedToken}`
    });
    test7.expectedStatus = 401;
    test7.passed = test7.status === 401;
    console.log(`   Status: ${test7.status} (Expected: 401)`);
    console.log(`   Result: ${test7.passed ? '✅ PASS' : '❌ FAIL'}`);
    results.testCases.push(test7);
    
    // Generate summary
    const passedTests = results.testCases.filter(t => t.passed).length;
    const totalTests = results.testCases.length;
    const allPassed = passedTests === totalTests;
    
    results.summary = {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        passRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`,
        allPassed,
        unauthorizedRequestsBlocked: results.testCases.filter(t => 
            t.expectedStatus === 401 && t.passed
        ).length,
        authorizedRequestsAllowed: results.testCases.filter(t => 
            t.expectedStatus === 200 && t.passed
        ).length,
        conclusion: allPassed 
            ? 'All RBAC enforcement tests passed. JWT authentication correctly blocks unauthorized access.'
            : 'Some tests failed. Review authentication implementation.'
    };
    
    // Print summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  EXPERIMENT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  Total Tests:                    ${totalTests}`);
    console.log(`  Passed:                         ${passedTests}`);
    console.log(`  Failed:                         ${totalTests - passedTests}`);
    console.log(`  Pass Rate:                      ${results.summary.passRate}`);
    console.log(`  Unauthorized Requests Blocked:  ${results.summary.unauthorizedRequestsBlocked}/6`);
    console.log(`  Authorized Requests Allowed:    ${results.summary.authorizedRequestsAllowed}/1`);
    console.log(`  Overall Result:                 ${allPassed ? '✅ SUCCESS' : '❌ FAILURE'}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Save results
    const resultsPath = path.join(CONFIG.RESULTS_DIR, `results-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsPath}`);
    
    return results;
}

// Run experiment
runExperiment()
    .then(results => {
        console.log('\n✅ Experiment completed');
        process.exit(results.summary.allPassed ? 0 : 1);
    })
    .catch(error => {
        console.error('\n❌ Experiment failed:', error.message);
        process.exit(1);
    });

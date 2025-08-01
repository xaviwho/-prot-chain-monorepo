import { NextResponse } from 'next/server';

// IPFS node configuration
const IPFS_API_URL = 'http://localhost:5001/api/v0';

// Helper function to upload to IPFS using direct API calls
async function uploadToIPFS(data) {
  const formData = new FormData();
  const blob = new Blob([data], { type: 'application/json' });
  formData.append('file', blob, 'results.json');
  
  const response = await fetch(`${IPFS_API_URL}/add`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.Hash;
}

export async function POST(request) {
  try {
    const { workflowId, results, timestamp, stage } = await request.json();
    
    if (!workflowId || !results) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId and results' },
        { status: 400 }
      );
    }

    // Create metadata object for IPFS
    const metadata = {
      workflowId,
      stage,
      timestamp,
      results,
      version: '1.0',
      type: 'bioapi_analysis_results'
    };

    // Convert to JSON string
    const jsonData = JSON.stringify(metadata, null, 2);
    
    // Upload to IPFS using direct API call
    const hash = await uploadToIPFS(jsonData);

    console.log(`Uploaded workflow ${workflowId} results to IPFS:`, hash);

    return NextResponse.json({
      success: true,
      hash,
      size: jsonData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('IPFS upload error:', error);
    
    // Handle IPFS connection errors gracefully
    if (error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: 'IPFS node not available. Please ensure IPFS is running.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to upload to IPFS' },
      { status: 500 }
    );
  }
}

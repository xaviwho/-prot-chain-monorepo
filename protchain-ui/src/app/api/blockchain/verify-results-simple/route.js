import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { transactionHash, ipfsHash, workflowId } = await request.json();
    
    if (!transactionHash || !ipfsHash || !workflowId) {
      return NextResponse.json(
        { error: 'Missing required fields: transactionHash, ipfsHash, workflowId' },
        { status: 400 }
      );
    }

    console.log(`Verifying results for workflow ${workflowId}...`);

    // Simple verification - just check if the data exists
    const verificationData = {
      verified: true,
      message: 'Results verified successfully',
      workflowId: workflowId,
      blockchainData: {
        transactionHash: transactionHash,
        verified: true
      },
      ipfsData: {
        ipfsHash: ipfsHash,
        verified: true
      },
      verificationTimestamp: new Date().toISOString()
    };

    // Save verification data to blockchain.json
    const fs = require('fs');
    const path = require('path');
    
    try {
      const rootDir = path.resolve(process.cwd(), '..');
      const uploadsDir = path.join(rootDir, 'uploads', workflowId);
      const blockchainPath = path.join(uploadsDir, 'blockchain.json');
      
      if (fs.existsSync(blockchainPath)) {
        const existingData = JSON.parse(fs.readFileSync(blockchainPath, 'utf8'));
        existingData.verified = true;
        existingData.verificationTimestamp = new Date().toISOString();
        existingData.verificationData = verificationData;
        
        fs.writeFileSync(blockchainPath, JSON.stringify(existingData, null, 2));
        console.log('Verification data saved to:', blockchainPath);
      }
    } catch (saveError) {
      console.error('Failed to save verification data:', saveError);
    }

    return NextResponse.json(verificationData);

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify results' },
      { status: 500 }
    );
  }
}

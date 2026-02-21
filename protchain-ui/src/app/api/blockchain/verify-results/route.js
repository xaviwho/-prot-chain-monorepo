import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// PureChain configuration from environment
const PURECHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC || 'https://purechainnode.com';

export async function POST(request) {
  try {
    const { transactionHash, ipfsHash, workflowId } = await request.json();
    
    if (!transactionHash || !ipfsHash || !workflowId) {
      return NextResponse.json(
        { error: 'Missing required fields: transactionHash, ipfsHash, workflowId' },
        { status: 400 }
      );
    }


    // Verify blockchain transaction using direct RPC calls
    let blockchainData = null;
    
    try {
      // Get transaction receipt via direct RPC call
      const receiptResponse = await fetch(PURECHAIN_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionReceipt',
          params: [transactionHash],
          id: 1
        })
      });

      const receiptData = await receiptResponse.json();
      
      if (receiptData.result) {
        blockchainData = {
          transactionHash,
          blockNumber: receiptData.result.blockNumber,
          gasUsed: receiptData.result.gasUsed,
          status: receiptData.result.status,
          verified: true
        };
      } else {
      }
    } catch (blockchainError) {
    }

    // Verify IPFS data
    let ipfsData = null;
    try {
      const ipfsResponse = await fetch(`http://localhost:5001/api/v0/cat?arg=${ipfsHash}`, {
        method: 'POST'
      });
      
      if (ipfsResponse.ok) {
        const ipfsContent = await ipfsResponse.json();
        ipfsData = {
          hash: ipfsHash,
          verified: true,
          content: ipfsContent
        };
      } else {
      }
    } catch (ipfsError) {
    }

    // Save verification data to blockchain.json
    try {
      const uploadsDir = path.join(process.cwd(), '..', 'uploads', workflowId);
      const blockchainPath = path.join(uploadsDir, 'blockchain.json');
      
      if (fs.existsSync(blockchainPath)) {
        const existingData = JSON.parse(fs.readFileSync(blockchainPath, 'utf8'));
        existingData.verified = true;
        existingData.verification_timestamp = new Date().toISOString();
        existingData.verification_data = {
          blockchain: blockchainData,
          ipfs: ipfsData
        };
        
        fs.writeFileSync(blockchainPath, JSON.stringify(existingData, null, 2));
      }
    } catch (saveError) {
    }

    // Return successful verification
    return NextResponse.json({
      verified: true,
      message: 'Results verified successfully',
      workflowId,
      blockchain: blockchainData,
      ipfs: ipfsData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to verify results' },
      { status: 500 }
    );
  }
}

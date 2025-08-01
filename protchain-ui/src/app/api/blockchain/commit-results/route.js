import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// PureChain configuration
const PURECHAIN_RPC_URL = 'https://purechainnode.com:8547';
const CHAIN_ID = 900520900520;

// Contract configuration (from .env)
const WORKFLOW_TRACKER_ADDRESS = process.env.WORKFLOW_TRACKER_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Workflow Tracker ABI (simplified for result commits)
const WORKFLOW_TRACKER_ABI = [
  {
    "inputs": [
      {"name": "workflowId", "type": "string"},
      {"name": "stage", "type": "string"},
      {"name": "ipfsHash", "type": "string"},
      {"name": "resultsHash", "type": "string"}
    ],
    "name": "commitResults",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "workflowId", "type": "string"}],
    "name": "getWorkflowResults",
    "outputs": [
      {"name": "stage", "type": "string"},
      {"name": "ipfsHash", "type": "string"},
      {"name": "resultsHash", "type": "string"},
      {"name": "timestamp", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

export async function POST(request) {
  try {
    const { workflowId, ipfsHash, resultsHash, stage } = await request.json();
    
    if (!workflowId || !ipfsHash || !resultsHash || !stage) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId, ipfsHash, resultsHash, stage' },
        { status: 400 }
      );
    }

    if (!WORKFLOW_TRACKER_ADDRESS || !PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Blockchain configuration missing. Check environment variables.' },
        { status: 500 }
      );
    }

    // Initialize provider and wallet - bypass all network detection
    console.log('Connecting to PureChain at:', PURECHAIN_RPC_URL);
    console.log('Chain ID:', CHAIN_ID);
    
    // Create a simple provider without network detection
    const provider = new ethers.providers.JsonRpcProvider(PURECHAIN_RPC_URL);
    
    // Skip network detection entirely - create wallet directly
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log('Wallet address:', wallet.address);
    
    // Initialize contract
    const contract = new ethers.Contract(WORKFLOW_TRACKER_ADDRESS, WORKFLOW_TRACKER_ABI, wallet);

    console.log(`Committing results to blockchain for workflow ${workflowId}...`);

    // Since ethers.js has network detection issues, try raw RPC call approach
    console.log('Attempting direct transaction to gas-free PureChain...');
    
    try {
      // First try with ethers.js
      const transaction = await contract.commitResults(
        workflowId,
        stage,
        ipfsHash,
        resultsHash
      );
      
      console.log('Transaction submitted:', transaction.hash);
      
      // Wait for transaction confirmation
      const receipt = await transaction.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);
      
      var transactionHash = transaction.hash;
      var blockNumber = receipt.blockNumber;
      var gasUsed = '0'; // Gas-free network
      
    } catch (ethersError) {
      console.log('Ethers.js failed, trying raw RPC approach:', ethersError.message);
      
      // Fallback: Create transaction data manually
      const contractInterface = new ethers.utils.Interface(WORKFLOW_TRACKER_ABI);
      const txData = contractInterface.encodeFunctionData('commitResults', [
        workflowId,
        stage,
        ipfsHash,
        resultsHash
      ]);
      
      // Get nonce via direct RPC call to avoid network detection issues
      const nonceResponse = await fetch(PURECHAIN_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionCount',
          params: [wallet.address, 'latest'],
          id: 1
        })
      });
      
      const nonceResult = await nonceResponse.json();
      if (nonceResult.error) {
        throw new Error(`Nonce RPC Error: ${nonceResult.error.message}`);
      }
      
      const nonce = nonceResult.result;
      console.log('Retrieved nonce via RPC:', nonce);
      
      // Create raw transaction with EIP-155 compliance
      const rawTx = {
        to: WORKFLOW_TRACKER_ADDRESS,
        data: txData,
        value: '0x0',
        chainId: CHAIN_ID, // Required for EIP-155 (replay protection)
        gasLimit: '0x7530', // 30000 in hex - sufficient for contract call
        gasPrice: '0x0', // Gas-free network (no cost)
        nonce: nonce
      };
      
      // Sign the transaction
      const signedTx = await wallet.signTransaction(rawTx);
      
      // Send via raw RPC call
      const rpcResponse = await fetch(PURECHAIN_RPC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_sendRawTransaction',
          params: [signedTx],
          id: 1
        })
      });
      
      const rpcResult = await rpcResponse.json();
      
      if (rpcResult.error) {
        throw new Error(`RPC Error: ${rpcResult.error.message}`);
      }
      
      var transactionHash = rpcResult.result;
      var blockNumber = 'pending';
      var gasUsed = '0'; // Gas-free network
      
      console.log('Raw RPC transaction submitted:', transactionHash);
    }

    // Persist blockchain information to database
    try {
      const updateResponse = await fetch(`http://localhost:8082/api/v1/workflows/${workflowId}/blockchain`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': request.headers.get('Authorization') || ''
        },
        body: JSON.stringify({
          transaction_hash: transactionHash,
          ipfs_hash: ipfsHash
        })
      });
      
      if (!updateResponse.ok) {
        console.warn('Failed to persist blockchain info to database:', updateResponse.status);
        // Don't fail the entire request - blockchain commit was successful
      } else {
        console.log('Successfully persisted blockchain info to database');
      }
    } catch (dbError) {
      console.warn('Error persisting blockchain info to database:', dbError.message);
      // Don't fail the entire request - blockchain commit was successful
    }

    // Store commit info in response for frontend localStorage storage
    const commitInfo = {
      txHash: transactionHash,
      ipfsHash: ipfsHash,
      timestamp: new Date().toISOString(),
      workflowId: workflowId
    };

    // Save blockchain verification data to persistent storage
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Use absolute path to root uploads directory
      const rootDir = path.resolve(process.cwd(), '..');
      const uploadsDir = path.join(rootDir, 'uploads', workflowId);
      
      console.log('Creating blockchain data directory:', uploadsDir);
      
      // Ensure directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log('Created uploads directory:', uploadsDir);
      }
      
      const blockchainData = {
        transaction_hash: transactionHash,
        block_number: blockNumber,
        gas_used: gasUsed,
        ipfs_hash: ipfsHash,
        commit_info: commitInfo,
        timestamp: new Date().toISOString(),
        workflow_id: workflowId,
        stage: stage,
        verified: false // Will be updated by verify endpoint
      };
      
      const blockchainPath = path.join(uploadsDir, 'blockchain.json');
      fs.writeFileSync(blockchainPath, JSON.stringify(blockchainData, null, 2));
      console.log('Blockchain data successfully saved to:', blockchainPath);
      
      // Verify file was actually created
      if (fs.existsSync(blockchainPath)) {
        console.log('Blockchain file verified to exist at:', blockchainPath);
      } else {
        console.error('ERROR: Blockchain file was not created!');
      }
      
    } catch (saveError) {
      console.error('Failed to save blockchain data:', saveError);
      console.error('Error details:', saveError.stack);
    }

    return NextResponse.json({
      success: true,
      transactionHash: transactionHash,
      blockNumber: blockNumber,
      gasUsed: gasUsed,
      ipfsHash: ipfsHash,
      commitInfo: commitInfo,
      message: 'Results committed to blockchain successfully'
    });

  } catch (error) {
    console.error('Blockchain commit error:', error);
    
    // Handle specific blockchain errors
    if (error.code === 'NETWORK_ERROR') {
      return NextResponse.json(
        { error: 'Unable to connect to PureChain network. Please check network connectivity.' },
        { status: 503 }
      );
    }
    
    if (error.code === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json(
        { error: 'Insufficient funds for blockchain transaction.' },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to commit to blockchain' },
      { status: 500 }
    );
  }
}

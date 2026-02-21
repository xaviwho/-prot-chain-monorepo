import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// PureChain configuration from environment
const PURECHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC || 'https://purechainnode.com';
const CHAIN_ID = 900520900520;

// Contract configuration — no fallbacks, must be set in environment
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
    const body = await request.json();
    const { workflowId, ipfsHash, resultsHash, stage } = body;

    if (!workflowId || !ipfsHash || !resultsHash || !stage) {
      return NextResponse.json(
        { error: 'Missing required fields: workflowId, ipfsHash, resultsHash, stage' },
        { status: 400 }
      );
    }

    if (!WORKFLOW_TRACKER_ADDRESS || !PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Blockchain configuration missing. Set WORKFLOW_TRACKER_ADDRESS and PRIVATE_KEY environment variables.' },
        { status: 500 }
      );
    }

    // Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(PURECHAIN_RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(WORKFLOW_TRACKER_ADDRESS, WORKFLOW_TRACKER_ABI, wallet);

    let transactionHash;
    let blockNumber;
    const gasUsed = '0'; // Gas-free network

    try {
      const transaction = await contract.commitResults(
        workflowId,
        stage,
        ipfsHash,
        resultsHash
      );

      const receipt = await transaction.wait();
      transactionHash = transaction.hash;
      blockNumber = receipt.blockNumber;

    } catch (ethersError) {
      // Fallback: raw RPC approach if ethers.js network detection fails
      const contractInterface = new ethers.utils.Interface(WORKFLOW_TRACKER_ABI);
      const txData = contractInterface.encodeFunctionData('commitResults', [
        workflowId,
        stage,
        ipfsHash,
        resultsHash
      ]);

      const nonceResponse = await fetch(PURECHAIN_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const rawTx = {
        to: WORKFLOW_TRACKER_ADDRESS,
        data: txData,
        value: '0x0',
        chainId: CHAIN_ID,
        gasLimit: '0x7530',
        gasPrice: '0x0',
        nonce: nonceResult.result
      };

      const signedTx = await wallet.signTransaction(rawTx);

      const rpcResponse = await fetch(PURECHAIN_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      transactionHash = rpcResult.result;
      blockNumber = 'pending';
    }

    // Persist blockchain information to Go backend
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
      const updateResponse = await fetch(`${apiUrl}/api/v1/workflows/${workflowId}/blockchain`, {
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
      }
    } catch (dbError) {
    }

    const commitInfo = {
      txHash: transactionHash,
      ipfsHash: ipfsHash,
      timestamp: new Date().toISOString(),
      workflowId: workflowId
    };

    // Save blockchain verification data to local file storage
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const rootDir = path.resolve(process.cwd(), '..');
      const uploadsDir = path.join(rootDir, 'uploads', workflowId);

      const fsSync = require('fs');
      if (!fsSync.existsSync(uploadsDir)) {
        fsSync.mkdirSync(uploadsDir, { recursive: true });
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
        verified: false
      };

      const blockchainPath = path.join(uploadsDir, 'blockchain.json');
      await fs.writeFile(blockchainPath, JSON.stringify(blockchainData, null, 2));
    } catch (saveError) {
    }

    return NextResponse.json({
      success: true,
      transactionHash,
      blockNumber,
      gasUsed,
      ipfsHash,
      commitInfo,
      message: 'Results committed to blockchain successfully'
    });

  } catch (error) {

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
      { error: 'Failed to commit to blockchain' },
      { status: 500 }
    );
  }
}

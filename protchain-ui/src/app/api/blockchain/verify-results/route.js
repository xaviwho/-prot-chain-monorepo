import { NextResponse } from 'next/server';
import { readBlockchainJson } from '../../../../utils/blockchainCommit';

const PURECHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC || 'https://purechainnode.com';
const IPFS_API_URL = process.env.IPFS_API_URL || 'http://localhost:5001';

export async function POST(request) {
  try {
    const { workflowId, stage, transactionHash, ipfsHash } = await request.json();

    if (!workflowId) {
      return NextResponse.json(
        { error: 'Missing required field: workflowId' },
        { status: 400 }
      );
    }

    // Read per-stage blockchain data
    const blockchainData = readBlockchainJson(workflowId);
    const stageData = stage
      ? blockchainData.stages?.[stage]
      : null;

    // Determine which tx/ipfs hash to verify
    const txHash = transactionHash || stageData?.txHash;
    const ipfs = ipfsHash || stageData?.ipfsHash;

    if (!txHash && !ipfs) {
      return NextResponse.json(
        { error: 'No blockchain record found for this workflow/stage. Run the pipeline stage first.' },
        { status: 404 }
      );
    }

    // Verify blockchain transaction via RPC
    let blockchainResult = null;
    if (txHash) {
      try {
        const receiptResponse = await fetch(PURECHAIN_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionReceipt',
            params: [txHash],
            id: 1,
          }),
        });

        const receiptData = await receiptResponse.json();

        if (receiptData.result) {
          blockchainResult = {
            transactionHash: txHash,
            blockNumber: receiptData.result.blockNumber,
            gasUsed: receiptData.result.gasUsed,
            status: receiptData.result.status,
            verified: true,
          };
        }
      } catch (err) {
        blockchainResult = { transactionHash: txHash, verified: false, error: err.message };
      }
    }

    // Verify IPFS data
    let ipfsResult = null;
    if (ipfs) {
      try {
        const ipfsResponse = await fetch(`${IPFS_API_URL}/api/v0/cat?arg=${ipfs}`, {
          method: 'POST',
        });

        if (ipfsResponse.ok) {
          const ipfsContent = await ipfsResponse.json();
          ipfsResult = {
            hash: ipfs,
            verified: true,
            version: ipfsContent.version || '1.0',
            stage: ipfsContent.stage,
            resultsHash: ipfsContent.resultsHash,
            chain: ipfsContent.chain || null,
          };
        }
      } catch (err) {
        ipfsResult = { hash: ipfs, verified: false, error: err.message };
      }
    }

    return NextResponse.json({
      verified: !!(blockchainResult?.verified || ipfsResult?.verified),
      workflowId,
      stage: stage || stageData?.stage || null,
      blockchain: blockchainResult,
      ipfs: ipfsResult,
      storedRecord: stageData || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to verify results' },
      { status: 500 }
    );
  }
}

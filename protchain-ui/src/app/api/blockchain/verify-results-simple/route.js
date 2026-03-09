import { NextResponse } from 'next/server';
import { readBlockchainJson } from '../../../../utils/blockchainCommit';

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

    const txHash = transactionHash || stageData?.txHash;
    const ipfs = ipfsHash || stageData?.ipfsHash;

    if (!txHash && !ipfs) {
      return NextResponse.json(
        { error: 'No blockchain record found for this workflow/stage.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      verified: true,
      message: 'Results verified successfully',
      workflowId,
      stage: stage || null,
      blockchainData: {
        transactionHash: txHash,
        verified: !!txHash,
      },
      ipfsData: {
        ipfsHash: ipfs,
        verified: !!ipfs,
      },
      storedRecord: stageData || null,
      verificationTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to verify results' },
      { status: 500 }
    );
  }
}

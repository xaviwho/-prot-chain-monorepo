import { NextResponse } from 'next/server';
import { readBlockchainJson } from '../../../../../utils/blockchainCommit';

/**
 * GET /api/workflow/[id]/blockchain-status
 * Returns per-stage blockchain commit status for a workflow.
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    const blockchainData = readBlockchainJson(id);
    return NextResponse.json(blockchainData);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read blockchain status' },
      { status: 500 }
    );
  }
}

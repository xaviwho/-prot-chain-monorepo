/**
 * Blockchain + IPFS auto-commit utility for pipeline stage results.
 *
 * After each pipeline stage completes, this module:
 * 1. Computes a SHA-256 hash of the results
 * 2. Reads the previous stage's blockchain record for chain linking
 * 3. Uploads results + chain metadata to IPFS (with pinning)
 * 4. Commits the IPFS hash + results hash to PureChain via WorkflowTracker
 * 5. Persists the record to blockchain.json (per-stage format)
 * 6. Notifies the Go backend (non-blocking)
 */
import crypto from 'crypto';
import fs from 'fs';
import { ethers } from 'ethers';
import { getWorkflowPath, getWorkflowFilePath } from './pathUtils';

// ── Configuration ──────────────────────────────────────────────
const IPFS_API_URL = process.env.NEXT_PUBLIC_IPFS_API_URL || 'http://localhost:5001';
const PURECHAIN_RPC_URL = process.env.BLOCKCHAIN_RPC || 'https://purechainnode.com';
const CHAIN_ID = 900520900520;
const WORKFLOW_TRACKER_ADDRESS = process.env.WORKFLOW_TRACKER_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const WORKFLOW_TRACKER_ABI = [
  {
    inputs: [
      { name: 'workflowId', type: 'string' },
      { name: 'stage', type: 'string' },
      { name: 'ipfsHash', type: 'string' },
      { name: 'resultsHash', type: 'string' },
    ],
    name: 'commitResults',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'workflowId', type: 'string' }],
    name: 'getWorkflowResults',
    outputs: [
      { name: 'stage', type: 'string' },
      { name: 'ipfsHash', type: 'string' },
      { name: 'resultsHash', type: 'string' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

const STAGE_ORDER = [
  'structure_preparation',
  'binding_site_analysis',
  'virtual_screening',
  'molecular_dynamics',
];

// ── Public API ─────────────────────────────────────────────────

/**
 * Automatically commit a pipeline stage's results to IPFS + PureChain.
 * Non-fatal: returns { success: false, error } on failure so the stage
 * response can still be returned to the user.
 *
 * @param {string} workflowId
 * @param {string} stage - one of STAGE_ORDER
 * @param {object} stageResults - the results object for this stage
 * @param {Request} [request] - optional, for forwarding auth headers
 * @returns {Promise<object>} { success, txHash, ipfsHash, resultsHash, blockNumber, timestamp, chain, error? }
 */
export async function commitStageToBlockchain(workflowId, stage, stageResults, request = null) {
  if (!WORKFLOW_TRACKER_ADDRESS || !PRIVATE_KEY) {
    console.warn('[blockchain] Missing WORKFLOW_TRACKER_ADDRESS or PRIVATE_KEY — skipping commit');
    return { success: false, error: 'Blockchain not configured', skipped: true };
  }

  try {
    // 1. SHA-256 hash of results
    const resultsJson = JSON.stringify(stageResults);
    const resultsHash = crypto.createHash('sha256').update(resultsJson).digest('hex');

    // 2. Get parent chain data for linking
    const chain = getParentChainData(workflowId, stage);

    // 3. Build IPFS metadata envelope
    const timestamp = new Date().toISOString();
    const metadata = {
      version: '2.0',
      type: 'protchain_workflow_results',
      workflowId,
      stage,
      timestamp,
      resultsHash,
      results: stageResults,
      chain, // null for genesis stage
    };

    // 4. Upload to IPFS with pinning
    const ipfsHash = await uploadToIPFS(JSON.stringify(metadata, null, 2));

    // 5. Commit to PureChain blockchain
    const { txHash, blockNumber } = await commitToChain(workflowId, stage, ipfsHash, resultsHash);

    // 6. Persist to blockchain.json
    const record = {
      txHash,
      ipfsHash,
      resultsHash,
      blockNumber,
      timestamp,
      chain,
      verified: false,
    };
    writeStageToBlockchainJson(workflowId, stage, record);

    // 7. Notify Go backend (non-blocking, fire-and-forget)
    notifyGoBackend(workflowId, txHash, ipfsHash, request).catch(() => {});

    console.log(`[blockchain] Committed ${stage} for workflow ${workflowId}: tx=${txHash}`);
    return { success: true, ...record };
  } catch (error) {
    console.error(`[blockchain] Commit failed for ${workflowId}/${stage}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Read the blockchain.json for a workflow.
 * Handles migration from old flat format to new per-stage format.
 */
export function readBlockchainJson(workflowId) {
  const filePath = getWorkflowFilePath(workflowId, 'blockchain.json');
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // Already new format
      if (data.version === '2.0' && data.stages) {
        return data;
      }

      // Migrate old flat format: { transaction_hash, stage, ipfs_hash, ... }
      if (data.stage && !data.stages) {
        return {
          workflow_id: workflowId,
          version: '2.0',
          stages: {
            [data.stage]: {
              txHash: data.transaction_hash || data.commit_info?.txHash,
              ipfsHash: data.ipfs_hash || data.commit_info?.ipfsHash,
              resultsHash: null, // old format didn't have proper hash
              blockNumber: data.block_number,
              timestamp: data.timestamp,
              chain: null,
              verified: data.verified || false,
            },
          },
        };
      }
    }
  } catch (e) {
    console.warn('[blockchain] Failed to read blockchain.json:', e.message);
  }
  return { workflow_id: workflowId, version: '2.0', stages: {} };
}

// ── Internal helpers ───────────────────────────────────────────

/**
 * Get the parent stage's blockchain record for chain linking.
 * Returns null for the first stage (genesis).
 */
function getParentChainData(workflowId, stage) {
  const stageIndex = STAGE_ORDER.indexOf(stage);
  if (stageIndex <= 0) return null; // genesis or unknown stage

  const parentStage = STAGE_ORDER[stageIndex - 1];
  const blockchain = readBlockchainJson(workflowId);
  const parentRecord = blockchain.stages[parentStage];

  if (!parentRecord || !parentRecord.txHash) return null;

  return {
    parentStage,
    parentTxHash: parentRecord.txHash,
    parentIpfsHash: parentRecord.ipfsHash,
    parentResultsHash: parentRecord.resultsHash,
  };
}

/**
 * Upload JSON data to the local IPFS node with pinning.
 * Uses the same pattern as the protein analysis route.
 */
async function uploadToIPFS(jsonString) {
  const formData = new FormData();
  const blob = new Blob([Buffer.from(jsonString)], { type: 'application/json' });
  formData.append('file', blob, 'results.json');

  const response = await fetch(`${IPFS_API_URL}/api/v0/add?pin=true`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result.Hash;
}

/**
 * Commit to PureChain using ethers.js with raw RPC fallback.
 * Extracted from the existing commit-results/route.js.
 */
async function commitToChain(workflowId, stage, ipfsHash, resultsHash) {
  const provider = new ethers.providers.JsonRpcProvider(PURECHAIN_RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(WORKFLOW_TRACKER_ADDRESS, WORKFLOW_TRACKER_ABI, wallet);

  let txHash;
  let blockNumber;

  try {
    // Primary: ethers.js contract call
    const tx = await contract.commitResults(workflowId, stage, ipfsHash, resultsHash);
    const receipt = await tx.wait();
    txHash = tx.hash;
    blockNumber = receipt.blockNumber;
  } catch (ethersError) {
    // Fallback: raw RPC if ethers.js network detection fails on PureChain
    const contractInterface = new ethers.utils.Interface(WORKFLOW_TRACKER_ABI);
    const txData = contractInterface.encodeFunctionData('commitResults', [
      workflowId,
      stage,
      ipfsHash,
      resultsHash,
    ]);

    const nonceResponse = await fetch(PURECHAIN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionCount',
        params: [wallet.address, 'latest'],
        id: 1,
      }),
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
      nonce: nonceResult.result,
    };

    const signedTx = await wallet.signTransaction(rawTx);

    const rpcResponse = await fetch(PURECHAIN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_sendRawTransaction',
        params: [signedTx],
        id: 1,
      }),
    });

    const rpcResult = await rpcResponse.json();
    if (rpcResult.error) {
      throw new Error(`RPC Error: ${rpcResult.error.message}`);
    }

    txHash = rpcResult.result;
    blockNumber = 'pending';
  }

  return { txHash, blockNumber };
}

/**
 * Write a stage record to the per-stage blockchain.json.
 */
function writeStageToBlockchainJson(workflowId, stage, record) {
  const blockchain = readBlockchainJson(workflowId);
  blockchain.stages[stage] = record;

  const dir = getWorkflowPath(workflowId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filePath = getWorkflowFilePath(workflowId, 'blockchain.json');
  fs.writeFileSync(filePath, JSON.stringify(blockchain, null, 2));
}

/**
 * Notify Go backend about the blockchain commit (non-blocking).
 */
async function notifyGoBackend(workflowId, txHash, ipfsHash, request) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
  await fetch(`${apiUrl}/api/v1/workflows/${workflowId}/blockchain`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: request?.headers?.get?.('Authorization') || '',
    },
    body: JSON.stringify({
      transaction_hash: txHash,
      ipfs_hash: ipfsHash,
    }),
  });
}

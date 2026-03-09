import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are ProtChain AI, an expert protein analysis assistant embedded in a drug discovery platform. You help researchers understand their protein structure analysis and binding site detection results.

Your capabilities:
- Explain protein structure properties (atom count, residue count, chain count, molecular weight, etc.)
- Interpret binding site analysis results (druggability scores, volume, hydrophobicity, nearby residues)
- Suggest next steps in the drug discovery pipeline
- Explain what PDB IDs mean and protein function
- Compare binding site characteristics to known druggable targets
- Provide context about computational methods used (geometric cavity detection, fpocket-style analysis)

Guidelines:
- Be concise but informative. Use bullet points for clarity.
- When discussing scores, explain what "good" vs "poor" values look like.
- Reference the user's actual data when available in the context.
- If you don't know something specific about their protein, say so and suggest where they can find the answer (e.g., UniProt, RCSB PDB).
- Use scientific terminology appropriately but explain jargon when first used.`;

export async function POST(request) {
  try {
    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY is not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { message, history = [], workflowContext = {}, fileContext = null } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string.' },
        { status: 400 }
      );
    }

    // Build context from workflow data
    let contextBlock = '';
    if (workflowContext && Object.keys(workflowContext).length > 0) {
      const contextParts = [];

      if (workflowContext.workflowName) {
        contextParts.push(`Workflow: ${workflowContext.workflowName}`);
      }
      if (workflowContext.pdbId) {
        contextParts.push(`PDB ID: ${workflowContext.pdbId}`);
      }
      if (workflowContext.stage) {
        contextParts.push(`Current Stage: ${workflowContext.stage}`);
      }
      if (workflowContext.status) {
        contextParts.push(`Status: ${workflowContext.status}`);
      }

      // Add structure results if available
      if (workflowContext.structureResults) {
        const sr = workflowContext.structureResults;
        contextParts.push('\n--- Structure Analysis Results ---');
        const structStr = JSON.stringify(sr, null, 2);
        // Truncate if too long
        contextParts.push(structStr.length > 25000 ? structStr.slice(0, 25000) + '\n... (truncated)' : structStr);
      }

      // Add binding site results if available
      if (workflowContext.bindingSites) {
        contextParts.push('\n--- Binding Site Analysis Results ---');
        const bsStr = JSON.stringify(workflowContext.bindingSites, null, 2);
        contextParts.push(bsStr.length > 25000 ? bsStr.slice(0, 25000) + '\n... (truncated)' : bsStr);
      }

      contextBlock = contextParts.join('\n');
    }

    // Determine if file is an image (for Claude vision API)
    const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
    const isImageFile = fileContext && IMAGE_EXTENSIONS.has(fileContext.type);
    const isBinaryFile = fileContext && fileContext.isBinary && !isImageFile;

    // Append uploaded file content if present (text-based files)
    if (fileContext && fileContext.content && !fileContext.isBinary) {
      let fileContent = fileContext.content;
      if (fileContent.length > 50000) {
        fileContent = fileContent.slice(0, 50000) + '\n... (file content truncated)';
      }
      contextBlock += `\n\n--- Uploaded File: ${fileContext.name || 'unknown'} (${fileContext.type || 'txt'}) ---\n${fileContent}`;
    }

    // For binary non-image files (PDF, Word, Excel), note the attachment metadata
    if (isBinaryFile) {
      contextBlock += `\n\n--- Uploaded File: ${fileContext.name || 'unknown'} (${fileContext.type?.toUpperCase() || 'binary'}) ---\n`;
      contextBlock += `[Binary file attached. File type: ${fileContext.type}. The user may be asking about this file's contents or requesting analysis.]`;
    }

    // Hard cap total context at 100K chars
    if (contextBlock.length > 100000) {
      contextBlock = contextBlock.slice(0, 100000) + '\n... (context truncated)';
    }

    // Build messages array from history (cap at last 10 exchanges)
    const recentHistory = history.slice(-10);
    const messages = [];

    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Add current user message with context
    // For image files, use Claude's multimodal content blocks
    if (isImageFile && fileContext.content) {
      // Extract base64 data from data URL (e.g., "data:image/png;base64,iVBOR...")
      const base64Match = fileContext.content.match(/^data:([^;]+);base64,(.+)$/);
      const mediaType = base64Match?.[1] || fileContext.mimeType || `image/${fileContext.type}`;
      const base64Data = base64Match?.[2] || fileContext.content;

      const contentBlocks = [];
      if (contextBlock) {
        contentBlocks.push({ type: 'text', text: `[Current Workflow Context]\n${contextBlock}\n\n[User Question]\n${message}` });
      } else {
        contentBlocks.push({ type: 'text', text: message });
      }
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
      contentBlocks.push({ type: 'text', text: `[Attached image: ${fileContext.name}]` });

      messages.push({ role: 'user', content: contentBlocks });
    } else if (isBinaryFile && fileContext.content && fileContext.type === 'pdf') {
      // Send PDF as document content block (Claude supports PDF via base64)
      const base64Match = fileContext.content.match(/^data:([^;]+);base64,(.+)$/);
      const base64Data = base64Match?.[2] || fileContext.content;

      const contentBlocks = [];
      if (contextBlock) {
        contentBlocks.push({ type: 'text', text: `[Current Workflow Context]\n${contextBlock}\n\n[User Question]\n${message}` });
      } else {
        contentBlocks.push({ type: 'text', text: message });
      }
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64Data,
        },
      });

      messages.push({ role: 'user', content: contentBlocks });
    } else {
      const userContent = contextBlock
        ? `[Current Workflow Context]\n${contextBlock}\n\n[User Question]\n${message}`
        : message;
      messages.push({ role: 'user', content: userContent });
    }

    // Call Claude API
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: (isImageFile || isBinaryFile) ? 4096 : fileContext ? 2048 : 1024,
      system: SYSTEM_PROMPT,
      messages: messages,
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return NextResponse.json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error('AI Chat error:', error);

    if (error?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid Anthropic API key. Check your ANTHROPIC_API_KEY.' },
        { status: 401 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get AI response. Please try again.' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate extension
    const filename = file.name.toLowerCase();
    if (!filename.endsWith('.csv') && !filename.endsWith('.sdf')) {
      return NextResponse.json(
        { error: 'Only .csv and .sdf files are accepted' },
        { status: 400 }
      );
    }

    // Validate size
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    if (fileBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large (max 5 MB)' },
        { status: 400 }
      );
    }

    // Ensure uploads directory exists
    const rootDir = path.resolve(process.cwd(), '..');
    const uploadsDir = path.join(rootDir, 'uploads', id);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save the raw file
    const ext = filename.endsWith('.sdf') ? 'sdf' : 'csv';
    const savedPath = path.join(uploadsDir, `compounds.${ext}`);
    fs.writeFileSync(savedPath, fileBuffer);

    // Forward file to BioAPI for parsing (direct call, no Go proxy needed)
    const bioApiUrl = process.env.BIOAPI_URL || 'http://127.0.0.1:8000';
    const bioFormData = new FormData();
    bioFormData.append('file', new Blob([fileBuffer]), file.name);

    const parseResponse = await fetch(`${bioApiUrl}/api/v1/compounds/parse`, {
      method: 'POST',
      body: bioFormData,
    });

    if (!parseResponse.ok) {
      const errText = await parseResponse.text();
      console.error('BioAPI compound parse error:', parseResponse.status, errText);
      return NextResponse.json(
        { error: `Compound parsing failed: ${parseResponse.statusText}`, details: errText },
        { status: parseResponse.status }
      );
    }

    const parseResult = await parseResponse.json();
    const data = parseResult.data || parseResult;

    if (!data.compounds || data.compounds.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid compounds found in file',
          warnings: data.warnings || [],
        },
        { status: 400 }
      );
    }

    // Save parsed compounds for virtual screening to read later
    const parsedPath = path.join(uploadsDir, 'parsed_compounds.json');
    fs.writeFileSync(parsedPath, JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      count: data.count,
      warnings: data.warnings || [],
      sample: data.compounds.slice(0, 3), // preview first 3
    });
  } catch (error) {
    console.error('Compound upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process compound file', details: error.message },
      { status: 500 }
    );
  }
}

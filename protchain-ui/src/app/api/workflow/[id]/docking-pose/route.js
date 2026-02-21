import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const compoundName = searchParams.get('compound');

  if (!id || !compoundName) {
    return NextResponse.json(
      { error: 'Workflow ID and compound name are required' },
      { status: 400 }
    );
  }

  const rootDir = path.resolve(process.cwd(), '..');
  const resultsPath = path.join(rootDir, 'uploads', id, 'results.json');

  if (!fs.existsSync(resultsPath)) {
    return NextResponse.json({ error: 'No results found' }, { status: 404 });
  }

  try {
    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const screening = data.virtual_screening;

    if (!screening || !screening.top_compounds) {
      return NextResponse.json({ error: 'No docking results found' }, { status: 404 });
    }

    const compound = screening.top_compounds.find(c => c.name === compoundName);
    if (!compound || !compound.pose_sdf) {
      return NextResponse.json({ error: 'Pose not found for compound' }, { status: 404 });
    }

    // Determine format: SDF or PDBQT
    const isSdf = compound.pose_sdf.includes('M  END') || compound.pose_sdf.includes('$$$$');
    const contentType = isSdf ? 'chemical/x-mdl-sdfile' : 'chemical/x-pdbqt';

    return new Response(compound.pose_sdf, {
      headers: { 'Content-Type': contentType },
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to read pose data' }, { status: 500 });
  }
}

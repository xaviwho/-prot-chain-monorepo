import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

export async function GET(request, { params }) {
    const { id } = params;

    if (!id || id.length !== 4) {
        return NextResponse.json({ error: 'Invalid PDB ID format. Must be 4 characters.' }, { status: 400 });
    }

    const pdbId = id.toUpperCase();

    try {
        console.log(`Fetching real binding pockets for ${pdbId}...`);

        // Step 1: Fetch PDB file from RCSB
        let pdbFile;
        const pdbResponse = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`);
        if (pdbResponse.ok) {
            pdbFile = await pdbResponse.text();
        } else {
            const fallbackResponse = await fetch(`https://files.rcsb.org/view/${pdbId}.pdb`);
            if (!fallbackResponse.ok) {
                return NextResponse.json({ error: `Failed to retrieve PDB file for ${pdbId} from RCSB.` }, { status: 404 });
            }
            pdbFile = await fallbackResponse.text();
        }

        // Step 2: Call BioAPI for real geometric cavity detection
        console.log(`Calling BioAPI for binding site detection...`);
        const response = await fetch(`${API_URL}/api/v1/structure/binding-sites/detect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                pdb_id: pdbId,
                structure_data: pdbFile
            }),
        });

        if (!bioApiResponse.ok) {
            console.error(`BioAPI failed for ${pdbId}: ${bioApiResponse.status}`);
            return NextResponse.json({ error: 'Failed to detect binding sites' }, { status: 500 });
        }

        const bioApiData = await bioApiResponse.json();
        const bindingSites = bioApiData.binding_sites || [];

        console.log(`✅ Detected ${bindingSites.length} real binding pockets for ${pdbId}`);

        // Step 3: Format binding sites for Molstar viewer
        const formattedBindingSites = bindingSites.map((site, index) => ({
            id: site.site_id || (index + 1),
            center: {
                x: site.center.x,
                y: site.center.y,
                z: site.center.z
            },
            volume: site.volume,
            druggability_score: site.druggability_score,
            hydrophobicity: site.hydrophobicity,
            cavity_points: site.cavity_points,
            shape_complementarity: site.shape_complementarity,
            residues: site.nearby_residues?.map(res => ({
                chain: res.chain,
                number: res.residue_number,
                name: res.residue_name,
                distance: res.distance
            })) || []
        }));

        return NextResponse.json({
            pdb_id: pdbId,
            binding_sites: formattedBindingSites,
            detection_method: "geometric_cavity_detection",
            total_pockets: formattedBindingSites.length
        });

    } catch (error) {
        console.error('Error in binding pockets API route:', error);
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

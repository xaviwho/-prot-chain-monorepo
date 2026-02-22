import { NextResponse } from 'next/server';
import crypto from 'crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
const IPFS_API_URL = process.env.NEXT_PUBLIC_IPFS_API_URL || 'http://localhost:5001';
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'http://localhost:8080';

export async function GET(request, context) {
    const { params } = context;
    const { id } = params;

    if (!id || id.length !== 4) {
        return NextResponse.json({ error: 'Invalid PDB ID format. Must be 4 characters.' }, { status: 400 });
    }

    const pdbId = id.toUpperCase();

    try {
        // Step 1: Fetch PDB file from RCSB
        let pdbFile;
        const pdbResponse = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`, {
            cache: 'no-store',
        });
        if (pdbResponse.ok) {
            pdbFile = await pdbResponse.text();
        } else {
            const fallbackResponse = await fetch(`https://files.rcsb.org/view/${pdbId}.pdb`, {
                cache: 'no-store',
            });
            if (!fallbackResponse.ok) {
                return NextResponse.json({ error: `Failed to retrieve PDB file for ${pdbId} from RCSB.` }, { status: 404 });
            }
            pdbFile = await fallbackResponse.text();
        }

        // Step 2: Fetch rich metadata from RCSB REST API (always, not gated behind BioAPI)
        let metadata = {
            recommended_name: 'N/A',
            organism: { scientific_name: 'Unknown', common_name: 'Unknown' },
            primary_accession: 'N/A',
            entry_audit: { first_public_date: 'N/A' },
        };

        try {
            // Fetch entry data and polymer entity data in parallel from RCSB
            const [entryRes, entityRes] = await Promise.all([
                fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`, { cache: 'no-store' }),
                fetch(`https://data.rcsb.org/rest/v1/core/polymer_entity/${pdbId}/1`, { cache: 'no-store' }),
            ]);

            if (entryRes.ok) {
                const entryData = await entryRes.json();

                // Title / Recommended Name
                if (entryData?.struct?.title) {
                    metadata.recommended_name = entryData.struct.title;
                }

                // Release date
                if (entryData?.rcsb_accession_info?.initial_release_date) {
                    metadata.entry_audit = {
                        first_public_date: entryData.rcsb_accession_info.initial_release_date.split('T')[0],
                    };
                } else if (entryData?.rcsb_accession_info?.deposit_date) {
                    metadata.entry_audit = {
                        first_public_date: entryData.rcsb_accession_info.deposit_date.split('T')[0],
                    };
                }

                // Primary accession — try PubMed ID first, then DOI
                if (entryData?.rcsb_primary_citation?.pdbx_database_id_PubMed) {
                    metadata.primary_accession = String(entryData.rcsb_primary_citation.pdbx_database_id_PubMed);
                } else if (entryData?.rcsb_primary_citation?.pdbx_database_id_DOI) {
                    metadata.primary_accession = entryData.rcsb_primary_citation.pdbx_database_id_DOI;
                }
            }

            if (entityRes.ok) {
                const entityData = await entityRes.json();

                // Organism
                const source = entityData?.rcsb_entity_source_organism?.[0];
                if (source) {
                    metadata.organism = {
                        scientific_name: source.scientific_name || 'Unknown',
                        common_name: source.common_name || source.scientific_name || 'Unknown',
                    };
                }

                // Fallback title from entity description
                if (metadata.recommended_name === 'N/A' && entityData?.rcsb_polymer_entity?.pdbx_description) {
                    metadata.recommended_name = entityData.rcsb_polymer_entity.pdbx_description;
                }
            }

            // Try to get UniProt accession (more specific than PubMed)
            try {
                const uniprotRes = await fetch(`https://data.rcsb.org/rest/v1/core/uniprot/${pdbId}/1`, { cache: 'no-store' });
                if (uniprotRes.ok) {
                    const uniprotData = await uniprotRes.json();
                    const uniprotId = uniprotData?.[0]?.rcsb_uniprot_container_identifiers?.uniprot_id;
                    if (uniprotId) {
                        metadata.primary_accession = uniprotId;
                    }
                }
            } catch (_) {}
        } catch (rcsbError) {
            // If RCSB API fails entirely, fall back to PDB file header parsing
            try {
                const titleMatch = pdbFile.match(/^TITLE\s+(.+)/m);
                if (titleMatch) metadata.recommended_name = titleMatch[1].trim();

                const lines = pdbFile.split('\n');
                for (const line of lines) {
                    if (line.startsWith('SOURCE') && line.includes('ORGANISM_SCIENTIFIC:')) {
                        const match = line.match(/ORGANISM_SCIENTIFIC:\s*([^;]+)/);
                        if (match) metadata.organism.scientific_name = match[1].trim();
                    }
                    if (line.startsWith('SOURCE') && line.includes('ORGANISM_COMMON:')) {
                        const match = line.match(/ORGANISM_COMMON:\s*([^;]+)/);
                        if (match) metadata.organism.common_name = match[1].trim();
                    }
                }

                const dateMatch = pdbFile.match(/REVDAT\s+1\s+(\d{2}-\w{3}-\d{2})/);
                if (dateMatch) metadata.entry_audit = { first_public_date: dateMatch[1].trim() };
            } catch (_) {}
        }

        // Optionally enrich with BioAPI (non-blocking, don't fail if unavailable)
        try {
            const bioApiResponse = await fetch(`${API_URL}/api/v1/structure/workflows/ad-hoc-analysis/structure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdb_id: pdbId, structure_data: pdbFile }),
                cache: 'no-store',
            });
            if (bioApiResponse.ok) {
                const bioApiData = await bioApiResponse.json();
                const descriptors = bioApiData.data?.details?.descriptors;
                if (descriptors) {
                    metadata = { ...descriptors, ...metadata };
                }
            }
        } catch (_) {}

        // Step 3: Generate cryptographic hash for blockchain reference
        let fileHash = '';
        try {
            const hashObj = crypto.createHash('sha256');
            hashObj.update(pdbFile);
            fileHash = hashObj.digest('hex');
        } catch (hashError) {
            fileHash = `hash-error-${Date.now()}`;
        }

        // Step 4: Store PDB file in IPFS and get the real CID
        let ipfsCid = '';
        try {
            const formData = new FormData();
            const blob = new Blob([Buffer.from(pdbFile)]);
            formData.append('file', blob);

            const ipfsResponse = await fetch(`${IPFS_API_URL}/api/v0/add?pin=true`, {
                method: 'POST',
                body: formData,
            });

            if (!ipfsResponse.ok) {
                throw new Error(`IPFS API error: ${ipfsResponse.status} ${ipfsResponse.statusText}`);
            }

            const ipfsData = await ipfsResponse.json();
            ipfsCid = ipfsData.Hash;
        } catch (ipfsError) {
            ipfsCid = `QmError${fileHash.substring(0, 40)}`;
        }

        // Step 5: Structure the response
        const response = {
            protein_id: pdbId,
            data: metadata,
            blockchain_info: {
                file_hash: fileHash,
                ipfs_cid: ipfsCid,
                timestamp: new Date().toISOString(),
                gateway_url: `${IPFS_GATEWAY}/ipfs/${ipfsCid}`,
                status: 'indexed',
            },
            file: pdbFile,
        };

        return NextResponse.json(response);

    } catch (error) {
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

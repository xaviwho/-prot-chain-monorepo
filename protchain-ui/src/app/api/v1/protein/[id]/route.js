import { NextResponse } from 'next/server';
import crypto from 'crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
const IPFS_API_URL = process.env.NEXT_PUBLIC_IPFS_API_URL || 'http://localhost:5001';
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'http://localhost:8080';

// Next.js 15+ requires dynamic params to be properly awaited
export async function GET(request, context) {
    // Get parameters from context
    const { params } = context;
    const { id } = params;
    
    console.log('[PROTEIN API] Processing request for PDB ID:', id);
    
    if (!id || id.length !== 4) {
        return NextResponse.json({ error: 'Invalid PDB ID format. Must be 4 characters.' }, { status: 400 });
    }

    const pdbId = id.toUpperCase();

    try {
        // Step 1: Fetch PDB file from RCSB
        console.log('[PROTEIN API] Fetching PDB file for', pdbId);
        let pdbFile;
        const pdbResponse = await fetch(`https://files.rcsb.org/download/${pdbId}.pdb`, {
            cache: 'no-store' // Bypass caching
        });
        if (pdbResponse.ok) {
            pdbFile = await pdbResponse.text();
            console.log('[PROTEIN API] PDB file fetched successfully, length:', pdbFile.length);
        } else {
            console.log('[PROTEIN API] Primary PDB fetch failed, trying fallback...');
            const fallbackResponse = await fetch(`https://files.rcsb.org/view/${pdbId}.pdb`, {
                cache: 'no-store' // Bypass caching
            });
            if (!fallbackResponse.ok) {
                console.error('[PROTEIN API] Failed to retrieve PDB file for', pdbId);
                return NextResponse.json({ error: `Failed to retrieve PDB file for ${pdbId} from RCSB.` }, { status: 404 });
            }
            pdbFile = await fallbackResponse.text();
            console.log('[PROTEIN API] PDB file fetched from fallback, length:', pdbFile.length);
        }

        // Step 2: Call BioAPI to get metadata and fetch additional protein information from UniProt
        let metadata = {};
        let primaryAccession = 'N/A';
        let recommendedName = 'N/A';
        let organism = 'Unknown';
        let publicationDate = 'N/A';
        
        try {
            console.log(`[PROTEIN API] Calling API at ${API_URL} for ${pdbId}`);
            const bioApiResponse = await fetch(`${API_URL}/api/v1/structure/workflows/ad-hoc-analysis/structure`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    pdb_id: pdbId,
                    structure_data: pdbFile
                }),
                cache: 'no-store',
            });

            if (bioApiResponse.ok) {
                const bioApiData = await bioApiResponse.json();
                metadata = bioApiData.data?.details?.descriptors || {};
                console.log('[PROTEIN API] BioAPI response received');
                
                // Extract metadata from the PDB file header
                try {
                    // Look for TITLE, SOURCE, DBREF lines in the PDB file
                    const titleMatch = pdbFile.match(/^TITLE\s+(.+)/m);
                    if (titleMatch && titleMatch[1]) {
                        recommendedName = titleMatch[1].trim();
                    }
                    
                    const sourceMatch = pdbFile.match(/^SOURCE\s+(.+)/m);
                    if (sourceMatch && sourceMatch[1]) {
                        organism = sourceMatch[1].trim();
                    }
                    
                    // Look for accession in DBREF lines
                    const dbrefMatch = pdbFile.match(/^DBREF\s+\w+\s+\w+\s+(\w+)/m);
                    if (dbrefMatch && dbrefMatch[1]) {
                        primaryAccession = dbrefMatch[1].trim();
                    }
                    
                    // Try to get publication date from JRNL or REMARK lines
                    const dateMatch = pdbFile.match(/JRNL.*YEAR\s+(\d{4})/) || 
                                     pdbFile.match(/REMARK\s+\d+\s+REFERENCE.*(\d{4})/) ||
                                     pdbFile.match(/REVDAT\s+1\s+(\d{2}-\w{3}-\d{2})/); 
                    if (dateMatch && dateMatch[1]) {
                        publicationDate = dateMatch[1].trim();
                    }
                    
                    // If we still couldn't find the accession, try from the RCSB API
                    if (primaryAccession === 'N/A') {
                        const rcsbResponse = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`, {
                            cache: 'no-store'
                        });
                        
                        if (rcsbResponse.ok) {
                            const rcsbData = await rcsbResponse.json();
                            primaryAccession = rcsbData?.rcsb_primary_citation?.pdbx_database_id_PubMed || 
                                              rcsbData?.struct_ref?.[0]?.pdbx_db_accession || 
                                              'N/A';
                                              
                            if (recommendedName === 'N/A' && rcsbData?.struct?.title) {
                                recommendedName = rcsbData.struct.title;
                            }
                            
                            if (organism === 'Unknown' && rcsbData?.entity?.[0]?.src_method === 'nat' && 
                                rcsbData?.entity?.[0]?.pdbx_description) {
                                organism = rcsbData.entity[0].pdbx_description;
                            }
                        }
                    }
                } catch (parseError) {
                    console.error('[PROTEIN API] Error parsing PDB metadata:', parseError);
                }
            } else {
                console.error(`[PROTEIN API] BioAPI failed: ${bioApiResponse.status} ${await bioApiResponse.text()}`);
            }
        } catch (bioApiError) {
            console.error('[PROTEIN API] Failed to call BioAPI:', bioApiError);
            // Do not fail the request; proceed without metadata
        }
        
        // Add the extracted metadata to our response
        metadata = {
            ...metadata,
            recommended_name: recommendedName,
            organism: organism,
            primary_accession: primaryAccession,
            publication_date: publicationDate
        };

        // Step 3: Generate cryptographic hash for blockchain reference
        console.log('[PROTEIN API] Generating SHA-256 hash of PDB file');
        let fileHash = '';
        try {
            // Use Node.js crypto module to create a proper SHA-256 hash
            const hashObj = crypto.createHash('sha256');
            hashObj.update(pdbFile);
            fileHash = hashObj.digest('hex');
            console.log('[PROTEIN API] Generated SHA-256 hash:', fileHash);
        } catch (hashError) {
            console.error('[PROTEIN API] Error generating hash:', hashError);
            fileHash = `hash-error-${Date.now()}`;
        }
        
        // Step 4: Store PDB file in IPFS and get the real CID
        console.log('[PROTEIN API] Storing file in IPFS...');
        let ipfsCid = '';
        try {
            // Create a Buffer from the PDB file text
            const fileBuffer = Buffer.from(pdbFile);
            
            // Store the file in IPFS using the IPFS HTTP API
            const formData = new FormData();
            const blob = new Blob([fileBuffer]);
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
            console.log('[PROTEIN API] Successfully stored in IPFS with CID:', ipfsCid);
        } catch (ipfsError) {
            console.error('[PROTEIN API] IPFS storage error:', ipfsError);
            // Fall back to a deterministic CID format if IPFS is unavailable
            ipfsCid = `QmError${fileHash.substring(0, 40)}`;
        }
        
        // Step 5: Structure the response in the format expected by the frontend
        // IMPORTANT: Format must exactly match what the frontend expects in retrieveProteinDetail function
        const response = {
            protein_id: pdbId,
            data: metadata,
            blockchain_info: {
                file_hash: fileHash,
                ipfs_cid: ipfsCid,
                timestamp: new Date().toISOString(),
                gateway_url: `${IPFS_GATEWAY}/ipfs/${ipfsCid}`,
                status: 'indexed'
            },
            file: pdbFile
        };
        
        console.log('[PROTEIN API] Sending response with blockchain info');
        console.log('[PROTEIN API] Response structure:', {
            protein_id: response.protein_id,
            data_keys: Object.keys(response.data || {}),
            blockchain_info: response.blockchain_info,
            file_length: response.file?.length
        });

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error in protein API route:', error);
        return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
    }
}

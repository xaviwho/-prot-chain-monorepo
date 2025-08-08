'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import { PDBLoader } from 'three/examples/jsm/loaders/PDBLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { retrieveProteinDetail } from '@/lib/api';
import Cookies from 'js-cookie';
import { getIpfsGatewayUrl } from '@/lib/api';

export default function ProteinScreen() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pdbId, setPdbId] = useState('');
    const [error, setError] = useState('');
    const [metadata, setMetadata] = useState(null);
    const [pdbFile, setPdbFile] = useState(null); // Save PDB file for download
    const [blockchainInfo, setBlockchainInfo] = useState(null);
    const containerRef = useRef(null);
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);

    useEffect(() => {
        const token = Cookies.get('token');
        if (token) {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
            router.push('/login');
        }
    }, [router]);

    const initializeScene = (pdbBlob) => {
        // Clean up previous scene and renderer if they exist
        if (sceneRef.current) {
            sceneRef.current.traverse((object) => {
                if (object.isMesh) object.geometry.dispose();
                if (object.material) object.material.dispose();
            });
            sceneRef.current.clear();
            sceneRef.current = null;
        }

        if (rendererRef.current) {
            rendererRef.current.dispose();
            containerRef.current.innerHTML = '';
            rendererRef.current = null;
        }

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            75,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            1000
        );
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        containerRef.current.appendChild(renderer.domElement);

        sceneRef.current = scene;
        rendererRef.current = renderer;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1).normalize();
        scene.add(directionalLight);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        const reader = new FileReader();
        reader.onload = () => {
            const pdbContent = reader.result;
            const loader = new PDBLoader();
            const pdb = loader.parse(pdbContent);
            const { geometryAtoms, geometryBonds } = pdb;

            const materialAtoms = new THREE.PointsMaterial({ size: 0.5, vertexColors: true });
            const points = new THREE.Points(geometryAtoms, materialAtoms);
            scene.add(points);

            const materialBonds = new THREE.LineBasicMaterial({ color: 0xffffff });
            const bonds = new THREE.LineSegments(geometryBonds, materialBonds);
            scene.add(bonds);

            const boundingBox = new THREE.Box3().setFromObject(points);
            const center = boundingBox.getCenter(new THREE.Vector3());
            const size = boundingBox.getSize(new THREE.Vector3()).length();
            const distance = size * 2.5;
            camera.position.set(center.x, center.y, distance);
            camera.lookAt(center);
            controls.update();

            const animate = () => {
                requestAnimationFrame(animate);
                controls.update();
                renderer.render(scene, camera);
            };
            animate();
        };

        reader.onerror = () => {
            setError('Failed to read PDB file.');
        };

        reader.readAsText(pdbBlob);
    };

    const fetchPdbFile = async () => {
        if (!pdbId.trim()) {
            setError('Please enter a valid PDB ID.');
            return;
        }

        try {
            setError('');
            const response = await retrieveProteinDetail(pdbId);

            if (!response.metadata?.data || !response.file) {
                throw new Error('Invalid response format.');
            }

            const { data: proteinData, blockchain_info } = response.metadata;
            console.log('Protein data:', proteinData);
            console.log('Blockchain info:', blockchain_info);
            
            setMetadata(proteinData);
            setBlockchainInfo({
                fileHash: blockchain_info?.file_hash || '',
                ipfsCid: blockchain_info?.ipfs_cid || '',
                primaryAccession: proteinData?.primary_accession || 'N/A'
            });

            const pdbBlob = new Blob([response.file], { type: 'chemical/x-pdb' });
            setPdbFile(pdbBlob); // Save the file for downloading
            initializeScene(pdbBlob);
        } catch (err) {
            setError(err.message || 'Error fetching PDB file.');
            console.error('Error fetching PDB file:', err);
        }
    };

    const downloadFile = () => {
        if (!pdbFile) {
            setError('No file to download.');
            return;
        }

        const url = URL.createObjectURL(pdbFile);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${pdbId}.pdb`;
        link.click();
        URL.revokeObjectURL(url); // Clean up URL
    };

    if (!isAuthenticated) {
        return <div>Loading...</div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100vh', backgroundColor: '#f5f5f5' }}>
            <div style={{ marginBottom: '1rem', textAlign: 'center', width: '100%', maxWidth: '1200px', padding: '0 1rem' }}>
                <h1 style={{ color: '#000' }}>3D PDB Viewer</h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <input
                        type="text"
                        placeholder="Enter PDB ID (e.g., 1XYZ)"
                        value={pdbId}
                        onChange={(e) => setPdbId(e.target.value)}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #ccc',
                            fontSize: '1rem',
                            color: '#000',
                            width: '200px'
                        }}
                    />
                    <button
                        onClick={fetchPdbFile}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#0070f3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                        }}
                    >
                        Load PDB Structure
                    </button>
                    <button
                        onClick={downloadFile}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#28a745',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem',
                        }}
                    >
                        Download PDB File
                    </button>
                </div>
                {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}
            </div>
            
            <div style={{ display: 'flex', width: '100%', maxWidth: '1200px', gap: '2rem', padding: '0 1rem' }}>
                {/* Left side: 3D Viewer */}
                <div style={{ flex: '2' }}>
                    <div
                        ref={containerRef}
                        style={{ width: '100%', height: '500px', backgroundColor: '#000', borderRadius: '8px' }}
                    ></div>
                </div>

                {/* Right side: Metadata and Blockchain Info */}
                <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Blockchain Information */}
                    {blockchainInfo && (
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h2 style={{ color: '#000', fontSize: '1.5rem', marginBottom: '1rem' }}>Blockchain Information</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div>
                                    <p style={{ color: '#4B5563', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>File Hash</p>
                                    <p style={{ fontFamily: 'monospace', wordBreak: 'break-all', backgroundColor: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', color: '#111827', fontSize: '0.875rem' }}>
                                        {blockchainInfo.fileHash}
                                    </p>
                                </div>
                                <div>
                                    <p style={{ color: '#4B5563', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>IPFS CID</p>
                                    <p style={{ fontFamily: 'monospace', wordBreak: 'break-all', backgroundColor: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', color: '#111827', fontSize: '0.875rem' }}>
                                        {blockchainInfo.ipfsCid}
                                    </p>
                                    <a
                                        href={`${getIpfsGatewayUrl()}/ipfs/${blockchainInfo.ipfsCid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-block',
                                            marginTop: '0.5rem',
                                            color: '#0070f3',
                                            textDecoration: 'none',
                                            fontSize: '0.875rem',
                                            fontWeight: '500'
                                        }}
                                    >
                                        View on IPFS →
                                    </a>
                                </div>
                                <div>
                                    <p style={{ color: '#4B5563', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Primary Accession</p>
                                    <p style={{ fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', color: '#111827', fontSize: '0.875rem' }}>
                                        {blockchainInfo.primaryAccession}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Protein Metadata */}
                    {metadata && (
                        <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h2 style={{ color: '#000', fontSize: '1.5rem', marginBottom: '1rem' }}>Protein Metadata</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div>
                                    <p style={{ color: '#4B5563', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Recommended Name</p>
                                    <p style={{ color: '#111827', fontSize: '0.938rem' }}>{metadata?.recommended_name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p style={{ color: '#4B5563', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>Organism</p>
                                    <p style={{ color: '#111827', fontSize: '0.938rem' }}>{metadata?.organism?.scientific_name || 'Unknown'} ({metadata?.organism?.common_name || 'Unknown'})</p>
                                </div>
                                <div>
                                    <p style={{ color: '#4B5563', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>First Public Date</p>
                                    <p style={{ color: '#111827', fontSize: '0.938rem' }}>{metadata?.entry_audit?.first_public_date || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useWeb3React } from '@web3-react/core';
import { ethers } from 'ethers';
import DrugDiscoveryABI from '../../contracts/DrugDiscovery.json';
import PDBViewer from '@/components/PDBViewer';

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const { account, library } = useWeb3React();

  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_DRUG_DISCOVERY_CONTRACT;

  useEffect(() => {
    loadProjects();
  }, [account]);

  async function loadProjects() {
    if (!account || !library) return;

    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        DrugDiscoveryABI,
        library.getSigner()
      );

      const projectCount = await contract.projectCount();
      const projectsData = [];

      for (let i = 0; i < projectCount; i++) {
        const project = await contract.getProject(i);
        if (project.owner === account || project.isPublic) {
          projectsData.push({
            id: i,
            ...project,
            milestones: await contract.getProjectMilestones(i),
            collaborators: await contract.getProjectCollaborators(i),
          });
        }
      }

      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createProject(data) {
    if (!account || !library) return;

    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        DrugDiscoveryABI,
        library.getSigner()
      );

      const tx = await contract.createProject(
        data.name,
        data.description,
        data.targetProtein,
        data.isPublic,
        data.metadataHash
      );

      await tx.wait();
      loadProjects();
    } catch (error) {
      console.error('Error creating project:', error);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Drug Discovery Projects</h1>
        <button
          onClick={() => {/* Open create project modal */}}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          New Project
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{project.name}</h2>
              <p className="text-gray-600 mb-4">{project.description}</p>
              
              {project.targetProtein && (
                <div className="mb-4 h-48">
                  <PDBViewer
                    pdbId={project.targetProtein}
                    style={{ height: '100%' }}
                  />
                </div>
              )}

              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-gray-500">
                  {new Date(project.createdAt * 1000).toLocaleDateString()}
                </span>
                <button
                  onClick={() => setSelectedProject(project)}
                  className="text-blue-500 hover:text-blue-600"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project details modal would go here */}
    </div>
  );
}

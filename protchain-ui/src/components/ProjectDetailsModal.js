'use client';

import { useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { ethers } from 'ethers';
import PDBViewer from './PDBViewer';

export default function ProjectDetailsModal({ project, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [newMilestone, setNewMilestone] = useState('');
  const { account, library } = useWeb3React();

  const isOwner = project?.owner === account;

  async function addMilestone(e) {
    e.preventDefault();
    if (!newMilestone || !account || !library) return;

    try {
      const contract = new ethers.Contract(
        process.env.NEXT_PUBLIC_DRUG_DISCOVERY_CONTRACT,
        DrugDiscoveryABI,
        library.getSigner()
      );

      const tx = await contract.addMilestone(
        project.id,
        newMilestone,
        '' // IPFS hash would go here
      );

      await tx.wait();
      setNewMilestone('');
      // Refresh project data
    } catch (error) {
      console.error('Error adding milestone:', error);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{project.name}</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          <div className="mb-6">
            <nav className="flex space-x-4 border-b">
              {['overview', 'milestones', 'collaborators', 'docking'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 ${
                    activeTab === tab
                      ? 'border-b-2 border-blue-500 text-blue-500'
                      : 'text-gray-500'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-6">
            {activeTab === 'overview' && (
              <div>
                <p className="text-gray-600 mb-4">{project.description}</p>
                <div className="h-96 mb-4">
                  <PDBViewer
                    pdbId={project.targetProtein}
                    style={{ height: '100%' }}
                  />
                </div>
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Project Details</h3>
                  <dl className="grid grid-cols-2 gap-4">
                    <dt className="text-gray-600">Created</dt>
                    <dd>{new Date(project.createdAt * 1000).toLocaleDateString()}</dd>
                    <dt className="text-gray-600">Status</dt>
                    <dd>{project.isPublic ? 'Public' : 'Private'}</dd>
                  </dl>
                </div>
              </div>
            )}

            {activeTab === 'milestones' && (
              <div>
                <div className="space-y-4">
                  {project.milestones.map((milestone, index) => (
                    <div
                      key={index}
                      className="border rounded p-4"
                    >
                      <p className="font-medium">{milestone.description}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(milestone.timestamp * 1000).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>

                {(isOwner || project.collaborators.includes(account)) && (
                  <form onSubmit={addMilestone} className="mt-6">
                    <input
                      type="text"
                      value={newMilestone}
                      onChange={(e) => setNewMilestone(e.target.value)}
                      placeholder="Add new milestone..."
                      className="w-full p-2 border rounded"
                    />
                    <button
                      type="submit"
                      className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      Add Milestone
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'collaborators' && (
              <div>
                <div className="space-y-2">
                  {project.collaborators.map((collaborator, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="font-mono">{collaborator}</span>
                    </div>
                  ))}
                </div>

                {isOwner && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-2">Add Collaborator</h3>
                    <input
                      type="text"
                      placeholder="Ethereum address"
                      className="w-full p-2 border rounded"
                    />
                    <button
                      className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'docking' && (
              <div>
                <h3 className="font-semibold mb-4">Molecular Docking</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="SMILES notation"
                    className="w-full p-2 border rounded"
                  />
                  <button
                    className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Start Docking Simulation
                  </button>
                </div>
                
                <div className="mt-6">
                  <h4 className="font-medium mb-2">Recent Results</h4>
                  {/* Docking results would go here */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

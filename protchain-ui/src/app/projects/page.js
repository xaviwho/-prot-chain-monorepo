'use client';

import { useState, useEffect } from 'react';
import PDBViewer from '@/components/PDBViewer';

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {

    try {
      // TODO: Replace with actual API call to backend
      // For now, using mock data since DrugDiscoveryABI was removed
      const mockProjects = [
        {
          id: 1,
          name: "Sample Drug Discovery Project",
          description: "A sample project for demonstration",
          targetProtein: "1ABC",
          owner: "sample-user",
          isPublic: true,
          createdAt: Math.floor(Date.now() / 1000),
          milestones: [],
          collaborators: []
        }
      ];

      setProjects(mockProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createProject(data) {
    try {
      // TODO: Replace with actual API call to backend
      // For now, just logging the data since DrugDiscoveryABI was removed
      console.log('Creating project with data:', data);
      
      // Simulate project creation
      const newProject = {
        id: projects.length + 1,
        name: data.name,
        description: data.description,
        targetProtein: data.targetProtein,
        owner: "sample-user",
        isPublic: data.isPublic,
        createdAt: Math.floor(Date.now() / 1000),
        milestones: [],
        collaborators: []
      };
      
      setProjects([...projects, newProject]);
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

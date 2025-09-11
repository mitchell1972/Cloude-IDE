import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { manageProject } from '../lib/supabase';
import { Plus, Folder, FolderOpen, FileText, Play, Settings, BarChart3 } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface ProjectManagerProps {
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
}

export function ProjectManager({ selectedProject, onSelectProject, onCreateProject }: ProjectManagerProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await manageProject('get_projects');
      setProjects(data || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject() {
    if (!newProject.name.trim()) return;

    try {
      const project = await manageProject('create_project', {
        projectData: {
          name: newProject.name,
          description: newProject.description,
          isPublic: false
        }
      });
      
      setProjects(prev => [project, ...prev]);
      setNewProject({ name: '', description: '' });
      setShowCreateForm(false);
      onSelectProject(project);
      onCreateProject();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Test Projects</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* Create Project Form */}
      {showCreateForm && (
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Project name"
              value={newProject.name}
              onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={newProject.description}
              onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateProject}
                disabled={!newProject.name.trim()}
                className="flex-1 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewProject({ name: '', description: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No projects yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first test project</p>
          </div>
        ) : (
          <div className="p-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className={`
                  p-3 rounded-lg cursor-pointer transition-colors mb-2
                  ${
                    selectedProject?.id === project.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {selectedProject?.id === project.id ? (
                    <FolderOpen className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Folder className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Updated {formatDate(project.updated_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {selectedProject && (
        <div className="border-t border-gray-200 p-3 bg-white">
          <div className="text-xs font-medium text-gray-500 mb-2">Quick Actions</div>
          <div className="grid grid-cols-3 gap-2">
            <button className="flex flex-col items-center gap-1 p-2 text-xs text-gray-600 hover:bg-gray-50 rounded">
              <Play className="w-4 h-4" />
              Run Tests
            </button>
            <button className="flex flex-col items-center gap-1 p-2 text-xs text-gray-600 hover:bg-gray-50 rounded">
              <BarChart3 className="w-4 h-4" />
              Coverage
            </button>
            <button className="flex flex-col items-center gap-1 p-2 text-xs text-gray-600 hover:bg-gray-50 rounded">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
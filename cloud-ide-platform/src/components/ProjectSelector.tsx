import React, { useState, useEffect } from 'react'
import { X, Plus, Calendar, Globe, Lock, Code } from 'lucide-react'
import { useIDEStore, type Project } from '../stores/ideStore'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

interface ProjectSelectorProps {
  onClose: () => void
  theme: 'dark' | 'light'
}

interface CreateProjectModalProps {
  onClose: () => void
  onProjectCreated: () => void
  theme: 'dark' | 'light'
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ onClose, onProjectCreated, theme }) => {
  const { createProject, createProjectDirect, loading } = useIDEStore()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: 'blank'
  })
  const [localLoading, setLocalLoading] = useState(false)

  // Unified project creation handler
  const handleCreateProject = async (useDirectDB = false) => {
    if (!formData.name.trim()) {
      toast.error('Project name is required')
      return
    }

    setLocalLoading(true)
    
    try {
      console.log(`Creating project via ${useDirectDB ? 'direct DB' : 'edge function'}:`, formData)
      
      if (useDirectDB) {
        await createProjectDirect(formData.name, formData.description, formData.template)
      } else {
        await createProject(formData.name, formData.description, formData.template)
      }
      
      console.log('Project created successfully')
      onProjectCreated()
      onClose()
    } catch (error) {
      console.error('Error creating project:', error)
      // Error is already handled by the store functions
    } finally {
      setLocalLoading(false)
    }
  }

  const templates = [
    { value: 'blank', label: 'Blank Project', description: 'Start from scratch' },
    { value: 'javascript', label: 'JavaScript Starter', description: 'Basic JavaScript project with sample code' },
    { value: 'python', label: 'Python Starter', description: 'Basic Python project with sample code' },
    { value: 'html', label: 'HTML/CSS/JS', description: 'Frontend web project template' }
  ]

  // Form submit handler removed - using direct button click instead

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          console.log('Modal overlay clicked, closing modal')
          onClose()
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create New Project
          </h2>
          <button
            onClick={() => {
              console.log('Close button clicked')
              onClose()
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome Project"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What is this project about?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Template
              </label>
              <div className="grid grid-cols-1 gap-2">
                {templates.map((template) => (
                  <label
                    key={template.value}
                    className={`flex items-center space-x-3 p-3 border rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      formData.template === template.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={template.value}
                      checked={formData.template === template.value}
                      onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {template.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {template.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col space-y-3 mt-6">
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  console.log('Cancel button clicked')
                  onClose()
                }}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || localLoading}
                onClick={(e) => {
                  e.preventDefault()
                  handleCreateProject(false) // Use edge function
                }}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(loading || localLoading) ? 'Creating...' : 'Create Project (Edge)'}
              </button>
            </div>
            <button
              type="button"
              disabled={loading || localLoading}
              onClick={(e) => {
                e.preventDefault()
                handleCreateProject(true) // Use direct DB
              }}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(loading || localLoading) ? 'Creating...' : 'Create Project (Direct DB)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onClose, theme }) => {
  const { projects, setCurrentProject, loading, loadProjects } = useIDEStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Load projects when component mounts
  React.useEffect(() => {
    loadProjects()
  }, [])

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleProjectSelect = (project: Project) => {
    setCurrentProject(project)
    onClose()
  }

  const handleProjectCreated = () => {
    // Refresh the projects list after creation
    loadProjects()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Project
            </h2>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  console.log('=== NEW PROJECT HEADER CLICKED ===')
                  setShowCreateModal(true)
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus size={16} />
                <span>New Project</span>
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Search */}
            <div className="mb-6">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search projects..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filteredProjects.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Code size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchTerm ? 'No projects found matching your search' : 'No projects yet'}
                  </p>
                  <button
                    onClick={() => {
                      console.log('=== CREATE YOUR FIRST PROJECT CLICKED ===')
                      setShowCreateModal(true)
                    }}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Your First Project
                  </button>
                </div>
              ) : (
                filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => handleProjectSelect(project)}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {project.name}
                      </h3>
                      <div className="flex items-center space-x-1 ml-2">
                        {project.is_public ? (
                          <Globe size={14} className="text-green-500" title="Public" />
                        ) : (
                          <Lock size={14} className="text-gray-400" title="Private" />
                        )}
                      </div>
                    </div>
                    
                    {project.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Calendar size={12} />
                        <span>{format(new Date(project.created_at), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                        {project.template_type}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onProjectCreated={handleProjectCreated}
          theme={theme}
        />
      )}
    </>
  )
}
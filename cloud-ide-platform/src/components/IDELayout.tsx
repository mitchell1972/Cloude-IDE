import React, { useState, useEffect } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { CodeEditor } from './CodeEditor'
import { FileExplorer } from './FileExplorer'
import { OutputPanel } from './OutputPanel'
import { ProjectSelector } from './ProjectSelector'
import { UserMenu } from './UserMenu'
import { useIDEStore } from '../stores/ideStore'
import { useAuthStore } from '../stores/authStore'
import { LayoutTemplate, Code, Terminal, FolderOpen } from 'lucide-react'

interface IDELayoutProps {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
  onNavigateToSubscription: () => void
}

export const IDELayout: React.FC<IDELayoutProps> = ({ theme, onThemeToggle, onNavigateToSubscription }) => {
  const { user } = useAuthStore()
  const { currentProject, loadProjects } = useIDEStore()
  const [showProjectSelector, setShowProjectSelector] = useState(false)

  useEffect(() => {
    if (user) {
      loadProjects()
    }
  }, [user, loadProjects])

  useEffect(() => {
    if (!currentProject) {
      setShowProjectSelector(true)
    } else {
      setShowProjectSelector(false)
    }
  }, [currentProject])

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <Code size={16} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              CloudIDE
            </span>
          </div>
          
          {currentProject && (
            <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
              <span>/</span>
              <button
                onClick={() => setShowProjectSelector(true)}
                className="hover:text-gray-900 dark:hover:text-white flex items-center space-x-1"
              >
                <FolderOpen size={14} />
                <span>{currentProject.name}</span>
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {!currentProject && (
            <button
              onClick={() => setShowProjectSelector(true)}
              className="flex items-center space-x-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              <LayoutTemplate size={14} />
              <span>Select Project</span>
            </button>
          )}
          
          <UserMenu theme={theme} onThemeToggle={onThemeToggle} onNavigateToSubscription={onNavigateToSubscription} />
        </div>
      </div>

      {/* Project Selector Modal */}
      {showProjectSelector && (
        <ProjectSelector
          onClose={() => setShowProjectSelector(false)}
          theme={theme}
        />
      )}

      {/* Main IDE Content */}
      {currentProject ? (
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">
            {/* Left Panel - File Explorer */}
            <Panel defaultSize={20} minSize={15} maxSize={35}>
              <FileExplorer theme={theme} />
            </Panel>
            
            <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600" />
            
            {/* Middle Panel - Code Editor */}
            <Panel defaultSize={60} minSize={40}>
              <CodeEditor theme={theme} onThemeToggle={onThemeToggle} />
            </Panel>
            
            <PanelResizeHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600" />
            
            {/* Right Panel - Output */}
            <Panel defaultSize={20} minSize={15} maxSize={40}>
              <OutputPanel theme={theme} />
            </Panel>
          </PanelGroup>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <Code size={32} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Welcome to CloudIDE
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
              Create a new project or select an existing one to start coding in your cloud-based development environment.
            </p>
            <button
              onClick={() => setShowProjectSelector(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mx-auto"
            >
              <LayoutTemplate size={18} />
              <span>Get Started</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
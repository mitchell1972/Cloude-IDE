import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ProjectManager } from '../components/ProjectManager';
import { FileExplorer } from '../components/FileExplorer';
import { CodeEditor } from '../components/CodeEditor';
import { TestExecutor, TestExecutorRef } from '../components/TestExecutor';
import { Settings } from '../components/Settings';
import { LogOut, User, Settings as SettingsIcon, BarChart3, Zap, CreditCard, ChevronDown, DollarSign } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface FileItem {
  id: string;
  name: string;
  content: string;
  language: string;
  file_type: 'file' | 'folder';
  parent_folder_id: string | null;
  is_folder: boolean;
  is_test_file: boolean;
  path: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

interface IDELayoutProps {
  onNavigateToSubscription: () => void;
}

export function IDELayout({ onNavigateToSubscription }: IDELayoutProps) {
  const { user, signOut } = useAuth();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [testCode, setTestCode] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isTest, setIsTest] = useState(false);
  
  // Reference to TestExecutor to trigger execution programmatically
  const testExecutorRef = useRef<TestExecutorRef | null>(null);

  function handleSelectProject(project: Project) {
    setSelectedProject(project);
    setSelectedFile(null); // Reset file selection when project changes
  }

  function handleSelectFile(file: FileItem) {
    setSelectedFile(file);
    if (file && file.content) {
      setTestCode(file.content);
    }
  }

  function handleFileChange(file: FileItem) {
    setSelectedFile(file);
    setTestCode(file.content);
  }

  function handleRunTest(code: string, language: string, isTestFile: boolean) {
    // Update the test code and test type, then immediately trigger execution
    setTestCode(code);
    setIsTest(isTestFile);
    
    // Trigger test execution in TestExecutor
    if (testExecutorRef.current) {
      setTimeout(() => {
        testExecutorRef.current?.executeTest();
      }, 100); // Small delay to ensure state update
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">SDET IDE</h1>
            </div>
            
            {selectedProject && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>/</span>
                <span className="font-medium">{selectedProject.name}</span>
                {selectedFile && (
                  <>
                    <span>/</span>
                    <span>{selectedFile.name}</span>
                  </>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>{user?.email}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              
              {showUserMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  
                  {/* Menu */}
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user?.email}</p>
                          <p className="text-sm text-gray-500">SDET Professional</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onNavigateToSubscription();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Subscription & Billing</span>
                      </button>
                      
                      <button 
                        onClick={() => {
                          setShowUserMenu(false);
                          onNavigateToSubscription();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>View Pricing Plans</span>
                      </button>
                      
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                        <BarChart3 className="w-4 h-4" />
                        <span>Analytics</span>
                      </button>
                      
                      <button 
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowSettings(true);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <SettingsIcon className="w-4 h-4" />
                        <span>Settings</span>
                      </button>
                      
                      <button 
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Project Manager */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <ProjectManager
            selectedProject={selectedProject}
            onSelectProject={handleSelectProject}
            onCreateProject={() => {/* Handle project creation */}}
          />
        </div>
        
        {/* File Explorer */}
        <div className="w-64 bg-gray-50">
          <FileExplorer
            projectId={selectedProject?.id || null}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
            onFileChange={handleFileChange}
          />
        </div>
        
        {/* Center - Code Editor */}
        <div className="flex-1 flex flex-col">
          <CodeEditor
            file={selectedFile}
            onFileChange={handleFileChange}
            onRunTest={handleRunTest}
          />
        </div>
        
        {/* Right Sidebar - Test/Code Executor */}
        <div className="w-96 bg-white">
          <TestExecutor
            ref={testExecutorRef}
            projectId={selectedProject?.id || null}
            currentFile={selectedFile}
            testCode={testCode}
            isTest={isTest}
          />
        </div>
      </div>
      
      {/* Status Bar */}
      <footer className="bg-gray-900 text-gray-300 px-6 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span>Ready</span>
          {selectedProject && (
            <span className="text-blue-400">{selectedProject.name}</span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {selectedFile && (
            <>
              <span>{selectedFile.language}</span>
              <span>UTF-8</span>
            </>
          )}
          <span>SDET IDE v1.0</span>
        </div>
      </footer>
      
      {/* Settings Modal */}
      <Settings 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  );
}
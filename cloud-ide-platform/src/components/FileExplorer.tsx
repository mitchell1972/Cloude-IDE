import React, { useState } from 'react'
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileImage,
  Plus,
  MoreVertical,
  Trash2,
  Edit,
  Download
} from 'lucide-react'
import { useIDEStore, type FileItem } from '../stores/ideStore'
import { Menu, Transition } from '@headlessui/react'
import toast from 'react-hot-toast'

interface FileExplorerProps {
  theme: 'dark' | 'light'
}

interface FileTreeItemProps {
  file: FileItem
  depth: number
  onSelect: (file: FileItem) => void
  onDelete: (fileId: string) => void
  selectedFile: FileItem | null
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ 
  file, 
  depth, 
  onSelect, 
  onDelete, 
  selectedFile 
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const isSelected = selectedFile?.id === file.id
  
  const getFileIcon = (file: FileItem) => {
    if (file.is_folder) {
      return isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />
    }
    
    const extension = file.name.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'js':
      case 'ts':
      case 'tsx':
      case 'jsx':
      case 'py':
      case 'html':
      case 'css':
      case 'json':
        return <FileCode size={16} />
      case 'md':
      case 'txt':
        return <FileText size={16} />
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <FileImage size={16} />
      default:
        return <File size={16} />
    }
  }
  
  const handleClick = () => {
    if (file.is_folder) {
      setIsExpanded(!isExpanded)
    } else {
      onSelect(file)
    }
  }
  
  return (
    <div>
      <div
        className={`flex items-center space-x-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
          isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
      >
        <span className="flex-shrink-0">{getFileIcon(file)}</span>
        <span className="flex-1 text-sm truncate">{file.name}</span>
        
        {!file.is_folder && (
          <Menu as="div" {...({ className: "relative" } as any)}>
            <Menu.Button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
              <MoreVertical size={12} />
            </Menu.Button>
            <Menu.Items className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10">
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''} flex items-center w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300`}
                    onClick={(e) => {
                      e.stopPropagation()
                      // TODO: Implement rename functionality
                      toast('Rename functionality coming soon!', { icon: 'ℹ️' })
                    }}
                  >
                    <Edit size={14} className="mr-2" />
                    Rename
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${active ? 'bg-gray-100 dark:bg-gray-700' : ''} flex items-center w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300`}
                    onClick={(e) => {
                      e.stopPropagation()
                      // TODO: Implement download functionality
                      toast('Download functionality coming soon!', { icon: 'ℹ️' })
                    }}
                  >
                    <Download size={14} className="mr-2" />
                    Download
                  </button>
                )}
              </Menu.Item>
              <Menu.Item>
                {({ active }) => (
                  <button
                    className={`${active ? 'bg-red-50 dark:bg-red-900/30 text-red-600' : 'text-gray-700 dark:text-gray-300'} flex items-center w-full px-3 py-2 text-sm text-left`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Are you sure you want to delete this file?')) {
                        onDelete(file.id)
                      }
                    }}
                  >
                    <Trash2 size={14} className="mr-2" />
                    Delete
                  </button>
                )}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        )}
      </div>
    </div>
  )
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ theme }) => {
  const { currentProject, files, setActiveFile, activeFile, deleteFile, saveFile } = useIDEStore()
  const [newFileName, setNewFileName] = useState('')
  const [showNewFileInput, setShowNewFileInput] = useState(false)
  
  // Organize files into tree structure
  const organizeFiles = (files: FileItem[]): FileItem[] => {
    const rootFiles = files.filter(file => !file.parent_folder_id)
    return rootFiles.sort((a, b) => {
      if (a.is_folder && !b.is_folder) return -1
      if (!a.is_folder && b.is_folder) return 1
      return a.name.localeCompare(b.name)
    })
  }
  
  const handleCreateFile = async () => {
    if (!currentProject || !newFileName.trim()) {
      toast.error('Please enter a valid file name')
      return
    }
    
    try {
      const fileType = getFileType(newFileName)
      const initialContent = getInitialContent(fileType)
      
      await saveFile(currentProject.id, newFileName, initialContent, fileType)
      setNewFileName('')
      setShowNewFileInput(false)
      toast.success('File created successfully!')
    } catch (error) {
      // Error handling is done in the store
    }
  }
  
  const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase()
    const typeMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml'
    }
    return typeMap[extension || ''] || 'text'
  }
  
  const getInitialContent = (fileType: string): string => {
    const templates: Record<string, string> = {
      'javascript': '// Welcome to your new JavaScript file\nconsole.log("Hello, World!");\n',
      'typescript': '// Welcome to your new TypeScript file\nconsole.log("Hello, World!");\n',
      'python': '# Welcome to your new Python file\nprint("Hello, World!")\n',
      'html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Document</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>\n',
      'css': '/* Welcome to your new CSS file */\nbody {\n    font-family: Arial, sans-serif;\n    margin: 0;\n    padding: 20px;\n}\n',
      'json': '{\n    "name": "example",\n    "version": "1.0.0"\n}\n',
      'markdown': '# Welcome to your new Markdown file\n\nStart writing your content here...\n'
    }
    return templates[fileType] || ''
  }
  
  if (!currentProject) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <Folder size={48} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No project selected</p>
        <p className="text-xs mt-1">Create or select a project to start coding</p>
      </div>
    )
  }
  
  const organizedFiles = organizeFiles(files)
  
  return (
    <div className="h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {currentProject.name}
        </h3>
        <button
          onClick={() => setShowNewFileInput(true)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="New File"
        >
          <Plus size={16} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>
      
      {/* New File Input */}
      {showNewFileInput && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.js"
              className="flex-1 px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFile()
                } else if (e.key === 'Escape') {
                  setShowNewFileInput(false)
                  setNewFileName('')
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex space-x-2 mt-2">
            <button
              onClick={handleCreateFile}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowNewFileInput(false)
                setNewFileName('')
              }}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* File Tree */}
      <div className="overflow-y-auto" style={{ height: 'calc(100% - 60px)' }}>
        {organizedFiles.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <File size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No files in this project</p>
            <p className="text-xs mt-1">Click the + button to create a new file</p>
          </div>
        ) : (
          organizedFiles.map(file => (
            <FileTreeItem
              key={file.id}
              file={file}
              depth={0}
              onSelect={setActiveFile}
              onDelete={deleteFile}
              selectedFile={activeFile}
            />
          ))
        )}
      </div>
    </div>
  )
}
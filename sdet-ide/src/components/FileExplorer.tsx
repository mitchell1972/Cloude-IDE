import React, { useState, useEffect } from 'react';
import { manageProject } from '../lib/supabase';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  FilePlus, 
  FolderPlus, 
  MoreHorizontal,
  Trash2,
  Edit3
} from 'lucide-react';

interface FileItem {
  id: string;
  name: string;
  file_type: 'file' | 'folder';
  content?: string;
  language?: string;
  parent_folder_id: string | null;
  is_folder: boolean;
  is_test_file: boolean;
  path: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
}

interface FileExplorerProps {
  projectId: string | null;
  selectedFile: FileItem | null;
  onSelectFile: (file: FileItem) => void;
  onFileChange: (file: FileItem) => void;
}

export function FileExplorer({ projectId, selectedFile, onSelectFile, onFileChange }: FileExplorerProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [createName, setCreateName] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null);

  useEffect(() => {
    if (projectId) {
      loadFiles();
    } else {
      setFiles([]);
      setAllFiles([]);
    }
  }, [projectId]);

  // Build tree structure whenever allFiles changes
  useEffect(() => {
    setFiles(buildFileTree(allFiles));
  }, [allFiles, expandedFolders]);

  async function loadFiles() {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const data = await manageProject('get_files', {
        projectId
      });
      
      setAllFiles(data || []);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  }

  function buildFileTree(allFiles: FileItem[], parentId: string | null = null): FileItem[] {
    const items = allFiles.filter(file => file.parent_folder_id === parentId);
    const result: FileItem[] = [];
    
    // Sort folders first, then files
    items.sort((a, b) => {
      if (a.is_folder && !b.is_folder) return -1;
      if (!a.is_folder && b.is_folder) return 1;
      return a.name.localeCompare(b.name);
    });
    
    for (const item of items) {
      result.push(item);
      
      // If it's a folder and it's expanded, add its children
      if (item.is_folder && expandedFolders.has(item.id)) {
        const children = buildFileTree(allFiles, item.id);
        result.push(...children);
      }
    }
    
    return result;
  }

  function getItemDepth(item: FileItem): number {
    let depth = 0;
    let current = item;
    
    while (current.parent_folder_id) {
      depth++;
      const parent = allFiles.find(f => f.id === current.parent_folder_id);
      if (!parent) break;
      current = parent;
    }
    
    return depth;
  }

  function toggleFolder(folderId: string) {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  }

  async function handleCreateItem() {
    if (!projectId || !createName.trim()) return;

    try {
      const newItem = await manageProject('create_file', {
        projectId,
        fileData: {
          name: createName,
          fileType: createType,
          content: createType === 'file' ? '' : undefined,
          language: createType === 'file' ? getLanguageFromExtension(createName) : undefined,
          parentId: currentFolderId
        }
      });
      
      setAllFiles(prev => [...prev, newItem]);
      setCreateName('');
      setShowCreateForm(false);
      
      if (createType === 'file') {
        onSelectFile(newItem);
      }
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  }

  async function handleDeleteFile(file: FileItem) {
    try {
      await manageProject('delete_file', {
        fileId: file.id
      });
      
      // Remove the file and all its descendants from allFiles
      setAllFiles(prev => {
        const toRemove = new Set([file.id]);
        
        // If it's a folder, also remove all its children
        if (file.is_folder) {
          const findChildren = (parentId: string) => {
            prev.forEach(f => {
              if (f.parent_folder_id === parentId) {
                toRemove.add(f.id);
                if (f.is_folder) {
                  findChildren(f.id);
                }
              }
            });
          };
          findChildren(file.id);
        }
        
        return prev.filter(f => !toRemove.has(f.id));
      });
      
      if (selectedFile?.id === file.id) {
        onSelectFile(null as any);
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }

  function getLanguageFromExtension(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py': return 'python';
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'java': return 'java';
      case 'json': return 'json';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'md': return 'markdown';
      case 'yaml': case 'yml': return 'yaml';
      default: return 'text';
    }
  }

  function getFileIcon(file: FileItem) {
    if (file.is_folder) {
      return expandedFolders.has(file.id) ? (
        <FolderOpen className="w-4 h-4 text-blue-500" />
      ) : (
        <Folder className="w-4 h-4 text-blue-500" />
      );
    }
    return <FileText className="w-4 h-4 text-gray-500" />;
  }

  function handleItemClick(file: FileItem) {
    if (file.is_folder) {
      toggleFolder(file.id);
    } else {
      onSelectFile(file);
    }
  }

  function handleContextMenu(e: React.MouseEvent, file: FileItem) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }

  useEffect(() => {
    function handleClickOutside() {
      setContextMenu(null);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  if (!projectId) {
    return (
      <div className="h-full bg-gray-50 border-r border-gray-200 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Select a project to view files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Files</h3>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setCreateType('file');
              setShowCreateForm(true);
            }}
            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
            title="New File"
          >
            <FilePlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setCreateType('folder');
              setShowCreateForm(true);
            }}
            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
            title="New Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="p-3 border-b border-gray-200 bg-white">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              {currentFolderId ? (
                <>
                  <Folder className="w-3 h-3" />
                  <span>Creating in: {allFiles.find(f => f.id === currentFolderId)?.name || 'folder'}</span>
                </>
              ) : (
                <>
                  <Folder className="w-3 h-3" />
                  <span>Creating in: root</span>
                </>
              )}
            </div>
            <input
              type="text"
              placeholder={`${createType === 'file' ? 'File' : 'Folder'} name`}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateItem();
                } else if (e.key === 'Escape') {
                  setShowCreateForm(false);
                  setCreateName('');
                  setCurrentFolderId(null);
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateItem}
                disabled={!createName.trim()}
                className="flex-1 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateName('');
                  setCurrentFolderId(null);
                }}
                className="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-center text-gray-500">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-3 text-center text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No files yet</p>
            <p className="text-xs text-gray-400 mt-1">Create your first file</p>
          </div>
        ) : (
          <div className="p-2">
            {files.map((file) => {
              const depth = getItemDepth(file);
              const isSelected = selectedFile?.id === file.id && !file.is_folder;
              
              return (
                <div
                  key={file.id}
                  onClick={() => handleItemClick(file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                  className={`
                    flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors text-sm group
                    ${isSelected
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-100'
                    }
                  `}
                  style={{ paddingLeft: `${8 + depth * 16}px` }}
                >
                  {getFileIcon(file)}
                  <span className="flex-1 truncate">{file.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleContextMenu(e, file);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded"
                  >
                    <MoreHorizontal className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.file.is_folder && (
            <>
              <button
                onClick={() => {
                  setCurrentFolderId(contextMenu.file.id);
                  setCreateType('file');
                  setShowCreateForm(true);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <FilePlus className="w-4 h-4" />
                New File in Folder
              </button>
              <button
                onClick={() => {
                  setCurrentFolderId(contextMenu.file.id);
                  setCreateType('folder');
                  setShowCreateForm(true);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                New Folder in Folder
              </button>
              <hr className="my-1" />
            </>
          )}
          <button
            onClick={() => {
              // Handle rename
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Rename
          </button>
          <button
            onClick={() => {
              handleDeleteFile(contextMenu.file);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-red-600 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
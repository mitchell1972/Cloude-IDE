import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export interface Project {
  id: string
  name: string
  description: string
  user_id: string
  is_public: boolean
  template_type: string
  share_token: string
  created_at: string
  updated_at: string
}

export interface FileItem {
  id: string
  project_id: string
  name: string
  path: string
  content: string
  file_type: string
  size_bytes: number
  user_id: string
  is_folder: boolean
  parent_folder_id: string | null
  created_at: string
  updated_at: string
}

interface IDEState {
  projects: Project[]
  currentProject: Project | null
  files: FileItem[]
  activeFile: FileItem | null
  loading: boolean
  
  // Actions
  loadProjects: () => Promise<void>
  createProject: (name: string, description?: string, template?: string) => Promise<void>
  createProjectDirect: (name: string, description?: string, template?: string) => Promise<void>
  setCurrentProject: (project: Project) => void
  loadProjectFiles: (projectId: string) => Promise<void>
  saveFile: (projectId: string, filePath: string, content: string, fileType?: string) => Promise<void>
  setActiveFile: (file: FileItem | null) => void
  deleteFile: (fileId: string) => Promise<void>
}

export const useIDEStore = create<IDEState>((set, get) => ({
  projects: [],
  currentProject: null,
  files: [],
  activeFile: null,
  loading: false,

  loadProjects: async () => {
    set({ loading: true })
    try {
      console.log('=== LOADING PROJECTS ===')
      
      // Check authentication first
      const { data: { user } } = await supabase.auth.getUser()
      console.log('Current user:', user?.id)
      
      if (!user) {
        console.log('No authenticated user found')
        set({ projects: [] })
        return
      }
      
      const { data, error } = await supabase.functions.invoke('file-manager', {
        body: { action: 'get-projects' }
      })
      
      console.log('Load projects response:', { data, error })
      
      if (error) {
        console.error('Error loading projects:', error)
        throw error
      }
      
      if (data?.data) {
        console.log('Projects loaded:', data.data)
        set({ projects: data.data })
      } else {
        console.log('No projects data returned')
        set({ projects: [] })
      }
    } catch (error: any) {
      console.error('Load projects error:', error)
      toast.error(error.message || 'Failed to load projects')
    } finally {
      set({ loading: false })
    }
  },

  createProject: async (name: string, description = '', template = 'blank') => {
    set({ loading: true })
    try {
      console.log('Creating project with data:', { name, description, template })
      
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('You must be logged in to create a project')
      }
      console.log('User authenticated:', user.id)
      
      // Get current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No valid session found. Please log in again.')
      }
      console.log('Session valid:', !!session.access_token)
      
      const { data, error } = await supabase.functions.invoke('file-manager', {
        body: {
          action: 'create-project',
          name,
          description,
          template,
          isPublic: false
        }
      })
      
      console.log('Supabase response:', { data, error })
      console.log('Full response object:', JSON.stringify({ data, error }, null, 2))
      
      if (error) {
        console.error('Supabase error details:', error)
        throw new Error(error.message || 'Failed to create project')
      }
      
      if (data?.data) {
        console.log('Project created successfully:', data.data)
        set(state => ({ projects: [data.data, ...state.projects] }))
        toast.success('Project created successfully!')
      } else if (data?.error) {
        console.error('Server returned error:', data.error)
        throw new Error(data.error.message || 'Server error occurred')
      } else {
        console.log('Unexpected response format:', data)
        throw new Error('Unexpected response from server')
      }
    } catch (error: any) {
      console.error('Create project error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error(error.message || 'Failed to create project')
      throw error
    } finally {
      set({ loading: false })
    }
  },

  setCurrentProject: (project: Project) => {
    set({ currentProject: project })
    get().loadProjectFiles(project.id)
  },

  loadProjectFiles: async (projectId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('file-manager', {
        body: {
          action: 'get-files',
          project_id: projectId
        }
      })
      
      if (error) throw error
      
      if (data?.data) {
        set({ files: data.data })
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load project files')
    }
  },

  saveFile: async (projectId: string, filePath: string, content: string, fileType = 'text') => {
    try {
      const { data, error } = await supabase.functions.invoke('file-manager', {
        body: {
          action: 'save-file',
          projectId,
          filePath,
          content,
          fileType
        }
      })
      
      if (error) throw error
      
      if (data?.data) {
        // Update files state
        const existingFileIndex = get().files.findIndex(f => f.path === filePath && f.project_id === projectId)
        if (existingFileIndex >= 0) {
          set(state => ({
            files: state.files.map((f, i) => i === existingFileIndex ? data.data : f)
          }))
        } else {
          set(state => ({ files: [...state.files, data.data] }))
        }
        
        // Update active file if it's the same
        if (get().activeFile?.path === filePath) {
          set({ activeFile: data.data })
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save file')
      throw error
    }
  },

  setActiveFile: (file: FileItem | null) => {
    set({ activeFile: file })
  },

  deleteFile: async (fileId: string) => {
    try {
      const { error } = await supabase.functions.invoke('file-manager', {
        body: {
          action: 'delete-file',
          fileId
        }
      })
      
      if (error) throw error
      
      // Remove from state
      set(state => ({
        files: state.files.filter(f => f.id !== fileId),
        activeFile: state.activeFile?.id === fileId ? null : state.activeFile
      }))
      
      toast.success('File deleted successfully')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete file')
    }
  },

  createProjectDirect: async (name: string, description = '', template = 'blank') => {
    set({ loading: true })
    try {
      alert('Creating project directly - step 1')
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('No user found!')
        throw new Error('You must be logged in to create a project')
      }
      
      alert('User found: ' + user.id)
      
      // Insert directly into database
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name,
          description,
          user_id: user.id,
          is_public: false,
          template_type: template,
          share_token: globalThis.crypto.randomUUID()
        })
        .select()
        .single()
      
      alert('Database response received')
      
      if (error) {
        alert('Database error: ' + error.message)
        throw new Error(error.message)
      }
      
      if (data) {
        alert('Project created successfully: ' + data.name)
        set(state => ({ projects: [data, ...state.projects] }))
        toast.success('Project created successfully (direct)!')
      } else {
        alert('No data returned from database')
      }
    } catch (error: any) {
      alert('Caught error: ' + error.message)
      toast.error(error.message || 'Failed to create project directly')
      throw error
    } finally {
      set({ loading: false })
    }
  }
}))
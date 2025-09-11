import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export interface ExecutionResult {
  output: string
  error: string | null
  executionTime: number
  status: string
  language: string
  remainingUsage: number
  usageLimit: number
}

interface ExecutionState {
  isExecuting: boolean
  results: ExecutionResult[]
  executeCode: (code: string, language: string) => Promise<ExecutionResult | null>
  clearResults: () => void
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  isExecuting: false,
  results: [],

  executeCode: async (code: string, language: string) => {
    set({ isExecuting: true })
    try {
      const { data, error } = await supabase.functions.invoke('execute-code', {
        body: {
          code,
          language,
          timeoutMs: 30000
        }
      })
      
      if (error) {
        toast.error(error.message || 'Code execution failed')
        return null
      }
      
      const result = data?.data
      if (result) {
        set(state => ({ results: [result, ...state.results.slice(0, 9)] })) // Keep last 10 results
        
        if (result.error) {
          toast.error('Code execution error: ' + result.error)
        } else {
          toast.success('Code executed successfully!')
        }
        
        return result
      }
      
      return null
    } catch (error: any) {
      toast.error(error.message || 'Code execution failed')
      return null
    } finally {
      set({ isExecuting: false })
    }
  },

  clearResults: () => {
    set({ results: [] })
  }
}))
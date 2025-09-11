import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://zjfilhbczaquokqlcoej.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqZmlsaGJjemFxdW9rcWxjb2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MzQ2MjIsImV4cCI6MjA3MTExMDYyMn0.b6YATor8UyDwYSiSagOQUxM_4sqfCv-89CBXVgC2hP0"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Enhanced error handler for Supabase operations
export const handleSupabaseError = (error: any) => {
  console.error('Supabase error:', error)
  if (error?.message) {
    return error.message
  }
  return 'An unexpected error occurred'
}
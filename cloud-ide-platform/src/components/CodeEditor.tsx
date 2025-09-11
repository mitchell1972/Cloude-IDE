import React, { useState, useRef, useCallback, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Play, Square, Settings, Moon, Sun, Save } from 'lucide-react'
import { useIDEStore, type FileItem } from '../stores/ideStore'
import { useExecutionStore } from '../stores/executionStore'
import toast from 'react-hot-toast'
import * as monaco from 'monaco-editor'
import { ideThemes } from '../lib/themes'

interface CodeEditorProps {
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ theme, onThemeToggle }) => {
  const { activeFile, saveFile, currentProject } = useIDEStore()
  const { executeCode, isExecuting, results } = useExecutionStore()
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [isModified, setIsModified] = useState(false)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  // Update code when active file changes
  useEffect(() => {
    if (activeFile) {
      setCode(activeFile.content || '')
      setLanguage(getLanguageFromFileType(activeFile.file_type))
      setIsModified(false)
    } else {
      setCode('')
      setLanguage('javascript')
      setIsModified(false)
    }
  }, [activeFile])

  const getLanguageFromFileType = (fileType: string): string => {
    const languageMap: Record<string, string> = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'python': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'markdown': 'markdown',
      'yaml': 'yaml',
      'xml': 'xml'
    }
    return languageMap[fileType] || 'javascript'
  }

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor
    
    // Define custom themes
    monaco.editor.defineTheme('ide-dark', ideThemes['vs-dark'])
    monaco.editor.defineTheme('ide-light', ideThemes['vs-light'])
    
    // Set initial theme
    monaco.editor.setTheme(theme === 'dark' ? 'ide-dark' : 'ide-light')
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave()
    })
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleExecute()
    })
    
    // Focus editor
    editor.focus()
  }

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || ''
    setCode(newCode)
    setIsModified(activeFile ? newCode !== activeFile.content : newCode !== '')
  }

  const handleSave = async () => {
    if (!currentProject || !activeFile) {
      toast.error('No file selected to save')
      return
    }
    
    try {
      await saveFile(currentProject.id, activeFile.path, code, activeFile.file_type)
      setIsModified(false)
      toast.success('File saved successfully!')
    } catch (error) {
      // Error handling is done in the store
    }
  }

  const handleExecute = async () => {
    if (!code.trim()) {
      toast.error('No code to execute')
      return
    }
    
    await executeCode(code, language)
  }

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage)
    if (editorRef.current) {
      monaco.editor.setModelLanguage(editorRef.current.getModel()!, newLanguage)
    }
  }

  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(theme === 'dark' ? 'ide-dark' : 'ide-light')
    }
  }, [theme])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="px-3 py-1 text-sm border rounded-md bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
            </select>
            
            {activeFile && (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {activeFile.name}
                {isModified && <span className="text-orange-500 ml-1">●</span>}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSave}
            disabled={!isModified || !activeFile}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save (Ctrl+S)"
          >
            <Save size={16} />
          </button>
          
          <button
            onClick={handleExecute}
            disabled={isExecuting || !code.trim()}
            className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Run Code (Ctrl+Enter)"
          >
            {isExecuting ? <Square size={14} /> : <Play size={14} />}
            <span className="ml-1 text-sm">{isExecuting ? 'Running...' : 'Run'}</span>
          </button>
          
          <button
            onClick={onThemeToggle}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          <button
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
      
      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          theme={theme === 'dark' ? 'ide-dark' : 'ide-light'}
          options={{
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            minimap: { enabled: false },
            wordWrap: 'on',
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            folding: true,
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 4,
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalHasArrows: false,
              horizontalHasArrows: false
            },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            acceptSuggestionOnCommitCharacter: true,
            quickSuggestions: true,
            parameterHints: {
              enabled: true
            }
          }}
        />
      </div>
    </div>
  )
}
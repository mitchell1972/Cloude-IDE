import React, { useEffect, useRef } from 'react'
import { Terminal as TerminalIcon, X, Trash2, Copy, Download } from 'lucide-react'
import { useExecutionStore, type ExecutionResult } from '../stores/executionStore'
import { format } from 'date-fns'

interface OutputPanelProps {
  theme: 'dark' | 'light'
}

interface ResultItemProps {
  result: ExecutionResult
  theme: 'dark' | 'light'
}

const ResultItem: React.FC<ResultItemProps> = ({ result, theme }) => {
  const formatTime = (time: number) => {
    if (time < 1000) return `${time}ms`
    return `${(time / 1000).toFixed(2)}s`
  }
  
  const copyOutput = () => {
    navigator.clipboard.writeText(result.output || result.error || '')
  }
  
  const downloadOutput = () => {
    const content = result.output || result.error || ''
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `output-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className={`w-2 h-2 rounded-full ${
            result.status === 'success' ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {result.language.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTime(result.executionTime)}
          </span>
          {result.usageLimit && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Usage: {Math.max(0, result.usageLimit - result.remainingUsage)}/{result.usageLimit} minutes
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={copyOutput}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Copy Output"
          >
            <Copy size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={downloadOutput}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Download Output"
          >
            <Download size={14} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>
      
      {/* Output */}
      <div className="p-3">
        {result.error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <div className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
              Error:
            </div>
            <pre className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap font-mono">
              {result.error}
            </pre>
          </div>
        ) : result.output ? (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
            <div className="p-3">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                {result.output}
              </pre>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500 dark:text-gray-400 italic">
            No output
          </div>
        )}
      </div>
    </div>
  )
}

export const OutputPanel: React.FC<OutputPanelProps> = ({ theme }) => {
  const { results, isExecuting, clearResults } = useExecutionStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to latest result
  useEffect(() => {
    if (scrollRef.current && results.length > 0) {
      scrollRef.current.scrollTop = 0
    }
  }, [results])
  
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center space-x-2">
          <TerminalIcon size={16} className="text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Output
          </span>
          {isExecuting && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs text-blue-600 dark:text-blue-400">
                Executing...
              </span>
            </div>
          )}
        </div>
        
        {results.length > 0 && (
          <button
            onClick={clearResults}
            className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Clear All Results"
          >
            <Trash2 size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>
      
      {/* Results */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {results.length === 0 && !isExecuting ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <TerminalIcon size={48} className="mb-3 opacity-50" />
            <p className="text-sm font-medium">No execution results yet</p>
            <p className="text-xs mt-1 text-center px-4">
              Write some code and press "Run" or use Ctrl+Enter to execute
            </p>
          </div>
        ) : (
          <div>
            {results.map((result, index) => (
              <ResultItem key={index} result={result} theme={theme} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
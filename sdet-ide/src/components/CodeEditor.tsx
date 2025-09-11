import React from 'react';
import { Editor } from '@monaco-editor/react';
import { Play, Save, Bug, FileCheck } from 'lucide-react';
import { manageProject } from '../lib/supabase';

interface FileItem {
  id: string;
  name: string;
  content: string;
  language: string;
}

interface CodeEditorProps {
  file: FileItem | null;
  onFileChange: (file: FileItem) => void;
  onRunTest: (code: string, language: string, isTest: boolean) => void;
}

export function CodeEditor({ file, onFileChange, onRunTest }: CodeEditorProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [currentCode, setCurrentCode] = React.useState('');

  React.useEffect(() => {
    if (file) {
      setCurrentCode(file.content || '');
      setHasUnsavedChanges(false);
    }
  }, [file?.id, file?.content]);

  async function handleSave() {
    if (!file || isSaving) return;

    setIsSaving(true);
    try {
      await manageProject('update_file', {
        fileId: file.id,
        fileData: {
          content: currentCode,
          name: file.name,
          language: file.language
        }
      });
      
      onFileChange({ ...file, content: currentCode });
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Failed to save file:', error);
    } finally {
      setIsSaving(false);
    }
  }

  function handleRunTest() {
    if (!file) return;
    const isTest = isTestFile(currentCode, file.language);
    onRunTest(currentCode, file.language, isTest);
  }

  function isTestFile(code: string, language: string): boolean {
    switch (language) {
      case 'java':
        // Check for JUnit test patterns vs main method
        const hasTestAnnotations = /@Test/.test(code);
        const hasMainMethod = /public\s+static\s+void\s+main\s*\(/.test(code);
        const hasJUnitImports = /import\s+.*junit/i.test(code);
        const hasTestMethods = /\btest\w*\s*\(/i.test(code);
        
        // If it has JUnit annotations or imports, it's likely a test
        // But if it also has a main method, treat it as a regular program
        if (hasMainMethod) {
          return false; // Programs with main method are not tests
        }
        return hasTestAnnotations || hasJUnitImports || hasTestMethods;
        
      case 'python':
        // Check for test functions vs regular code
        const hasTestFunctions = /def\s+test_\w+/.test(code);
        const hasPrintStatements = /print\s*\(/.test(code);
        return hasTestFunctions && !hasPrintStatements;
        
      case 'javascript':
      case 'typescript':
        // Check for Jest/Mocha patterns vs console.log
        const hasTestCalls = /\b(test|it)\s*\(/.test(code);
        const hasConsoleLog = /console\.log\s*\(/.test(code);
        return hasTestCalls && !hasConsoleLog;
        
      default:
        return false;
    }
  }

  function getExecutionButtonText(code: string, language: string): string {
    if (isTestFile(code, language)) {
      return 'Run Tests';
    } else {
      switch (language) {
        case 'java': return 'Run Program';
        case 'python': return 'Run Script';
        case 'javascript':
        case 'typescript': return 'Execute Code';
        default: return 'Run Code';
      }
    }
  }

  function handleCodeChange(value: string | undefined) {
    const newValue = value || '';
    setCurrentCode(newValue);
    setHasUnsavedChanges(newValue !== (file?.content || ''));
  }

  function getLanguageIcon(language: string) {
    switch (language) {
      case 'python': return '🐍';
      case 'javascript': case 'typescript': return '📜';
      case 'java': return '☕';
      default: return '📝';
    }
  }

  if (!file) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center text-gray-500">
          <FileCheck className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No file selected</h3>
          <p className="text-sm">Select a file from the explorer to start editing</p>
          <div className="mt-6 text-xs text-gray-400">
            <p>Keyboard shortcuts:</p>
            <p>Ctrl/Cmd + S: Save</p>
            <p>Ctrl/Cmd + Enter: Run test</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-lg">{getLanguageIcon(file.language)}</span>
          <div>
            <h3 className="text-sm font-medium text-gray-900">
              {file.name}
              {hasUnsavedChanges && <span className="text-orange-500 ml-1">•</span>}
            </h3>
            <p className="text-xs text-gray-500">
              {file.language} file
              {lastSaved && (
                <span className="ml-2">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          
          <button
            onClick={handleRunTest}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            title={isTestFile(currentCode, file.language) ? 'Execute unit tests' : 'Run the program'}
          >
            <Play className="w-4 h-4" />
            {getExecutionButtonText(currentCode, file.language)}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          value={currentCode}
          language={file.language || 'text'}
          onChange={handleCodeChange}
          theme="vs-light"
          options={{
            fontSize: 14,
            lineNumbers: 'on',
            automaticLayout: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            insertSpaces: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true
            }
          }}
          onMount={(editor) => {
            // Add keyboard shortcuts
            editor.addCommand(
              editor.getModel()?.isDisposed() ? 0 : 
              (window as any).monaco?.KeyMod.CtrlCmd | (window as any).monaco?.KeyCode.KeyS,
              () => {
                handleSave();
              }
            );

            editor.addCommand(
              (window as any).monaco?.KeyMod.CtrlCmd | (window as any).monaco?.KeyCode.Enter,
              () => {
                handleRunTest();
              }
            );
          }}
        />
      </div>
    </div>
  );
}
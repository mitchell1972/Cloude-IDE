interface ThemeColors {
  background: string
  foreground: string
  muted: string
  mutedForeground: string
  card: string
  cardForeground: string
  border: string
  input: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  ring: string
}

export const lightTheme: ThemeColors = {
  background: '#ffffff',
  foreground: '#0f0f23',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  card: '#ffffff',
  cardForeground: '#0f0f23',
  border: '#e2e8f0',
  input: '#f1f5f9',
  primary: '#0f0f23',
  primaryForeground: '#ffffff',
  secondary: '#f1f5f9',
  secondaryForeground: '#0f0f23',
  accent: '#f1f5f9',
  accentForeground: '#0f0f23',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  ring: '#0f0f23'
}

export const darkTheme: ThemeColors = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  muted: '#262626',
  mutedForeground: '#a1a1aa',
  card: '#0a0a0a',
  cardForeground: '#fafafa',
  border: '#262626',
  input: '#262626',
  primary: '#fafafa',
  primaryForeground: '#0a0a0a',
  secondary: '#262626',
  secondaryForeground: '#fafafa',
  accent: '#262626',
  accentForeground: '#fafafa',
  destructive: '#ef4444',
  destructiveForeground: '#fafafa',
  ring: '#d4d4d8'
}

export const ideThemes = {
  'vs-dark': {
    base: 'vs-dark' as const,
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'regexp', foreground: 'D16969' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'class', foreground: '4EC9B0' },
      { token: 'function', foreground: 'DCDCAA' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'constant', foreground: '4FC1FF' }
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorCursor.foreground': '#aeafad',
      'editor.lineHighlightBackground': '#2d2d30',
      'editorLineNumber.foreground': '#858585',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41'
    }
  },
  'vs-light': {
    base: 'vs' as const,
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000FF' },
      { token: 'string', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'regexp', foreground: 'AF0092' },
      { token: 'type', foreground: '008080' },
      { token: 'class', foreground: '008080' },
      { token: 'function', foreground: '795E26' },
      { token: 'variable', foreground: '001080' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#000000',
      'editorCursor.foreground': '#000000',
      'editor.lineHighlightBackground': '#f0f0f0',
      'editorLineNumber.foreground': '#237893',
      'editor.selectionBackground': '#add6ff',
      'editor.inactiveSelectionBackground': '#e5ebf1'
    }
  }
}
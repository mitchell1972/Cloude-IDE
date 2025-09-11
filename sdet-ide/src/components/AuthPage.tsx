import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface AuthPageProps {
  mode: 'signin' | 'signup' | 'reset';
  onModeChange: (mode: 'signin' | 'signup' | 'reset') => void;
}

// Password validation function
function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must include lowercase letters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include uppercase letters');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must include at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must include at least one special character');
  }
  
  return { isValid: errors.length === 0, errors };
}

export function AuthPage({ mode, onModeChange }: AuthPageProps) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  // Handle password change with validation
  function handlePasswordChange(newPassword: string) {
    setPassword(newPassword);
    if (mode === 'signup' && newPassword) {
      const validation = validatePassword(newPassword);
      setPasswordErrors(validation.errors);
    } else {
      setPasswordErrors([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    
    // Validate password for signup
    if (mode === 'signup') {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        setError('Please fix the password requirements before continuing.');
        setPasswordErrors(passwordValidation.errors);
        return;
      }
    }
    
    setLoading(true);

    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setMessage('Password reset email sent! Check your email for instructions.');
      } else if (mode === 'signup') {
        await signUp(email, password);
        setMessage('✅ Account created! Please check your email for a verification link. You must verify your email before you can log in.');
      } else {
        await signIn(email, password);
      }
    } catch (error: any) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. If you just registered, please check your email and click the verification link before trying to log in.');
      } else {
        setError(error.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">SDET IDE</h1>
          </div>
          <p className="text-gray-600">
            Professional Testing Environment for Software Development Engineers in Test
          </p>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {mode === 'reset' ? 'Reset Password' : mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-gray-600">
              {mode === 'reset'
                ? 'Enter your email to receive reset instructions'
                : mode === 'signin'
                ? 'Sign in to access your testing projects'
                : 'Get started with your professional testing environment'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your email"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            {mode !== 'reset' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    required
                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                    disabled={loading}
                    minLength={12}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {mode === 'signup' && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-700">Password requirements:</p>
                    <ul className="text-xs space-y-1">
                      <li className={password.length >= 12 ? 'text-green-600' : 'text-red-500'}>
                        • At least 12 characters long {password.length >= 12 ? '✓' : '✗'}
                      </li>
                      <li className={/[a-z]/.test(password) ? 'text-green-600' : 'text-red-500'}>
                        • Include lowercase letters {/[a-z]/.test(password) ? '✓' : '✗'}
                      </li>
                      <li className={/[A-Z]/.test(password) ? 'text-green-600' : 'text-red-500'}>
                        • Include uppercase letters {/[A-Z]/.test(password) ? '✓' : '✗'}
                      </li>
                      <li className={/\d/.test(password) ? 'text-green-600' : 'text-red-500'}>
                        • Include at least one number {/\d/.test(password) ? '✓' : '✗'}
                      </li>
                      <li className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-green-600' : 'text-red-500'}>
                        • Include special character (!@#$%^&*) {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '✓' : '✗'}
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700">{message}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email || (mode !== 'reset' && !password) || (mode === 'signup' && passwordErrors.length > 0)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {mode === 'reset' ? 'Sending email...' : mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                </div>
              ) : (
                mode === 'reset' ? 'Send Reset Email' : mode === 'signin' ? 'Sign in' : 'Create account'
              )}
            </button>
          </form>

          {/* Switch Mode */}
          <div className="mt-6 text-center space-y-2">
            {mode !== 'reset' && (
              <p className="text-sm text-gray-600">
                {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
                {' '}
                <button
                  onClick={() => onModeChange(mode === 'signin' ? 'signup' : 'signin')}
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  disabled={loading}
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            )}
            
            {mode === 'signin' && (
              <p className="text-sm text-gray-600">
                <button
                  onClick={() => onModeChange('reset')}
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  disabled={loading}
                >
                  Forgot your password?
                </button>
              </p>
            )}
            
            {mode === 'reset' && (
              <p className="text-sm text-gray-600">
                <button
                  onClick={() => onModeChange('signin')}
                  className="font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  disabled={loading}
                >
                  Back to sign in
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 gap-4 text-center">
          <div className="bg-white/50 backdrop-blur-sm rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">Professional Testing Features</h3>
            <p className="text-sm text-gray-600">
              Integrated test runners, code coverage analysis, and collaborative testing environment
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
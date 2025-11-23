import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Server } from 'lucide-react'

function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await login(username, password)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.error)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 relative overflow-hidden">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-blue-500/30 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-purple-500/30 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse animation-delay-300"></div>
        <div className="absolute w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl top-1/2 left-1/2 animate-bounce"></div>
      </div>

      <div className="max-w-md w-full mx-4 relative z-10">
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 animate-slideInUp">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl mb-4 shadow-lg animate-bounce">
              <Server className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold gradient-text animate-fadeIn">Digiskills Network Monitor</h1>
            <p className="text-gray-600 mt-2 animate-fadeIn animation-delay-100">Sign in to access your dashboard</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-300 rounded-xl animate-slideInDown shadow-lg">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Enter your username"
                required
                autoFocus
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="w-full btn btn-primary py-4 text-lg font-bold shadow-2xl hover:shadow-blue-500/50"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Default Credentials Info */}
          <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-inner animate-fadeIn animation-delay-200">
            <p className="text-sm text-blue-900 font-bold mb-2 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></span>
              Default Credentials:
            </p>
            <p className="text-sm text-blue-800 font-medium">Admin: <span className="font-mono bg-white/60 px-2 py-1 rounded">admin / Digiskills2025!</span></p>
            <p className="text-sm text-blue-800 font-medium mt-1">Operator: <span className="font-mono bg-white/60 px-2 py-1 rounded">operator / Operator2025!</span></p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white text-sm mt-6 font-medium animate-fadeIn animation-delay-300 drop-shadow-lg">
          Digiskills IT Department © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

export default Login

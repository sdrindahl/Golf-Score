'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'

export default function Login() {
  const router = useRouter()
  const auth = useAuth()
  
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [newUserInfo, setNewUserInfo] = useState<{ name: string; password: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      auth.loginUser(name, password)
      router.push('/')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter your name')
      return
    }

    if (!password || password.length !== 4) {
      setError('Password must be exactly 4 digits')
      return
    }

    if (!/^\d{4}$/.test(password)) {
      setError('Password must contain only numbers (0-9)')
      return
    }

    try {
      // Register with user-provided password
      auth.registerUser(name, password)
      setNewUserInfo({ name, password })
      setName('')
      setPassword('')
      
      // Auto-login the new user
      auth.loginUser(name, password)
      
      setTimeout(() => {
        router.push('/')
      }, 2000)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (newUserInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <div className="card max-w-md w-full">
          <h2 className="text-3xl font-bold mb-4 text-center text-green-700">🎉 Welcome!</h2>
          <p className="text-gray-600 mb-4 text-center">Your account has been created successfully.</p>
          
          <div className="bg-blue-50 p-4 rounded-lg mb-6 text-center border-2 border-blue-300">
            <p className="text-sm text-gray-600 mb-2">Player: <span className="font-bold text-lg text-blue-700">{newUserInfo.name}</span></p>
            <p className="text-sm text-gray-600 mb-1">Your Password:</p>
            <p className="text-3xl font-mono font-bold text-green-600">{newUserInfo.password}</p>
            <p className="text-xs text-gray-500 mt-3">📌 Please save this password - you'll need it to log in</p>
          </div>

          <p className="text-center text-gray-600 mb-4">Redirecting to home page...</p>
          <Link href="/">
            <button className="btn-primary w-full">Go to Home</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="card max-w-md w-full">
        <h1 className="text-3xl font-bold mb-8 text-center text-green-700">⛳ Golf Score Tracker</h1>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => {
              setIsLogin(true)
              setError('')
              setName('')
              setPassword('')
            }}
            className={`flex-1 py-2 px-4 rounded font-semibold transition ${
              isLogin
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setIsLogin(false)
              setError('')
              setName('')
              setPassword('')
            }}
            className={`flex-1 py-2 px-4 rounded font-semibold transition ${
              !isLogin
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
          <div>
            <label className="label">Player Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isLogin ? 'Enter your name' : 'Your name'}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">4-Digit Password (0-9)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 4)
                  setPassword(value)
                }}
                placeholder="0000"
                maxLength={4}
                className="input-field text-center text-2xl tracking-widest font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-gray-600 text-sm"
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {!isLogin && password && (
              <p className="text-xs text-gray-500 mt-1">
                {password.length}/4 digits
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded">
              {error}
            </div>
          )}

          <button type="submit" className="btn-primary w-full mt-6">
            {isLogin ? '🔓 Login' : '✨ Create Account'}
          </button>
        </form>

        {isLogin && (
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-gray-600 text-center mb-4">
              Don't have an account?{' '}
              <button
                onClick={() => {
                  setIsLogin(false)
                  setError('')
                }}
                className="text-green-600 font-semibold hover:underline"
              >
                Sign up here
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

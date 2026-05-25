'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import InstallPrompt from '@/components/InstallPrompt'

export default function Login() {
  const router = useRouter()
  const auth = useAuth()
  
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [newUserInfo, setNewUserInfo] = useState<{ name: string; password: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await auth.loginUser(name, password)
      router.push('/')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
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
      await auth.registerUser(name, password)
      setNewUserInfo({ name, password })
      setName('')
      setPassword('')
      
      // Auto-login the new user
      await auth.loginUser(name, password)
      
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
    <div className="min-h-screen flex flex-col items-center justify-start bg-[#101010] pt-8">
      <img src="/JustTapIt_Logo.png" alt="Just Tap It Logo" className="h-40 w-40 mb-4 mt-2" />
      <div
        className="card max-w-md w-full relative overflow-hidden"
        style={{
          background: "#111 url(/JustTapIt_Logo.png) center center / cover no-repeat",
          border: "2px solid #39FF14",
          boxShadow: "0 0 24px #39FF14, 0 2px 24px #000a",
        }}
      >
        {/* Overlay for contrast */}
        <div className="absolute inset-0 bg-black/70 z-0" />

        {/* Removed Login/Sign Up toggle buttons for cleaner UI */}

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="relative z-10 space-y-4">
          <div>
            <label className="label">Player Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter Name / Username"
              className="input-field rounded-xl bg-black/70 border-2 border-[#39FF14] text-black placeholder:text-black focus:ring-2 focus:ring-[#39FF14] focus:border-[#39FF14] shadow-lg"
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
                placeholder="Enter 4 Digit Password"
                maxLength={4}
                autoComplete="current-password"
                className="input-field text-center text-2xl tracking-widest font-mono rounded-xl bg-black/70 border-2 border-[#39FF14] text-black placeholder:text-black focus:ring-2 focus:ring-[#39FF14] focus:border-[#39FF14] shadow-lg"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[#39FF14] text-lg hover:scale-110 transition"
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

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 text-lg rounded-xl bg-[#39FF14] text-black font-bold py-2 mt-2 shadow-lg hover:bg-[#53ff1a] focus:ring-2 focus:ring-[#39FF14] focus:outline-none transition"
            disabled={(!isLogin && (name.length === 0 || password.length !== 4)) || (isLogin && (name.length === 0 || password.length !== 4))}
          >
            {isLogin ? '🔒 Login' : 'Sign Up'}
          </button>
        </form>

        {isLogin ? (
          <div className="mt-6 pt-6 border-t border-[#39FF14]">
            <p className="text-sm text-[#39FF14] text-center mb-4 drop-shadow-lg">
              Don't have an account?{' '}
              <button
                onClick={() => {
                  setIsLogin(false)
                  setError('')
                }}
                className="font-bold hover:underline"
              >
                Sign up here
              </button>
            </p>
          </div>
        ) : (
          <div className="mt-6 pt-6 border-t border-[#39FF14]">
            <p className="text-sm text-[#39FF14] text-center mb-4 drop-shadow-lg">
              Already have an account?{' '}
              <button
                onClick={() => {
                  setIsLogin(true)
                  setError('')
                }}
                className="font-bold hover:underline"
              >
                Log in here
              </button>
            </p>
          </div>
        )}
      </div>
      <InstallPrompt />
    </div>
  )
}

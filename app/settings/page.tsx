'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/types'
import { useAuth } from '@/lib/useAuth'

export default function Settings() {
  const router = useRouter()
  const auth = useAuth()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = auth.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    setLoading(false)
  }, [router])

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (currentPassword !== currentUser?.password) {
      setError('Current password is incorrect')
      return
    }

    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
      setError('New password must be exactly 4 digits')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword === currentPassword) {
      setError('New password must be different from current password')
      return
    }

    try {
      auth.updatePassword(currentUser!.id, newPassword)
      
      // Update local state
      setCurrentUser({ ...currentUser!, password: newPassword })
      
      setSuccess('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return null
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="card mb-6">
        <h1 className="text-3xl font-bold mb-2">⚙️ Settings</h1>
        <p className="text-gray-600">Manage your account settings</p>
      </div>

      <div className="card">
        <h2 className="text-2xl font-bold mb-6">Account Information</h2>

        <div className="mb-8 pb-8 border-b">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Player Name</p>
            <p className="text-xl font-bold">{currentUser.name}</p>
            <p className="text-xs text-gray-500 mt-2">User ID: {currentUser.id}</p>
          </div>
        </div>

        <h3 className="text-xl font-bold mb-4">Change Password</h3>
        
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label">Current Password (4 digits)</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value.slice(0, 4))}
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
          </div>

          <div>
            <label className="label">New Password (4 digits)</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value.slice(0, 4))}
              placeholder="0000"
              maxLength={4}
              className="input-field text-center text-2xl tracking-widest font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">Must be exactly 4 digits</p>
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value.slice(0, 4))}
              placeholder="0000"
              maxLength={4}
              className="input-field text-center text-2xl tracking-widest font-mono"
            />
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 text-green-700 p-3 rounded">
              ✅ {success}
            </div>
          )}

          <button type="submit" className="btn-primary w-full mt-6">
            🔒 Update Password
          </button>
        </form>
      </div>

      <Link href="/">
        <button className="btn-secondary w-full mt-6">← Back to Home</button>
      </Link>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import ThemeSelector from '@/components/ThemeSelector'

export default function Settings() {
  const router = useRouter()
  const auth = useAuth()

  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [newName, setNewName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    const user = auth.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    setNewName(user.name)
    setLoading(false)
  }, [router])

  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault()
    setNameError('')
    setNameSuccess('')

    if (!newName.trim()) {
      setNameError('Please enter a name')
      return
    }

    if (newName === currentUser?.name) {
      setNameError('New name must be different from current name')
      return
    }

    // Check if name is already taken
    const allUsers = auth.getAllUsers()
    if (allUsers.some(u => u.name.toLowerCase() === newName.toLowerCase() && u.id !== currentUser?.id)) {
      setNameError('This name is already taken')
      return
    }

    try {
      auth.updateName(currentUser!.id, newName)
      
      // Update local state
      setCurrentUser({ ...currentUser!, name: newName })
      
      setNameSuccess('Name updated successfully!')
    } catch (err) {
      setNameError((err as Error).message)
    }
  }

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields')
      return
    }

    if (currentPassword !== currentUser?.password) {
      setPasswordError('Current password is incorrect')
      return
    }

    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
      setPasswordError('New password must be exactly 4 digits')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password')
      return
    }

    try {
      auth.updatePassword(currentUser!.id, newPassword)
      
      // Update local state
      setCurrentUser({ ...currentUser!, password: newPassword })
      
      setPasswordSuccess('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError((err as Error).message)
    }
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete your account? This action cannot be undone and will remove all your data including all golf rounds.\n\nType your name to confirm: ${currentUser?.name}`
    )

    if (!confirmed) return

    try {
      setDeleteError('')
      await auth.deleteUser(currentUser!.id)
      router.push('/login')
    } catch (err) {
      setDeleteError((err as Error).message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUser')
    router.push('/login')
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
    <div className="max-w-xl mx-auto py-4">
      <div className="card mb-4">
        <h1 className="text-xl font-bold mb-1">⚙️ Settings</h1>
        <p className="text-gray-600 text-xs">Manage your account</p>
      </div>

      {/* Current Name Card */}
      <div className="card mb-4 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-gray-600">Player Name</p>
            <p className="text-base font-semibold">{currentUser?.name}</p>
          </div>
          {!editingName && (
            <button
              onClick={() => {
                setEditingName(true)
                setNameError('')
                setNameSuccess('')
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
            >
              Edit
            </button>
          )}
        </div>

        {/* Edit Name Form */}
        {editingName && (
          <form onSubmit={handleUpdateName} className="mt-3 pt-3 border-t space-y-2">
            <div>
              <label className="label text-xs">New Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter new name"
                className="input-field py-1 text-sm"
              />
            </div>

            {nameError && (
              <div className="bg-red-100 text-red-700 p-2 rounded text-xs">
                {nameError}
              </div>
            )}

            {nameSuccess && (
              <div className="bg-green-100 text-green-700 p-2 rounded text-xs">
                ✅ {nameSuccess}
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 py-1 text-sm">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="btn-secondary flex-1 py-1 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Change Password Card */}
      <div className="card mb-4 p-3">
        {!showPasswordForm ? (
          <button
            onClick={() => {
              setShowPasswordForm(true)
              setPasswordError('')
              setPasswordSuccess('')
              setCurrentPassword('')
              setNewPassword('')
              setConfirmPassword('')
            }}
            className="w-full text-left text-base font-semibold text-blue-600 hover:text-blue-800"
          >
            🔒 Change Password
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-2">
            <div>
              <label className="label text-xs">Current Password (4 digits)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value.slice(0, 4))}
                  placeholder="0000"
                  maxLength={4}
                  className="input-field text-center text-lg tracking-widest font-mono py-1"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1.5 text-gray-600 text-xs"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div>
              <label className="label text-xs">New Password (4 digits)</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value.slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                className="input-field text-center text-lg tracking-widest font-mono py-1"
              />
              <p className="text-xs text-gray-500 mt-0.5">Exactly 4 digits</p>
            </div>

            <div>
              <label className="label text-xs">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value.slice(0, 4))}
                placeholder="0000"
                maxLength={4}
                className="input-field text-center text-lg tracking-widest font-mono py-1"
              />
            </div>

            {passwordError && (
              <div className="bg-red-100 text-red-700 p-2 rounded text-xs">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-green-100 text-green-700 p-2 rounded text-xs">
                ✅ {passwordSuccess}
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 py-1 text-sm">
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordForm(false)}
                className="btn-secondary flex-1 py-1 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <ThemeSelector />

      <button 
        onClick={handleLogout} 
        className="btn-secondary w-full mt-3 py-1 text-sm"
      >
        🚪 Logout
      </button>

      {/* Delete Account Card */}
      <div className="card mt-3 p-3 border-2 border-red-200 bg-red-50">
        <h2 className="text-base font-bold mb-2 text-red-600">⚠️ Delete Account</h2>
        
        <p className="text-gray-600 text-xs mb-3">
          Permanently delete your account and all golf rounds.
        </p>
        
        {deleteError && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-2 text-xs">
            {deleteError}
          </div>
        )}

        <button
          onClick={handleDeleteAccount}
          className="btn-danger w-full py-1 text-sm"
        >
          🗑️ Delete Account
        </button>
      </div>

      <Link href="/">
        <button className="btn-secondary w-full mt-3 py-1 text-sm">← Back</button>
      </Link>
    </div>
  )
}

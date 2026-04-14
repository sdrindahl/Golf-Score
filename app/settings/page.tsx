'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User } from '@/types'
import { useAuth } from '@/lib/useAuth'
import ThemeSelector from '@/components/ThemeSelector'
import PageWrapper from '@/components/PageWrapper'

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
      <PageWrapper title="Account Settings">
        <div className="max-w-2xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
          <p className="text-gray-500">Loading...</p>
        </div>
      </PageWrapper>
    )
  }

  if (!currentUser) {
    return null
  }

  return (
    <PageWrapper title="Account Settings">
      <div className="max-w-xl mx-auto space-y-4">

        {/* Current Name Card */}
        <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-lg border border-white/20">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-gray-600 font-semibold uppercase">Player Name</p>
              <p className="text-lg font-bold text-gray-800">{currentUser?.name}</p>
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
            <form onSubmit={handleUpdateName} className="mt-4 pt-4 border-t space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter new name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                />
              </div>

              {nameError && (
                <div className="bg-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold">
                  {nameError}
                </div>
              )}

              {nameSuccess && (
                <div className="bg-green-100 text-green-700 p-3 rounded-lg text-xs font-semibold">
                  ✅ {nameSuccess}
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Change Password Card */}
        <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-lg border border-white/20">
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
              className="w-full text-left text-base font-bold text-gray-800 hover:text-blue-600"
            >
              🔒 Change Password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Current Password (4 digits)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value.slice(0, 4))}
                    placeholder="0000"
                    maxLength={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-gray-600 text-sm"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Password (4 digits)</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value.slice(0, 4))}
                  placeholder="0000"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Exactly 4 digits</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.slice(0, 4))}
                  placeholder="0000"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono"
                />
              </div>

              {passwordError && (
                <div className="bg-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-100 text-green-700 p-3 rounded-lg text-xs font-semibold">
                  ✅ {passwordSuccess}
                </div>
              )}

              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordForm(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-lg border border-white/20">
          <ThemeSelector />
        </div>

        <button 
          onClick={handleLogout} 
          className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20"
        >
          🚪 Logout
        </button>

        {/* Delete Account Card - Admin Only */}
        {currentUser?.is_admin && (
          <div className="bg-red-50 backdrop-blur rounded-3xl p-6 shadow-lg border-2 border-red-200">
            <h2 className="text-lg font-bold mb-2 text-red-600">⚠️ Delete Account</h2>
            
            <p className="text-gray-600 text-xs mb-4">
              Permanently delete an account and all golf rounds.
            </p>
            
            {deleteError && (
              <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-3 text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <button
              onClick={handleDeleteAccount}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors"
            >
              🗑️ Delete Account
            </button>
          </div>
        )}

        <Link href="/">
          <button className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20">← Back to Home</button>
        </Link>
      </div>
    </PageWrapper>
  )
}

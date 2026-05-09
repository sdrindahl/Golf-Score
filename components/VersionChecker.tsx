'use client'

import { useEffect, useState } from 'react'
import { getRoundsInProgress } from '@/lib/roundsInProgress'

export default function VersionChecker() {
  const [version, setVersion] = useState<string | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [showBanner, setShowBanner] = useState(false)
  const [hasActiveRound, setHasActiveRound] = useState(false)

  // Check if user has any active rounds
  const checkForActiveRounds = async () => {
    try {
      const rounds = await getRoundsInProgress()
      setHasActiveRound(rounds && rounds.length > 0)
    } catch (error) {
      // If error (e.g., Supabase not configured), allow updates
      setHasActiveRound(false)
    }
  }

  useEffect(() => {
    // Check for active rounds on mount
    checkForActiveRounds()

    // Get current version
    const loadVersion = async () => {
      try {
        const response = await fetch('/version.json', { cache: 'no-store' })
        const data = await response.json()
        setVersion(data.version)
        // Store in sessionStorage for version display
        sessionStorage.setItem('appVersion', data.version)
        console.log('VersionChecker: Loaded version:', data.version)
      } catch (error) {
        console.error('Error loading version:', error)
      }
    }

    loadVersion()

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data.type === 'UPDATE_AVAILABLE') {
          console.log(`VersionChecker: Update available from SW: ${event.data.version}`)
          setUpdateAvailable(true)
          // Check for active rounds before showing banner
          checkForActiveRounds().then(() => {
            setShowBanner(true)
          })
        }
      }

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)

      // Check for updates every 5 minutes
      const updateCheckInterval = setInterval(async () => {
        try {
          const response = await fetch('/version.json', { cache: 'no-store' })
          const data = await response.json()
          console.log('VersionChecker: Checking version. Current:', version, 'Latest:', data.version)
          if (version && data.version !== version) {
            console.log('VersionChecker: New version detected! Showing banner.')
            setUpdateAvailable(true)
            // Check for active rounds before showing banner
            checkForActiveRounds().then(() => {
              setShowBanner(true)
            })
          }
        } catch (error) {
          console.error('Error checking for updates:', error)
        }
      }, 5 * 60 * 1000) // 5 minutes

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
        clearInterval(updateCheckInterval)
      }
    }
  }, [version])

  const handleUpdate = () => {
    // Service worker will handle new version on reload
    // Auth tokens (currentUser in localStorage) are preserved
    if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
      (window as any).location.reload()
    }
  }

  return (
    <>
      {/* Version banner - shows when update is available AND no active rounds */}
      {showBanner && updateAvailable && !hasActiveRound && (
        <div className="fixed top-4 left-4 right-4 max-w-md bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg z-50">
          <p className="font-semibold mb-2">✨ New Update Available</p>
          <p className="text-sm mb-3">A new version is ready with bug fixes and improvements.</p>
          <button
            onClick={handleUpdate}
            className="w-full bg-white text-green-600 font-semibold py-2 px-3 rounded hover:bg-gray-100 transition-colors text-sm"
          >
            Update Now
          </button>
        </div>
      )}

      {/* Hidden banner message when update is available but user is golfing */}
      {showBanner && updateAvailable && hasActiveRound && (
        <div className="fixed top-4 left-4 right-4 max-w-md bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-lg shadow-lg z-50">
          <p className="font-semibold mb-2">📱 Update Waiting</p>
          <p className="text-sm mb-2">A new version is ready. Finish your round first, then tap "Update Now" when it appears.</p>
          <p className="text-xs opacity-90">Your data is safe—no need to rush.</p>
        </div>
      )}

      {/* Version display - small text in corner (debugging/info) */}
      {version && process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-2 right-2 text-xs text-gray-500 bg-white/50 px-2 py-1 rounded">
          v{version}
        </div>
      )}
    </>
  )
}

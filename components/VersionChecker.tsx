'use client'

import { useEffect, useState } from 'react'

export default function VersionChecker() {
  const [version, setVersion] = useState<string | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Get current version
    const loadVersion = async () => {
      try {
        const response = await fetch('/version.json', { cache: 'no-store' })
        const data = await response.json()
        setVersion(data.version)
        // Store in sessionStorage for version display
        sessionStorage.setItem('appVersion', data.version)
      } catch (error) {
        console.error('Error loading version:', error)
      }
    }

    loadVersion()

    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        if (event.data.type === 'UPDATE_AVAILABLE') {
          console.log(`Update available: ${event.data.version}`)
          setUpdateAvailable(true)
          setShowBanner(true)
        }
      }

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)

      // Check for updates every 5 minutes
      const updateCheckInterval = setInterval(async () => {
        try {
          const response = await fetch('/version.json', { cache: 'no-store' })
          const data = await response.json()
          if (version && data.version !== version) {
            setUpdateAvailable(true)
            setShowBanner(true)
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
    // Clear caches and reload
    if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
      if ('caches' in window) {
        caches.keys().then((cacheNames: string[]) => {
          Promise.all(cacheNames.map((cacheName: string) => caches.delete(cacheName)))
            .then(() => {
              (window as any).location.reload()
            })
        })
      } else {
        (window as any).location.reload()
      }
    }
  }

  return (
    <>
      {/* Version banner - shows when update is available */}
      {showBanner && updateAvailable && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow-lg z-50">
          <p className="font-semibold mb-2">📱 Update Available</p>
          <p className="text-sm mb-3">A new version of the app is ready to install.</p>
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              className="flex-1 bg-white text-blue-600 font-semibold py-2 px-3 rounded hover:bg-gray-100 transition-colors text-sm"
            >
              Update Now
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="px-3 py-2 hover:bg-blue-700 transition-colors text-sm"
            >
              Later
            </button>
          </div>
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

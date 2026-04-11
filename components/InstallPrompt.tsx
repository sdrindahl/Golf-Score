'use client'

import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      return
    }

    // Check if app is already installed
    if ((window as any).navigator.standalone === true) {
      setIsInstalled(true)
      return
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    if (isIOSDevice) {
      setShowInstructions(true)
      return
    }

    // Listen for the beforeinstallprompt event (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowPrompt(true)
      console.log('beforeinstallprompt event fired')
    }

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setInstallPrompt(null)
      console.log('App installed successfully')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) {
      console.log('No install prompt available')
      return
    }

    try {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      console.log('User choice:', outcome)
      
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setShowPrompt(false)
      }
      setInstallPrompt(null)
    } catch (error) {
      console.error('Install error:', error)
    }
  }

  // Don't show anything if app is already installed
  if (isInstalled) {
    return null
  }

  // iPhone instructions
  if (isIOS && showInstructions) {
    return (
      <div className="fixed bottom-6 left-6 right-6 bg-blue-50 border-2 border-blue-400 rounded-lg p-4 shadow-lg z-40 md:w-96 md:left-auto md:right-6">
        <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
          📱 Add App to Home Screen
        </h3>
        <ol className="text-sm text-blue-800 space-y-2 mb-4">
          <li className="flex gap-2">
            <span className="font-bold flex-shrink-0">1.</span>
            <span>Tap the <strong>Share</strong> button (bottom center)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold flex-shrink-0">2.</span>
            <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold flex-shrink-0">3.</span>
            <span>Tap <strong>Add</strong> in the top right</span>
          </li>
        </ol>
        <p className="text-xs text-blue-600 italic">The app will appear as an icon on your home screen!</p>
      </div>
    )
  }

  // Android/Desktop install button
  if (showPrompt && installPrompt) {
    return (
      <button
        onClick={handleInstall}
        className="fixed bottom-6 left-6 right-6 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2 z-40 md:w-auto md:left-auto md:right-6 md:bottom-6"
      >
        📱 Install App
      </button>
    )
  }

  return null
}

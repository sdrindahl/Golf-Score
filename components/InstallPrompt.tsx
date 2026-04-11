'use client'

import { useState, useEffect } from 'react'

export default function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

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

    // Listen for the beforeinstallprompt event
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

  // Don't show anything if prompt is not available and not installed
  if (!showPrompt || !installPrompt) {
    return null
  }

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-6 left-6 right-6 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2 z-40 md:w-auto md:left-auto md:right-6 md:bottom-6"
    >
      📱 Install App
    </button>
  )
}

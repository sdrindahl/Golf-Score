'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  // Always use light mode
  useEffect(() => {
    const html = document.documentElement
    html.classList.remove('dark-mode', 'golf-mode')
    html.classList.add('light-mode')
    setMounted(true)
  }, [])

  const setTheme = () => {
    // Theme is locked to light mode, no-op
  }

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

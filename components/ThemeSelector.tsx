'use client'

import { useTheme, type Theme } from '@/lib/themeContext'

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="card mt-6">
      <h2 className="text-2xl font-bold mb-6">Theme Settings</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-bold mb-4">Choose Your Theme</h3>
        <div className="space-y-2">
          <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:opacity-80 transition">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="mr-3 w-4 h-4"
            />
            <span className="text-sm font-medium">☀️ Light Mode</span>
          </label>
          
          <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:opacity-80 transition">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="mr-3 w-4 h-4"
            />
            <span className="text-sm font-medium">🌙 Dark Mode</span>
          </label>
          
          <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:opacity-80 transition">
            <input
              type="radio"
              name="theme"
              value="golf"
              checked={theme === 'golf'}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="mr-3 w-4 h-4"
            />
            <span className="text-sm font-medium">⛳ Golf Mode (Dark Green)</span>
          </label>
        </div>
      </div>
    </div>
  )
}

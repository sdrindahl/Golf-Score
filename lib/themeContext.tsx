'use client'


import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'wolves' | 'vikings'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'wolves';
    }
    return 'wolves';
  });
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.remove('wolves-mode', 'vikings-mode');
    body.classList.remove('wolves-mode', 'vikings-mode');
    if (theme === 'wolves') {
      html.classList.add('wolves-mode');
      body.classList.add('wolves-mode');
    } else if (theme === 'vikings') {
      html.classList.add('vikings-mode');
      body.classList.add('vikings-mode');
    }
    setMounted(true);
    localStorage.setItem('theme', theme);
  }, [theme]);



  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

'use client'


import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'wolves' | 'vikings' | 'purplerain'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'light';
    }
    return 'light';
  });
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.remove('light-mode', 'wolves-mode', 'vikings-mode', 'purplerain-mode');
    body.classList.remove('light-mode', 'wolves-mode', 'vikings-mode', 'purplerain-mode');
    if (theme === 'wolves') {
      html.classList.add('wolves-mode');
      body.classList.add('wolves-mode');
    } else if (theme === 'vikings') {
      html.classList.add('vikings-mode');
      body.classList.add('vikings-mode');
    } else if (theme === 'purplerain') {
      html.classList.add('purplerain-mode');
      body.classList.add('purplerain-mode');
    } else {
      html.classList.add('light-mode');
      body.classList.add('light-mode');
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

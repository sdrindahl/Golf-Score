"use client";
import { useTheme } from "../../lib/themeContext";

export default function ThemesPage() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--green-bg)' }}
    >
      <div className="max-w-xl w-full mx-auto mt-10 space-y-6 bg-white/80 rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold mb-4 text-center">Select Theme</h1>
        <div className="flex gap-3 mt-2">
          <button
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors border-2 ${theme === 'light' ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
            onClick={() => setTheme('light')}
          >
            iOS Light
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors border-2 ${theme === 'wolves' ? '' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
            style={theme === 'wolves' ? {
              background: 'linear-gradient(120deg, #0a1833 0%, #00ff87 60%, #00cfff 100%)',
              color: '#fff',
              borderColor: '#00ff87',
              boxShadow: '0 2px 8px rgba(0,255,135,0.15)'
            } : {}}
            onClick={() => setTheme('wolves')}
          >
            MN TWolves
          </button>
          <button
            className={`flex-1 py-2 rounded-lg font-semibold transition-colors border-2 ${theme === 'vikings' ? '' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
            style={theme === 'vikings' ? {
              background: 'linear-gradient(120deg, #4f2683 0%, #ffc62f 60%, #ffffff 100%)',
              color: '#4f2683',
              borderColor: '#ffc62f',
              boxShadow: '0 2px 8px rgba(79,38,131,0.15)'
            } : {}}
            onClick={() => setTheme('vikings')}
          >
            MN Vikings
          </button>
        </div>
      </div>
    </div>
  );
}

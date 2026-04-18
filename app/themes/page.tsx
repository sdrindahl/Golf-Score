"use client";
import { useTheme } from "../../lib/themeContext";

export default function ThemesPage() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start pt-24 md:pt-32"
      style={{ background: 'var(--green-bg)' }}
    >
      <h1 className="text-3xl md:text-4xl font-extrabold mb-10 mt-2 text-center text-white drop-shadow-lg">Select Theme</h1>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md px-4 justify-center items-center">
        <button
          className={`flex-1 min-w-[180px] min-h-[56px] py-4 px-6 rounded-xl text-lg font-semibold transition-colors border-2 ${theme === 'light' ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)] scale-105' : 'bg-white/80 text-gray-800 border-gray-300 hover:scale-105'}`}
          onClick={() => setTheme('light')}
        >
          iOS Light
        </button>
        <button
          className={`flex-1 min-w-[180px] min-h-[56px] py-4 px-6 rounded-xl text-lg font-semibold transition-colors border-2 ${theme === 'wolves' ? 'scale-105' : 'bg-white/80 text-gray-800 border-gray-300 hover:scale-105'}`}
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
          className={`flex-1 min-w-[180px] min-h-[56px] py-4 px-6 rounded-xl text-lg font-semibold transition-colors border-2 ${theme === 'vikings' ? 'scale-105' : 'bg-white/80 text-gray-800 border-gray-300 hover:scale-105'}`}
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
  );
}

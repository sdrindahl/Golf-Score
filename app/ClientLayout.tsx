"use client";
import CourseInitializer from '@/components/CourseInitializer';
import VersionChecker from '@/components/VersionChecker';
import NavBar from '@/components/NavBar';
import { ThemeProvider } from '@/lib/themeContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CourseInitializer />
      <VersionChecker />
      <NavBar />
      <main className="max-w-6xl mx-auto p-3 md:p-4 lg:p-6 pb-24 md:pb-6">
        {children}
      </main>
    </ThemeProvider>
  );
}

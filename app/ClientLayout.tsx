"use client";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import CourseInitializer from '@/components/CourseInitializer';
import VersionChecker from '@/components/VersionChecker';
import InstallPrompt from '@/components/InstallPrompt';
import NavBar from '@/components/NavBar';
import { ThemeProvider } from '@/lib/themeContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWalletRoute = pathname?.startsWith('/wallet');

  useEffect(() => {
    document.body.classList.toggle('wallet-page', Boolean(isWalletRoute));

    return () => {
      document.body.classList.remove('wallet-page');
    };
  }, [pathname]);

  return (
    <ThemeProvider>
      <CourseInitializer />
      <VersionChecker />
      <InstallPrompt />
      <NavBar />
      <main className={`max-w-6xl mx-auto ${isWalletRoute ? 'p-0 pb-24 md:pb-6 bg-[#06110d]' : 'p-3 md:p-4 lg:p-6 pb-24 md:pb-6'}`}>
        {children}
      </main>
    </ThemeProvider>
  );
}

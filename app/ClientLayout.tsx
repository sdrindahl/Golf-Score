"use client";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import CourseInitializer from '@/components/CourseInitializer';
import VersionChecker from '@/components/VersionChecker';
import InstallPrompt from '@/components/InstallPrompt';
import { FeatureFlagsProvider } from '@/lib/featureFlagsContext';
import NavBar from '@/components/NavBar';
import { ThemeProvider } from '@/lib/themeContext';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWalletRoute = pathname?.startsWith('/wallet');
  const isRoundsInProgressRoute = pathname === '/rounds-in-progress';
  const isEventsRoute = pathname?.startsWith('/events');
  const isFullBleedDarkRoute = isWalletRoute || isRoundsInProgressRoute || isEventsRoute;

  useEffect(() => {
    document.body.classList.toggle('wallet-page', Boolean(isFullBleedDarkRoute));

    return () => {
      document.body.classList.remove('wallet-page');
    };
  }, [isFullBleedDarkRoute]);

  return (
    <ThemeProvider>
      <FeatureFlagsProvider>
        <CourseInitializer />
        <VersionChecker />
        <InstallPrompt />
        <NavBar />
        <main className={`${isFullBleedDarkRoute ? 'w-full max-w-none mx-0 p-0 pb-24 md:pb-6 bg-[#06110d]' : 'max-w-6xl mx-auto p-3 md:p-4 lg:p-6 pb-24 md:pb-6'}`}>
          {children}
        </main>
      </FeatureFlagsProvider>
    </ThemeProvider>
  );
}

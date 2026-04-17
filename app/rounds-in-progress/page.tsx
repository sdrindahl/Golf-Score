"use client"

import { useEffect, useState } from 'react';
import { getRoundsInProgress, subscribeToRoundsInProgress } from '@/lib/roundsInProgress';
import Link from 'next/link';

import { useRouter } from 'next/navigation'


export default function RoundsInProgressPage() {
  const router = useRouter();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    let subscription: any;
    getRoundsInProgress().then(data => {
      setRounds(data || []);
      setLoading(false);
      // Subscribe for real-time updates
      subscription = subscribeToRoundsInProgress(() => {
        getRoundsInProgress().then(setRounds);
      });
    }).catch((err) => {
      setLoading(false);
      setRounds([]);
      // Optionally, show error to user
      console.error(err);
    });
    return () => {
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };
  }, [isClient]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  // Navigation handlers for bottom nav
  const handleViewRounds = () => router.push('/')
  const handleViewCourses = () => router.push('/courses')
  const handleViewGolfers = () => router.push('/players')
  const handleSettings = () => router.push('/settings')

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-600 via-green-600 to-teal-600 flex flex-col pb-24">
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 drop-shadow-lg text-center">Rounds in Progress</h1>
        {rounds.length === 0 && (
          <div className="bg-white/90 rounded-xl shadow-md p-6 text-center">
            <p className="text-gray-500 font-semibold">No rounds in progress.</p>
          </div>
        )}
        <ul className="space-y-5">
          {rounds.map(round => (
            <li key={round.id} className="bg-white/95 backdrop-blur rounded-xl shadow-lg p-5 flex flex-col gap-2 border border-white/20">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">⏱️</span>
                <span className="font-bold text-lg text-emerald-700">{round.user_name}</span>
                <span className="text-gray-500 font-semibold">at</span>
                <span className="font-semibold text-base text-green-700">{round.course_name}</span>
              </div>
              <div className="text-xs text-gray-600 mb-2">Started: {new Date(round.date).toLocaleString()}</div>
              <Link href={`/round-detail?id=${round.id}&from=rounds-in-progress`} className="inline-block w-fit bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg shadow transition-all text-xs sm:text-sm">Watch Round</Link>
            </li>
          ))}
        </ul>
      </div>

      {/* iOS-style Bottom Navigation */}
      <nav className="ios-bottom-nav fixed bottom-0 left-0 right-0 z-50">
        <button onClick={handleViewRounds} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
          <span className="text-xl">🏌️</span>
          <span className="text-xs">Rounds</span>
        </button>
        <button onClick={handleViewCourses} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
          <span className="text-xl">⛳</span>
          <span className="text-xs">Courses</span>
        </button>
        <button onClick={handleViewGolfers} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
          <span className="text-xl">👥</span>
          <span className="text-xs">Golfers</span>
        </button>
        <button onClick={handleSettings} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  );
}

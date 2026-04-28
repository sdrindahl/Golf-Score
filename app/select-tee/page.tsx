'use client'
import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageWrapper from '@/components/PageWrapper';
import { COURSES_DATABASE } from '@/data/courses';
import { useAuth } from '@/lib/useAuth';

function SelectTeePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tee, setTee] = React.useState<'men' | 'women' | 'senior' | 'championship' | null>(null);
  const [startingHole, setStartingHole] = React.useState<number | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedNines, setSelectedNines] = React.useState<any[]>([]);
  const auth = useAuth();

  // Load selected nines from query param on mount
  React.useEffect(() => {
    const ninesParam = searchParams?.get('nines');
    if (ninesParam) {
      const ids = ninesParam.split(',').map(id => id.trim()).filter(Boolean);
      // Try to find nines in COURSES_DATABASE
      const allCourses = COURSES_DATABASE;
      const foundNines = ids.map(id => allCourses.find(c => c.id === id)).filter(Boolean);
      setSelectedNines(foundNines);
      // Save to localStorage for round creation
      localStorage.setItem('selectedNines', JSON.stringify(foundNines));
    }
  }, [searchParams]);
  // Create and save a new round, then navigate (wait for Supabase)
  React.useEffect(() => {
    const createAndStartRound = async () => {
      // Defensive: do not proceed unless tee is a valid value
      if (!tee || !['men', 'women', 'senior', 'championship'].includes(tee)) {
        console.warn('[SelectTee] Attempted to create round without valid tee:', tee);
        return;
      }
      if (!startingHole || creating) return;
      setCreating(true);
      setError(null);

      // Generate a unique round ID
      const roundId = Date.now().toString();
      const user = auth.getCurrentUser();
      const nines = selectedNines;
      console.log('[DEBUG] Selected nines:', nines);
      console.log('[DEBUG] Tee at round creation:', tee);
      if (!user || !user.id) {
        setError('You must be logged in to start a round.');
        setCreating(false);
        return;
      }
      if (!nines || nines.length === 0) {
        setError('No nines selected. Please go back and select a course.');
        setCreating(false);
        return;
      }

      // Compose round object with array of courseIds
      const round = {
        id: roundId,
        userId: user.id,
        userName: user.name || 'Unknown',
        courseId: nines.map((c: any) => c.id),
        courseName: nines.map((c: any) => c.name).join(' / '),
        selectedTee: tee,
        date: new Date().toISOString(),
        scores: Array(nines.length * 9).fill(0),
        totalScore: 0,
        notes: '',
        in_progress: true, // Always boolean
        startingHole: startingHole,
      };
      // Remove any snake_case fields if present (defensive)
      if ('selected_tee' in round) delete (round as any).selected_tee;
      if ('inProgress' in round) delete (round as any).inProgress;
      console.log('[DEBUG] Round object to save:', round);

      try {
        // 1. Upsert all selected nines to Supabase
        for (const nine of nines) {
          const courseResponse = await fetch('/api/save-course', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nine),
          });
          const courseResult = await courseResponse.json();
          console.log('[DEBUG] Supabase save-course response:', courseResult);
          if (!courseResult.success) throw new Error(courseResult.error || 'Failed to save course to Supabase');
        }

        // 2. Save round to Supabase
        // Debug log outgoing round object
        console.log('[DEBUG] Outgoing round object to /api/save-round:', round);
        const response = await fetch('/api/save-round', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(round),
        });
        const result = await response.json();
        console.log('[DEBUG] Supabase save-round response:', result);
        if (!result.success) throw new Error(result.error || 'Failed to save round to Supabase');

        // 3. Save round to localStorage
        const savedRounds = localStorage.getItem('golfRounds');
        const rounds = savedRounds ? JSON.parse(savedRounds) : [];
        rounds.push(round);
        localStorage.setItem('golfRounds', JSON.stringify(rounds));
        localStorage.setItem('currentRoundId', roundId);
        console.log('[DEBUG] Round saved to localStorage:', round);

        // 4. Optionally, save selected nines to golfCourses for detail pages
        const savedCourses = localStorage.getItem('golfCourses');
        const courses = savedCourses ? JSON.parse(savedCourses) : [];
        for (const nine of nines) {
          if (nine.id && !courses.some((c: any) => c.id === nine.id)) {
            courses.push(nine);
          }
        }
        localStorage.setItem('golfCourses', JSON.stringify(courses));
        console.log('[DEBUG] Navigating to track-round:', `/track-round?id=${roundId}&tee=${tee}&hole=${startingHole}`);

        // 5. Navigate to track-round with id
        router.push(`/track-round?id=${roundId}&tee=${tee}&hole=${startingHole}`);
      } catch (err: any) {
        let msg = 'Failed to save round to Supabase';
        if (err) {
          if (typeof err === 'string') msg = err;
          else if (err.message) msg = err.message;
          else try { msg = JSON.stringify(err); } catch {}
        }
        setError(msg);
        setCreating(false);
      }
    };

    if (tee && startingHole && !creating) {
      createAndStartRound();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tee, startingHole]);

  return (
    <PageWrapper title="Select Tee & Starting Hole">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      <div className="max-w-md mx-auto mt-8 flex flex-col gap-8">
        {/* Tee Selection Card */}
        <div className="bg-[#e6f7f2] rounded-3xl shadow-lg p-6 mb-2 flex flex-col items-center">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Select Tee</h2>
          <div className="flex flex-wrap gap-3 justify-center w-full">
            {['men', 'women', 'senior', 'championship'].map(option => (
              <button
                key={option}
                className={`px-6 py-2 rounded-full border text-base font-semibold transition-all duration-150 ${
                  tee === option
                    ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                    : 'bg-blue-50 text-blue-700 border-blue-300'
                }`}
                onClick={() => setTee(option as any)}
                type="button"
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Starting Hole Selection Card */}
        {tee && (
          <div className="bg-[#e6f7f2] rounded-3xl shadow-lg p-6 mb-2 flex flex-col items-center">
            <h2 className="text-lg font-bold mb-4 text-gray-800">Select Starting Hole</h2>
            <div className="grid grid-cols-6 gap-4 w-full max-w-xs">
              {Array.from({ length: 18 }, (_, i) => i + 1).map(hole => (
                <button
                  key={hole}
                  className={`aspect-square w-10 rounded-xl border-2 text-lg font-bold flex items-center justify-center transition-all duration-150 ${
                    startingHole === hole
                      ? 'bg-green-200 border-green-500 text-green-800 shadow'
                      : 'bg-white border-green-300 text-green-700'
                  }`}
                  onClick={() => setStartingHole(hole)}
                  type="button"
                >
                  {hole}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Cancel Button - pill shape and under cards */}
        <button
          className="mt-4 px-8 py-3 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold border border-gray-300 shadow transition-all"
          onClick={() => router.push('/courses')}
          type="button"
        >
          Cancel
        </button>
      </div>
    </PageWrapper>
  );
}

export default function SelectTeePage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <SelectTeePageInner />
    </Suspense>
  );
}
'use client'
import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageWrapper from '@/components/PageWrapper';
import { COURSES_DATABASE } from '@/data/courses';
import { useAuth } from '@/lib/useAuth';

function SelectTeePageInner() {
          // Cleanup on unmount: reset state and localStorage to ensure Start Round is reset if navigating away
          React.useEffect(() => {
            return () => {
              setTee(null);
              setStartingHole(null);
              setCreating(false);
              setSelectedNines([]);
              localStorage.removeItem('selectedNines');
              localStorage.removeItem('courseSelectedButNoRound');
              window.dispatchEvent(new Event('roundStateChanged'));
            };
          }, []);
        // Reset state on mount to avoid stale disabled Start button
        React.useEffect(() => {
          setTee(null);
          setStartingHole(null);
          setCreating(false);
        }, []);
      // State for TapIt button pressed feedback
      const [tapItPressed, setTapItPressed] = React.useState(false);
    // Helper to compute total yards, rating, and slope for a tee type
    function getTeeStats(teeKey: 'men' | 'women' | 'senior' | 'championship') {
      let totalYards = 0;
      let totalRating = 0;
      let totalSlope = 0;
      let count = 0;
      selectedNines.forEach(nine => {
        if (nine.holes && Array.isArray(nine.holes)) {
          nine.holes.forEach((hole: any) => {
            if (hole[teeKey]) {
              totalYards += hole[teeKey].yardage || 0;
            }
          });
          if (nine.holes.length > 0 && nine.holes[0][teeKey]) {
            totalRating += nine.holes[0][teeKey].courseRating || 0;
            totalSlope += nine.holes[0][teeKey].slopeRating || 0;
            count++;
          }
        }
      });
      // Average rating/slope if multiple nines
      const avgRating = count > 0 ? (totalRating / count).toFixed(1) : '-';
      const avgSlope = count > 0 ? Math.round(totalSlope / count) : '-';
      return {
        totalYards: totalYards > 0 ? totalYards : '-',
        rating: avgRating,
        slope: avgSlope,
      };
    }
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
        // Remove the courseSelectedButNoRound flag since a round is being started
        localStorage.removeItem('courseSelectedButNoRound');

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


  // Improved logic for parent/child course display and formatting
  let parentName = '';
  let childNames = '';
  if (selectedNines.length > 0) {
    // Support both parent_id and parentId
    const parentIds = selectedNines
      .map(c => c.parent_id || c.parentId)
      .filter(Boolean);
    let parent = null;
    if (parentIds.length > 0) {
      parent = COURSES_DATABASE.find(c => c.id === parentIds[0]);
    }
    // If no parent found, but all selected nines have the same name, treat as parent
    if (!parent && selectedNines.length === 1) {
      parent = selectedNines[0];
    }
    parentName = parent && parent.name ? parent.name : '';
    // Only show child names if they are not the same as parent
    childNames = selectedNines
      .filter(c => !parent || c.id !== parent.id)
      .map(c => c.name)
      .join(' / ');
    // If no childNames (e.g., only parent selected), show parent only
    if (!childNames && selectedNines.length === 1) {
      parentName = selectedNines[0].name;
    }
  }

  return (
    <PageWrapper title="">
      <div className="max-w-xl mx-auto mt-8 mb-2 flex flex-col items-center">
        {(parentName || childNames) && (
          <div className="w-full flex flex-col items-center px-4 py-3 rounded-xl bg-black/60 shadow-lg mb-2">
            {parentName && (
              <div className="text-base font-extrabold text-white drop-shadow-lg tracking-tight text-center mb-1 break-words whitespace-pre-line" style={{textShadow: '0 2px 8px #000', wordBreak: 'break-word'}}> {parentName} </div>
            )}
            {childNames && (
              <div className="text-sm font-medium text-green-200 drop-shadow text-center break-words whitespace-pre-line" style={{textShadow: '0 1px 4px #000', wordBreak: 'break-word'}}> {childNames} </div>
            )}
            <hr className="w-3/4 border-t border-green-300 my-2 opacity-60" />
            <div className="text-base font-semibold text-green-300 tracking-wide mt-1 drop-shadow-sm">Select Tee Box</div>
          </div>
        )}
      </div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="max-w-2xl mx-auto mt-8 flex flex-col gap-8">
        {/* Tee Selection Cards - grid, not wrapped */}
        {/* Removed floating Select Tee Box heading, now in header card above */}
        <div className="flex flex-col gap-3 w-full">
          {[
            { key: 'championship', label: 'Championship Tee', desc: 'Championship tee', border: 'border-black', circle: 'bg-transparent' },
            { key: 'men', label: "Men's Tee", desc: 'Standard men\'s tee', border: 'border-blue-500', circle: 'bg-transparent' },
            { key: 'senior', label: 'Senior Tee', desc: 'Senior tee', border: 'border-yellow-400', circle: 'bg-transparent' },
            { key: 'women', label: "Women's Tee", desc: 'Women\'s tee', border: 'border-red-500', circle: 'bg-transparent' },
          ].map(option => {
            const stats = getTeeStats(option.key as any);
            return (
              <button
                key={option.key}
                className={`bg-black bg-opacity-70 rounded-lg border shadow-md flex flex-col items-start px-2 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-green-400 text-sm w-full
                  ${option.border}
                  ${tee === option.key
                    ? `${option.key === 'championship' ? 'scale-[1.03] border-2 border-black text-green-200 shadow-lg' : 'scale-[1.03] border-2 border-green-400 text-green-200 shadow-lg'}`
                    : 'border-4 hover:scale-[1.01] text-green-300 hover:bg-green-800 opacity-90'}
                `}
                onClick={() => setTee(option.key as any)}
                type="button"
              >
                <div className="flex flex-row items-center w-full">
                  {/* Custom radio button */}
                  <span className="flex items-center justify-center mr-3">
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150
                      ${tee === option.key ? 'border-green-400 bg-green-400' : 'border-gray-400 bg-black'}`}
                    >
                      {tee === option.key && <span className="w-2.5 h-2.5 rounded-full bg-white block" />}
                    </span>
                  </span>
                  <span className={`w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 mr-3 ${option.circle}`}>
                    <img src="/golf_ball_tee.png" alt="Golf tee icon" className="w-8 h-8 object-contain" />
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="font-bold text-base mb-1 text-white drop-shadow-sm">{option.label}</span>
                    <div className="text-xs text-green-200 flex flex-row flex-wrap gap-x-4 gap-y-0.5 items-center">
                      <span>Yards: <span className="font-semibold">{stats.totalYards}</span></span>
                      <span>Rating: <span className="font-semibold">{stats.rating}</span></span>
                      <span>Slope: <span className="font-semibold">{stats.slope}</span></span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>


        {/* Tapit Logo Start Round Button (replaces starting hole selection) */}
        <div className="flex flex-col items-center mt-1">
          <button
            className={`flex items-center justify-center rounded-full shadow-lg p-2 transition-all duration-150
              ${!tee ? 'opacity-40 pointer-events-none grayscale' : ''}
              ${tapItPressed ? 'scale-95 shadow-inner bg-black/30' : 'bg-transparent'}`}
            style={{ width: 220, height: 220 }}
            onClick={() => {
              if (tee) {
                setTapItPressed(true);
                setTimeout(() => setTapItPressed(false), 150);
                setStartingHole(1); // Always start on hole 1
              }
            }}
            type="button"
            aria-disabled={!tee}
            aria-pressed={tapItPressed}
          >
            <img 
              src="/JustTapIt_Logo.png" 
              alt="JustTapIt Logo" 
              className="w-44 h-44 object-contain select-none" 
              draggable="false"
              style={{
                border: '2px solid rgb(57, 255, 20)',
                boxShadow: '0 0 24px rgb(57, 255, 20), 0 2px 24px rgba(0,0,0,0.667)',
                borderRadius: '24px',
                background: '#111'
              }}
            />
          </button>
        </div>

        {/* Cancel Button - pill shape and under cards */}
        <div className="mt-0 flex justify-center w-full">
          <button
            className="px-4 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white font-extrabold border border-gray-400 transition-all shadow-sm text-sm"
            style={{ minWidth: 0, width: 'auto', color: '#fff' }}
            onClick={() => router.push('/courses')}
            type="button"
          >
            Cancel
          </button>
        </div>
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
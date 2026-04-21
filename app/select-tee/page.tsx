'use client'
import React, { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageWrapper from '@/components/PageWrapper';
import { COURSES_DATABASE } from '@/data/courses';
import { useAuth } from '@/lib/useAuth';

// Helper component for auto-navigation after both selections
function AutoNavigate({ nines, tee, hole }: { nines: string[], tee: string, hole: number }) {
  const router = useRouter();
  React.useEffect(() => {
    if (nines.length && tee && hole) {
      const ninesParam = nines.join(',');
      router.push(`/track-round?nines=${ninesParam}&tee=${tee}&hole=${hole}`);
    }
  }, [nines, tee, hole, router]);
  return null;
}

export default function SelectTeePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Get selected nines from query string
  const nines = searchParams.get('nines')?.split(',') || [];
  // Find the selected courses from COURSES_DATABASE
  const selectedCourses = COURSES_DATABASE.filter(c => nines.includes(c.id));
  const [tee, setTee] = useState<'men'|'women'|'senior'|'championship'|null>(null);
  const [startingHole, setStartingHole] = useState(1);
  const [saving, setSaving] = useState(false);
  const auth = useAuth();

  // For demo, assume 9 or 18 holes
  const holeOptions = selectedCourses.length === 2 ? [1, 10] : [1];

  if (!selectedCourses.length) {
    return (
      <div className="max-w-2xl mx-auto py-6">
        <div className="card text-center">
          <p className="text-gray-500 mb-4">Course not found</p>
          <button onClick={() => router.push('/courses')} className="btn-primary">
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageWrapper title="Select Tee & Starting Hole">

      <div className="max-w-md mx-auto mt-8 flex flex-col gap-8">
        {/* Tee Selection Card */}
        <div className="bg-[#e6f7f2] rounded-3xl shadow-lg p-6 mb-2 flex flex-col items-center">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Select Tee</h2>
          <div className="flex flex-wrap gap-3 justify-center w-full">
            {['men','women','senior','championship'].map(option => (
              <button
                key={option}
                className={`px-6 py-2 rounded-full border text-base font-semibold transition-all duration-150
                  ${tee === option
                    ? 'bg-blue-500 text-white border-blue-600 shadow-md'
                    : 'bg-blue-50 text-blue-700 border-blue-300'}
                `}
                onClick={() => setTee(option as any)}
                type="button"
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Starting Hole Selection Card */}
        <div className="bg-[#e6f7f2] rounded-3xl shadow-lg p-6 mb-2 flex flex-col items-center">
          <h2 className="text-lg font-bold mb-4 text-gray-800">Select Starting Hole</h2>

          <div className={`grid gap-4 mx-auto ${selectedCourses.length === 2 ? 'grid-cols-6' : 'grid-cols-6'} w-full max-w-xs`}>
            {(() => {
              const totalHoles = selectedCourses.length === 2 ? 18 : 9;
              return Array.from({length: totalHoles}, (_, i) => i + 1).map(hole => (
                <button
                  key={hole}
                  className={`aspect-square w-12 md:w-14 rounded-xl border-2 text-lg font-bold flex items-center justify-center transition-all duration-150
                    ${startingHole === hole
                      ? 'bg-green-200 border-green-500 text-green-800 shadow'
                      : 'bg-white border-green-300 text-green-700'}
                  `}
                  style={{ boxShadow: startingHole === hole ? '0 2px 8px 0 rgba(34,197,94,0.10)' : 'none', padding: 0 }}
                  disabled={saving}
                  onClick={async () => {
                    if (!tee || saving) return; // Require tee selection first, prevent double tap
                    setStartingHole(hole);
                    setSaving(true);
                    try {
                      // Prevent multiple in-progress rounds for the same user
                      const user = auth.getCurrentUser();
                      const savedRounds = localStorage.getItem('golfRounds');
                      const rounds = savedRounds ? JSON.parse(savedRounds) : [];
                      const inProgress = user && rounds.find((r: any) => r.userId === user.id && r.in_progress);
                      if (inProgress) {
                        alert('You already have a round in progress. Please finish or discard it before starting a new one.');
                        setSaving(false);
                        return;
                      }
                      // Compose round object
                      const roundId = Date.now().toString();
                      const courseNames = selectedCourses.map(c => c.name).join(', ');
                      const courseId = selectedCourses.map(c => c.id).join(',');
                      const holes = selectedCourses.flatMap(c => c.holes);
                      const round = {
                        id: roundId,
                        userId: user?.id || 'guest',
                        userName: user?.name || 'Guest',
                        courseId,
                        courseName: courseNames,
                        selectedTee: tee,
                        date: new Date().toISOString().split('T')[0],
                        scores: Array(holes.length).fill(0),
                        totalScore: 0,
                        notes: '',
                        in_progress: true,
                        startingHole: hole,
                      };
                      // Save round to Supabase via API route
                      const response = await fetch('/api/save-round', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(round),
                      });
                      const result = await response.json();
                      if (!result.success) throw new Error(result.error || 'Unknown error');
                      router.push(`/track-round?id=${roundId}`);
                    } catch (err) {
                      alert('Error creating round. Please try again.');
                      setSaving(false);
                    }
                  }}
                  type="button"
                >
                  {hole}
                </button>
              ));
            })()}
          </div>
        </div>


        {/* Selected Nines Display */}
        <div className="bg-white rounded-2xl shadow p-4 text-center">
          <div className="font-semibold mb-2 text-gray-700">Selected Nines:</div>
          <div className="text-gray-600">{selectedCourses.map(c => c.name).join(', ')}</div>
        </div>

        {/* No Continue button needed, navigation is automatic after both selections */}
        {/* Auto-navigate if tee is selected and startingHole is changed (from tee selection) */}
        {/* No auto navigation, navigation is handled on hole button click only */}

        {/* Loading overlay (must be outside grid/main content) */}
        {saving && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
            <div className="bg-white rounded-2xl shadow p-8 text-xl font-semibold">Creating round...</div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

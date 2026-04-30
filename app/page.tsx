'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Round, User } from '@/types'
import { useAuth } from '@/lib/useAuth'

export default function Home() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isClient, setIsClient] = useState(false)
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null)
  const [courses, setCourses] = useState<any[]>([])
  const router = useRouter()
  const auth = useAuth()

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Debug: Print rounds and golfCourses to console
  useEffect(() => {
    if (!isClient) return;
    const savedRounds = localStorage.getItem('golfRounds');
    const savedCourses = localStorage.getItem('golfCourses');
    console.log('DEBUG: rounds', savedRounds ? JSON.parse(savedRounds) : []);
    console.log('DEBUG: golfCourses', savedCourses ? JSON.parse(savedCourses) : []);
  }, [isClient, rounds]);

  // Only run client-only logic after hydration
  useEffect(() => {
    if (!isClient) return;
    // Get current user
    const user = auth.getCurrentUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setCurrentUser(user);

    // Fetch all rounds for the user from Supabase
    fetch('/api/get-user-rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id })
    })
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.rounds)) {
          // Map snake_case fields to camelCase for each round
          const mappedRounds = data.rounds.map((r: any) => ({
            id: r.id,
            userId: r.user_id,
            userName: r.user_name,
            courseId: r.course_id,
            courseName: r.course_name,
            selectedTee: r.selected_tee,
            date: r.date,
            scores: r.scores,
            totalScore: r.total_score,
            notes: r.notes,
            in_progress: r.in_progress,
            perHoleStats: r.perHoleStats || r.per_hole_stats // fallback for perHoleStats if present
          }));
          setRounds(mappedRounds);
        } else {
          setRounds([]);
        }
      })
      .catch(() => setRounds([]));

    // Fetch all courses from Supabase
    fetch('/api/get-courses')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.courses)) {
          setCourses(data.courses);
        } else {
          setCourses([]);
        }
      })
      .catch(() => setCourses([]));

    // Optionally, check for a current round in progress (if you want to keep this logic)
    const inProgressRoundId = localStorage.getItem('currentRoundId');
    if (inProgressRoundId) {
      setCurrentRoundId(inProgressRoundId);
    }
  }, [isClient]);

  const calculateHandicap = (): number => {
    if (!isClient || rounds.length === 0 || courses.length === 0) return 0;
    let handicap = 0;
    // Calculate handicap differential for each round
    // Formula: (Score - Course Rating) × 113 / Slope Rating
    const differentials = rounds
      .map(round => {
        // Support comma-separated courseId (e.g., '9a,9b')
        let courseIds: string[] = [];
        if (Array.isArray(round.courseId)) {
          courseIds = round.courseId;
        } else if (typeof round.courseId === 'string') {
          courseIds = round.courseId.split(',').map((id: string) => id.trim());
        }
        const selectedCourses = courses.filter((c: any) => courseIds.includes(c.id));
        if (selectedCourses.length === 0) return null;
        // For multi-course rounds, sum par/ratings and treat as one course
        const totalPar = selectedCourses.reduce((sum: number, c: any) => sum + (c.par || 0), 0);
        const totalHoles = selectedCourses.reduce((sum: number, c: any) => sum + (c.holes ? c.holes.length : 0), 0);
        // Use average rating/slope if available, else fallback
        const avgCourseRating = selectedCourses.reduce((sum: number, c: any) => sum + (c.courseRating || 0), 0) / selectedCourses.length || totalPar;
        const avgSlopeRating = selectedCourses.reduce((sum: number, c: any) => sum + (c.slopeRating || 113), 0) / selectedCourses.length || 113;
        let courseRating = avgCourseRating;
        let slopeRating = avgSlopeRating;
        if (!courseRating) courseRating = totalPar;
        if (!slopeRating) slopeRating = 113;
        let adjustedScore = round.totalScore;
        let adjustedRating = courseRating;
        // If 9 holes, double for 18
        if (totalHoles === 9) {
          adjustedScore = round.totalScore * 2;
          adjustedRating = courseRating * 2;
        }
        const differential = (adjustedScore - adjustedRating) * 113 / slopeRating;
        return differential;
      })
      .filter((d: any) => d !== null) as number[];
    if (differentials.length > 0) {
      const recentDifferentials = differentials.slice(-20);
      const sortedDifferentials = recentDifferentials.sort((a, b) => a - b);
      let bestCount = 1;
      const roundCount = sortedDifferentials.length;
      if (roundCount >= 6) bestCount = 2;
      if (roundCount >= 7) bestCount = 3;
      if (roundCount >= 9) bestCount = 4;
      if (roundCount >= 11) bestCount = 5;
      if (roundCount >= 13) bestCount = 6;
      if (roundCount >= 15) bestCount = 7;
      if (roundCount >= 17) bestCount = 8;
      const bestDifferentials = sortedDifferentials.slice(0, bestCount);
      handicap = Math.round(bestDifferentials.reduce((a, b) => a + b, 0) / bestCount * 10) / 10;
    }
    return handicap;
  }

  const handicap = calculateHandicap()
  
  const calculateBestScore = (): number | null => {
    if (!isClient || rounds.length === 0) return null
    return Math.min(...rounds.map(r => r.totalScore))
  }

  const bestScore = calculateBestScore()

  const calculateScoreDistribution = (): { distribution: { [key: string]: number }; trend: 'improving' | 'declining' | 'stable'; recentBestType: string } => {
    const distribution = {
      'Hole in 1': 0,
      'Eagle': 0,
      'Birdie': 0,
      'Par': 0,
      'Bogey': 0,
      'Double+': 0,
    };
    if (!isClient || courses.length === 0) {
      return { distribution, trend: 'stable', recentBestType: 'Par' };
    }
    // Count score types across all holes in all rounds
    // Only use completed (not in-progress) rounds
    const completedRounds = rounds.filter(r => !r.in_progress);
    for (const round of completedRounds) {
      // Support comma-separated courseId (e.g., '9a,9b')
      let courseIds: string[] = [];
      if (Array.isArray(round.courseId)) {
        courseIds = round.courseId;
      } else if (typeof round.courseId === 'string') {
        courseIds = round.courseId.split(',').map((id: string) => id.trim());
      }
      const selectedCourses = courses.filter((c: any) => courseIds.includes(c.id));
      const holes = selectedCourses.flatMap((c: any) => c.holes || []);
      for (let i = 0; i < holes.length; i++) {
        const hole = holes[i];
        const score = round.scores?.[i] || 0;
        const par = hole.par;
        const diff = score - par;
        if (score === 1) {
          distribution['Hole in 1']++;
        } else if (diff <= -2) {
          distribution['Eagle']++;
        } else if (diff === -1) {
          distribution['Birdie']++;
        } else if (diff === 0) {
          distribution['Par']++;
        } else if (diff === 1) {
          distribution['Bogey']++;
        } else {
          distribution['Double+']++;
        }
      }
    }
    // Calculate trend - compare recent holes to overall
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (rounds.length >= 2) {
      const recentRound = rounds[rounds.length - 1];
      const prevRound = rounds[rounds.length - 2];
      const recentScore = recentRound.totalScore;
      const prevScore = prevRound.totalScore;
      if (recentScore < prevScore - 1) trend = 'improving';
      else if (recentScore > prevScore + 1) trend = 'declining';
    }
    // Find best recent score type
    let recentBestType = 'Par';
    const recentRound = rounds[rounds.length - 1];
    if (recentRound) {
      const course = courses.find((c: any) => c.id === recentRound.courseId);
      if (course?.holes) {
        let bestDiff = 999;
        for (let i = 0; i < course.holes.length; i++) {
          const hole = course.holes[i];
          const score = recentRound.scores?.[i] || 0;
          const diff = score - hole.par;
          if (diff < bestDiff) {
            bestDiff = diff;
            if (diff <= -2) recentBestType = 'Eagle';
            else if (diff === -1) recentBestType = 'Birdie';
            else if (diff === 0) recentBestType = 'Par';
          }
        }
      }
    }
    return { distribution, trend, recentBestType };
  }

  const { distribution, trend: scoreTrend, recentBestType } = calculateScoreDistribution()
  const maxDistribution = Math.max(...Object.values(distribution), 1)

  // Don't render until client is hydrated and auth checked
  if (!isClient || !currentUser) {
    return null
  }

  const handleStartNewRound = () => {
    router.push('/courses')
  }

  const handleViewRounds = () => {
    router.push(`/player?id=${currentUser.id}`)
  }

  const handleViewCourses = () => {
    router.push('/courses')
  }

  const handleViewGolfers = () => {
    router.push('/players')
  }

  return (
    <div className="min-h-screen flex flex-col pb-24" style={{ background: 'var(--green-bg)' }}>
      {/* Debug: Show rounds array for troubleshooting */}
      {/* Debug output removed for production */}
      {/* Welcome Banner */}
      <div className="px-4 pt-8 pb-4">
        <p className="text-xs text-[var(--text-secondary)] mb-1 font-medium">Welcome back</p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{currentUser?.name || 'Golfer'}</h1>
      </div>

      {/* Main Content */}
      <div className="px-4 space-y-4 max-w-md w-full mx-auto pt-8">
        {/* Stats Cards */}
        <div className="flex gap-2 justify-between">
          {/* Rounds Card */}
          <button
            onClick={handleViewRounds}
            className="card flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="text-2xl mb-0.5">🏌️</div>
            <div className="text-lg font-bold">{rounds.length}</div>
            <div className="text-[10px] text-[var(--text-secondary)] text-center font-semibold uppercase tracking-wide mt-0.5">View My Rounds</div>
          </button>

          {/* Current Active Rounds Card */}
          <button
            onClick={() => router.push('/rounds-in-progress')}
            className="card flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="text-2xl mb-0.5">⏱️</div>
            <div className="text-sm font-bold text-[var(--accent-color)] leading-tight text-center">
              Current<br />Golfers
            </div>
            <div className="text-[10px] text-[var(--accent-color)] text-center font-semibold uppercase tracking-wide mt-0.5">View Live</div>
          </button>

          {/* Handicap Card */}
          <div className="card flex-1 flex flex-col items-center justify-center gap-1">
            <div className="text-2xl mb-0.5">⛳</div>
            <div className="text-lg font-bold">
              {handicap > 0 ? handicap : '—'}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] text-center font-semibold uppercase tracking-wide mt-0.5">Handicap</div>
          </div>
        </div>

        {/* Score Distribution Chart */}
        {rounds.length > 0 && (
          <div className="card p-4">
            <h3 className="text-lg font-bold mb-4">Performance Breakdown</h3>
            {/* Column Headers */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Type</span>
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase w-8 text-center">Total</span>
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase w-12 text-right">Avg/Rnd</span>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(distribution).map(([type, count]) => {
                const percentage = (count / maxDistribution) * 100
                const colors: { [key: string]: string } = {
                  'Hole in 1': 'from-purple-500 to-purple-400',
                  'Eagle': 'from-blue-500 to-blue-400',
                  'Birdie': 'from-green-500 to-green-400',
                  'Par': 'from-yellow-500 to-yellow-400',
                  'Bogey': 'from-orange-500 to-orange-400',
                  'Double+': 'from-red-500 to-red-400',
                }
                const emojis: { [key: string]: string } = {
                  'Hole in 1': '⭐',
                  'Eagle': '🦅',
                  'Birdie': '🐦',
                  'Par': '✔️',
                  'Bogey': '⚠️',
                  'Double+': '❌',
                }
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{emojis[type]}</span>
                        <span className="text-sm font-semibold">{type}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-bold w-8 text-center">{count}</span>
                        <span className="text-xs w-12 text-right">{(count / rounds.length).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`bg-gradient-to-r ${colors[type]} h-2 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Return to Round Button (if round in progress) */}
        {(() => {
          if (!currentRoundId) return null;
          // Find the round in localStorage
          const savedRounds = typeof window !== 'undefined' ? localStorage.getItem('golfRounds') : null;
          let foundRound = null;
          if (savedRounds) {
            const allRounds = JSON.parse(savedRounds);
            foundRound = allRounds.find((r: any) => r.id === currentRoundId);
          }
          // Only show if round is in progress and has a valid courseId
          if (foundRound && foundRound.in_progress && foundRound.courseId && foundRound.courseId !== '') {
            return (
              <button
                onClick={() => router.push(`/track-round?id=${currentRoundId}`)}
                className="btn-danger w-full flex items-center justify-center gap-2 mt-2"
              >
                <span className="text-lg">🎯</span>
                <span>Return to Round</span>
              </button>
            );
          }
          return null;
        })()}

        {/* Start New Round Button */}
        <button
          onClick={handleStartNewRound}
          className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
        >
          <span className="text-lg">+</span>
          <span>Start New Round</span>
        </button>

        {/* View Courses and Golfers */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={handleViewCourses}
            className="btn-secondary flex items-center justify-center gap-2 text-xs font-semibold py-2"
          >
            <span className="text-base">⛳</span>
            <span>Courses</span>
          </button>

          <button
            onClick={handleViewGolfers}
            className="btn-secondary flex items-center justify-center gap-2 text-xs font-semibold py-2"
          >
            <span className="text-base">👥</span>
            <span>Golfers</span>
          </button>
        </div>
      </div>


    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Round } from '@/types'
import { useAuth } from '@/lib/useAuth'

interface ScoreHistoryProps {
  rounds: Round[]
  onDelete?: (roundId: string) => void
  readOnly?: boolean
  userId?: string // ID of the player whose rounds are being shown
}

export default function ScoreHistory({ rounds, onDelete, readOnly = false, userId }: ScoreHistoryProps) {
  const router = useRouter()
  const auth = useAuth()
  const currentUser = auth.getCurrentUser()
  
  // Force rebuild to clear browser cache

  // Determine if current user can edit a round
  const canEditRound = (roundUserId: string): boolean => {
    if (!currentUser) {
      console.log('❌ ScoreHistory: No currentUser found')
      return false
    }
    if (currentUser.is_admin) {
      console.log('✅ ScoreHistory: User is admin, can edit')
      return true
    }
    const canEdit = !readOnly && currentUser.id === roundUserId
    console.log(`ScoreHistory: readOnly=${readOnly}, currentUser.id=${currentUser.id}, roundUserId=${roundUserId}, can edit=${canEdit}`)
    return canEdit
  }

  const handleDelete = async (roundId: string) => {
    if (confirm('Are you sure you want to Delete This?')) {
      if (onDelete) {
        onDelete(roundId)
      } else {
        // Fallback: delete from localStorage directly
        const savedRounds = localStorage.getItem('golfRounds')
        if (savedRounds) {
          const allRounds = JSON.parse(savedRounds)
          const updated = allRounds.filter((r: Round) => r.id !== roundId)
          localStorage.setItem('golfRounds', JSON.stringify(updated))
          window.location.reload()
        }
      }
      // Also delete from Supabase via API route
      try {
        await fetch('/api/delete-round', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roundId }),
        })
      } catch (e) {
        // ignore
      }
    }
  }

  if (rounds.length === 0) {
    return null
  }

  const sortedRounds = [...rounds].reverse()

  // Load courses from localStorage (if available)
  const [courses, setCourses] = useState<any[]>([]);
  useEffect(() => {
    async function loadCourses() {
      let loadedCourses: any[] = [];
      if (typeof window !== 'undefined') {
        const savedCourses = localStorage.getItem('golfCourses');
        if (savedCourses) {
          loadedCourses = JSON.parse(savedCourses);
        }
      }
      // If not found in localStorage, fetch from Supabase
      if (!loadedCourses.length && typeof window !== 'undefined') {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data, error } = await supabase.from('courses').select('*');
            if (!error && data) {
              loadedCourses = data;
            }
          }
        } catch (e) {
          // ignore
        }
      }
      setCourses(loadedCourses);
    }
    loadCourses();
  }, []);

  // Always display the course name from the round object
  const getDisplayCourseName = (round: Round): string => {
    return round.courseName || '';
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 text-gray-800">Rounds — Tap to view</h2>
      <div className="space-y-3">
        {sortedRounds.map((round) => {
          const vsPar = round.totalScore - 72 // Assuming 18 holes, par 72
          const vsPalColor = vsPar < 0 ? 'text-green-600 font-bold' : vsPar > 0 ? 'text-red-600 font-bold' : 'text-gray-600 font-semibold'
          const vsPalDisplay = vsPar > 0 ? `+${vsPar}` : `${vsPar}`

          return (
            <div
              key={round.id}
              onClick={() => router.push(`/round-detail?id=${round.id}`)}
              className="bg-white/95 backdrop-blur rounded-2xl p-5 shadow-md border border-white/20 cursor-pointer transition-all active:scale-95 active:shadow-lg"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0">
                <div className="flex flex-row items-center gap-3 flex-1 min-w-0">
                  <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(round.date).toISOString().slice(0, 10)}</span>
                  <span className="text-xs text-gray-400">|</span>
                  {getDisplayCourseName(round) && (
                    <span className="font-semibold text-gray-800 truncate text-sm md:text-base max-w-[120px] sm:max-w-[200px]">{getDisplayCourseName(round)}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 ml-0 sm:ml-4">
                  <div className="text-right">
                    <span className="text-2xl font-bold text-gray-800">{round.totalScore}</span>
                    <span className={`text-xs ml-2 ${vsPalColor}`}>{vsPalDisplay}</span>
                  </div>
                  <div className="text-2xl text-gray-400">→</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Round } from '@/types'
import { useAuth } from '@/lib/useAuth'
import CommentsModal from '@/components/CommentsModal'


interface ScoreHistoryProps {
  rounds: Round[];
  onDelete?: (roundId: string) => void;
  readOnly?: boolean;
  userId?: string; // ID of the player whose rounds are being shown
  sectionTitle?: string;
}

export default function ScoreHistory({ rounds, onDelete, readOnly = false, userId, sectionTitle }: ScoreHistoryProps) {
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

  // Sort by date descending (most recent first)
  const sortedRounds = [...rounds].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // State for comments modal
  const [openCommentsModal, setOpenCommentsModal] = useState<string | null>(null)
  const [commentCounts, setCommentCounts] = useState<{ [key: string]: number }>({})
  const fetchedRoundsRef = useRef<Set<string>>(new Set())

  // Fetch comment counts once per round (prevent duplicate API calls)
  useEffect(() => {
    const fetchCounts = async () => {
      const newCounts: { [key: string]: number } = { ...commentCounts }
      let hasNewData = false
      
      for (const round of sortedRounds) {
        // Skip if already fetched
        if (fetchedRoundsRef.current.has(round.id)) {
          continue
        }
        
        try {
          const res = await fetch('/api/get-comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roundId: round.id }),
          })
          const data = await res.json()
          newCounts[round.id] = data.comments?.length || 0
          fetchedRoundsRef.current.add(round.id)
          hasNewData = true
        } catch (error) {
          console.error('Failed to fetch counts:', error)
        }
      }
      
      if (hasNewData) {
        setCommentCounts(newCounts)
      }
    }
    
    if (sortedRounds.length > 0) {
      fetchCounts()
    }
  }, [rounds.length])

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
      <h2 className="text-xl font-bold mb-4 text-gray-800">{sectionTitle || 'Saved Rounds'}</h2>
      <div className="space-y-3">
        {sortedRounds.map((round) => {
          // Multi-child support: if courseId is comma-separated, show all child names under parent
          let parentName = '';
          let childNames: string[] = [];
          if (courses && courses.length && round.courseId) {
            const courseIds = round.courseId.split(',');
            let childCourses = courses.filter((c: any) => courseIds.includes(c.id));
            if (childCourses.length > 0) {
              // Sort so that 'Front 9' comes before 'Back 9' if both are present
              childCourses = childCourses.sort((a: any, b: any) => {
                const aIsFront = /front/i.test(a.name);
                const bIsFront = /front/i.test(b.name);
                const aIsBack = /back/i.test(a.name);
                const bIsBack = /back/i.test(b.name);
                if (aIsFront && !bIsFront) return -1;
                if (!aIsFront && bIsFront) return 1;
                if (aIsBack && !bIsBack) return 1;
                if (!aIsBack && bIsBack) return -1;
                return a.name.localeCompare(b.name);
              });
              // Assume all children have same parent
              const parentId = childCourses[0].parent_id;
              if (parentId) {
                const parent = courses.find((c: any) => c.id === parentId);
                if (parent) parentName = parent.name;
              }
              childNames = childCourses.map((c: any) => c.name);
            } else {
              // fallback: single course logic
              const course = courses.find((c: any) => c.id === round.courseId);
              if (course && course.parent_id) {
                const parent = courses.find((c: any) => c.id === course.parent_id);
                if (parent) parentName = parent.name;
                childNames = [course.name];
              } else if (course) {
                childNames = [course.name];
              }
            }
          } else if (round.courseName) {
            childNames = [round.courseName];
          }
          const dateStr = round.date ? new Date(round.date).toLocaleDateString() : '';
          return (
            <div
              key={round.id}
              onClick={() => router.push(`/round-detail?id=${round.id}`)}
              className="bg-white/95 backdrop-blur rounded-xl p-4 shadow border border-white/20 cursor-pointer transition-all active:scale-95 active:shadow-lg relative flex flex-row items-center justify-between"
            >
              {/* Comments Button */}
              <div className="absolute -top-5 -left-5 flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenCommentsModal(round.id);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-2 py-1 rounded hover:bg-blue-100 text-blue-500 transition-all active:scale-95 text-sm font-bold"
                  title="Comment"
                >
                  <span className="text-lg">💬</span>
                  {commentCounts[round.id] > 0 && (
                    <span className="px-2 py-0.5 bg-blue-200 text-blue-700 text-xs font-bold rounded-full">{commentCounts[round.id]}</span>
                  )}
                </button>
              </div>
              {/* Date in top right */}
              <span className="absolute top-2 right-2 text-xs text-gray-500">{dateStr}</span>
              {/* Left: Parent and Child course names */}
              <div className="flex flex-col items-start">
                {parentName && (
                  <span className="font-semibold text-gray-800 text-sm md:text-base leading-tight">{parentName}</span>
                )}
                {childNames.map((name, idx) => (
                  <span key={idx} className="text-xs text-gray-600 mt-0.5">{name}</span>
                ))}
                {round.selectedTee && (
                  <span className="text-xs text-gray-500 mt-2 font-semibold">{round.selectedTee.charAt(0).toUpperCase() + round.selectedTee.slice(1)}'s</span>
                )}
              </div>
              {/* Right: Total Score */}
              <div className="flex flex-col items-end ml-auto">
                <span className="text-2xl font-bold text-gray-800">{round.totalScore}</span>
              </div>
              <div className="text-2xl text-gray-400 ml-2">→</div>
            </div>
          );
        })}
      </div>

      {/* Comments Modal */}
      {openCommentsModal && currentUser && (
        <CommentsModal
          roundId={openCommentsModal}
          userId={currentUser.id}
          userName={currentUser.name || 'Anonymous'}
          onClose={() => setOpenCommentsModal(null)}
          onCommentAdded={() => {
            // Refresh comment counts for this round
            const fetchUpdatedCounts = async () => {
              const res = await fetch('/api/get-comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roundId: openCommentsModal }),
              })
              const data = await res.json()
              const newCounts = { ...commentCounts }
              newCounts[openCommentsModal] = data.comments?.length || 0
              
              setCommentCounts(newCounts)
            }
            fetchUpdatedCounts()
          }}
        />
      )}
    </div>
  );
}

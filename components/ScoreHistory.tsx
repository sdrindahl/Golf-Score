'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Round } from '@/types'
import { useAuth } from '@/lib/useAuth'


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
            const childCourses = courses.filter((c: any) => courseIds.includes(c.id));
            if (childCourses.length > 0) {
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
              {/* Date in top right */}
              <span className="absolute top-2 right-4 text-xs text-gray-500">{dateStr}</span>
              {/* Left: Parent and Child course names */}
              <div className="flex flex-col items-start">
                {parentName && (
                  <span className="font-semibold text-gray-800 text-sm md:text-base leading-tight">{parentName}</span>
                )}
                {childNames.map((name, idx) => (
                  <span key={idx} className="text-xs text-gray-600 mt-0.5">{name}</span>
                ))}
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
    </div>
  );
}

'use client'

import { useRouter } from 'next/navigation'
import { Round } from '@/types'
import { deleteRoundFromSupabase } from '@/lib/dataSync'
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

  const handleDelete = (roundId: string) => {
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
      
      // Also delete from Supabase
      deleteRoundFromSupabase(roundId)
    }
  }

  if (rounds.length === 0) {
    return null
  }

  const sortedRounds = [...rounds].reverse()

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
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">{new Date(round.date).toISOString().slice(0, 10)}</p>
                  <p className="font-semibold text-gray-800 truncate text-sm md:text-base">{round.courseName}</p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-800">{round.totalScore}</p>
                    <p className={`text-xs ${vsPalColor}`}>{vsPalDisplay}</p>
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

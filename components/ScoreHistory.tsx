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
    <div className="bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg border border-white/20">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Rounds</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-base">
          <thead className="border-b-2 border-gray-200">
            <tr>
              <th className="text-left p-1 md:p-3 text-xs md:text-sm font-bold text-gray-700">Date</th>
              <th className="text-left p-1 md:p-3 text-xs md:text-sm font-bold text-gray-700">Course</th>
              <th className="text-center p-1 md:p-3 text-xs md:text-sm font-bold text-gray-700">Score</th>
              <th className="text-center p-1 md:p-3 text-xs md:text-sm hidden sm:table-cell font-bold text-gray-700">vs Par</th>
            </tr>
          </thead>
          <tbody>
            {sortedRounds.map((round) => {
              const vsPar = round.totalScore - 72 // Assuming 18 holes, par 72
              const vsPalColor = vsPar < 0 ? 'text-green-600' : vsPar > 0 ? 'text-red-600' : 'text-gray-600'
              const vsPalDisplay = vsPar > 0 ? `+${vsPar}` : `${vsPar}`

              return (
                <tr 
                  key={round.id}
                  onClick={() => router.push(`/round-detail?id=${round.id}`)}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="p-1 md:p-3 text-xs md:text-sm text-gray-800">{new Date(round.date).toLocaleDateString()}</td>
                  <td className="p-1 md:p-3 text-xs md:text-sm max-w-24 md:max-w-none truncate text-gray-800">{round.courseName}</td>
                  <td className="text-center font-bold p-1 md:p-3 text-xs md:text-sm text-gray-800">{round.totalScore}</td>
                  <td className={`text-center font-bold p-1 md:p-3 text-xs md:text-sm hidden sm:table-cell ${vsPalColor}`}>
                    {vsPalDisplay}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
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
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Recent Rounds</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs md:text-base">
          <thead className="table-header">
            <tr>
              <th className="text-left p-1 md:p-3 text-xs md:text-sm">Date</th>
              <th className="text-left p-1 md:p-3 text-xs md:text-sm">Course</th>
              <th className="text-center p-1 md:p-3 text-xs md:text-sm">Score</th>
              <th className="text-center p-1 md:p-3 text-xs md:text-sm hidden sm:table-cell">vs Par</th>
              {!readOnly && <th className="text-center p-1 md:p-3 text-xs md:text-sm">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedRounds.map((round) => {
              const vsPar = round.totalScore - 72 // Assuming 18 holes, par 72
              const vsPalColor = vsPar < 0 ? 'text-green-600' : vsPar > 0 ? 'text-red-600' : 'text-gray-600'
              const vsPalDisplay = vsPar > 0 ? `+${vsPar}` : `${vsPar}`

              return (
                <tr key={round.id} className="table-row border-b">
                  <td className="p-1 md:p-3 text-xs md:text-sm">{new Date(round.date).toLocaleDateString()}</td>
                  <td className="p-1 md:p-3 text-xs md:text-sm max-w-24 md:max-w-none truncate">{round.courseName}</td>
                  <td className="text-center font-bold p-1 md:p-3 text-xs md:text-sm">{round.totalScore}</td>
                  <td className={`text-center font-bold p-1 md:p-3 text-xs md:text-sm hidden sm:table-cell ${vsPalColor}`}>
                    {vsPalDisplay}
                  </td>
                  {!readOnly ? (
                    <td className="text-center p-1 md:p-3 text-xs md:text-sm">
                      <div className="flex flex-col sm:flex-row gap-0.5 md:gap-2 justify-center">
                        <Link href={`/round-detail?id=${round.id}`} className="inline-block">
                          <button className="text-green-600 hover:text-green-800 font-semibold text-xs">
                            View
                          </button>
                        </Link>
                        {canEditRound(round.userId) && (
                          <Link href={`/edit-round?id=${round.id}`} className="inline-block">
                            <button className="text-blue-600 hover:text-blue-800 font-semibold text-xs">
                              Edit
                            </button>
                          </Link>
                        )}
                        {canEditRound(round.userId) && (
                          <button
                            onClick={() => handleDelete(round.id)}
                            className="text-red-600 hover:text-red-800 font-semibold text-xs"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  ) : (
                    <td className="text-center p-1 md:p-3 text-xs md:text-sm">
                      <Link href={`/round-detail?id=${round.id}`} className="inline-block">
                        <button className="text-green-600 hover:text-green-800 font-semibold text-xs">
                          View Card
                        </button>
                      </Link>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

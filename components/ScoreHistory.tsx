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
    if (!currentUser) return false
    if (currentUser.is_admin) return true // Admins can edit any round
    if (!readOnly && currentUser.id === roundUserId) return true // Users can edit their own rounds
    return false
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
        <table className="w-full text-sm md:text-base">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2 md:p-3">Date</th>
              <th className="text-left p-2 md:p-3">Course</th>
              <th className="text-center p-2 md:p-3">Score</th>
              <th className="text-center p-2 md:p-3">vs Par</th>
              {!readOnly && <th className="text-center p-2 md:p-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedRounds.map((round) => {
              const vsPar = round.totalScore - 72 // Assuming 18 holes, par 72
              const vsPalColor = vsPar < 0 ? 'text-green-600' : vsPar > 0 ? 'text-red-600' : 'text-gray-600'
              const vsPalDisplay = vsPar > 0 ? `+${vsPar}` : `${vsPar}`

              return (
                <tr key={round.id} className="border-b hover:bg-gray-50">
                  <td className="p-2 md:p-3">{new Date(round.date).toLocaleDateString()}</td>
                  <td className="p-2 md:p-3 max-w-xs truncate md:max-w-none">{round.courseName}</td>
                  <td className="text-center font-bold p-2 md:p-3">{round.totalScore}</td>
                  <td className={`text-center font-bold p-2 md:p-3 ${vsPalColor}`}>
                    {vsPalDisplay}
                  </td>
                  {!readOnly ? (
                    <td className="text-center p-2 md:p-3">
                      <div className="flex gap-1 md:gap-2 justify-center flex-wrap">
                        <Link href={`/round-detail?id=${round.id}`} className="inline-block">
                          <button className="text-green-600 hover:text-green-800 font-semibold text-xs md:text-sm">
                            View
                          </button>
                        </Link>
                        {canEditRound(round.userId) && (
                          <Link href={`/edit-round?id=${round.id}`} className="inline-block">
                            <button className="text-blue-600 hover:text-blue-800 font-semibold text-xs md:text-sm">
                              Edit
                            </button>
                          </Link>
                        )}
                        {canEditRound(round.userId) && (
                          <button
                            onClick={() => handleDelete(round.id)}
                            className="text-red-600 hover:text-red-800 font-semibold text-xs md:text-sm"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  ) : (
                    <td className="text-center p-2 md:p-3">
                      <Link href={`/round-detail?id=${round.id}`} className="inline-block">
                        <button className="text-green-600 hover:text-green-800 font-semibold text-xs md:text-sm">
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

'use client'

import Link from 'next/link'
import { Round } from '@/types'

interface ScoreHistoryProps {
  rounds: Round[]
  onDelete?: (roundId: string) => void
  readOnly?: boolean
}

export default function ScoreHistory({ rounds, onDelete, readOnly = false }: ScoreHistoryProps) {
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
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Course</th>
              <th className="text-center p-2">Score</th>
              <th className="text-center p-2">vs Par</th>
              {!readOnly && <th className="text-center p-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sortedRounds.map((round) => {
              const vsPar = round.totalScore - 72 // Assuming 18 holes, par 72
              const vsPalColor = vsPar < 0 ? 'text-green-600' : vsPar > 0 ? 'text-red-600' : 'text-gray-600'
              const vsPalDisplay = vsPar > 0 ? `+${vsPar}` : `${vsPar}`

              return (
                <tr key={round.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">{new Date(round.date).toLocaleDateString()}</td>
                  <td className="p-2">{round.courseName}</td>
                  <td className="text-center font-bold p-2">{round.totalScore}</td>
                  <td className={`text-center font-bold p-2 ${vsPalColor}`}>
                    {vsPalDisplay}
                  </td>
                  {!readOnly && (
                    <td className="text-center p-2 space-x-2">
                      <Link href={`/edit-round?id=${round.id}`} className="inline-block">
                        <button className="text-blue-600 hover:text-blue-800 font-semibold text-sm">
                          Edit
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(round.id)}
                        className="text-red-600 hover:text-red-800 font-semibold text-sm"
                      >
                        Delete
                      </button>
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

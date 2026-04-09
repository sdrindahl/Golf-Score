'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ScoreHistory from '@/components/ScoreHistory'
import HandicapDisplay from '@/components/HandicapDisplay'
import { Round } from '@/types'

export default function Home() {
  const [rounds, setRounds] = useState<Round[]>([])

  useEffect(() => {
    // Load rounds from localStorage
    const savedRounds = localStorage.getItem('golfRounds')
    if (savedRounds) {
      setRounds(JSON.parse(savedRounds))
    }
  }, [])

  const calculateHandicap = (): number => {
    if (rounds.length === 0) return 0
    
    // Simple handicap calculation: average of last 8 rounds minus best score
    const recentRounds = rounds.slice(-8)
    const avgScore = recentRounds.reduce((sum, r) => sum + r.totalScore, 0) / recentRounds.length
    const bestScore = Math.min(...recentRounds.map(r => r.totalScore))
    
    return Math.round((avgScore - bestScore) * 10) / 10
  }

  const handleDeleteRound = (roundId: string) => {
    const updated = rounds.filter(r => r.id !== roundId)
    setRounds(updated)
    localStorage.setItem('golfRounds', JSON.stringify(updated))
  }

  const handicap = calculateHandicap()

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
      <div className="md:col-span-2">
        <div className="card mb-6">
          <h2 className="text-2xl font-bold mb-4">Welcome to Golf Score Tracker</h2>
          <p className="text-gray-600 mb-6">
            Track your rounds, calculate your handicap, and improve your game.
          </p>
          <div className="flex gap-4 flex-wrap">
            <Link href="/add-course">
              <button className="btn-primary">
                ➕ Add Course
              </button>
            </Link>
            <Link href="/manage-courses">
              <button className="btn-secondary">
                📋 My Courses
              </button>
            </Link>
            <Link href="/new-round">
              <button className="btn-secondary">
                🎯 Record Round
              </button>
            </Link>
          </div>
        </div>

        <ScoreHistory rounds={rounds} onDelete={handleDeleteRound} />
      </div>

      <div>
        <HandicapDisplay handicap={handicap} totalRounds={rounds.length} />
        
        <div className="card mt-6">
          <h3 className="text-lg font-bold mb-4">Statistics</h3>
          {rounds.length > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Best Score:</span>
                <span className="font-bold">{Math.min(...rounds.map(r => r.totalScore))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Worst Score:</span>
                <span className="font-bold">{Math.max(...rounds.map(r => r.totalScore))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Average Score:</span>
                <span className="font-bold">
                  {(rounds.reduce((sum, r) => sum + r.totalScore, 0) / rounds.length).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Rounds:</span>
                <span className="font-bold">{rounds.length}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No rounds recorded yet. Start by recording your first round!</p>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Event, EventTeam, EventTeamPlayerScore, User } from '@/types'
import { useAuth } from '@/lib/useAuth'

type PlayerScoreState = Record<string, { scores: number[]; inProgress: boolean }>

function calculateTotal(scores: number[]) {
  return scores.reduce((sum, score) => sum + (Number(score) > 0 ? Number(score) : 0), 0)
}

function calculateLowBall(scores: number[][], holeCount: number) {
  return Array.from({ length: holeCount }, (_, holeIndex) => {
    const holeScores = scores.map((playerScores) => Number(playerScores[holeIndex] || 0)).filter((score) => score > 0)
    return holeScores.length > 0 ? Math.min(...holeScores) : 0
  })
}

export default function BestBallScoringPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const auth = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [teams, setTeams] = useState<EventTeam[]>([])
  const [playerScores, setPlayerScores] = useState<PlayerScoreState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const user = auth.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }

    setCurrentUser((previous) => {
      if (previous?.id === user.id && previous?.name === user.name) {
        return previous
      }

      return user
    })
  }, [router])

  useEffect(() => {
    if (!currentUser || !params?.id) {
      return
    }

    const loadBestBall = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/events/${params.id}/best-ball?userId=${encodeURIComponent(currentUser.id)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load Best Ball scoring.')
        }

        const scoreState = (data.playerScores || []).reduce((accumulator: PlayerScoreState, playerScore: EventTeamPlayerScore) => {
          accumulator[`${playerScore.team_id}:${playerScore.user_id}`] = {
            scores: Array.isArray(playerScore.scores) ? playerScore.scores : [],
            inProgress: playerScore.in_progress !== false,
          }
          return accumulator
        }, {})

        setEvent(data.event)
        setTeams(data.teams || [])
        setPlayerScores(scoreState)
      } catch (err: any) {
        setError(err.message || 'Failed to load Best Ball scoring.')
      } finally {
        setLoading(false)
      }
    }

    loadBestBall()
  }, [currentUser, params?.id])

  const holeCount = event?.hole_count || 18

  function getPlayerState(teamId: string, userId: string) {
    return playerScores[`${teamId}:${userId}`] || { scores: Array(holeCount).fill(0), inProgress: true }
  }

  function updatePlayerScore(teamId: string, userId: string, holeIndex: number, value: string) {
    const numericValue = Number(value)
    setPlayerScores((previous) => {
      const currentState = previous[`${teamId}:${userId}`] || { scores: Array(holeCount).fill(0), inProgress: true }
      const nextScores = currentState.scores.map((score, index) => (
        index === holeIndex ? (Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0) : score
      ))

      return {
        ...previous,
        [`${teamId}:${userId}`]: {
          ...currentState,
          scores: nextScores,
        },
      }
    })
  }

  function setPlayerFinished(teamId: string, userId: string, isFinished: boolean) {
    setPlayerScores((previous) => {
      const currentState = previous[`${teamId}:${userId}`] || { scores: Array(holeCount).fill(0), inProgress: true }

      return {
        ...previous,
        [`${teamId}:${userId}`]: {
          ...currentState,
          inProgress: !isFinished,
        },
      }
    })
  }

  async function handleSaveScores() {
    if (!currentUser || !params?.id) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/events/${params.id}/best-ball`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser.id,
          players: teams.flatMap((team) => (team.members || []).map((member) => {
            const playerState = getPlayerState(team.id, member.user_id)
            return {
              teamId: team.id,
              userId: member.user_id,
              scores: playerState.scores,
              inProgress: playerState.inProgress,
            }
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save Best Ball scoring.')
      }

      setSuccess('Best Ball scores saved.')
    } catch (err: any) {
      setError(err.message || 'Failed to save Best Ball scoring.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#06110d] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/events/${params.id}`} className="text-sm font-semibold text-lime-300 hover:text-lime-200">← Back to Event</Link>
            <h1 className="mt-3 text-3xl font-bold text-white">{event?.name || 'Best Ball'} Scoring</h1>
            <p className="mt-2 text-sm text-white/65">Enter each player score by hole. The team total is automatically derived from the lowest score on each hole.</p>
          </div>
          <button
            type="button"
            onClick={handleSaveScores}
            disabled={saving || loading}
            className="rounded-full bg-lime-400 px-5 py-3 text-sm font-bold text-[#07150f] hover:bg-lime-300 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Scores'}
          </button>
        </div>

        {error && <div className="rounded-2xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        {success && <div className="rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-700">{success}</div>}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-white/70">Loading Best Ball teams...</div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div>
                <h2 className="text-lg font-bold text-white">Team Low-Ball Summary</h2>
                <p className="mt-1 text-sm text-white/60">Each team card shows the current low-ball total derived from player scores.</p>
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {teams.map((team) => {
                  const memberScoreRows = (team.members || []).map((member) => getPlayerState(team.id, member.user_id).scores)
                  const lowBall = calculateLowBall(memberScoreRows, holeCount)
                  const lowBallTotal = calculateTotal(lowBall)
                  const thru = lowBall.filter((score) => score > 0).length

                  return (
                    <div key={team.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-white">{team.name}</div>
                          <div className="mt-1 text-xs text-white/50">{(team.members || []).map((member) => member.user_name || 'Unknown Player').join(' • ')}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-lime-300">{lowBallTotal}</div>
                          <div className="text-xs uppercase tracking-[0.14em] text-white/45">Thru {thru || '-'}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <div className="space-y-4">
              {teams.map((team) => (
                <section key={team.id} className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] p-5 shadow-2xl">
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-white">{team.name}</h2>
                    <div className="mt-2 text-sm text-white/60">Every player finishes the hole; the low ball becomes the team score.</div>
                  </div>
                  <div className="space-y-4">
                    {(team.members || []).map((member) => {
                      const stateKey = `${team.id}:${member.user_id}`
                      const scoreState = getPlayerState(team.id, member.user_id)
                      const totalScore = calculateTotal(scoreState.scores)
                      const thru = scoreState.scores.filter((score) => score > 0).length

                      return (
                        <div key={stateKey} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-lg font-bold text-white">{member.user_name}</div>
                              <div className="mt-1 text-xs text-white/45">Individual player card</div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-lime-300">{totalScore}</div>
                              <div className="text-xs uppercase tracking-[0.14em] text-white/45">Thru {scoreState.inProgress ? thru : 'F'}</div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 xl:grid-cols-9">
                            {scoreState.scores.map((score, holeIndex) => (
                              <label key={`${stateKey}-${holeIndex}`} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-center">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">Hole {holeIndex + 1}</div>
                                <input
                                  type="number"
                                  min="0"
                                  value={score}
                                  onChange={(event) => updatePlayerScore(team.id, member.user_id, holeIndex, event.target.value)}
                                  className="mt-3 w-full rounded-xl border border-white/10 bg-[#08130f] px-2 py-2 text-center text-lg font-bold text-white outline-none"
                                />
                              </label>
                            ))}
                          </div>

                          <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-black/15 px-4 py-3 text-sm text-white/75">
                            <input
                              type="checkbox"
                              checked={!scoreState.inProgress}
                              onChange={(event) => setPlayerFinished(team.id, member.user_id, event.target.checked)}
                              className="h-4 w-4 accent-lime-500"
                            />
                            Mark player as finished
                          </label>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

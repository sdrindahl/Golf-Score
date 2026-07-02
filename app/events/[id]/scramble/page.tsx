'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Event, EventTeam, EventTeamScore, User } from '@/types'
import { useAuth } from '@/lib/useAuth'

type TeamScoreState = Record<string, { scores: number[]; inProgress: boolean }>

export default function ScrambleScoringPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const auth = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [teams, setTeams] = useState<EventTeam[]>([])
  const [teamScores, setTeamScores] = useState<TeamScoreState>({})
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
  }, [auth, router])

  useEffect(() => {
    if (!currentUser || !params?.id) {
      return
    }

    const loadScramble = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/events/${params.id}/scramble?userId=${encodeURIComponent(currentUser.id)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load scramble scoring.')
        }

        const scoreState = (data.scores || []).reduce((accumulator: TeamScoreState, teamScore: EventTeamScore) => {
          accumulator[teamScore.team_id] = {
            scores: Array.isArray(teamScore.scores) ? teamScore.scores : [],
            inProgress: teamScore.in_progress !== false,
          }
          return accumulator
        }, {})

        setEvent(data.event)
        setTeams(data.teams || [])
        setTeamScores(scoreState)
      } catch (err: any) {
        setError(err.message || 'Failed to load scramble scoring.')
      } finally {
        setLoading(false)
      }
    }

    loadScramble()
  }, [currentUser, params?.id])

  function updateTeamScore(teamId: string, holeIndex: number, value: string) {
    const numericValue = Number(value)
    setTeamScores((previous) => ({
      ...previous,
      [teamId]: {
        ...previous[teamId],
        scores: previous[teamId].scores.map((score, index) => index === holeIndex ? (Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0) : score),
      },
    }))
  }

  function setTeamFinished(teamId: string, isFinished: boolean) {
    setTeamScores((previous) => ({
      ...previous,
      [teamId]: {
        ...previous[teamId],
        inProgress: !isFinished,
      },
    }))
  }

  async function handleSaveScores() {
    if (!currentUser || !params?.id) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/events/${params.id}/scramble`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser.id,
          teams: teams.map((team) => ({
            teamId: team.id,
            scores: teamScores[team.id]?.scores || [],
            inProgress: teamScores[team.id]?.inProgress ?? true,
          })),
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save scramble scoring.')
      }

      setSuccess('Scramble scores saved.')
    } catch (err: any) {
      setError(err.message || 'Failed to save scramble scoring.')
    } finally {
      setSaving(false)
    }
  }

  const holeCount = event?.hole_count || 18

  return (
    <div className="min-h-screen bg-[#06110d] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/events/${params.id}`} className="text-sm font-semibold text-lime-300 hover:text-lime-200">← Back to Event</Link>
            <h1 className="mt-3 text-3xl font-bold text-white">{event?.name || 'Scramble'} Scoring</h1>
            <p className="mt-2 text-sm text-white/65">Enter one official team score per hole. Individual shots are not tracked on the scramble card.</p>
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
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-white/70">Loading scramble teams...</div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {teams.map((team) => {
              const scoreState = teamScores[team.id] || { scores: Array(holeCount).fill(0), inProgress: true }
              const totalScore = scoreState.scores.reduce((total, score) => total + (Number(score) > 0 ? Number(score) : 0), 0)
              const thru = scoreState.scores.filter((score) => Number(score) > 0).length

              return (
                <section key={team.id} className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] p-5 shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-white">{team.name}</h2>
                      <div className="mt-2 text-sm text-white/60">{(team.members || []).map((member) => member.user_name || 'Unknown Player').join(' • ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-[0.16em] text-white/45">Total</div>
                      <div className="mt-1 text-3xl font-extrabold text-lime-300">{totalScore}</div>
                      <div className="mt-1 text-xs text-white/50">Thru {scoreState.inProgress ? thru : 'F'}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 xl:grid-cols-9">
                    {scoreState.scores.map((score, holeIndex) => (
                      <label key={`${team.id}-${holeIndex}`} className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-center">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">Hole {holeIndex + 1}</div>
                        <input
                          type="number"
                          min="0"
                          value={score}
                          onChange={(event) => updateTeamScore(team.id, holeIndex, event.target.value)}
                          className="mt-3 w-full rounded-xl border border-white/10 bg-[#08130f] px-2 py-2 text-center text-lg font-bold text-white outline-none"
                        />
                      </label>
                    ))}
                  </div>

                  <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/8 bg-black/15 px-4 py-3 text-sm text-white/75">
                    <input
                      type="checkbox"
                      checked={!scoreState.inProgress}
                      onChange={(event) => setTeamFinished(team.id, event.target.checked)}
                      className="h-4 w-4 accent-lime-500"
                    />
                    Mark team as finished
                  </label>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
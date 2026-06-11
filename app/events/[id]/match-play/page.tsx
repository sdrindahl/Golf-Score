'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Event, EventMatchPlayHoleResult, EventMatchPlayScore, EventTeam, User } from '@/types'
import { useAuth } from '@/lib/useAuth'

const MATCH_PLAY_OPTIONS: Array<{ value: EventMatchPlayHoleResult; label: string }> = [
  { value: '', label: 'Not Played' },
  { value: 'team1', label: 'Team 1 Wins' },
  { value: 'halved', label: 'Halved' },
  { value: 'team2', label: 'Team 2 Wins' },
]

function summarizeMatch(holeResults: EventMatchPlayHoleResult[], holeCount: number) {
  let lead = 0
  let playedHoles = 0

  for (const result of holeResults) {
    if (!result) continue
    playedHoles += 1
    if (result === 'team1') lead += 1
    if (result === 'team2') lead -= 1
  }

  const remaining = holeCount - playedHoles
  if (playedHoles === 0) return 'Not started'
  if (Math.abs(lead) > remaining && lead !== 0) return `${Math.abs(lead)} & ${remaining}`
  if (lead === 0) return playedHoles === holeCount ? 'Halved Match' : `All Square thru ${playedHoles}`
  return `${Math.abs(lead)} Up thru ${playedHoles}`
}

export default function MatchPlayScoringPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const auth = useAuth()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [teams, setTeams] = useState<EventTeam[]>([])
  const [holeResults, setHoleResults] = useState<EventMatchPlayHoleResult[]>([])
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

    const loadMatchPlay = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/events/${params.id}/match-play?userId=${encodeURIComponent(currentUser.id)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load Match Play scoring.')
        }

        setEvent(data.event)
        setTeams(data.teams || [])
        setHoleResults((data.matchPlayScore as EventMatchPlayScore)?.hole_results || [])
      } catch (err: any) {
        setError(err.message || 'Failed to load Match Play scoring.')
      } finally {
        setLoading(false)
      }
    }

    loadMatchPlay()
  }, [currentUser, params?.id])

  const holeCount = event?.hole_count || 18

  function updateHoleResult(holeIndex: number, value: EventMatchPlayHoleResult) {
    setHoleResults((previous) => Array.from({ length: holeCount }, (_, index) => index === holeIndex ? value : previous[index] || ''))
  }

  async function handleSave() {
    if (!currentUser || !params?.id) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(`/api/events/${params.id}/match-play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUserId: currentUser.id,
          holeResults,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save Match Play scoring.')
      }

      setSuccess('Match Play results saved.')
    } catch (err: any) {
      setError(err.message || 'Failed to save Match Play scoring.')
    } finally {
      setSaving(false)
    }
  }

  const matchState = summarizeMatch(holeResults, holeCount)

  return (
    <div className="min-h-screen bg-[#06110d] px-4 py-6 text-white sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href={`/events/${params.id}`} className="text-sm font-semibold text-lime-300 hover:text-lime-200">← Back to Event</Link>
            <h1 className="mt-3 text-3xl font-bold text-white">{event?.name || 'Match Play'} Results</h1>
            <p className="mt-2 text-sm text-white/65">Pick the winner of each hole. The match state updates automatically as the sides move up, down, or finish the match.</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-full bg-lime-400 px-5 py-3 text-sm font-bold text-[#07150f] hover:bg-lime-300 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Match'}
          </button>
        </div>

        {error && <div className="rounded-2xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        {success && <div className="rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-700">{success}</div>}

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-black/30 p-6 text-sm text-white/70">Loading Match Play...</div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm uppercase tracking-[0.16em] text-white/45">Current Match State</div>
                  <div className="mt-2 text-3xl font-bold text-lime-300">{matchState}</div>
                </div>
                <div className="text-sm text-white/60">
                  <div>{teams[0]?.name || 'Team 1'} vs {teams[1]?.name || 'Team 2'}</div>
                  <div className="mt-1">{(teams[0]?.members || []).map((member) => member.user_name).join(' • ')}</div>
                  <div className="mt-1">{(teams[1]?.members || []).map((member) => member.user_name).join(' • ')}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] p-5 shadow-2xl">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-white">Hole Results</h2>
                <div className="mt-2 text-sm text-white/60">Choose which side won each hole, or mark it halved.</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: holeCount }, (_, holeIndex) => (
                  <div key={holeIndex} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                    <div className="text-sm font-bold text-white">Hole {holeIndex + 1}</div>
                    <select
                      value={holeResults[holeIndex] || ''}
                      onChange={(event) => updateHoleResult(holeIndex, event.target.value as EventMatchPlayHoleResult)}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-[#08130f] px-3 py-3 text-sm text-white"
                    >
                      {MATCH_PLAY_OPTIONS.map((option) => (
                        <option key={`${holeIndex}-${option.value || 'blank'}`} value={option.value}>
                          {option.value === 'team1'
                            ? teams[0]?.name || option.label
                            : option.value === 'team2'
                              ? teams[1]?.name || option.label
                              : option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
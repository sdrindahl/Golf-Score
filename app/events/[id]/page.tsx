'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import PageWrapper from '@/components/PageWrapper'
import { useFeatureFlags } from '@/lib/featureFlagsContext'
import { useAuth } from '@/lib/useAuth'
import { Event, EventLeaderboardEntry, EventMember, User } from '@/types'

type TabKey = 'leaderboard' | 'players' | 'teams' | 'games' | 'info'

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const auth = useAuth()
  const { isEnabled, loading: flagsLoading } = useFeatureFlags()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [members, setMembers] = useState<EventMember[]>([])
  const [leaderboard, setLeaderboard] = useState<EventLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard')

  const eventsEnabled = isEnabled('events_core')
  const teamsEnabled = isEnabled('events_teams')
  const gamesEnabled = isEnabled('events_games')

  useEffect(() => {
    const user = auth.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }

    setCurrentUser(user)
  }, [auth, router])

  useEffect(() => {
    if (!currentUser || flagsLoading || !eventsEnabled || !params?.id) {
      setLoading(false)
      return
    }

    const loadEvent = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/events/${params.id}?userId=${encodeURIComponent(currentUser.id)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load event.')
        }

        setEvent(data.event)
        setMembers(data.members || [])
        setLeaderboard(data.leaderboard || [])
      } catch (err: any) {
        setError(err.message || 'Failed to load event.')
      } finally {
        setLoading(false)
      }
    }

    loadEvent()
  }, [currentUser, eventsEnabled, flagsLoading, params?.id])

  const tabs: Array<{ key: TabKey; label: string; enabled: boolean }> = [
    { key: 'leaderboard', label: 'Leaderboard', enabled: true },
    { key: 'players', label: 'Players', enabled: true },
    { key: 'teams', label: 'Teams', enabled: teamsEnabled },
    { key: 'games', label: 'Games', enabled: gamesEnabled },
    { key: 'info', label: 'Info', enabled: true },
  ]

  if (flagsLoading) {
    return (
      <PageWrapper title="Event">
        <div className="max-w-4xl mx-auto rounded-3xl border border-cyan-800 bg-black/70 p-8 text-center text-cyan-200">Loading feature access...</div>
      </PageWrapper>
    )
  }

  if (!eventsEnabled) {
    return (
      <PageWrapper title="Event">
        <div className="max-w-4xl mx-auto rounded-3xl border border-cyan-800 bg-black/70 p-8 text-center text-white">
          <h2 className="text-2xl font-bold text-cyan-300">Events are not enabled for this account</h2>
          <p className="mt-3 text-sm text-gray-300">The Event detail surface stays hidden until the `events_core` flag is enabled for you.</p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title={event?.name || 'Event'} userName={currentUser?.name}>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-100">← Back to Events</Link>

        {error && <div className="rounded-2xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

        <section className="rounded-[28px] border border-cyan-900 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.25),rgba(5,12,16,0.95)_48%)] p-6 text-white shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.25em] text-cyan-300">Event</div>
              <h1 className="mt-2 text-3xl font-bold">{event?.name || 'Loading...'}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-200">
                <span>{event?.course_name || 'Course TBD'}</span>
                <span>•</span>
                <span>{event?.event_date || 'Date TBD'}</span>
                <span>•</span>
                <span>{event?.hole_count || 18} Holes</span>
              </div>
            </div>
            <span className="rounded-full border border-cyan-700 px-4 py-2 text-xs uppercase tracking-wide text-cyan-100">{event?.status || 'draft'}</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/courses?eventId=${encodeURIComponent(params.id)}&eventName=${encodeURIComponent(event?.name || '')}`}
              className="inline-flex items-center rounded-full bg-cyan-400 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 transition-colors"
            >
              Start Event Round
            </Link>
            <div className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-xs text-gray-200">
              Choose a course, then the round will stay attached to this event.
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => tab.enabled && setActiveTab(tab.key)}
                disabled={!tab.enabled}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'bg-cyan-400 text-slate-950'
                    : tab.enabled
                      ? 'bg-white/5 text-white hover:bg-white/10'
                      : 'bg-white/5 text-white/40 cursor-not-allowed'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-cyan-900 bg-black/70 p-8 text-sm text-gray-300">Loading event details...</div>
        ) : null}

        {!loading && activeTab === 'leaderboard' && (
          <section className="rounded-3xl border border-cyan-900 bg-black/70 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Leaderboard</h2>
                <p className="text-sm text-gray-300 mt-1">Finished players stay on the same board so everyone remains visible.</p>
              </div>
            </div>
            {leaderboard.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-cyan-900 bg-slate-950/70 p-6 text-sm text-gray-300">No event rounds yet. Once rounds are linked to this event they will appear here.</div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                  <div key={entry.round_id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-2xl border border-cyan-950 bg-slate-950/70 px-4 py-3">
                    <div className="text-2xl font-bold text-cyan-300">{index + 1}</div>
                    <div>
                      <div className="font-bold text-white">{entry.user_name}</div>
                      <div className="text-xs text-gray-400 mt-1">{entry.status_label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">{entry.total_score}</div>
                      <div className="text-xs text-gray-400 mt-1">Thru {entry.thru || 'F'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!loading && activeTab === 'players' && (
          <section className="rounded-3xl border border-cyan-900 bg-black/70 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Players</h2>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={`${member.event_id}-${member.user_id}`} className="flex items-center justify-between rounded-2xl border border-cyan-950 bg-slate-950/70 px-4 py-3">
                  <div>
                    <div className="font-semibold text-white">{member.user_name}</div>
                    <div className="text-xs text-gray-400 mt-1">{member.user_id}</div>
                  </div>
                  <span className="rounded-full border border-cyan-700 px-3 py-1 text-[11px] uppercase tracking-wide text-cyan-200">{member.role}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && activeTab === 'info' && (
          <section className="rounded-3xl border border-cyan-900 bg-black/70 p-6 shadow-2xl text-sm text-gray-200">
            <h2 className="text-xl font-bold text-white mb-4">Info</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-cyan-950 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-wide text-cyan-300">Organizer</div>
                <div className="mt-2 font-semibold text-white">{members.find((member) => member.role === 'organizer')?.user_name || 'Unknown'}</div>
              </div>
              <div className="rounded-2xl border border-cyan-950 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-wide text-cyan-300">Enabled Features</div>
                <div className="mt-2 font-semibold text-white">{event?.enabled_features?.length ? event.enabled_features.join(', ') : 'Core leaderboard only'}</div>
              </div>
            </div>
          </section>
        )}

        {!loading && activeTab === 'teams' && (
          <section className="rounded-3xl border border-cyan-900 bg-black/70 p-6 shadow-2xl text-sm text-gray-200">
            Team setup is reserved behind the `events_teams` flag.
          </section>
        )}

        {!loading && activeTab === 'games' && (
          <section className="rounded-3xl border border-cyan-900 bg-black/70 p-6 shadow-2xl text-sm text-gray-200">
            Side games are reserved behind the `events_games` flag.
          </section>
        )}
      </div>
    </PageWrapper>
  )
}
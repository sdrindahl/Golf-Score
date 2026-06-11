'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useFeatureFlags } from '@/lib/featureFlagsContext'
import { useAuth } from '@/lib/useAuth'
import { Event, EventFormat, EventLeaderboardEntry, EventMember, EventTeam, EventWagerMode, User } from '@/types'

type TabKey = 'leaderboard' | 'players' | 'teams' | 'games' | 'info'

const EVENT_HERO_IMAGES = ['/hole1.png', '/hole3.png', '/hole4.png', '/hole5.png']

const FORMAT_LABELS: Record<EventFormat, string> = {
  scramble: 'Scramble',
  best_ball: 'Best Ball',
  match_play: 'Match Play',
}

const WAGER_MODE_LABELS: Record<EventWagerMode, string> = {
  per_hole: 'Per-Hole Wager',
  overall_match: 'Overall Match Stakes',
}

function getEventHeroImage(seed: string) {
  const total = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return EVENT_HERO_IMAGES[total % EVENT_HERO_IMAGES.length]
}

function getInitials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'G'
}

function getAvatarPalette(seed: string) {
  const palettes = [
    'from-lime-500 to-green-700',
    'from-cyan-500 to-blue-700',
    'from-amber-400 to-orange-600',
    'from-fuchsia-500 to-violet-700',
    'from-emerald-400 to-teal-700',
  ]
  const total = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palettes[total % palettes.length]
}

function formatScore(value: number) {
  if (value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

function formatTeamStrokeTotal(value: number) {
  return `${value}`
}

function formatMatchPlayState(entry: EventLeaderboardEntry) {
  return entry.match_state || entry.status_label || '--'
}

function getScoreChipClasses(value: number) {
  if (value < 0) return 'bg-red-600/90 text-white border-red-400/30'
  if (value > 0) return 'bg-lime-700/90 text-white border-lime-400/30'
  return 'bg-slate-600/90 text-white border-white/10'
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const auth = useAuth()
  const { isEnabled, loading: flagsLoading } = useFeatureFlags()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [members, setMembers] = useState<EventMember[]>([])
  const [teams, setTeams] = useState<EventTeam[]>([])
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

    setCurrentUser((previous) => {
      if (previous?.id === user.id && previous?.name === user.name) {
        return previous
      }

      return user
    })
  }, [router])

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
        setTeams(data.teams || [])
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
    { key: 'teams', label: 'Teams', enabled: teamsEnabled || event?.format === 'scramble' || event?.format === 'best_ball' || event?.format === 'match_play' },
    { key: 'games', label: 'Games', enabled: gamesEnabled },
    { key: 'info', label: 'Info', enabled: true },
  ]

  const heroImage = getEventHeroImage(event?.id || params.id)
  const isTeamStrokeFormat = event?.format === 'scramble' || event?.format === 'best_ball'
  const isMatchPlay = event?.format === 'match_play'
  const totalPlayers = members.length
  const roundsStarted = leaderboard.length
  const liveCount = leaderboard.filter((entry) => entry.in_progress).length
  const leadScore = leaderboard.length > 0 ? leaderboard[0].total_score : null
  const eventFormatLabel = event?.format ? FORMAT_LABELS[event.format] : 'Event Format Pending'
  const wagerModeLabel = event?.betting_config?.wager_mode ? WAGER_MODE_LABELS[event.betting_config.wager_mode] : 'No wager selected'
  const gamePills = [
    { id: 'scramble', title: 'Scramble', subtitle: 'Team Best Ball', enabled: true },
    { id: 'best-ball', title: 'Best Ball', subtitle: 'Individual', enabled: teamsEnabled },
    { id: 'skins', title: 'Skins', subtitle: 'Per Hole', enabled: gamesEnabled },
    { id: 'nassau', title: 'Nassau', subtitle: 'Front/Back', enabled: gamesEnabled },
    { id: 'match', title: 'Match Play', subtitle: 'Head to Head', enabled: gamesEnabled },
  ]

  if (flagsLoading) {
    return (
      <div className="min-h-screen bg-[#06110d] px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-cyan-800 bg-black/70 p-8 text-center text-cyan-200">Loading feature access...</div>
      </div>
    )
  }

  if (!eventsEnabled) {
    return (
      <div className="min-h-screen bg-[#06110d] px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-cyan-800 bg-black/70 p-8 text-center text-white">
          <h2 className="text-2xl font-bold text-cyan-300">Events are not enabled for this account</h2>
          <p className="mt-3 text-sm text-gray-300">The Event detail surface stays hidden until the `events_core` flag is enabled for you.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#06110d] text-white">
      <div className="mx-auto w-full max-w-[760px]">
        <section className="relative overflow-hidden border-b border-white/10 bg-[#08130f]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-50"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,9,7,0.35),rgba(4,15,11,0.72)_35%,rgba(4,12,9,0.96)_100%)]" />
          <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
            <div className="flex items-center justify-between">
              <Link href="/events" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white/90 hover:bg-black/35">
                <span className="text-xl">‹</span>
              </Link>
              <div className="flex items-center gap-2">
                <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white/90">↗</button>
                <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/20 text-white/90">⋯</button>
              </div>
            </div>

            <div className="pt-12 pb-4 text-center sm:pt-16">
              <h1 className="text-[22px] font-bold tracking-tight sm:text-[38px]">{event?.name || 'Event'} <span className="text-yellow-400">🏆</span></h1>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-white/85">
                <span>📍 {event?.course_name || 'Course TBD'}</span>
                <span>•</span>
                <span>📅 {event?.event_date || 'Date TBD'}</span>
                <span>•</span>
                <span>{event?.hole_count || 18} Holes</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 rounded-[22px] border border-white/10 bg-black/20 p-2 backdrop-blur-md sm:grid-cols-4">
              <div className="rounded-2xl bg-white/5 px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Players</div>
                <div className="mt-1 text-xl font-bold text-lime-300">{totalPlayers}</div>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Started</div>
                <div className="mt-1 text-xl font-bold text-white">{roundsStarted}</div>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Live</div>
                <div className="mt-1 text-xl font-bold text-lime-300">{liveCount}</div>
              </div>
              <div className="rounded-2xl bg-white/5 px-3 py-3 text-center">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/55">Lead</div>
                <div className="mt-1 text-xl font-bold text-white">{isMatchPlay ? (leaderboard[0] ? formatMatchPlayState(leaderboard[0]) : '--') : leadScore !== null ? (isTeamStrokeFormat ? formatTeamStrokeTotal(leadScore) : formatScore(leadScore)) : '--'}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 overflow-x-auto border-b border-white/10 pb-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => tab.enabled && setActiveTab(tab.key)}
                  disabled={!tab.enabled}
                  className={`relative whitespace-nowrap px-1 pb-3 pt-2 text-[13px] font-semibold uppercase tracking-[0.12em] transition ${
                    activeTab === tab.key
                      ? 'text-lime-300'
                      : tab.enabled
                        ? 'text-white/80 hover:text-white'
                        : 'text-white/30 cursor-not-allowed'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-lime-400" />}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="px-4 py-4 sm:px-6 sm:py-6">
          {error && <div className="mb-4 rounded-2xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            {event?.format === 'scramble' ? (
              <Link
                href={`/events/${params.id}/scramble`}
                className="inline-flex items-center rounded-full bg-lime-400 px-5 py-2.5 text-sm font-bold text-[#07150f] hover:bg-lime-300 transition-colors"
              >
                Enter Scramble Scores
              </Link>
            ) : event?.format === 'best_ball' ? (
              <Link
                href={`/events/${params.id}/best-ball`}
                className="inline-flex items-center rounded-full bg-lime-400 px-5 py-2.5 text-sm font-bold text-[#07150f] hover:bg-lime-300 transition-colors"
              >
                Enter Best Ball Scores
              </Link>
            ) : event?.format === 'match_play' ? (
              <Link
                href={`/events/${params.id}/match-play`}
                className="inline-flex items-center rounded-full bg-lime-400 px-5 py-2.5 text-sm font-bold text-[#07150f] hover:bg-lime-300 transition-colors"
              >
                Enter Match Play Results
              </Link>
            ) : (
              <Link
                href={`/courses?eventId=${encodeURIComponent(params.id)}&eventName=${encodeURIComponent(event?.name || '')}`}
                className="inline-flex items-center rounded-full bg-lime-400 px-5 py-2.5 text-sm font-bold text-[#07150f] hover:bg-lime-300 transition-colors"
              >
                Start Event Round
              </Link>
            )}
            <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/75">
              {event?.format === 'scramble'
                ? 'This event now uses team-first scramble scoring instead of individual rounds.'
                : event?.format === 'best_ball'
                  ? 'Enter player scores and the team low ball will be derived automatically.'
                  : event?.format === 'match_play'
                    ? 'Track the winner of each hole and the match state will update automatically.'
                : 'Choose a course and keep the round attached to this event.'}
            </div>
          </div>

          {loading ? (
            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.92),rgba(10,28,20,0.84))] p-8 text-sm text-gray-300">Loading event details...</div>
          ) : null}

          {!loading && activeTab === 'leaderboard' && (
            <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Leaderboard</h2>
                  <p className="mt-1 text-sm text-white/65">Track everyone in the event, including finished rounds.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/35 bg-lime-400/10 px-3 py-1 text-sm font-semibold text-lime-300">
                  <span className="text-base">◉</span>
                  Live
                </div>
              </div>

              {leaderboard.length === 0 ? (
                <div className="px-5 py-8 text-sm text-white/65">No event rounds yet. Once rounds are linked to this event they will appear here.</div>
              ) : (
                <>
                  <div className="grid grid-cols-[44px_minmax(0,1fr)_110px_56px] gap-3 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                    <div>Pos</div>
                    <div>{isTeamStrokeFormat || isMatchPlay ? 'Team' : 'Player'}</div>
                    <div className="text-center">{isMatchPlay ? 'State' : 'Score'}</div>
                    <div className="text-center">Thru</div>
                  </div>
                  <div>
                    {leaderboard.map((entry, index) => (
                      <div key={entry.round_id} className="grid grid-cols-[44px_minmax(0,1fr)_110px_56px] items-center gap-3 border-t border-white/8 px-5 py-4">
                        <div className="text-[28px] font-bold text-lime-300">{index + 1}</div>
                        <div className="min-w-0 flex items-center gap-3">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarPalette(entry.user_name)} text-sm font-bold text-white shadow-lg`}>
                            {getInitials(entry.user_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[16px] font-bold text-white">{entry.team_name || entry.user_name}</div>
                            <div className="mt-1 text-xs text-white/55">
                              {entry.entry_kind === 'team' && entry.member_names?.length
                                ? entry.member_names.join(' • ')
                                : entry.in_progress ? 'In Progress' : 'Finished'}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <span className={`min-w-[78px] rounded-xl border px-3 py-2 text-center text-[18px] font-bold ${getScoreChipClasses(entry.total_score)}`}>
                            {isMatchPlay ? formatMatchPlayState(entry) : isTeamStrokeFormat ? formatTeamStrokeTotal(entry.total_score) : formatScore(entry.total_score)}
                          </span>
                        </div>
                        <div className="text-center">
                          <div className="text-[22px] font-bold text-white">{entry.in_progress ? entry.thru : 'F'}</div>
                          <div className="mt-1 text-[11px] text-white/45">{entry.in_progress ? 'Live' : 'Done'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {!loading && activeTab === 'players' && (
            <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Players</h2>
                  <p className="mt-1 text-sm text-white/65">Everyone currently assigned to this event.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">{members.length} total</div>
              </div>
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={`${member.event_id}-${member.user_id}`} className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarPalette(member.user_name || member.user_id)} text-sm font-bold text-white`}>
                        {getInitials(member.user_name || member.user_id)}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{member.user_name}</div>
                        <div className="mt-1 text-xs text-white/45">{member.user_id}</div>
                      </div>
                    </div>
                    <span className="rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-lime-300">{member.role}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!loading && activeTab === 'teams' && (
            <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-white">Teams</h2>
              <p className="mt-2 text-sm text-white/65">
                {event?.format === 'best_ball'
                  ? 'Best Ball teams are persisted here so the low-ball leaderboard can be derived from each player card.'
                  : event?.format === 'match_play'
                    ? 'Match Play persists both sides so the hole-by-hole match state can be tracked on the event.'
                  : 'Scramble teams are now persisted on the event and shown here as the team-first competition view.'}
              </p>
              {teams.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-black/15 px-4 py-6 text-center text-sm text-white/45">No teams saved on this event yet.</div>
              ) : (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {teams.map((team, index) => (
                    <div key={team.id} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-white">{team.name}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/45">{event?.format === 'best_ball' ? 'Best Ball Team' : event?.format === 'match_play' ? 'Match Play Side' : 'Scramble Team'} {index + 1}</div>
                        </div>
                        <div className="rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-lime-300">
                          {team.members?.length || 0} Players
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {(team.members || []).map((member) => (
                          <div key={`${team.id}-${member.user_id}`} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarPalette(member.user_name || member.user_id)} text-sm font-bold text-white`}>
                              {getInitials(member.user_name || member.user_id)}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{member.user_name}</div>
                              <div className="mt-1 text-xs text-white/45">{member.user_id}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {!loading && activeTab === 'games' && (
            <div className="space-y-4">
              <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] p-4 shadow-2xl">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {gamePills.map((pill) => (
                    <button
                      key={pill.id}
                      className={`min-w-[118px] rounded-2xl border px-4 py-3 text-left transition ${pill.enabled ? 'border-lime-400/30 bg-lime-400/10 text-white' : 'border-white/10 bg-white/5 text-white/45'}`}
                    >
                      <div className="text-[15px] font-bold">{pill.title}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.12em]">{pill.subtitle}</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Skins Game</h2>
                    <p className="mt-1 text-sm text-white/65">Placeholder game module styled to match the tournament view.</p>
                  </div>
                  <button className="rounded-full border border-lime-400/35 px-4 py-2 text-sm font-semibold text-lime-300">View Holes</button>
                </div>
                <div className="px-5 py-5 text-sm text-white/75">
                  <div className="grid grid-cols-[repeat(9,minmax(0,1fr))] gap-2 text-center text-xs text-white/45 sm:grid-cols-[repeat(18,minmax(0,1fr))]">
                    {Array.from({ length: 18 }).map((_, index) => (
                      <div key={index} className="rounded-lg bg-black/20 px-1 py-2">
                        <div className="text-[10px] uppercase">{index + 1}</div>
                        <div className="mt-1 font-bold text-lime-300">{index % 5 === 0 ? '2' : index % 7 === 0 ? '3' : '–'}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/45">Leader</div>
                      <div className="mt-2 text-lg font-bold text-white">{leaderboard[0]?.user_name || 'Waiting for play'}</div>
                      <div className="mt-1 text-sm text-white/55">Projected skins winner</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/45">Status</div>
                      <div className="mt-2 text-lg font-bold text-white">{gamesEnabled ? 'Games Enabled' : 'Preview Mode'}</div>
                      <div className="mt-1 text-sm text-white/55">Turn on `events_games` to make this live later.</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {!loading && activeTab === 'info' && (
            <section className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,24,18,0.94),rgba(10,24,19,0.9))] p-5 shadow-2xl">
              <h2 className="text-lg font-bold text-white">Info</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-white/45">Organizer</div>
                  <div className="mt-2 text-lg font-bold text-white">{members.find((member) => member.role === 'organizer')?.user_name || 'Unknown'}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-white/45">Format</div>
                  <div className="mt-2 text-lg font-bold text-white">{eventFormatLabel}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-white/45">Date</div>
                  <div className="mt-2 text-lg font-bold text-white">{event?.event_date || 'TBD'}</div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-white/45">Wagering</div>
                  <div className="mt-2 text-lg font-bold text-white">{wagerModeLabel}</div>
                  <div className="mt-1 text-sm text-white/55">
                    {typeof event?.betting_config?.wager_value === 'number'
                      ? `${event.betting_config.currency === 'points' ? '' : '$'}${event.betting_config.wager_value}${event.betting_config.currency === 'points' ? ' pts' : ''}`
                      : 'No amount set'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-black/15 p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-white/45">Side Games</div>
                  <div className="mt-2 text-lg font-bold text-white">{event?.side_games?.length ? event.side_games.join(', ') : 'None'}</div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
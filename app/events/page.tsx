'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageWrapper from '@/components/PageWrapper'
import { useFeatureFlags } from '@/lib/featureFlagsContext'
import { useAuth } from '@/lib/useAuth'
import { Event, EventBettingConfig, EventFormat, EventSideGame, EventSkinsTiebreaker, EventWagerMode, User } from '@/types'

const FORMAT_OPTIONS: Array<{ key: EventFormat; label: string; subtitle: string }> = [
  { key: 'scramble', label: 'Scramble', subtitle: 'One team score per hole' },
  { key: 'best_ball', label: 'Best Ball', subtitle: 'Count the low ball' },
  { key: 'match_play', label: 'Match Play', subtitle: 'Track holes won' },
]

const WAGER_MODE_OPTIONS: Array<{ key: EventWagerMode; label: string }> = [
  { key: 'per_hole', label: 'Per-Hole Wager' },
  { key: 'overall_match', label: 'Overall Match Stakes' },
]

const SKINS_TIEBREAKER_OPTIONS: Array<{ key: EventSkinsTiebreaker; label: string }> = [
  { key: 'carry_over_or_split', label: 'Carry Over / Split' },
  { key: 'chip_or_putt', label: 'Chip or Putt Winner' },
]

const FORMAT_LABELS: Record<EventFormat, string> = {
  scramble: 'Scramble',
  best_ball: 'Best Ball',
  match_play: 'Match Play',
}

const TEAM_FORMATS: EventFormat[] = ['scramble', 'best_ball']

type EventSetupState = {
  name: string
  format: EventFormat
  courseName: string
  eventDate: string
  holeCount: number
  selectedMemberIds: string[]
  scrambleTeamCount: number
  scrambleAssignments: Record<string, string>
  sideGames: EventSideGame[]
  bettingConfig: EventBettingConfig
}

function buildTeamKey(index: number) {
  return `team-${index + 1}`
}

function getConfiguredTeams(setup: EventSetupState) {
  return Array.from({ length: setup.scrambleTeamCount }, (_, index) => {
    const teamId = buildTeamKey(index)
    return {
      id: teamId,
      name: `Team ${index + 1}`,
      memberIds: setup.selectedMemberIds.filter((memberId) => setup.scrambleAssignments[memberId] === teamId),
    }
  })
}

function assignMembersRoundRobin(memberIds: string[], teamCount: number) {
  return memberIds.reduce<Record<string, string>>((assignments, memberId, index) => {
    assignments[memberId] = buildTeamKey(index % teamCount)
    return assignments
  }, {})
}

function createInitialEventSetup(): EventSetupState {
  return {
    name: '',
    format: 'scramble',
    courseName: '',
    eventDate: '',
    holeCount: 18,
    selectedMemberIds: [],
    scrambleTeamCount: 2,
    scrambleAssignments: {},
    sideGames: [],
    bettingConfig: {
      currency: 'usd',
      wager_mode: 'per_hole',
      wager_value: 5,
      skin_value: 5,
      skins_tiebreaker: 'chip_or_putt',
      skins_validation_required: false,
    },
  }
}

export default function EventsPage() {
  const router = useRouter()
  const auth = useAuth()
  const { isEnabled, loading: flagsLoading } = useFeatureFlags()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [setup, setSetup] = useState<EventSetupState>(() => createInitialEventSetup())

  const eventsEnabled = isEnabled('events_core')
  const skinsEnabled = setup.sideGames.includes('skins')
  const usesTeams = TEAM_FORMATS.includes(setup.format)
  const configuredTeams = getConfiguredTeams(setup)
  const configuredTeamsValid = !usesTeams
    ? true
    : configuredTeams.length >= 2 && configuredTeams.every((team) => team.memberIds.length > 0 && team.memberIds.length <= 4)

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
    if (!currentUser || flagsLoading || !eventsEnabled) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      setLoading(true)
      setError('')

      try {
        const [usersResult, eventsResponse] = await Promise.all([
          auth.getAllUsersAsync(),
          fetch(`/api/events?userId=${encodeURIComponent(currentUser.id)}`, { cache: 'no-store' }),
        ])

        setUsers(usersResult)

        const eventsData = await eventsResponse.json()
        if (!eventsResponse.ok) {
          throw new Error(eventsData.error || 'Failed to load events.')
        }

        setEvents(eventsData.events || [])
      } catch (err: any) {
        setError(err.message || 'Failed to load events.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentUser, eventsEnabled, flagsLoading])

  function toggleMember(userId: string) {
    setSetup((previous) => {
      const selectedMemberIds = previous.selectedMemberIds.includes(userId)
        ? previous.selectedMemberIds.filter((value) => value !== userId)
        : [...previous.selectedMemberIds, userId]

      const nextAssignments = { ...previous.scrambleAssignments }
      if (!previous.selectedMemberIds.includes(userId)) {
        const teamIndex = selectedMemberIds.length > 0 ? (selectedMemberIds.length - 1) % previous.scrambleTeamCount : 0
        nextAssignments[userId] = buildTeamKey(teamIndex)
      } else {
        delete nextAssignments[userId]
      }

      return {
        ...previous,
        selectedMemberIds,
        scrambleAssignments: nextAssignments,
      }
    })
  }

  function updateScrambleTeamCount(teamCount: number) {
    setSetup((previous) => ({
      ...previous,
      scrambleTeamCount: teamCount,
      scrambleAssignments: assignMembersRoundRobin(previous.selectedMemberIds, teamCount),
    }))
  }

  function assignMemberToTeam(userId: string, teamId: string) {
    setSetup((previous) => ({
      ...previous,
      scrambleAssignments: {
        ...previous.scrambleAssignments,
        [userId]: teamId,
      },
    }))
  }

  function toggleSkins() {
    setSetup((previous) => {
      const sideGames: EventSideGame[] = previous.sideGames.includes('skins')
        ? previous.sideGames.filter((game): game is EventSideGame => game !== 'skins')
        : [...previous.sideGames, 'skins']

      return {
        ...previous,
        sideGames,
      }
    })
  }

  function updateBettingConfig<K extends keyof EventBettingConfig>(key: K, value: EventBettingConfig[K]) {
    setSetup((previous) => ({
      ...previous,
      bettingConfig: {
        ...previous.bettingConfig,
        [key]: value,
      },
    }))
  }

  async function handleCreateEvent() {
    if (!currentUser) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentUserId: currentUser.id,
          name: setup.name,
          format: setup.format,
          courseName: setup.courseName,
          eventDate: setup.eventDate,
          holeCount: setup.holeCount,
          memberIds: setup.selectedMemberIds,
          teams: usesTeams ? configuredTeams.filter((team) => team.memberIds.length > 0) : [],
          sideGames: setup.sideGames,
          bettingConfig: setup.bettingConfig,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create event.')
      }

      setSuccess('Event created.')
      setSetup(createInitialEventSetup())
      setEvents((previous) => [data.event, ...previous])
    } catch (err: any) {
      setError(err.message || 'Failed to create event.')
    } finally {
      setSaving(false)
    }
  }

  if (flagsLoading) {
    return (
      <PageWrapper title="Events">
        <div className="max-w-3xl mx-auto rounded-3xl border border-cyan-800 bg-black/70 p-8 text-center text-cyan-200">Loading feature access...</div>
      </PageWrapper>
    )
  }

  if (!eventsEnabled) {
    return (
      <PageWrapper title="Events">
        <div className="max-w-3xl mx-auto rounded-3xl border border-cyan-800 bg-black/70 p-8 text-center text-white">
          <h2 className="text-2xl font-bold text-cyan-300">Events are not enabled for this account</h2>
          <p className="mt-3 text-sm text-gray-300">Ask an admin to turn on the Events rollout flag for your user or for all players.</p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Events" userName={currentUser?.name}>
      <div className="max-w-5xl mx-auto space-y-6">
        {error && <div className="rounded-2xl bg-red-100 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        {success && <div className="rounded-2xl bg-green-100 px-4 py-3 text-sm font-semibold text-green-700">{success}</div>}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-cyan-900 bg-black/70 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Your Events</h2>
                <p className="text-sm text-gray-300 mt-1">Live and upcoming groups you can manage or follow.</p>
              </div>
            </div>
            {loading ? (
              <div className="rounded-2xl border border-cyan-950 bg-slate-950/70 p-5 text-sm text-gray-300">Loading events...</div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-cyan-900 bg-slate-950/70 p-6 text-sm text-gray-300">No events yet. Create one to start tracking a tournament or group.</div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className="block rounded-2xl border border-cyan-900 bg-slate-950/70 p-4 hover:border-cyan-500 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-white font-bold">{event.name}</div>
                          {event.format && (
                            <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300">
                              {FORMAT_LABELS[event.format]}
                            </span>
                          )}
                          {event.side_games?.includes('skins') && (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                              Skins
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{event.course_name || 'Course TBD'} • {event.event_date || 'Date TBD'} • {event.hole_count || 18} holes</div>
                      </div>
                      <span className="rounded-full border border-cyan-700 px-3 py-1 text-[11px] uppercase tracking-wide text-cyan-200">{event.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-green-900 bg-black/70 p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white">Create Event</h2>
            <p className="text-sm text-gray-300 mt-1">Start with the format, then set betting inputs, golfers, and the course shell for this event.</p>
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-2 text-sm font-semibold text-white">1. Select format</div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {FORMAT_OPTIONS.map((option) => {
                    const isActive = setup.format === option.key
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setSetup((previous) => ({ ...previous, format: option.key }))}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${isActive ? 'border-lime-400/50 bg-lime-400/10 text-white' : 'border-green-900 bg-slate-950 text-gray-200 hover:border-green-700'}`}
                      >
                        <div className="font-bold">{option.label}</div>
                        <div className="mt-1 text-xs text-gray-400">{option.subtitle}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <input value={setup.name} onChange={(e) => setSetup((previous) => ({ ...previous, name: e.target.value }))} placeholder="Saturday Scramble" className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white" />

              <div className="rounded-2xl border border-green-900 bg-slate-950/80 p-4">
                <div className="text-sm font-semibold text-white mb-3">2. Betting and game inputs</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Wager Mode</label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {WAGER_MODE_OPTIONS.map((option) => {
                        const isActive = setup.bettingConfig.wager_mode === option.key
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => updateBettingConfig('wager_mode', option.key)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${isActive ? 'border-lime-400/50 bg-lime-400/10 text-white' : 'border-green-950 text-gray-300 hover:border-green-800'}`}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Wager Value</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={setup.bettingConfig.wager_value ?? 0}
                      onChange={(e) => updateBettingConfig('wager_value', Number(e.target.value))}
                      className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white"
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-green-950 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">Skins Add-On</div>
                      <div className="mt-1 text-xs text-gray-400">Gross skins with push and carryover logic. Add it on top of the primary format.</div>
                    </div>
                    <button
                      type="button"
                      onClick={toggleSkins}
                      className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${skinsEnabled ? 'bg-amber-400 text-slate-950' : 'border border-white/10 bg-white/5 text-white/75'}`}
                    >
                      {skinsEnabled ? 'Enabled' : 'Add Skins'}
                    </button>
                  </div>

                  {skinsEnabled && (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Skin Value</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={setup.bettingConfig.skin_value ?? 0}
                          onChange={(e) => updateBettingConfig('skin_value', Number(e.target.value))}
                          className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">18th Tie Rule</label>
                        <select
                          value={setup.bettingConfig.skins_tiebreaker || 'chip_or_putt'}
                          onChange={(e) => updateBettingConfig('skins_tiebreaker', e.target.value as EventSkinsTiebreaker)}
                          className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white"
                        >
                          {SKINS_TIEBREAKER_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-3 rounded-2xl border border-green-950 px-4 py-3 text-sm text-gray-200">
                        <input
                          type="checkbox"
                          checked={Boolean(setup.bettingConfig.skins_validation_required)}
                          onChange={(e) => updateBettingConfig('skins_validation_required', e.target.checked)}
                          className="h-4 w-4 accent-green-500"
                        />
                        Validation Required
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <input value={setup.courseName} onChange={(e) => setSetup((previous) => ({ ...previous, courseName: e.target.value }))} placeholder="Oak Glen Golf Club" className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={setup.eventDate} onChange={(e) => setSetup((previous) => ({ ...previous, eventDate: e.target.value }))} className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white" />
                <select value={setup.holeCount} onChange={(e) => setSetup((previous) => ({ ...previous, holeCount: Number(e.target.value) }))} className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white">
                  <option value={9}>9 holes</option>
                  <option value={18}>18 holes</option>
                  <option value={27}>27 holes</option>
                  <option value={36}>36 holes</option>
                </select>
              </div>
              <div className="rounded-2xl border border-green-900 bg-slate-950/80 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-sm font-semibold text-white">3. Select golfers</div>
                  <div className="text-xs text-gray-400">Team assignment comes next after the setup contract is in place.</div>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {users.map((user) => {
                    const checked = setup.selectedMemberIds.includes(user.id)
                    return (
                      <label key={user.id} className="flex items-center justify-between rounded-xl border border-green-950 px-3 py-2 text-sm text-gray-200">
                        <span>{user.name}{user.id === currentUser?.id ? ' (you)' : ''}</span>
                        <input type="checkbox" checked={checked} onChange={() => toggleMember(user.id)} className="h-4 w-4 accent-green-500" />
                      </label>
                    )
                  })}
                </div>
              </div>
              {usesTeams && (
                <div className="rounded-2xl border border-green-900 bg-slate-950/80 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="text-sm font-semibold text-white">4. Assign teams</div>
                      <div className="mt-1 text-xs text-gray-400">
                        {setup.format === 'scramble'
                          ? 'Scramble uses one official team score per hole, so every selected golfer must be placed on a team.'
                          : 'Best Ball keeps individual player cards and derives the team low ball from them.'}
                      </div>
                    </div>
                    <select
                      value={setup.scrambleTeamCount}
                      onChange={(e) => updateScrambleTeamCount(Number(e.target.value))}
                      className="rounded-2xl border border-green-800 bg-slate-950 px-4 py-2 text-sm text-white"
                    >
                      {[2, 3, 4].filter((count) => count <= Math.max(2, setup.selectedMemberIds.length || 2)).map((count) => (
                        <option key={count} value={count}>{count} Teams</option>
                      ))}
                    </select>
                  </div>

                  {setup.selectedMemberIds.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-green-900 px-4 py-5 text-sm text-gray-400">Select golfers first, then assign them across scramble teams.</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {setup.selectedMemberIds.map((memberId) => {
                          const user = users.find((candidate) => candidate.id === memberId)
                          return (
                            <div key={memberId} className="flex items-center justify-between gap-3 rounded-2xl border border-green-950 px-4 py-3 text-sm text-gray-200">
                              <span>{user?.name || 'Unknown Player'}</span>
                              <select
                                value={setup.scrambleAssignments[memberId] || buildTeamKey(0)}
                                onChange={(e) => assignMemberToTeam(memberId, e.target.value)}
                                className="rounded-xl border border-green-800 bg-slate-950 px-3 py-2 text-white"
                              >
                                {Array.from({ length: setup.scrambleTeamCount }, (_, index) => {
                                  const teamId = buildTeamKey(index)
                                  return <option key={teamId} value={teamId}>{`Team ${index + 1}`}</option>
                                })}
                              </select>
                            </div>
                          )
                        })}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {configuredTeams.map((team) => (
                          <div key={team.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="text-sm font-bold text-white">{team.name}</div>
                            <div className="mt-1 text-xs text-gray-400">{team.memberIds.length} player{team.memberIds.length === 1 ? '' : 's'}</div>
                            <div className="mt-3 space-y-2 text-sm text-gray-200">
                              {team.memberIds.length === 0 ? (
                                <div className="text-gray-500">No players assigned</div>
                              ) : team.memberIds.map((memberId) => {
                                const user = users.find((candidate) => candidate.id === memberId)
                                return <div key={memberId}>{user?.name || 'Unknown Player'}</div>
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!configuredTeamsValid && (
                        <div className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">This format requires at least two teams, and each team must have between 1 and 4 players.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <button onClick={handleCreateEvent} disabled={saving || !setup.name.trim() || !configuredTeamsValid} className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  )
}
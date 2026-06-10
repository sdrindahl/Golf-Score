'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageWrapper from '@/components/PageWrapper'
import { useFeatureFlags } from '@/lib/featureFlagsContext'
import { useAuth } from '@/lib/useAuth'
import { Event, User } from '@/types'

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
  const [name, setName] = useState('')
  const [courseName, setCourseName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [holeCount, setHoleCount] = useState(18)
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])

  const eventsEnabled = isEnabled('events_core')

  useEffect(() => {
    const user = auth.getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }

    setCurrentUser(user)
  }, [auth, router])

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
  }, [auth, currentUser, eventsEnabled, flagsLoading])

  function toggleMember(userId: string) {
    setSelectedMemberIds((previous) => previous.includes(userId)
      ? previous.filter((value) => value !== userId)
      : [...previous, userId])
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
          name,
          courseName,
          eventDate,
          holeCount,
          memberIds: selectedMemberIds,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create event.')
      }

      setSuccess('Event created.')
      setName('')
      setCourseName('')
      setEventDate('')
      setHoleCount(18)
      setSelectedMemberIds([])
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
                        <div className="text-white font-bold">{event.name}</div>
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
            <p className="text-sm text-gray-300 mt-1">Start with a name, date, and the golfers you want on the board.</p>
            <div className="mt-4 space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturday Scramble" className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white" />
              <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Oak Glen Golf Club" className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white" />
                <select value={holeCount} onChange={(e) => setHoleCount(Number(e.target.value))} className="w-full rounded-2xl border border-green-800 bg-slate-950 px-4 py-3 text-white">
                  <option value={9}>9 holes</option>
                  <option value={18}>18 holes</option>
                  <option value={27}>27 holes</option>
                  <option value={36}>36 holes</option>
                </select>
              </div>
              <div className="rounded-2xl border border-green-900 bg-slate-950/80 p-4">
                <div className="text-sm font-semibold text-white mb-3">Select golfers</div>
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {users.map((user) => {
                    const checked = selectedMemberIds.includes(user.id)
                    return (
                      <label key={user.id} className="flex items-center justify-between rounded-xl border border-green-950 px-3 py-2 text-sm text-gray-200">
                        <span>{user.name}{user.id === currentUser?.id ? ' (you)' : ''}</span>
                        <input type="checkbox" checked={checked} onChange={() => toggleMember(user.id)} className="h-4 w-4 accent-green-500" />
                      </label>
                    )
                  })}
                </div>
              </div>
              <button onClick={handleCreateEvent} disabled={saving || !name.trim()} className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  )
}
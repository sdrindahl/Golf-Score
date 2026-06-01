'use client'

import { Suspense, useEffect, useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import PageWrapper from '@/components/PageWrapper'
import { addExpense, EXPENSE_CATEGORIES, CATEGORY_EMOJI } from '@/lib/walletApi'
import { ExpenseCategory } from '@/types'

function AddExpensePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const auth = useAuth()

  const today = new Date().toISOString().slice(0, 10)

  const [date, setDate] = useState(today)
  const [category, setCategory] = useState<ExpenseCategory>('Greens Fees')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Pre-fill round_id if coming from a round
  const roundId = searchParams?.get('round_id') ?? undefined

  useEffect(() => {
    const user = auth.getCurrentUser()
    if (!user) router.push('/login')
  }, [auth, router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than $0.')
      return
    }

    const user = auth.getCurrentUser()
    if (!user) { router.push('/login'); return }

    setSaving(true)
    try {
      await addExpense(user.id, {
        date,
        category,
        amount: parsedAmount,
        notes: notes.trim() || undefined,
        round_id: roundId,
      })
      router.push('/wallet')
    } catch (err) {
      setError('Failed to save expense. Please try again.')
      setSaving(false)
    }
  }

  return (
    <PageWrapper title="Add Wallet Entry">
      <div className="max-w-lg mx-auto px-2 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="text-green-400 hover:text-white text-2xl transition"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-green-400">💳 Add Wallet Entry</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-black bg-opacity-60 rounded-2xl p-6 border border-green-800 space-y-5">

          {/* Date */}
          <div>
            <label className="block text-green-400 text-sm font-semibold mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full bg-gray-900 border border-green-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-green-400 text-sm font-semibold mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {EXPENSE_CATEGORIES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border font-semibold text-sm transition ${
                    category === c
                      ? 'bg-green-700 border-green-400 text-white shadow'
                      : 'bg-gray-900 border-green-900 text-green-300 hover:border-green-600'
                  }`}
                >
                  <span className="text-lg">{CATEGORY_EMOJI[c]}</span>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-green-400 text-sm font-semibold mb-1">
              {category === 'Winnings' ? 'Amount Won' : 'Amount'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 font-bold text-lg">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full bg-gray-900 border border-green-700 rounded-xl pl-8 pr-4 py-3 text-white text-xl font-bold focus:outline-none focus:border-green-400"
              />
            </div>
            {category === 'Winnings' && (
              <p className="mt-2 text-xs text-green-500">Winnings are tracked separately from spending totals.</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-green-400 text-sm font-semibold mb-1">Notes <span className="text-green-700 font-normal">(optional)</span></label>
            <textarea
              placeholder="e.g. 18 holes at Pebble Beach..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              maxLength={300}
              className="w-full bg-gray-900 border border-green-700 rounded-xl px-4 py-3 text-white resize-none focus:outline-none focus:border-green-400"
            />
          </div>

          {roundId && (
            <p className="text-xs text-green-600">📎 Linked to current round</p>
          )}

          {error && (
            <p className="text-red-400 text-sm font-semibold">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-extrabold text-lg rounded-xl shadow transition"
          >
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      </div>
    </PageWrapper>
  )
}

export default function AddExpensePage() {
  return (
    <Suspense fallback={
      <PageWrapper title="Add Wallet Entry">
        <div className="max-w-lg mx-auto px-2 pb-24">
          <div className="flex justify-center items-center h-40">
            <p className="text-green-400">Loading...</p>
          </div>
        </div>
      </PageWrapper>
    }>
      <AddExpensePageContent />
    </Suspense>
  )
}

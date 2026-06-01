'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import PageWrapper from '@/components/PageWrapper'
import {
  getExpenses,
  deleteExpense,
  EXPENSE_CATEGORIES,
  CATEGORY_EMOJI,
  CATEGORY_COLOR,
} from '@/lib/walletApi'
import { Expense, ExpenseCategory } from '@/types'

const ALL = 'All' as const
type Filter = ExpenseCategory | typeof ALL

export default function WalletHistoryPage() {
  const router = useRouter()
  const auth = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [filter, setFilter] = useState<Filter>(ALL)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadExpenses = useCallback(async () => {
    const user = auth.getCurrentUser()
    if (!user) { router.push('/login'); return }
    const data = await getExpenses(user.id)
    setExpenses(data)
    setLoading(false)
  }, [auth, router])

  useEffect(() => { loadExpenses() }, [loadExpenses])

  const handleDelete = async (id: string) => {
    const user = auth.getCurrentUser()
    if (!user) return
    await deleteExpense(user.id, id)
    setExpenses(prev => prev.filter(e => e.id !== id))
    setConfirmDelete(null)
  }

  const filtered = filter === ALL
    ? expenses
    : expenses.filter(e => e.category === filter)

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (loading) {
    return (
      <PageWrapper title="Wallet History">
        <div className="flex justify-center items-center h-40">
          <p className="text-green-400">Loading...</p>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Wallet History">
      <div className="max-w-2xl mx-auto px-2 pb-24 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/wallet')}
            className="text-green-400 hover:text-white text-2xl transition"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-green-400">💳 Wallet History</h1>
        </div>

        {/* Category filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setFilter(ALL)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              filter === ALL ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-900 border-green-900 text-green-300 hover:border-green-600'
            }`}
          >
            All
          </button>
          {EXPENSE_CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                filter === c ? 'border-green-400 text-white' : 'bg-gray-900 border-green-900 text-green-300 hover:border-green-600'
              }`}
              style={filter === c ? { background: CATEGORY_COLOR[c] } : undefined}
            >
              {CATEGORY_EMOJI[c]} {c}
            </button>
          ))}
        </div>

        {/* Total for current filter */}
        <div className="text-right text-green-400 text-sm font-semibold">
          {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'} · {fmt(filtered.reduce((s, e) => s + Number(e.amount), 0))}
        </div>

        {/* Expense list */}
        {filtered.length === 0 ? (
          <div className="bg-black bg-opacity-40 rounded-2xl p-8 text-center border border-green-900">
            <p className="text-green-300">No entries found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(expense => (
              <div
                key={expense.id}
                className="bg-black bg-opacity-60 rounded-2xl px-4 py-3 border border-green-900 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="text-2xl flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: CATEGORY_COLOR[expense.category] + '33' }}
                  >
                    {CATEGORY_EMOJI[expense.category]}
                  </span>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{expense.category}</p>
                    <p className="text-green-600 text-xs">{formatDate(expense.date)}</p>
                    {expense.notes && (
                      <p className="text-green-400 text-xs truncate mt-0.5">{expense.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`font-bold text-base ${expense.category === 'Winnings' ? 'text-emerald-400' : 'text-white'}`}>{fmt(Number(expense.amount))}</span>
                  {confirmDelete === expense.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-bold transition"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg font-bold transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(expense.id)}
                      className="text-gray-600 hover:text-red-400 text-lg transition"
                        aria-label="Delete entry"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add expense shortcut */}
        <button
          onClick={() => router.push('/wallet/add')}
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow transition"
        >
          + Add Entry
        </button>
      </div>
    </PageWrapper>
  )
}

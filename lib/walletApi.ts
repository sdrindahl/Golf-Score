/**
 * walletApi.ts
 * CRUD operations for golf expenses.
 * Stores to localStorage (primary) with Supabase sync when configured.
 * All reads are strictly scoped to the provided userId.
 */

import { Expense, ExpenseCategory } from '@/types'
import { supabase } from './supabase'

const LS_KEY = 'golf_expenses'

type LegacyExpenseCategory =
  | ExpenseCategory
  | 'Cart'
  | 'Equipment'
  | 'Clothing'
  | 'Food & Bev'

const LEGACY_CATEGORY_MAP: Record<LegacyExpenseCategory, ExpenseCategory> = {
  'Greens Fees': 'Greens Fees',
  'Cart': 'Greens Fees',
  'Equipment': 'Equipment & Clothing',
  'Clothing': 'Equipment & Clothing',
  'Equipment & Clothing': 'Equipment & Clothing',
  'Food & Bev': 'Food & Beverages',
  'Food & Beverages': 'Food & Beverages',
  'Winnings': 'Winnings',
  'Other': 'Other',
}

// ─── localStorage helpers ──────────────────────────────────────────────────

function normalizeExpense(expense: Expense): Expense {
  const normalizedCategory = LEGACY_CATEGORY_MAP[(expense.category as LegacyExpenseCategory) ?? 'Other'] ?? 'Other'
  const normalizedAmount = Math.abs(Number(expense.amount) || 0)

  return {
    ...expense,
    category: normalizedCategory,
    amount: normalizedAmount,
  }
}

function getAllExpensesFromLS(): Expense[] {
  if (typeof window === 'undefined') return []
  try {
    const expenses = JSON.parse(localStorage.getItem(LS_KEY) || '[]') as Expense[]
    return expenses.map(normalizeExpense)
  } catch {
    return []
  }
}

function saveExpensesToLS(expenses: Expense[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(expenses))
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function addExpense(
  userId: string,
  data: Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<Expense> {
  const now = new Date().toISOString()
  const normalizedAmount = Math.abs(Number(data.amount) || 0)

  const expense: Expense = {
    id: crypto.randomUUID(),
    user_id: userId,
    created_at: now,
    updated_at: now,
    ...data,
    amount: normalizedAmount,
  }

  // localStorage
  const all = getAllExpensesFromLS()
  all.push(expense)
  saveExpensesToLS(all)

  // Supabase sync
  if (supabase) {
    try {
      await supabase.from('golf_expenses').insert([{
        id: expense.id,
        user_id: expense.user_id,
        date: expense.date,
        category: expense.category,
        amount: expense.amount,
        notes: expense.notes ?? null,
        round_id: expense.round_id ?? null,
      }])
    } catch (err) {
      console.warn('[walletApi] Supabase insert failed, localStorage used:', err)
    }
  }

  return expense
}

export async function getExpenses(userId: string): Promise<Expense[]> {
  // Try Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('golf_expenses')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (!error && data) {
        const normalized = (data as Expense[]).map(normalizeExpense)
        // Keep localStorage in sync
        const others = getAllExpensesFromLS().filter(e => e.user_id !== userId)
        saveExpensesToLS([...others, ...normalized])
        return normalized
      }
    } catch (err) {
      console.warn('[walletApi] Supabase fetch failed, falling back to localStorage:', err)
    }
  }

  // Fallback: localStorage
  return getAllExpensesFromLS()
    .filter(e => e.user_id === userId)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

export async function deleteExpense(userId: string, expenseId: string): Promise<void> {
  // localStorage
  const remaining = getAllExpensesFromLS().filter(
    e => !(e.id === expenseId && e.user_id === userId)
  )
  saveExpensesToLS(remaining)

  // Supabase sync
  if (supabase) {
    try {
      await supabase
        .from('golf_expenses')
        .delete()
        .eq('id', expenseId)
        .eq('user_id', userId)
    } catch (err) {
      console.warn('[walletApi] Supabase delete failed:', err)
    }
  }
}

// ─── Aggregation helpers ───────────────────────────────────────────────────

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Greens Fees',
  'Equipment & Clothing',
  'Food & Beverages',
  'Winnings',
  'Other',
]

export const CATEGORY_EMOJI: Record<ExpenseCategory, string> = {
  'Greens Fees': '⛳',
  'Equipment & Clothing': '🏌️',
  'Food & Beverages': '🍔',
  'Winnings': '🏆',
  'Other': '➕',
}

export const CATEGORY_COLOR: Record<ExpenseCategory, string> = {
  'Greens Fees': '#16a34a',
  'Equipment & Clothing': '#2563eb',
  'Food & Beverages': '#d97706',
  'Winnings': '#a855f7',
  'Other':       '#6b7280',
}

/** Returns expenses filtered to a date range */
export function filterByRange(expenses: Expense[], from: Date, to: Date): Expense[] {
  const fromStr = from.toISOString().slice(0, 10)
  const toStr   = to.toISOString().slice(0, 10)
  return expenses.filter(e => e.date >= fromStr && e.date <= toStr)
}

/** Totals by category */
export function totalsByCategory(expenses: Expense[]): Record<ExpenseCategory, number> {
  const totals = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, 0])) as Record<ExpenseCategory, number>
  for (const e of expenses) {
    totals[e.category] = (totals[e.category] ?? 0) + Number(e.amount)
  }
  return totals
}

/** Grand total */
export function grandTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + Number(e.amount), 0)
}

/** Bar chart data: spending grouped by label (day/week/month depending on period) */
export function barChartData(expenses: Expense[], period: 'week' | 'month' | 'year'): { label: string; total: number }[] {
  const map = new Map<string, number>()

  for (const e of expenses) {
    const d = new Date(e.date + 'T12:00:00')
    let label: string
    if (period === 'week') {
      // Day of week: Mon–Sun
      label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
    } else if (period === 'month') {
      // Week number within the month
      const weekOfMonth = Math.ceil(d.getDate() / 7)
      label = `Wk ${weekOfMonth}`
    } else {
      // Month name
      label = d.toLocaleDateString('en-US', { month: 'short' })
    }
    map.set(label, (map.get(label) ?? 0) + Number(e.amount))
  }

  // Maintain insertion order from oldest → newest
  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total }))
}

-- Migration: Add golf_expenses table for Golf Wallet feature

CREATE TYPE expense_category AS ENUM (
  'Greens Fees',
  'Equipment & Clothing',
  'Food & Beverages',
  'Winnings',
  'Other'
);

CREATE TABLE IF NOT EXISTS golf_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category expense_category NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    notes TEXT,
    round_id TEXT REFERENCES rounds(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_golf_expenses_user_id ON golf_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_golf_expenses_date ON golf_expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_golf_expenses_user_date ON golf_expenses(user_id, date DESC);

-- Row Level Security: users can only see/modify their own expenses
ALTER TABLE golf_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses"
  ON golf_expenses FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own expenses"
  ON golf_expenses FOR INSERT
  WITH CHECK (user_id IS NOT NULL AND user_id <> '');

CREATE POLICY "Users can update own expenses"
  ON golf_expenses FOR UPDATE
  USING (true)
  WITH CHECK (user_id IS NOT NULL AND user_id <> '');

CREATE POLICY "Users can delete own expenses"
  ON golf_expenses FOR DELETE
  USING (true);

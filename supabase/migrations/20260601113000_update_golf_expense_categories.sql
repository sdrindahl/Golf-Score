-- Migration: Update golf expense categories to the simplified wallet model

ALTER TABLE golf_expenses
  ALTER COLUMN category DROP DEFAULT;

CREATE TYPE expense_category_v2 AS ENUM (
  'Greens Fees',
  'Equipment & Clothing',
  'Food & Beverages',
  'Winnings',
  'Other'
);

ALTER TABLE golf_expenses
  ALTER COLUMN category TYPE expense_category_v2
  USING (
    CASE category::text
      WHEN 'Cart' THEN 'Greens Fees'
      WHEN 'Equipment' THEN 'Equipment & Clothing'
      WHEN 'Clothing' THEN 'Equipment & Clothing'
      WHEN 'Food & Bev' THEN 'Food & Beverages'
      ELSE category::text
    END
  )::expense_category_v2;

DROP TYPE expense_category;
ALTER TYPE expense_category_v2 RENAME TO expense_category;

ALTER TABLE golf_expenses
  ALTER COLUMN category SET DEFAULT 'Greens Fees';
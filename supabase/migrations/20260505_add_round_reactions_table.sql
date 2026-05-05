-- Create round_reactions table for round-level emoji reactions
CREATE TABLE IF NOT EXISTS public.round_reactions (
  id BIGSERIAL PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  
  -- Ensure one reaction per user per emoji per round
  UNIQUE(round_id, user_id, emoji)
);

-- Create indexes for common queries
CREATE INDEX idx_round_reactions_round_id ON public.round_reactions(round_id);
CREATE INDEX idx_round_reactions_user_id ON public.round_reactions(user_id);
CREATE INDEX idx_round_reactions_emoji ON public.round_reactions(emoji);

-- Enable RLS
ALTER TABLE public.round_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can read round reactions
CREATE POLICY "round_reactions_select" ON public.round_reactions
  FOR SELECT
  USING (true);

-- RLS Policy: Anyone can insert reactions (they're adding their own)
CREATE POLICY "round_reactions_insert" ON public.round_reactions
  FOR INSERT
  WITH CHECK (
    user_id IS NOT NULL AND user_id != ''
  );

-- RLS Policy: Users can delete their own reactions
CREATE POLICY "round_reactions_delete" ON public.round_reactions
  FOR DELETE
  USING (
    user_id IS NOT NULL
  );

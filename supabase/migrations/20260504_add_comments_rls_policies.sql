-- Add RLS policies for comments and comment_reactions tables

-- Enable RLS on comments table
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read comments
CREATE POLICY "Allow read comments" ON comments
  FOR SELECT
  USING (true);

-- Policy: Allow authenticated users to insert comments
CREATE POLICY "Allow insert comments" ON comments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Allow users to update their own comments
CREATE POLICY "Allow update own comments" ON comments
  FOR UPDATE
  USING (auth.uid()::text = user_id);

-- Policy: Allow users to delete their own comments
CREATE POLICY "Allow delete own comments" ON comments
  FOR DELETE
  USING (auth.uid()::text = user_id);

-- Enable RLS on comment_reactions table
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read reactions
CREATE POLICY "Allow read reactions" ON comment_reactions
  FOR SELECT
  USING (true);

-- Policy: Allow authenticated users to insert reactions
CREATE POLICY "Allow insert reactions" ON comment_reactions
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Allow anyone to update reactions (for reaction counts)
CREATE POLICY "Allow update reactions" ON comment_reactions
  FOR UPDATE
  USING (true);

-- Policy: Allow anyone to delete reactions
CREATE POLICY "Allow delete reactions" ON comment_reactions
  FOR DELETE
  USING (true);

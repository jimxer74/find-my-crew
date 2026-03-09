-- Migration: Social features for Legs/Journeys
-- Adds: leg_likes, leg_comments tables + journeys.comments_enabled column

-- 1. Add commenting toggle to journeys
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS comments_enabled boolean NOT NULL DEFAULT true;

-- 2. Leg likes
CREATE TABLE IF NOT EXISTS leg_likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id      uuid NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leg_id, user_id)
);

CREATE INDEX IF NOT EXISTS leg_likes_leg_id_idx ON leg_likes(leg_id);
CREATE INDEX IF NOT EXISTS leg_likes_user_id_idx ON leg_likes(user_id);

-- 3. Leg comments
CREATE TABLE IF NOT EXISTS leg_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id      uuid NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leg_comments_leg_id_idx ON leg_comments(leg_id);
CREATE INDEX IF NOT EXISTS leg_comments_user_id_idx ON leg_comments(user_id);

-- 4. RLS for leg_likes
ALTER TABLE leg_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view likes"
  ON leg_likes FOR SELECT USING (true);

CREATE POLICY "users can like"
  ON leg_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can unlike"
  ON leg_likes FOR DELETE USING (auth.uid() = user_id);

-- 5. RLS for leg_comments
ALTER TABLE leg_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view comments"
  ON leg_comments FOR SELECT USING (true);

CREATE POLICY "users can comment"
  ON leg_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can edit own comment"
  ON leg_comments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "users can delete own comment or journey owner can delete"
  ON leg_comments FOR DELETE USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT b.owner_id FROM legs l
      JOIN journeys j ON j.id = l.journey_id
      JOIN boats b ON b.id = j.boat_id
      WHERE l.id = leg_comments.leg_id
    )
  );

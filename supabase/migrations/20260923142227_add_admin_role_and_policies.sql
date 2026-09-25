/*
# Add admin role to profiles + admin access policies

1. Modified Tables
- `profiles` — add `is_admin` boolean column (default false)
2. Security Changes
- Admins (is_admin = true) can SELECT all rows on: likes, matches, messages, calls, rooms, room_members, room_messages, subscriptions
- Admins can UPDATE/DELETE subscriptions (to manage/extend/revoke)
- Admins can DELETE rooms (moderation)
- Admins can DELETE profiles (ban users by removing profile)
- Uses a SECURITY DEFINER helper function `is_current_user_admin()` to check admin status efficiently
3. Important Notes
- The is_admin column defaults to false. Set it to true manually for admin users via SQL.
- The helper function avoids recursive RLS on profiles by using SECURITY DEFINER.
*/

-- Add is_admin column to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_admin') THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Helper function to check if current user is admin (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Grant execute on the helper to authenticated users
GRANT EXECUTE ON FUNCTION is_current_user_admin() TO authenticated;

-- Update policies to allow admin access

-- Profiles: admins can update/delete any profile (moderation)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR is_current_user_admin()) WITH CHECK (auth.uid() = id OR is_current_user_admin());

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id OR is_current_user_admin());

-- Likes: admins can see all likes
DROP POLICY IF EXISTS "select_own_likes" ON likes;
CREATE POLICY "select_own_likes" ON likes FOR SELECT
  TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user OR is_current_user_admin());

-- Matches: admins can see all matches
DROP POLICY IF EXISTS "select_own_matches" ON matches;
CREATE POLICY "select_own_matches" ON matches FOR SELECT
  TO authenticated USING (auth.uid() = user1 OR auth.uid() = user2 OR is_current_user_admin());

-- Messages: admins can see all messages
DROP POLICY IF EXISTS "select_match_messages" ON messages;
CREATE POLICY "select_match_messages" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = messages.match_id AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
    OR is_current_user_admin()
 );

-- Calls: admins can see all calls
DROP POLICY IF EXISTS "select_match_calls" ON calls;
CREATE POLICY "select_match_calls" ON calls FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = calls.match_id AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
    OR is_current_user_admin()
  );

-- Rooms: admins can see all rooms and delete for moderation
DROP POLICY IF EXISTS "select_visible_rooms" ON rooms;
CREATE POLICY "select_visible_rooms" ON rooms FOR SELECT
  TO authenticated USING (
    auth.uid() = owner
    OR EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = rooms.id AND room_members.user_id = auth.uid())
    OR is_current_user_admin()
  );

DROP POLICY IF EXISTS "delete_own_rooms" ON rooms;
CREATE POLICY "delete_own_rooms" ON rooms FOR DELETE
  TO authenticated USING (auth.uid() = owner OR is_current_user_admin());

-- Room members: admins can see all
DROP POLICY IF EXISTS "select_room_members_visible" ON room_members;
CREATE POLICY "select_room_members_visible" ON room_members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_members.room_id AND (rooms.owner = auth.uid() OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid())))
    OR is_current_user_admin()
  );

-- Room messages: admins can see all
DROP POLICY IF EXISTS "select_room_messages_member" ON room_messages;
CREATE POLICY "select_room_messages_member" ON room_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = room_messages.room_id AND room_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_messages.room_id AND rooms.owner = auth.uid())
    OR is_current_user_admin()
  );

-- Subscriptions: admins can see all and manage them
DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_current_user_admin());

DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR is_current_user_admin()) WITH CHECK (auth.uid() = user_id OR is_current_user_admin());

DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR is_current_user_admin());

-- Admins can delete subscriptions (revoke)
DROP POLICY IF EXISTS "delete_own_subscriptions" ON subscriptions;
CREATE POLICY "delete_own_subscriptions" ON subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR is_current_user_admin());

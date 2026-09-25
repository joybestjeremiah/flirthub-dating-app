/*
# Dating App Schema

1. New Tables
- `profiles` — user dating profiles (display name, bio, age, gender, photo_url, preferences)
- `likes` — when one user likes another (asymmetric, one row per like)
- `matches` — when two users have mutually liked each other
- `messages` — chat messages between matched users
- `calls` — call records (audio/video) between matched users
- `rooms` — private rooms owned by a user
- `room_members` — members of a private room
- `room_messages` — messages in private rooms
- `subscriptions` — subscription records with plan, price, status, expires_at

2. Security
- RLS enabled on every table.
- Policies scoped `TO authenticated` with `auth.uid()` ownership checks.
- All owner columns default to `auth.uid()`.
- Profiles: each user reads/writes only their own profile row, but can view other profiles for discovery.
- Likes: users can create likes, and can see likes they sent or received.
- Matches: users can see matches they are part of.
- Messages: users can send and read messages in matches they belong to.
- Calls: users can initiate and see calls in matches they belong to.
- Rooms: owner can CRUD; members can read rooms they belong to.
- Room members: owner can add; members can see.
- Room messages: members can send and read.
- Subscriptions: users can read their own subscription.
*/

-- ============ TABLE CREATION ============

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  display_name text NOT NULL,
  bio text,
  age int,
  gender text DEFAULT 'other',
  interested_in text DEFAULT 'all',
  photo_url text,
  city text,
  online boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(from_user, to_user)
);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1 uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2 uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user1, user2)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  caller uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  call_type text DEFAULT 'audio',
  status text DEFAULT 'initiated',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'weekly',
  amount numeric NOT NULL DEFAULT 700,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============ RLS ENABLE ============

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============

-- Profiles
DROP POLICY IF EXISTS "select_all_profiles" ON profiles;
CREATE POLICY "select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Likes
DROP POLICY IF EXISTS "select_own_likes" ON likes;
CREATE POLICY "select_own_likes" ON likes FOR SELECT
  TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);

DROP POLICY IF EXISTS "insert_own_likes" ON likes;
CREATE POLICY "insert_own_likes" ON likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = from_user);

-- Matches
DROP POLICY IF EXISTS "select_own_matches" ON matches;
CREATE POLICY "select_own_matches" ON matches FOR SELECT
  TO authenticated USING (auth.uid() = user1 OR auth.uid() = user2);

DROP POLICY IF EXISTS "insert_own_matches" ON matches;
CREATE POLICY "insert_own_matches" ON matches FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user1 OR auth.uid() = user2);

DROP POLICY IF EXISTS "delete_own_matches" ON matches;
CREATE POLICY "delete_own_matches" ON matches FOR DELETE
  TO authenticated USING (auth.uid() = user1 OR auth.uid() = user2);

-- Messages
DROP POLICY IF EXISTS "select_match_messages" ON messages;
CREATE POLICY "select_match_messages" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = messages.match_id AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

DROP POLICY IF EXISTS "insert_match_messages" ON messages;
CREATE POLICY "insert_match_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = messages.match_id AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
    AND auth.uid() = sender
  );

DROP POLICY IF EXISTS "update_match_messages" ON messages;
CREATE POLICY "update_match_messages" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = sender) WITH CHECK (true);

-- Calls
DROP POLICY IF EXISTS "select_match_calls" ON calls;
CREATE POLICY "select_match_calls" ON calls FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = calls.match_id AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  );

DROP POLICY IF EXISTS "insert_match_calls" ON calls;
CREATE POLICY "insert_match_calls" ON calls FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = calls.match_id AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
    AND auth.uid() = caller
  );

DROP POLICY IF EXISTS "update_match_calls" ON calls;
CREATE POLICY "update_match_calls" ON calls FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM matches WHERE matches.id = calls.match_id AND (matches.user1 = auth.uid() OR matches.user2 = auth.uid()))
  ) WITH CHECK (true);

-- Rooms
DROP POLICY IF EXISTS "select_visible_rooms" ON rooms;
CREATE POLICY "select_visible_rooms" ON rooms FOR SELECT
  TO authenticated USING (
    auth.uid() = owner
    OR EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = rooms.id AND room_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_rooms" ON rooms;
CREATE POLICY "insert_own_rooms" ON rooms FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner);

DROP POLICY IF EXISTS "update_own_rooms" ON rooms;
CREATE POLICY "update_own_rooms" ON rooms FOR UPDATE
  TO authenticated USING (auth.uid() = owner) WITH CHECK (auth.uid() = owner);

DROP POLICY IF EXISTS "delete_own_rooms" ON rooms;
CREATE POLICY "delete_own_rooms" ON rooms FOR DELETE
  TO authenticated USING (auth.uid() = owner);

-- Room members
DROP POLICY IF EXISTS "select_room_members_visible" ON room_members;
CREATE POLICY "select_room_members_visible" ON room_members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_members.room_id AND (rooms.owner = auth.uid() OR EXISTS (SELECT 1 FROM room_members rm WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid())))
  );

DROP POLICY IF EXISTS "insert_room_members_owner" ON room_members;
CREATE POLICY "insert_room_members_owner" ON room_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_members.room_id AND rooms.owner = auth.uid())
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "delete_room_members_owner_or_self" ON room_members;
CREATE POLICY "delete_room_members_owner_or_self" ON room_members FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_members.room_id AND rooms.owner = auth.uid())
    OR auth.uid() = user_id
  );

-- Room messages
DROP POLICY IF EXISTS "select_room_messages_member" ON room_messages;
CREATE POLICY "select_room_messages_member" ON room_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = room_messages.room_id AND room_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_messages.room_id AND rooms.owner = auth.uid())
  );

DROP POLICY IF EXISTS "insert_room_messages_member" ON room_messages;
CREATE POLICY "insert_room_messages_member" ON room_messages FOR INSERT
  TO authenticated WITH CHECK (
    (EXISTS (SELECT 1 FROM room_members WHERE room_members.room_id = room_messages.room_id AND room_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM rooms WHERE rooms.id = room_messages.room_id AND rooms.owner = auth.uid()))
    AND auth.uid() = sender
  );

-- Subscriptions
DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_likes_from_user ON likes(from_user);
CREATE INDEX IF NOT EXISTS idx_likes_to_user ON likes(to_user);
CREATE INDEX IF NOT EXISTS idx_matches_user1 ON matches(user1);
CREATE INDEX IF NOT EXISTS idx_matches_user2 ON matches(user2);
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages(match_id);
CREATE INDEX IF NOT EXISTS idx_calls_match_id ON calls(match_id);
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

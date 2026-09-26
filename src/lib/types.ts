export interface Profile {
  id: string;
  display_name: string;
  bio: string | null;
  age: number | null;
  gender: string;
  interested_in: string;
  photo_url: string | null;
  city: string | null;
  online: boolean;
  is_visible: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
  location_updated_at: string | null;
  max_distance_km: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  actor_id: string | null;
  match_id: string | null;
  message_id: string | null;
  read_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface Like {
  id: string;
  from_user: string;
  to_user: string;
  created_at: string;
}

export interface Match {
  id: string;
  user1: string;
  user2: string;
  created_at: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender: string;
  content: string;
  message_type: 'text' | 'image';
  media_url: string | null;
  media_path: string | null;
  read: boolean;
  created_at: string;
}

export interface Call {
  id: string;
  match_id: string;
  caller: string;
  call_type: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  offer?: RTCSessionDescriptionInit | null;
  answer?: RTCSessionDescriptionInit | null;
  caller_ice?: RTCIceCandidateInit[];
  callee_ice?: RTCIceCandidateInit[];
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  owner: string;
  created_at: string;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  joined_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  sender: string;
  content: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  amount: number;
  status: string;
  starts_at: string;
  expires_at: string;
  created_at: string;
}

export const PLAN_PRICES = {
  weekly: 700,
  monthly: 2800,
};

export const PLAN_DURATIONS = {
  weekly: 7,
  monthly: 30,
};

export const PLAN_LABELS = {
  weekly: '7 Days',
  monthly: '1 Month',
};

export type PlanKey = 'weekly' | 'monthly';

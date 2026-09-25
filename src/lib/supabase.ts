import { createClient } from '@supabase/supabase-js';

// Keep frontend configuration resilient if Vercel environment variables are missing.
// The Supabase publishable key is safe for browser use; database access remains
// protected by Supabase RLS policies.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sraspeyjdecfkznldyvf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_semyebHXVdhxShT2ZAnxCQ_uWB_Lq6u';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

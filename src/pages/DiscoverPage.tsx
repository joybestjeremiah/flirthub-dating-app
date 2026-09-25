import { useEffect, useState } from 'react';
import { Heart, X, MapPin, Loader2, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function DiscoverPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    if (!user) return;
    setLoading(true);

    const [{ data: profileData, error: profileError }, { data: likesData, error: likesError }] = await Promise.all([
      supabase.from('profiles').select('*').neq('id', user.id),
      supabase.from('likes').select('to_user').eq('from_user', user.id),
    ]);

    if (profileError || likesError) {
      console.error('Failed to load discovery data', profileError ?? likesError);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const likedSet = new Set((likesData || []).map((l: { to_user: string }) => l.to_user));
    setLikedIds(likedSet);

    const filtered = (profileData || []).filter(
      (p) => !likedSet.has((p as Profile).id)
    ) as Profile[];
    setProfiles(filtered);
    setLoading(false);
  };

  const handleLike = async () => {
    if (!user || actionLoading) return;
    const target = profiles[currentIdx];
    if (!target) return;

    setActionLoading(true);

    const { error: likeError } = await supabase.from('likes').upsert(
      {
        from_user: user.id,
        to_user: target.id,
      },
      { onConflict: 'from_user,to_user', ignoreDuplicates: true }
    );

    if (likeError) {
      console.error('Failed to like profile', likeError);
      setActionLoading(false);
      return;
    }

    const { data: reverseLike } = await supabase
      .from('likes')
      .select('id')
      .eq('from_user', target.id)
      .eq('to_user', user.id)
      .maybeSingle();

    if (reverseLike) {
      const userA = user.id < target.id ? user.id : target.id;
      const userB = user.id < target.id ? target.id : user.id;
      const { error: matchError } = await supabase.from('matches').upsert(
        {
          user1: userA,
          user2: userB,
        },
        { onConflict: 'user1,user2', ignoreDuplicates: true }
      );
      if (matchError) {
        console.error('Failed to create match', matchError);
      }
    }

    setLikedIds((prev) => new Set(prev).add(target.id));
    setCurrentIdx((prev) => prev + 1);
    setActionLoading(false);
  };

  const handlePass = () => {
    if (actionLoading) return;
    setCurrentIdx((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  const current = profiles[currentIdx];

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mb-4">
          <Search className="w-10 h-10 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">No more profiles</h2>
        <p className="text-gray-500 mt-1">Check back later for new people in your area</p>
        <button
          onClick={loadProfiles}
          className="mt-4 px-6 py-2.5 rounded-xl bg-rose-500 text-white font-semibold hover:bg-rose-600 transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white">
        <div className="aspect-[3/4] relative bg-gradient-to-br from-rose-100 to-pink-100">
          {current.photo_url ? (
            <img
              src={current.photo_url}
              alt={current.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Heart className="w-24 h-24 text-rose-300" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-20">
            <div className="flex items-end gap-2">
              <h2 className="text-2xl font-bold text-white">{current.display_name}</h2>
              {current.age && <span className="text-xl text-white/80 mb-0.5">{current.age}</span>}
            </div>
            {current.city && (
              <div className="flex items-center gap-1 text-white/70 text-sm mt-1">
                <MapPin className="w-4 h-4" />
                {current.city}
              </div>
            )}
            {current.bio && (
              <p className="text-white/80 text-sm mt-2 line-clamp-3">{current.bio}</p>
            )}
          </div>

          <div className="absolute top-4 right-4">
            {current.online ? (
              <span className="flex items-center gap-1.5 bg-green-500/90 text-white text-xs font-medium px-3 py-1 rounded-full backdrop-blur">
                <span className="w-2 h-2 bg-white rounded-full" />
                Online
              </span>
            ) : (
              <span className="bg-black/40 text-white/80 text-xs font-medium px-3 py-1 rounded-full backdrop-blur">
                Offline
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 mt-6">
        <button
          onClick={handlePass}
          disabled={actionLoading}
          className="w-16 h-16 rounded-full bg-white shadow-lg border border-gray-100 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
        >
          <X className="w-7 h-7 text-gray-400" />
        </button>

        <button
          onClick={handleLike}
          disabled={actionLoading}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 shadow-xl shadow-rose-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
        >
          <Heart className="w-9 h-9 text-white" fill="white" />
        </button>
      </div>

      <p className="text-center text-sm text-gray-400 mt-4">
        {profiles.length - currentIdx - 1} more profiles to discover
      </p>
    </div>
  );
}

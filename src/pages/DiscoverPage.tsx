import { useEffect, useState } from 'react';
import { Heart, X, MapPin, Loader2, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function DiscoverPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [passedIds, setPassedIds] = useState<Set<string>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [maxAge, setMaxAge] = useState(99);
  const [cityFilter, setCityFilter] = useState('');
  const [showSafety, setShowSafety] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [profilePhotos, setProfilePhotos] = useState<string[]>([]);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    if (!user) return;
    setLoading(true);

    const [
      { data: profileData, error: profileError },
      { data: likesData, error: likesError },
      { data: passesData, error: passesError },
      { data: blocksData, error: blocksError },
    ] = await Promise.all([
      supabase.from('profiles').select('*').neq('id', user.id).eq('is_visible', true),
      supabase.from('likes').select('to_user').eq('from_user', user.id),
      supabase.from('passes').select('to_user').eq('from_user', user.id),
      supabase.from('blocks').select('blocked').eq('blocker', user.id),
    ]);

    if (profileError || likesError || passesError || blocksError) {
      console.error('Failed to load discovery data', profileError ?? likesError);
      setProfiles([]);
      setLoading(false);
      return;
    }

    const likedSet = new Set((likesData || []).map((l: { to_user: string }) => l.to_user));
    const passedSet = new Set((passesData || []).map((p: { to_user: string }) => p.to_user));
    const blockedSet = new Set((blocksData || []).map((b: { blocked: string }) => b.blocked));
    setLikedIds(likedSet);
    setPassedIds(passedSet);

    const me = (await supabase.from('profiles').select('gender, interested_in') .eq('id', user.id).maybeSingle()).data as Pick<Profile, 'gender' | 'interested_in'> | null;
    const filtered = (profileData || []).filter((p) => {
      const candidate = p as Profile;
      const genderMatches = !me?.interested_in || me.interested_in === 'all' || me.interested_in === candidate.gender;
      const candidateAcceptsMe = !candidate.interested_in || candidate.interested_in === 'all' || candidate.interested_in === me?.gender;
      return genderMatches && candidateAcceptsMe && !likedSet.has(candidate.id) && !passedSet.has(candidate.id) && !blockedSet.has(candidate.id);
    }) as Profile[];
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
      const { data: matchData, error: matchError } = await supabase.from('matches').upsert(
        {
          user1: userA,
          user2: userB,
        },
        { onConflict: 'user1,user2', ignoreDuplicates: true }
      );
      if (matchError) {
        console.error('Failed to create match', matchError);
      } else if (matchData) {
        setMatchedProfile(target);
      }
    }

    setLikedIds((prev) => new Set(prev).add(target.id));
    setCurrentIdx((prev) => prev + 1);
    setActionLoading(false);
  };

  const openProfile = async () => {
    if (!current) return;
    const { data } = await supabase.from('profile_photos').select('photo_url').eq('user_id', current.id).order('sort_order', { ascending: true });
    setProfilePhotos((data || []).map((p: { photo_url: string }) => p.photo_url));
    setShowProfile(true);
  };

  const handleSafetyAction = async (action: 'block' | 'report') => {
    if (!user || !current) return;
    if (action === 'block') {
      const { error } = await supabase.from('blocks').insert({ blocker: user.id, blocked: current.id });
      if (error) { console.error(error); return; }
      setShowSafety(false); setProfilePhotos([]); setCurrentIdx((prev) => prev + 1); return;
    }
    if (!reportReason) return;
    const { error } = await supabase.from('reports').insert({ reporter: user.id, reported: current.id, reason: reportReason });
    if (error) { console.error(error); return; }
    setShowSafety(false); setReportReason(''); setCurrentIdx((prev) => prev + 1);
  };

  const handlePass = async () => {
    if (!user || actionLoading) return;
    const target = profiles[currentIdx];
    if (!target) return;
    setActionLoading(true);

    const { error } = await supabase.from('passes').upsert(
      { from_user: user.id, to_user: target.id },
      { onConflict: 'from_user,to_user', ignoreDuplicates: true }
    );

    if (error) {
      console.error('Failed to save pass', error);
      setActionLoading(false);
      return;
    }

    setPassedIds((prev) => new Set(prev).add(target.id));
    setCurrentIdx((prev) => prev + 1);
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  const visibleProfiles = profiles.filter((p) =>
    (p.age == null || p.age <= maxAge) &&
    (!cityFilter.trim() || (p.city ?? '').toLowerCase().includes(cityFilter.trim().toLowerCase()))
  );
  const current = visibleProfiles[currentIdx];

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
      <div className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div><div className="font-semibold text-gray-900">Discovery filters</div><div className="text-xs text-gray-500">Matches respect your profile preferences</div></div>
          <Sparkles className="w-5 h-5 text-rose-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-gray-500">Maximum age
            <select value={maxAge} onChange={(e) => { setMaxAge(Number(e.target.value)); setCurrentIdx(0); }} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 bg-white">
              {[25,30,35,40,45,50,60,70,99].map((age) => <option key={age} value={age}>{age === 99 ? 'Any age' : age}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">City
            <input value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setCurrentIdx(0); }} placeholder="Any city" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-rose-400" />
          </label>
        </div>
      </div>
      {matchedProfile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-7 text-center shadow-2xl">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-rose-500" />
            </div>
            <h2 className="text-3xl font-black text-gray-900">It’s a Match!</h2>
            <p className="text-gray-500 mt-2">You and {matchedProfile.display_name} liked each other.</p>
            <div className="w-24 h-24 mx-auto mt-5 rounded-full overflow-hidden bg-rose-100 border-4 border-rose-100">
              {matchedProfile.photo_url ? (
                <img src={matchedProfile.photo_url} alt={matchedProfile.display_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Heart className="w-10 h-10 text-rose-300" /></div>
              )}
            </div>
            <button onClick={() => setMatchedProfile(null)} className="w-full mt-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold">Keep Discovering</button>
          </div>
        </div>
      )}

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

          <div className="absolute top-4 left-4 z-10"><button onClick={openProfile} className="px-3 py-1.5 rounded-full bg-black/50 text-white text-xs backdrop-blur">View profile</button></div>\n          <div className="absolute top-4 right-4">
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

      {showProfile && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">{current.display_name}'s profile</h2><button onClick={() => setShowProfile(false)} className="text-gray-500">✕</button></div><div className="grid grid-cols-2 gap-2">{(profilePhotos.length ? profilePhotos : (current.photo_url ? [current.photo_url] : [])).map((url) => <img key={url} src={url} alt={current.display_name} className="w-full aspect-square object-cover rounded-2xl" />)}</div><div className="mt-4"><div className="text-lg font-semibold">{current.display_name}{current.age ? `, ${current.age}` : ''}</div>{current.city && <div className="text-sm text-gray-500 mt-1">{current.city}</div>}{current.bio && <p className="text-gray-700 mt-3 whitespace-pre-wrap">{current.bio}</p>}</div><button onClick={() => { setShowProfile(false); setShowSafety(true); }} className="w-full mt-5 py-3 rounded-xl border border-gray-200 text-gray-700">Safety options</button></div></div>}

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
        {Math.max(0, visibleProfiles.length - currentIdx - 1)} more profiles to discover
      </p>
    </div>
  );
}

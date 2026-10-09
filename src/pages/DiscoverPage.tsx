import { useEffect, useState } from 'react';
import { Heart, X, MapPin, Loader2, Search, Sparkles, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function DiscoverPage() {
  const { user, hasActiveSubscription } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
  const [maxDistanceKm, setMaxDistanceKm] = useState(50);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [discoveryMode, setDiscoveryMode] = useState<'cards' | 'popular'>('popular');
  const [directChatProfile, setDirectChatProfile] = useState<Profile | null>(null);
  const [directChatId, setDirectChatId] = useState<string | null>(null);
  const [directMessages, setDirectMessages] = useState<Array<{id:string;sender:string;content:string;created_at:string}>>([]);
  const [directMessageText, setDirectMessageText] = useState('');
  const [directChatLoading, setDirectChatLoading] = useState(false);
  const [directChatError, setDirectChatError] = useState<string | null>(null);

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

    const { data: meData } = await supabase.from('profiles').select('gender, interested_in, latitude, longitude, max_distance_km').eq('id', user.id).maybeSingle();
    const me = meData as Pick<Profile, 'gender' | 'interested_in'> & { latitude?: number | null; longitude?: number | null; max_distance_km?: number } | null;
    setMaxDistanceKm(me?.max_distance_km ?? 50);
    setLocationEnabled(me?.latitude != null && me?.longitude != null);
    let distanceById = new Map<string, number>();
    if (me?.latitude != null && me?.longitude != null) {
      const { data: nearby } = await supabase.rpc('nearby_profiles', { p_latitude: me.latitude, p_longitude: me.longitude, p_max_distance_km: me.max_distance_km ?? 50 });
      distanceById = new Map((nearby ?? []).map((row: { id: string; distance_km: number }) => [row.id, row.distance_km]));
    }
    const filtered = (profileData || []).filter((p) => {
      const candidate = p as Profile;
      const genderMatches = !me?.interested_in || me.interested_in === 'all' || me.interested_in === candidate.gender;
      const candidateAcceptsMe = !candidate.interested_in || candidate.interested_in === 'all' || candidate.interested_in === me?.gender;
      return genderMatches && candidateAcceptsMe && !likedSet.has(candidate.id) && !passedSet.has(candidate.id) && !blockedSet.has(candidate.id);
    }) as Profile[];
    setProfiles(filtered.map((p) => ({ ...p, distance_km: distanceById.get(p.id) } as Profile & { distance_km?: number })));
    setLocationMessage(locationEnabled ? null : 'Enable location in your profile to match by distance. City matching remains available.');
    setLoading(false);
  };

  const handleLike = async () => {
    if (!user || actionLoading) return;
    const target = visibleProfiles[currentIdx];
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

    setCurrentIdx((prev) => prev + 1);
    setActionLoading(false);
  };

  const startDirectChat = async (person: Profile) => {
    setDirectChatProfile(person); setDirectChatError(null); setDirectMessages([]); setDirectChatId(null);
    if (!user) return;
    if (!hasActiveSubscription) return;
    setDirectChatLoading(true);
    const { data: existing, error: lookupError } = await supabase.from('direct_conversations').select('id')
      .or(`and(user1.eq.${user.id},user2.eq.${person.id}),and(user1.eq.${person.id},user2.eq.${user.id})`).maybeSingle();
    if (lookupError) { setDirectChatError(lookupError.message); setDirectChatLoading(false); return; }
    let conversationId = existing?.id as string | undefined;
    if (!conversationId) {
      const user1 = user.id < person.id ? user.id : person.id;
      const user2 = user.id < person.id ? person.id : user.id;
      const { data: created, error } = await supabase.from('direct_conversations').insert({ user1, user2 }).select('id').single();
      if (error) { setDirectChatError('Could not start chat. You or this person may have blocked the other, or the chat service is unavailable.'); setDirectChatLoading(false); return; }
      conversationId = created.id;
    }
    setDirectChatId(conversationId);
    const { data, error } = await supabase.from('direct_messages').select('id,sender,content,created_at').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (error) setDirectChatError(error.message);
    setDirectMessages((data || []) as Array<{id:string;sender:string;content:string;created_at:string}>);
    setDirectChatLoading(false);
  };

  useEffect(() => {
    if (!directChatId) return;
    const channel = supabase.channel(`direct-messages:${directChatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${directChatId}` }, (payload) => {
        const incoming = payload.new as {id:string;sender:string;content:string;created_at:string};
        setDirectMessages((items) => items.some((item) => item.id === incoming.id) ? items : [...items, incoming]);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [directChatId]);

  const sendDirectMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !directChatId || !directMessageText.trim() || !hasActiveSubscription) return;
    setDirectChatLoading(true); setDirectChatError(null);
    const { data, error } = await supabase.from('direct_messages')
      .insert({ conversation_id: directChatId, sender: user.id, content: directMessageText.trim() })
      .select('id,sender,content,created_at').single();
    if (error) setDirectChatError(error.message);
    else if (data) { setDirectMessages((items) => [...items, data as {id:string;sender:string;content:string;created_at:string}]); setDirectMessageText(''); }
    setDirectChatLoading(false);
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
  const popularProfiles = [...visibleProfiles].sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online)) || (a.display_name ?? '').localeCompare(b.display_name ?? ''));
  const current = visibleProfiles[currentIdx];
  const currentDistance = (current as Profile & { distance_km?: number } | undefined)?.distance_km;

  if (!current && discoveryMode !== 'popular') {
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
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => setDiscoveryMode('popular')} className={`py-3 rounded-xl font-semibold text-sm transition-colors ${discoveryMode === 'popular' ? 'bg-rose-500 text-white shadow' : 'bg-white text-gray-600 border border-gray-200'}`}>✨ Popular people</button>
        <button onClick={() => { setDiscoveryMode('cards'); setCurrentIdx(0); }} className={`py-3 rounded-xl font-semibold text-sm transition-colors ${discoveryMode === 'cards' ? 'bg-rose-500 text-white shadow' : 'bg-white text-gray-600 border border-gray-200'}`}>Swipe discovery</button>
      </div>
      {discoveryMode === 'popular' && (
        <section className="mb-5">
          <div className="mb-3">
            <h2 className="text-xl font-bold text-gray-900">Popular people</h2>
            <p className="text-sm text-gray-500">Browse more profiles. People who are online appear first. Premium subscribers can message profiles directly, without waiting for a mutual match.</p>
          </div>
          {popularProfiles.length === 0 ? (
            <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center text-gray-500">No profiles match these filters yet. Try changing the city or age filter, or refresh.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {popularProfiles.map((person) => (
                <div key={person.id} className="overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="relative aspect-[4/5] bg-rose-50">
                    {person.photo_url ? <img src={person.photo_url} alt={person.display_name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Heart className="w-12 h-12 text-rose-300" /></div>}
                    <span className={`absolute top-2 left-2 rounded-full px-2 py-1 text-[10px] font-semibold ${person.online ? 'bg-green-500 text-white' : 'bg-black/50 text-white'}`}>{person.online ? '● Online' : 'Offline'}</span>
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-gray-900 truncate">{person.display_name}{person.age ? `, ${person.age}` : ''}</div>
                    <div className="text-xs text-gray-500 truncate">{person.city || 'Location not set'}</div>
                    <button type="button" onClick={() => { const index = visibleProfiles.findIndex((p) => p.id === person.id); setCurrentIdx(index); setDiscoveryMode('cards'); }} className="mt-2 w-full text-xs font-semibold text-gray-600 text-left">View profile →</button>
                    <button type="button" onClick={() => void startDirectChat(person)} className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-500 px-2 py-2 text-xs font-semibold text-white"><MessageCircle className="w-3.5 h-3.5" /> Message</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {discoveryMode === 'cards' && (
      <div className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div><div className="font-semibold text-gray-900">Discovery filters</div><div className="text-xs text-gray-500">Matches respect your profile preferences</div></div>
          <Sparkles className="w-5 h-5 text-rose-400" />
        </div>
        <div className="mb-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-700">{locationEnabled ? `Distance matching: within ${maxDistanceKm} km` : locationMessage}</div><div className="grid grid-cols-2 gap-3">
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
      )}
      {discoveryMode === 'cards' && matchedProfile && (
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

      {discoveryMode === 'cards' && current && <><div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white">
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
            {currentDistance != null && <div className="text-white/70 text-xs mt-1">{Math.round(currentDistance * 10) / 10} km away</div>}
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


      {showSafety && current && <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-md bg-white rounded-3xl p-5"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-gray-900">Safety options</h2><button onClick={() => setShowSafety(false)} className="text-gray-500">✕</button></div><p className="text-sm text-gray-600 mb-4">Block or report {current.display_name}. Reports are reviewed by the FlirtHub moderation team.</p><label className="block text-sm font-medium text-gray-700 mb-1.5">Report reason</label><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 bg-white mb-4"><option value="">Choose a reason</option><option value="spam">Spam or scam</option><option value="harassment">Harassment</option><option value="fake_profile">Fake profile</option><option value="inappropriate_content">Inappropriate content</option><option value="other">Other</option></select><div className="grid grid-cols-2 gap-3"><button onClick={() => handleSafetyAction('block')} className="py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 font-semibold">Block</button><button onClick={() => handleSafetyAction('report')} disabled={!reportReason} className="py-3 rounded-xl bg-rose-600 text-white font-semibold disabled:opacity-50">Report</button></div></div></div>}

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
      </p></>}
      
      {directChatProfile && <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3">
        <div className="w-full max-w-md h-[min(80vh,650px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 p-4 border-b"><div className="w-10 h-10 rounded-full overflow-hidden bg-rose-100">{directChatProfile.photo_url && <img src={directChatProfile.photo_url} alt="" className="w-full h-full object-cover" />}</div><div className="flex-1 min-w-0"><div className="font-semibold truncate">{directChatProfile.display_name}</div><div className="text-xs text-gray-500">{directChatProfile.online ? '● Online' : 'Offline'}</div></div><button type="button" onClick={() => {setDirectChatProfile(null);setDirectChatId(null);setDirectMessages([]);setDirectChatError(null);}} className="px-3 py-1 text-gray-500">Close</button></div>
          {!hasActiveSubscription ? <div className="p-5 text-center"><p className="text-gray-700 mb-3">Subscribe to Premium to message profiles directly without a mutual match.</p><button type="button" onClick={() => {window.location.assign('/subscription');}} className="rounded-xl bg-rose-500 px-5 py-3 text-white font-semibold">View Premium plans</button></div> : <>
            {directChatError && <div className="px-3 py-2 bg-rose-50 text-rose-700 text-xs">{directChatError}</div>}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">{directChatLoading && directMessages.length === 0 ? <Loader2 className="w-6 h-6 mx-auto animate-spin text-rose-500" /> : directMessages.length === 0 ? <p className="text-center text-sm text-gray-400 py-8">Say hello to start the conversation.</p> : directMessages.map((m) => <div key={m.id} className={`flex ${m.sender === user?.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.sender === user?.id ? 'bg-rose-500 text-white' : 'bg-white shadow-sm text-gray-800'}`}>{m.content}</div></div>)}</div>
            <form onSubmit={sendDirectMessage} className="p-3 border-t flex gap-2"><input value={directMessageText} onChange={(e) => setDirectMessageText(e.target.value)} maxLength={4000} placeholder="Write a message..." className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2" /><button disabled={directChatLoading || !directMessageText.trim() || !directChatId} className="rounded-xl bg-rose-500 px-4 text-white font-semibold disabled:opacity-50">Send</button></form>
          </>}
        </div>
      </div>}

    </div>
  );
}

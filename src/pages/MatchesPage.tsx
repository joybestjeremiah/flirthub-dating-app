import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Phone, Video, Lock, Loader2, MessageCircle, Check, CheckCheck, Gift, HeartOff, ImagePlus, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Profile, Message, Match } from '@/lib/types';
import SubscriptionModal from '@/components/SubscriptionModal';
import CallModal from '@/components/CallModal';
import GiftSubscriptionModal from '@/components/GiftSubscriptionModal';

interface MatchWithProfile extends Match {
  otherProfile: Profile;
  lastMessage?: Message;
  unreadCount: number;
}

interface Props {
  onBack: () => void;
}

export default function MatchesPage({ onBack }: Props) {
  const { user, hasActiveSubscription } = useAuth();
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMatch, setActiveMatch] = useState<MatchWithProfile | null>(null);
  const [showSubModal, setShowSubModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [unmatchingId, setUnmatchingId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMatches();
    if (!user) return;
    const presence = supabase.channel('flirthub-presence', { config: { presence: { key: user.id } } });
    const syncPresence = () => {
      const state = presence.presenceState<{ userId: string }>();
      const ids = new Set<string>();
      Object.values(state).forEach((entries) => entries.forEach((entry) => ids.add(entry.userId)));
      setOnlineUsers(ids);
    };
    presence.on('presence', { event: 'sync' }, syncPresence).on('presence', { event: 'join' }, syncPresence).on('presence', { event: 'leave' }, syncPresence).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await presence.track({ userId: user.id, onlineAt: new Date().toISOString() });
    });

    const channel = supabase
      .channel('matches-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const incoming = payload.new as Message;
        if (incoming.sender === user.id) return;
        setMatches((prev) => prev.map((m) =>
          m.id === incoming.match_id
            ? { ...m, lastMessage: incoming, unreadCount: m.id === activeMatch?.id ? m.unreadCount : m.unreadCount + 1 }
            : m
        ));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updated = payload.new as Message;
        if (updated.sender !== user.id || !updated.read) return;
        setMatches((prev) => prev.map((m) =>
          m.id === updated.match_id && m.lastMessage?.id === updated.id
            ? { ...m, lastMessage: updated }
            : m
        ));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) await channel.track({ userId: user.id, typing: false });
      });
    return () => { supabase.removeChannel(channel); supabase.removeChannel(presence); };
  }, [user?.id, activeMatch?.id]);

  const loadMatches = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`user1.eq.${user.id},user2.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (matchError) {
      console.error('Failed to load matches', matchError);
      setError('We could not load your matches. Please try again.');
      setMatches([]);
      setLoading(false);
      return;
    }

    if (!matchData) {
      setLoading(false);
      return;
    }

    const enriched: MatchWithProfile[] = await Promise.all(
      (matchData as Match[]).map(async (m) => {
        const otherId = m.user1 === user.id ? m.user2 : m.user1;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', otherId)
          .maybeSingle();
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('*')
          .eq('match_id', m.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('match_id', m.id)
          .eq('read', false)
          .neq('sender', user.id);
        return {
          ...m,
          otherProfile: profile as Profile,
          lastMessage: lastMsg as Message | undefined,
          unreadCount: unreadCount ?? 0,
        };
      })
    );

    setMatches(enriched);
    setLoading(false);
  };

  const handleChatClick = (match: MatchWithProfile) => {
    if (!hasActiveSubscription) {
      setShowSubModal(true);
      return;
    }
    setActiveMatch({ ...match, unreadCount: 0 });
  };

  const handleUnmatch = async (match: MatchWithProfile) => {
    if (!user || unmatchingId) return;
    const confirmed = window.confirm(`Unmatch with ${match.otherProfile?.display_name || 'this person'}? Your conversation will be removed.`);
    if (!confirmed) return;
    setUnmatchingId(match.id); setError(null);
    const { error } = await supabase.from('matches').delete().eq('id', match.id);
    setUnmatchingId(null);
    if (error) { setError('We could not remove this match. Please try again.'); return; }
    if (activeMatch?.id === match.id) setActiveMatch(null);
    setMatches((prev) => prev.filter((item) => item.id !== match.id));
  };

  const handleCallClick = (type: 'audio' | 'video') => {
    if (!hasActiveSubscription) {
      setShowSubModal(true);
      return;
    }
    setCallType(type);
    setShowCallModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mb-4">
          <MessageCircle className="w-10 h-10 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">No matches yet</h2>
        <p className="text-gray-500 mt-1">Start liking profiles to find your match</p>
        <button
          onClick={onBack}
          className="mt-4 px-6 py-2.5 rounded-xl bg-rose-500 text-white font-semibold hover:bg-rose-600 transition-colors"
        >
          Discover People
        </button>
      </div>
    );
  }

  if (activeMatch) {
    return (
      <>
        <ChatView
          match={activeMatch}
          onBack={() => {
            setActiveMatch(null);
            loadMatches();
          }}
          onCall={handleCallClick}
          onGift={() => setShowGiftModal(true)}
          isOtherOnline={onlineUsers.has(activeMatch.otherProfile.id)}
        />
        {showGiftModal && activeMatch && (
          <GiftSubscriptionModal
            recipientId={activeMatch.otherProfile.id}
            recipientName={activeMatch.otherProfile.display_name}
            onClose={() => setShowGiftModal(false)}
            onSuccess={() => setShowGiftModal(false)}
          />
        )}
        {showCallModal && activeMatch && (
          <CallModal
            match={activeMatch}
            callType={callType}
            onClose={() => setShowCallModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Your Matches</h1>
      </div>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</div>}
      <div className="space-y-3">
        {matches.map((match) => (
          <button
            key={match.id}
            onClick={() => handleChatClick(match)}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-rose-200 transition-all text-left"
          >
            <div className="w-14 h-14 rounded-full overflow-hidden bg-rose-100 flex-shrink-0">
              {match.otherProfile?.photo_url ? (
                <img
                  src={match.otherProfile.photo_url}
                  alt={match.otherProfile.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-rose-300" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900">{match.otherProfile?.display_name}</div>
              <div className="text-sm text-gray-500 truncate">
                {match.lastMessage
                  ? match.lastMessage.content
                  : match.otherProfile?.city || 'Say hello!'}
              </div>
            </div>
            {match.unreadCount > 0 && (
              <span className="min-w-6 h-6 px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                {match.unreadCount > 99 ? '99+' : match.unreadCount}
              </span>
            )}
            {!hasActiveSubscription && <Lock className="w-5 h-5 text-rose-400 flex-shrink-0" />}
            <button type="button" onClick={(e) => { e.stopPropagation(); handleUnmatch(match); }} disabled={unmatchingId === match.id} className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50" title="Unmatch">{unmatchingId === match.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <HeartOff className="w-4 h-4" />}</button>
          </button>
        ))}
      </div>

      {showSubModal && (
        <SubscriptionModal
          onClose={() => setShowSubModal(false)}
          reason="Subscribe to start chatting with your matches"
        />
      )}
    </div>
  );
}

function ChatView({
  match,
  onBack,
  onCall,
  onGift,
  isOtherOnline,
}: {
  match: MatchWithProfile;
  onBack: () => void;
  onCall: (type: 'audio' | 'video') => void;
  onGift: () => void;
  isOtherOnline: boolean;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`messages:${match.id}`, { config: { presence: { key: user?.id || 'anonymous' } } })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; typing?: boolean }>();
        const other = Object.values(state).flat().find((entry) => entry.userId !== user?.id);
        setIsOtherTyping(Boolean(other?.typing));
      })
      .on('presence', { event: 'join' }, () => {
        const state = channel.presenceState<{ userId: string; typing?: boolean }>();
        const other = Object.values(state).flat().find((entry) => entry.userId !== user?.id);
        setIsOtherTyping(Boolean(other?.typing));
      })
      .on('presence', { event: 'leave' }, () => setIsOtherTyping(false))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${match.id}` },
        (payload) => {
          const incoming = payload.new as Message;
          if (incoming.message_type === 'image' && incoming.media_path) {
            supabase.storage.from('chat-media').createSignedUrl(incoming.media_path, 60 * 60).then(({ data }) => {
              const hydrated = data?.signedUrl ? { ...incoming, media_url: data.signedUrl } : incoming;
              setMessages((prev) => prev.some((message) => message.id === hydrated.id) ? prev : [...prev, hydrated]);
            });
          } else setMessages((prev) => prev.some((message) => message.id === incoming.id) ? prev : [...prev, incoming]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `match_id=eq.${match.id}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) =>
            prev.map((message) => (message.id === updated.id ? updated : message))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const hydrateMediaUrls = async (items: Message[]) => {
    const paths = items.filter(m => m.message_type === 'image' && m.media_path).map(m => m.media_path as string);
    if (!paths.length) return items;
    const { data } = await supabase.storage.from('chat-media').createSignedUrls(paths, 60 * 60);
    const urlMap = new Map<string, string>();
    (data || []).forEach((item, index) => { if (item.signedUrl) urlMap.set(paths[index], item.signedUrl); });
    return items.map(m => m.media_path && urlMap.has(m.media_path) ? { ...m, media_url: urlMap.get(m.media_path) || null } : m);
  };

  const markIncomingAsRead = async (items: Message[]) => {
    if (!user) return;
    const unreadIds = items.filter((m) => m.sender !== user.id && !m.read).map((m) => m.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase.rpc('mark_match_messages_read', { p_match_id: match.id });
    if (error) console.error('Failed to mark messages read', error);
  };

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', match.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to load messages', error);
      setMessages([]);
    } else {
      const items = await hydrateMediaUrls((data || []) as Message[]);
      setMessages(items);
      await markIncomingAsRead(items);
    }
    setLoading(false);
  };

  const publishTyping = async (typing: boolean) => {
    if (!user) return;
    const channel = supabase.getChannels().find((item) => item.topic === `realtime:messages:${match.id}`);
    if (channel) await channel.track({ userId: user.id, typing });
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    publishTyping(Boolean(value.trim()));
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => publishTyping(false), 1200);
  };

  const handleSendImage = async () => {
    if (!user || !selectedImage || uploadingImage) return;
    if (!selectedImage.type.startsWith('image/')) return;
    if (selectedImage.size > 5 * 1024 * 1024) { alert('Images must be 5 MB or smaller.'); return; }
    setUploadingImage(true);
    const ext = selectedImage.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${match.id}/${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, selectedImage, { contentType: selectedImage.type, upsert: false });
    if (uploadError) { console.error(uploadError); alert('Could not upload this image.'); setUploadingImage(false); return; }
    const { data, error } = await supabase.from('messages').insert({ match_id: match.id, sender: user.id, content: '', message_type: 'image', media_url: null, media_path: path }).select('*').single();
    if (error) { console.error(error); await supabase.storage.from('chat-media').remove([path]); alert('Could not send this image.'); } else if (data) setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data as Message]);
    setSelectedImage(null); setUploadingImage(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedImage) { e.preventDefault(); await handleSendImage(); return; }
    if (!input.trim() || !user) return;
    const content = input.trim();
    setInput('');
    await publishTyping(false);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        match_id: match.id,
        sender: user.id,
        content,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to send message', error);
      setInput(content);
      return;
    }

    if (data) {
      const sent = data as Message;
      setMessages((prev) =>
        prev.some((message) => message.id === sent.id) ? prev : [...prev, sent]
      );
    }
  };

  const other = match.otherProfile;

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white">
        <button onClick={onBack} className="p-1 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-rose-100 flex-shrink-0">
          {other?.photo_url ? (
            <img src={other.photo_url} alt={other.display_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-rose-300" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{other?.display_name}</div>
          {isOtherOnline ? <div className="text-xs text-green-500">Online now</div> : <div className="text-xs text-gray-400">Offline</div>}
        </div>
        <button onClick={() => onCall('audio')} className="p-2 text-gray-500 hover:text-rose-500 transition-colors">
          <Phone className="w-5 h-5" />
        </button>
        <button onClick={() => onCall('video')} className="p-2 text-gray-500 hover:text-rose-500 transition-colors">
          <Video className="w-5 h-5" />
        </button>
        <button onClick={onGift} className="p-2 text-gray-500 hover:text-rose-500 transition-colors" title="Gift subscription">
          <Gift className="w-5 h-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMine
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                  }`}
                >
                  {msg.message_type === 'image' && msg.media_url ? <img src={msg.media_url} alt="Shared image" className="rounded-xl max-h-72 w-auto object-cover" loading="lazy" /> : <div>{msg.content}</div>}
                  {isMine && (
                    <div className="mt-1 flex justify-end">
                      {msg.read ? <CheckCheck className="w-3.5 h-3.5 text-white/80" /> : <Check className="w-3.5 h-3.5 text-white/70" />}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {isOtherTyping && <div className="px-4 py-1 text-xs text-gray-400 bg-gray-50">{other?.display_name} is typing…</div>}

      {selectedImage && <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center gap-3"><img src={URL.createObjectURL(selectedImage)} alt="Preview" className="w-14 h-14 rounded-lg object-cover" /><span className="text-xs text-gray-500 flex-1 truncate">{selectedImage.name}</span><button type="button" onClick={() => setSelectedImage(null)}><X className="w-4 h-4 text-gray-500" /></button></div>}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-white flex items-center gap-2">
        <label className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer hover:border-rose-400 text-gray-500"><ImagePlus className="w-5 h-5" /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploadingImage} onChange={(e) => setSelectedImage(e.target.files?.[0] || null)} /></label>
        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={(!input.trim() && !selectedImage) || uploadingImage}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white flex items-center justify-center disabled:opacity-50 hover:scale-105 active:scale-95 transition-transform"
        >
          {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
}

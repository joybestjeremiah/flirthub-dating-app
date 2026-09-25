import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Phone, Video, Lock, Loader2, MessageCircle, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Profile, Message, Match } from '@/lib/types';
import SubscriptionModal from '@/components/SubscriptionModal';
import CallModal from '@/components/CallModal';

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

  useEffect(() => {
    loadMatches();
    if (!user) return;
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
        />
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
            {!hasActiveSubscription && (
              <Lock className="w-5 h-5 text-rose-400 flex-shrink-0" />
            )}
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
}: {
  match: MatchWithProfile;
  onBack: () => void;
  onCall: (type: 'audio' | 'video') => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`messages:${match.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${match.id}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) =>
            prev.some((message) => message.id === incoming.id)
              ? prev
              : [...prev, incoming]
          );
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
      const items = (data || []) as Message[];
      setMessages(items);
      await markIncomingAsRead(items);
    }
    setLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    const content = input.trim();
    setInput('');

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
          {other?.online && <div className="text-xs text-green-500">Online</div>}
        </div>
        <button onClick={() => onCall('audio')} className="p-2 text-gray-500 hover:text-rose-500 transition-colors">
          <Phone className="w-5 h-5" />
        </button>
        <button onClick={() => onCall('video')} className="p-2 text-gray-500 hover:text-rose-500 transition-colors">
          <Video className="w-5 h-5" />
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
                  <div>{msg.content}</div>
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

      <form onSubmit={handleSend} className="p-4 border-t border-gray-100 bg-white flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white flex items-center justify-center disabled:opacity-50 hover:scale-105 active:scale-95 transition-transform"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

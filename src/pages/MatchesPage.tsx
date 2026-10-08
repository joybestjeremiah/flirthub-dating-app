import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Send, Video, Loader2, MessageCircle, Gift, HeartOff } from 'lucide-react';
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
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [unmatchingId, setUnmatchingId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const loadMatches = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .or(`user1.eq.${user.id},user2.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (matchError) {
      setError(matchError.message);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      ((matchData || []) as Match[]).map(async (match) => {
        const otherId = match.user1 === user.id ? match.user2 : match.user1;

        const [profileResult, messageResult, unreadResult] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', otherId).maybeSingle(),
          supabase.from('messages').select('*').eq('match_id', match.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('messages').select('id', { count: 'exact', head: true })
            .eq('match_id', match.id)
            .eq('read', false)
            .neq('sender', user.id),
        ]);

        return {
          ...match,
          otherProfile: profileResult.data as Profile,
          lastMessage: messageResult.data as Message | undefined,
          unreadCount: unreadResult.count ?? 0,
        };
      })
    );

    setMatches(enriched);
    setLoading(false);
  };

  useEffect(() => {
    void loadMatches();
    if (!user) return;

    const presence = supabase.channel('flirthub-presence', {
      config: { presence: { key: user.id } },
    });

    presence
      .on('presence', { event: 'sync' }, () => {
        const state = presence.presenceState<{ userId: string }>();
        const ids = new Set<string>();
        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => ids.add(entry.userId));
        });
        setOnlineUsers(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presence.track({ userId: user.id });
        }
      });

    const messagesChannel = supabase
      .channel('matches-unread')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload) => {
        const incoming = payload.new as Message;
        if (incoming.sender === user.id) return;

        setMatches((current) =>
          current.map((match) =>
            match.id === incoming.match_id
              ? { ...match, lastMessage: incoming, unreadCount: match.unreadCount + 1 }
              : match
          )
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(messagesChannel);
      void supabase.removeChannel(presence);
    };
  }, [user?.id]);

  const handleChatClick = (match: MatchWithProfile) => {
    setActiveMatch({ ...match, unreadCount: 0 });
  };

  const handleVideoCallClick = () => {
    if (!hasActiveSubscription) {
      setShowSubModal(true);
      return;
    }
    setShowCallModal(true);
  };

  const handleUnmatch = async (match: MatchWithProfile) => {
    if (!user || unmatchingId) return;

    if (!window.confirm(`Unmatch with ${match.otherProfile?.display_name || 'this person'}?`)) return;

    setUnmatchingId(match.id);
    const { error: deleteError } = await supabase.from('matches').delete().eq('id', match.id);
    setUnmatchingId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMatches((current) => current.filter((item) => item.id !== match.id));
    if (activeMatch?.id === match.id) setActiveMatch(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
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
            void loadMatches();
          }}
          onVideoCall={handleVideoCallClick}
          onGift={() => setShowGiftModal(true)}
          isOtherOnline={onlineUsers.has(activeMatch.otherProfile.id)}
          canSend={hasActiveSubscription}
          onSubscribe={() => setShowSubModal(true)}
        />

        {showGiftModal && (
          <GiftSubscriptionModal
            recipientId={activeMatch.otherProfile.id}
            recipientName={activeMatch.otherProfile.display_name}
            onClose={() => setShowGiftModal(false)}
            onSuccess={() => setShowGiftModal(false)}
          />
        )}

        {showCallModal && (
          <CallModal
            match={activeMatch}
                        onClose={() => setShowCallModal(false)}
          />
        )}

        {showSubModal && (
          <SubscriptionModal
            onClose={() => setShowSubModal(false)}
            reason="Subscribe to send messages, make calls and use private rooms"
          />
        )}
      </>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold flex-1">Your Matches</h1>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {!matches.length ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
          <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mb-4">
            <MessageCircle className="w-10 h-10 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">No matches yet</h2>
          <p className="text-gray-500 mt-1">Start liking profiles to find your match</p>
          <button
            onClick={onBack}
            className="mt-4 px-6 py-2.5 rounded-xl bg-rose-500 text-white font-semibold"
          >
            Discover People
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <div
              key={match.id}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100"
            >
              <button
                onClick={() => handleChatClick(match)}
                className="flex-1 flex items-center gap-4 text-left"
              >
                <div className="w-14 h-14 rounded-full overflow-hidden bg-rose-100 flex-shrink-0">
                  {match.otherProfile?.photo_url ? (
                    <img src={match.otherProfile.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <MessageCircle className="m-4 text-rose-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{match.otherProfile?.display_name}</div>
                  <div className="text-sm text-gray-500 truncate">
                    {match.lastMessage?.content || match.otherProfile?.city || 'Say hello!'}
                  </div>
                </div>

                {match.unreadCount > 0 && (
                  <span className="min-w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                    {match.unreadCount > 99 ? '99+' : match.unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handleUnmatch(match)}
                className="p-2 text-gray-400 hover:text-red-500"
                disabled={unmatchingId === match.id}
              >
                <HeartOff className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChatViewProps {
  match: MatchWithProfile;
  onBack: () => void;
  onVideoCall: () => void;
  onGift: () => void;
  isOtherOnline: boolean;
  canSend: boolean;
  onSubscribe: () => void;
}

function ChatView({
  match,
  onBack,
  onVideoCall,
  onGift,
  isOtherOnline,
  canSend,
  onSubscribe,
}: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', match.id)
      .order('created_at', { ascending: true });

    if (error) setSendError(error.message);
    setMessages((data || []) as Message[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadMessages();

    const channel = supabase
      .channel(`messages:${match.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${match.id}`,
      }, (payload) => {
        const incoming = payload.new as Message;
        setMessages((current) =>
          current.some((message) => message.id === incoming.id)
            ? current
            : [...current, incoming]
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [match.id, user?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !input.trim()) return;

    if (!canSend) {
      onSubscribe();
      return;
    }

    const content = input.trim();
    setSendError(null);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        match_id: match.id,
        sender: user.id,
        content,
        message_type: 'text',
      })
      .select('*')
      .single();

    if (error) {
      setSendError(error.message);
      return;
    }

    setInput('');

    if (data) {
      setMessages((current) =>
        current.some((message) => message.id === data.id)
          ? current
          : [...current, data as Message]
      );
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <button onClick={onBack} className="p-1" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-full overflow-hidden bg-rose-100">
          {match.otherProfile?.photo_url && (
            <img src={match.otherProfile.photo_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="flex-1">
          <div className="font-semibold">{match.otherProfile?.display_name}</div>
          <div className="text-xs text-gray-400">
            {isOtherOnline ? 'Online now' : 'Offline'}
          </div>
        </div>

        <button onClick={onVideoCall} className="p-2 text-rose-500" aria-label="Video call">
          <Video className="w-5 h-5" />
        </button>

        <button onClick={onGift} className="p-2 text-gray-500" aria-label="Gift subscription">
          <Gift className="w-5 h-5" />
        </button>
      </div>

      {!canSend && (
        <div className="px-4 py-2 bg-amber-50 text-amber-800 text-xs border-b flex items-center justify-between gap-2">
          <span>You can read messages here. Subscribe to send a message.</span>
          <button onClick={onSubscribe} className="font-bold text-rose-600">Subscribe</button>
        </div>
      )}

      {sendError && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-xs border-b">
          {sendError}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {loading ? (
          <Loader2 className="w-6 h-6 mx-auto text-rose-400 animate-spin" />
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No messages yet. Say hello!
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  message.sender === user?.id
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white'
                    : 'bg-white text-gray-800 shadow-sm'
                }`}
              >
                {message.content}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t bg-white flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={!canSend}
          placeholder={canSend ? 'Type a message...' : 'Subscribe to send a message'}
          className="flex-1 px-4 py-2.5 rounded-full border disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={!input.trim() || !canSend}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white flex items-center justify-center disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

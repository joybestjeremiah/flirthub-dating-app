import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Lock, Plus, Users, Loader2, MessageSquare, Trash2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Room, RoomMessage, Profile } from '@/lib/types';
import SubscriptionModal from '@/components/SubscriptionModal';

interface Props {
  onBack: () => void;
}

export default function RoomsPage({ onBack }: Props) {
  const { user, hasActiveSubscription } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const ownerRooms = await supabase
      .from('rooms')
      .select('*')
      .eq('owner', user.id)
      .order('created_at', { ascending: false });

    const memberRooms = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', user.id);

    const memberRoomIds = (memberRooms.data || []).map((m: { room_id: string }) => m.room_id);

    let allRooms = (ownerRooms.data || []) as Room[];
    if (memberRoomIds.length > 0) {
      const { data: joinedRooms } = await supabase
        .from('rooms')
        .select('*')
        .in('id', memberRoomIds);
      allRooms = [...allRooms, ...((joinedRooms || []) as Room[])];
    }

    const unique = Array.from(new Map(allRooms.map((r) => [r.id, r])).values());
    setRooms(unique);
    if (unique.length > 0) {
      const { data: members } = await supabase
        .from('room_members')
        .select('room_id')
        .in('room_id', unique.map((r) => r.id));
      const counts: Record<string, number> = {};
      (members || []).forEach((m: { room_id: string }) => {
        counts[m.room_id] = (counts[m.room_id] || 0) + 1;
      });
      unique.forEach((room) => {
        if (room.owner) counts[room.id] = (counts[room.id] || 0) + 1;
      });
      setMemberCounts(counts);
    } else {
      setMemberCounts({});
    }
    setLoading(false);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        name: newRoomName,
        description: newRoomDesc || null,
        owner: user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to create room', error);
      setError('Could not create the room. Please try again.');
      return;
    }
    if (data) {
      setShowCreate(false);
      setNewRoomName('');
      setNewRoomDesc('');
      await loadRooms();
    }
  };

  const handleJoinRoom = async (room: Room) => {
    if (!hasActiveSubscription) {
      setShowSubModal(true);
      return;
    }
    if (room.owner !== user?.id) {
      const { error } = await supabase.from('room_members').upsert(
        {
          room_id: room.id,
          user_id: user!.id,
        },
        { onConflict: 'room_id,user_id', ignoreDuplicates: true }
      );
      if (error) {
        console.error('Failed to join room', error);
        return;
      }
    }
    setActiveRoom(room);
  };

  const handleDeleteRoom = async (roomId: string) => {
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) {
      console.error('Failed to delete room', error);
      setError('Could not delete the room. Please try again.');
      return;
    }
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
  };

  const handleEnterRoom = (room: Room) => {
    if (!hasActiveSubscription) {
      setShowSubModal(true);
      return;
    }
    handleJoinRoom(room);
  };

  if (activeRoom) {
    return (
      <RoomChatView
        room={activeRoom}
        onBack={() => {
          setActiveRoom(null);
          loadRooms();
        }}
      />
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">Private Rooms</h1>
        <button
          onClick={() => {
            if (!hasActiveSubscription) {
              setShowSubModal(true);
              return;
            }
            setShowCreate(true);
          }}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg shadow-rose-500/30"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 text-sm">{error}</p>
          <button onClick={loadRooms} className="mt-3 px-5 py-2 rounded-xl bg-rose-500 text-white font-semibold">Retry</button>
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-center">
          <div className="w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">No rooms yet</h2>
          <p className="text-gray-500 mt-1">Create a private room to start chatting</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <button
                onClick={() => handleEnterRoom(room)}
                className="flex items-center gap-4 flex-1 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{room.name}</div>
                  {room.description && (
                    <div className="text-sm text-gray-500 truncate">{room.description}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">
                    {room.owner === user?.id ? 'Owner' : 'Member'} · {memberCounts[room.id] || 1} {(memberCounts[room.id] || 1) === 1 ? 'member' : 'members'}
                  </div>
                </div>
                {!hasActiveSubscription && <Lock className="w-5 h-5 text-rose-400" />}
              </button>
              {room.owner === user?.id && (
                <button
                  onClick={() => handleDeleteRoom(room.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Create Room</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <input
                type="text"
                required
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
              />
              <input
                type="text"
                value={newRoomDesc}
                onChange={(e) => setNewRoomDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                Create
              </button>
            </form>
          </div>
        </div>
      )}

      {showSubModal && (
        <SubscriptionModal
          onClose={() => setShowSubModal(false)}
          reason="Subscribe to create and join private rooms"
        />
      )}
    </div>
  );
}

function RoomChatView({ room, onBack }: { room: Room; onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`room_messages:${room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          const incoming = payload.new as RoomMessage;
          setMessages((prev) =>
            prev.some((message) => message.id === incoming.id)
              ? prev
              : [...prev, incoming]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Failed to load room messages', error);
      setMessages([]);
    } else {
      setMessages((data || []) as RoomMessage[]);
    }

    const senderIds = Array.from(new Set((data || []).map((m: { sender: string }) => m.sender)));
    if (senderIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', senderIds);
      const map: Record<string, Profile> = {};
      (profileData || []).forEach((p: Profile) => {
        map[p.id] = p;
      });
      setProfiles(map);
    }
    setLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    const content = input.trim();
    setInput('');

    const { data, error } = await supabase
      .from('room_messages')
      .insert({
        room_id: room.id,
        sender: user.id,
        content,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to send room message', error);
      setInput(content);
      return;
    }
    if (data) {
      const sent = data as RoomMessage;
      setMessages((prev) =>
        prev.some((message) => message.id === sent.id) ? prev : [...prev, sent]
      );
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white">
        <button onClick={onBack} className="p-1 text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">{room.name}</div>
          {room.description && (
            <div className="text-xs text-gray-500 truncate">{room.description}</div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender === user?.id;
            const senderProfile = profiles[msg.sender];
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isMine ? '' : ''}`}>
                  {!isMine && senderProfile && (
                    <div className="text-xs text-gray-400 mb-0.5 px-2">
                      {senderProfile.display_name}
                    </div>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm ${
                      isMine
                        ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md shadow-sm border border-gray-100'
                    }`}
                  >
                    {msg.content}
                  </div>
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

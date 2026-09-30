import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Plus, Users, Loader2, MessageSquare, Trash2, X, Phone, Video, Gift } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Room, RoomMessage, Profile, Call } from '@/lib/types';
import SubscriptionModal from '@/components/SubscriptionModal';
import WebRTCCall from '@/components/WebRTCCall';

interface Props { onBack: () => void; }
type RoomPerson = Pick<Profile, 'id' | 'display_name' | 'photo_url'>;

export default function RoomsPageV2({ onBack }: Props) {
  const { user, hasActiveSubscription } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadRooms = async () => {
    if (!user) return;
    setLoading(true); setError(null);
    const owned = await supabase.from('rooms').select('*').eq('owner', user.id).order('created_at', { ascending: false });
    const joined = await supabase.from('room_members').select('room_id').eq('user_id', user.id);
    if (owned.error || joined.error) { setError('Could not load rooms. Please retry.'); setLoading(false); return; }
    const ids = (joined.data || []).map((x: { room_id: string }) => x.room_id);
    let all = (owned.data || []) as Room[];
    if (ids.length) {
      const extra = await supabase.from('rooms').select('*').in('id', ids);
      all = [...all, ...((extra.data || []) as Room[])];
    }
    const unique = Array.from(new Map(all.map(r => [r.id, r])).values());
    setRooms(unique);
    const next: Record<string, number> = {};
    if (unique.length) {
      const memberRows = await supabase.from('room_members').select('room_id').in('room_id', unique.map(r => r.id));
      (memberRows.data || []).forEach((m: { room_id: string }) => { next[m.room_id] = (next[m.room_id] || 0) + 1; });
      unique.forEach(r => { next[r.id] = (next[r.id] || 0) + 1; });
    }
    setCounts(next); setLoading(false);
  };

  useEffect(() => { void loadRooms(); }, [user?.id]);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error: insertError } = await supabase.from('rooms').insert({ name: name.trim(), description: description.trim() || null, owner: user.id });
    if (insertError) { setError(insertError.message || 'Could not create the room.'); return; }
    setName(''); setDescription(''); setShowCreate(false); await loadRooms();
  };

  const enterRoom = async (room: Room) => {
    if (!hasActiveSubscription) { setShowSub(true); return; }
    if (room.owner !== user?.id) {
      const { error: joinError } = await supabase.from('room_members').upsert({ room_id: room.id, user_id: user!.id }, { onConflict: 'room_id,user_id', ignoreDuplicates: true });
      if (joinError) { setError(joinError.message || 'Could not join the room.'); return; }
    }
    setActiveRoom(room);
  };

  const deleteRoom = async (room: Room) => {
    const { error: deleteError } = await supabase.from('rooms').delete().eq('id', room.id);
    if (deleteError) { setError(deleteError.message || 'Could not delete the room.'); return; }
    setRooms(prev => prev.filter(r => r.id !== room.id));
  };

  if (activeRoom) return <RoomChat room={activeRoom} onBack={() => { setActiveRoom(null); void loadRooms(); }} />;

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">Rooms</h1>
        <button onClick={() => hasActiveSubscription ? setShowCreate(true) : setShowSub(true)} className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white flex items-center justify-center"><Plus className="w-5 h-5" /></button>
      </div>
      {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}<button className="ml-3 font-bold" onClick={() => setError(null)}>×</button></div>}
      {loading ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-rose-500 animate-spin" /></div> : rooms.length === 0 ? <div className="text-center py-20"><Users className="w-12 h-12 mx-auto text-rose-300"/><h2 className="mt-3 font-bold text-gray-900">No rooms yet</h2><p className="text-sm text-gray-500">Create a room to start chatting and calling.</p></div> : <div className="space-y-3">{rooms.map(room => <div key={room.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm"><button onClick={() => void enterRoom(room)} className="flex-1 text-left flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center"><MessageSquare className="text-white"/></div><div className="min-w-0"><div className="font-semibold truncate">{room.name}</div><div className="text-xs text-gray-500 truncate">{room.description || 'Private room'} · {counts[room.id] || 1} member{(counts[room.id] || 1) === 1 ? '' : 's'}</div></div></button>{room.owner === user?.id && <button onClick={() => void deleteRoom(room)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>}</div>)}</div>}
      {showCreate && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><div className="bg-white rounded-2xl p-6 w-full max-w-sm"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-lg">Create Room</h3><button onClick={() => setShowCreate(false)}><X/></button></div><form onSubmit={createRoom} className="space-y-4"><input required value={name} onChange={e => setName(e.target.value)} placeholder="Room name" className="w-full px-4 py-3 rounded-xl border"/><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" className="w-full px-4 py-3 rounded-xl border"/><button className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold">Create</button></form></div></div>}
      {showSub && <SubscriptionModal onClose={() => setShowSub(false)} reason="Subscribe to create and join private rooms"/>}
    </div>
  );
}

function RoomChat({ room, onBack }: { room: Room; onBack: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [members, setMembers] = useState<RoomPerson[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCalls, setShowCalls] = useState(false);
  const [activeCall, setActiveCall] = useState<{ call: Call; person: RoomPerson } | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const [giftMessage, setGiftMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [messageResult, memberResult] = await Promise.all([
      supabase.from('room_messages').select('*').eq('room_id', room.id).order('created_at', { ascending: true }),
      supabase.rpc('get_room_members_with_profiles', { p_room_id: room.id }),
    ]);
    const data = (messageResult.data || []) as RoomMessage[];
    setMessages(data);
    const map: Record<string, Profile> = {};
    if (data.length) {
      const ids = Array.from(new Set(data.map(m => m.sender)));
      const result = await supabase.from('profiles').select('*').in('id', ids);
      (result.data || []).forEach((p: Profile) => { map[p.id] = p; });
    }
    setProfiles(map);
    setMembers(((memberResult.data || []) as RoomPerson[]).filter(p => p.id !== user?.id));
    setLoading(false);
  };

  useEffect(() => { void load(); const channel = supabase.channel(`room-chat:${room.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${room.id}` }, payload => { const msg = payload.new as RoomMessage; setMessages(prev => prev.some(x => x.id === msg.id) ? prev : [...prev, msg]); }).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [room.id, user?.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user || !input.trim()) return;
    const content = input.trim(); setInput('');
    const { data, error } = await supabase.from('room_messages').insert({ room_id: room.id, sender: user.id, content }).select('*').single();
    if (error) { setInput(content); setGiftMessage(error.message); return; }
    if (data) setMessages(prev => prev.some(x => x.id === data.id) ? prev : [...prev, data as RoomMessage]);
  };

  const startCall = async (person: RoomPerson, type: 'audio' | 'video') => {
    if (!user || callBusy) return;
    setCallBusy(true); setGiftMessage(null);
    const { data, error } = await supabase.from('calls').insert({ room_id: room.id, callee: person.id, caller: user.id, call_type: type, status: 'initiated' }).select('*').single();
    setCallBusy(false);
    if (error || !data) { setGiftMessage(error?.message || 'Could not start the call.'); return; }
    setActiveCall({ call: data as Call, person }); setShowCalls(false);
  };

  const sendGift = async (giftId: string) => {
    const { data, error } = await supabase.rpc('send_virtual_gift', { p_room_id: room.id, p_gift_id: giftId });
    setGiftMessage(error ? error.message : data?.message || 'Gift sent successfully.');
  };

  if (activeCall) return <WebRTCCall call={activeCall.call} role="caller" otherProfile={activeCall.person as Profile} onClose={() => setActiveCall(null)} />;

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col bg-gray-50">
      <header className="flex items-center gap-2 p-3 border-b bg-white">
        <button onClick={onBack} className="p-2 text-gray-600"><ArrowLeft className="w-5 h-5"/></button>
        <div className="flex-1 min-w-0"><div className="font-bold truncate">{room.name}</div><div className="text-xs text-gray-500">Room chat</div></div>
        <button onClick={() => setShowCalls(v => !v)} className="p-2 rounded-full bg-rose-50 text-rose-600" title="Room calls"><Phone className="w-5 h-5"/></button>
        <button onClick={() => setShowCalls(v => !v)} className="p-2 rounded-full bg-rose-50 text-rose-600" title="Room video calls"><Video className="w-5 h-5"/></button>
      </header>
      {showCalls && <div className="bg-white border-b p-3"><div className="font-semibold text-sm mb-2">Call a room member</div>{members.length === 0 ? <div className="text-xs text-gray-500">No other room members yet.</div> : <div className="space-y-2">{members.map(person => <div key={person.id} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50"><div className="w-9 h-9 rounded-full overflow-hidden bg-rose-100">{person.photo_url && <img src={person.photo_url} alt="" className="w-full h-full object-cover"/>}</div><div className="flex-1 text-sm font-medium">{person.display_name}</div><button disabled={callBusy} onClick={() => void startCall(person, 'audio')} className="p-2 rounded-full bg-green-50 text-green-600"><Phone className="w-4 h-4"/></button><button disabled={callBusy} onClick={() => void startCall(person, 'video')} className="p-2 rounded-full bg-blue-50 text-blue-600"><Video className="w-4 h-4"/></button></div>)}</div>}</div>}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">{loading ? <Loader2 className="w-6 h-6 mx-auto text-rose-500 animate-spin"/> : messages.length === 0 ? <div className="text-center text-sm text-gray-400 py-12">No messages yet. Start the conversation.</div> : messages.map(msg => { const mine = msg.sender === user?.id; const sender = profiles[msg.sender]; return <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className="max-w-[80%]">{!mine && <div className="text-[11px] text-gray-400 px-2 mb-1">{sender?.display_name || 'Member'}</div>}<div className={`px-4 py-2.5 rounded-2xl text-sm ${mine ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-br-md' : 'bg-white text-gray-800 shadow-sm rounded-bl-md'}`}>{msg.content}</div></div></div>; })}</div>
      {giftMessage && <div className="px-4 py-2 bg-amber-50 text-amber-800 text-xs border-t">{giftMessage}</div>}
      <div className="p-3 bg-white border-t"><RoomGifts onSend={sendGift}/><form onSubmit={sendMessage} className="flex gap-2 mt-2"><input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." className="flex-1 px-4 py-2.5 rounded-full border"/><button disabled={!input.trim()} className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 text-white flex items-center justify-center disabled:opacity-50"><Send className="w-5 h-5"/></button></form></div>
    </div>
  );
}

function RoomGifts({ onSend }: { onSend: (giftId: string) => void }) {
  const [gifts, setGifts] = useState<Array<{ id: string; emoji: string; price: number }>>([]);
  useEffect(() => { void supabase.from('virtual_gifts').select('id,emoji,price').eq('active', true).order('sort_order').then(({ data }) => setGifts((data || []) as Array<{ id: string; emoji: string; price: number }>)); }, []);
  return <div className="flex gap-2 overflow-x-auto"><div className="flex items-center gap-1 text-xs font-semibold text-gray-500 shrink-0"><Gift className="w-4 h-4"/> Gifts</div>{gifts.map(g => <button key={g.id} type="button" onClick={() => onSend(g.id)} className="shrink-0 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-semibold">{g.emoji} ₦{Number(g.price).toLocaleString()}</button>)}</div>;
}

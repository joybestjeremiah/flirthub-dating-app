import { useEffect, useState } from 'react';
import { Phone, Video, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Call, Profile } from '@/lib/types';
import WebRTCCall from '@/components/WebRTCCall';

interface Props {
  userId: string;
}

export default function IncomingCall({ userId }: Props) {
  const [call, setCall] = useState<Call | null>(null);
  const [caller, setCaller] = useState<Profile | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'calls' }, async (payload) => {
        const incoming = payload.new as Call;
        if (incoming.caller === userId || incoming.status !== 'initiated') return;

        const { data: match } = await supabase
          .from('matches')
          .select('id')
          .eq('id', incoming.match_id)
          .or(`user1.eq.${userId},user2.eq.${userId}`)
          .maybeSingle();

        if (!match) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', incoming.caller)
          .maybeSingle();

        setCall(incoming);
        setCaller(profile as Profile | null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  if (active && call) return <WebRTCCall call={call} role="callee" otherProfile={caller} onClose={() => { setActive(false); setCall(null); }} />;

  if (!call) return null;

  const close = () => setCall(null);

  const updateCall = async (status: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('calls')
      .update({
        status,
        ...(status === 'accepted' ? { started_at: new Date().toISOString() } : { ended_at: new Date().toISOString() }),
      })
      .eq('id', call.id);

    if (error) console.error('Failed to update incoming call', error);
    close();
  };

  const isVideo = call.call_type === 'video';

  return (
    <div className="fixed inset-0 z-[60] bg-gray-950/90 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">
          Incoming {isVideo ? 'video' : 'audio'} call
        </div>
        <div className="w-24 h-24 mx-auto mt-5 rounded-full overflow-hidden bg-rose-100">
          {caller?.photo_url ? (
            <img src={caller.photo_url} alt={caller.display_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isVideo ? <Video className="w-10 h-10 text-rose-300" /> : <Phone className="w-10 h-10 text-rose-300" />}
            </div>
          )}
        </div>
        <h2 className="mt-4 text-xl font-bold text-gray-900">{caller?.display_name || 'Someone'}</h2>
        <p className="mt-1 text-sm text-gray-500">is calling you</p>

        <div className="flex items-center justify-center gap-4 mt-7">
          <button onClick={() => updateCall('rejected')} className="w-14 h-14 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center">
            <X className="w-6 h-6" />
          </button>
          <button onClick={async () => { await updateCall('accepted'); setActive(true); }} className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center">
            <Phone className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

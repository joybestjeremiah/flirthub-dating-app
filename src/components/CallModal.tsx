import { useEffect, useState } from 'react';
import { Phone, Video, X, Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Call, Match, Profile } from '@/lib/types';
import WebRTCCall from '@/components/WebRTCCall';

interface MatchWithProfile extends Match { otherProfile: Profile; }
interface Props { match: MatchWithProfile; callType: 'audio' | 'video'; onClose: () => void; }

export default function CallModal({ match, callType, onClose }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'calling' | 'ended' | 'error'>('calling');
  const [muted, setMuted] = useState(false);
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (!user) return;
      const { data, error } = await supabase.rpc('create_match_call', { p_match_id: match.id, p_call_type: callType });
      if (cancelled) return;
      if (error || !data) {
        console.error('Failed to start call', error);
        setStatus('error');
        return;
      }
      setCall(data as Call);
    };
    void start();
    return () => { cancelled = true; };
  }, [user?.id, match.id, callType]);

  const handleEnd = async () => {
    if (call?.id) {
      await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
    }
    setStatus('ended');
    window.setTimeout(onClose, 300);
  };

  if (call && status === 'calling') {
    return <WebRTCCall call={call} role="caller" otherProfile={match.otherProfile} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-rose-950 to-gray-900 flex flex-col items-center justify-between p-8">
      <div className="w-full text-center pt-8">
        <div className="text-white/60 text-sm uppercase tracking-wide">{callType === 'video' ? 'Video Call' : 'Audio Call'}</div>
        <div className="text-white text-xl font-semibold mt-2">{match.otherProfile?.display_name}</div>
        <div className="text-white/60 text-sm mt-2">
          {status === 'calling' && <><Loader2 className="inline w-4 h-4 mr-1 animate-spin" /> Calling…</>}
          {status === 'error' && 'Could not start the call.'}
          {status === 'ended' && 'Call ended'}
        </div>
      </div>
      <div className="flex flex-col items-center">
        <div className="w-40 h-40 rounded-full overflow-hidden bg-white/10 border-4 border-white/20">
          {match.otherProfile?.photo_url ? <img src={match.otherProfile.photo_url} alt={match.otherProfile.display_name} className="w-full h-full object-cover" /> : (callType === 'video' ? <Video className="w-16 h-16 text-white/40 m-auto mt-10" /> : <Phone className="w-16 h-16 text-white/40 m-auto mt-10" />)}
        </div>
      </div>
      <div className="flex items-center gap-4 pb-8">
        {status === 'calling' && <button onClick={() => setMuted(v => !v)} className={`w-14 h-14 rounded-full flex items-center justify-center ${muted ? 'bg-white text-gray-900' : 'bg-white/20 text-white'}`}>{muted ? <MicOff /> : <Mic />}</button>}
        <button onClick={handleEnd} className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center"><Phone className="w-7 h-7 rotate-[135deg]" /></button>
        {status === 'error' && <button onClick={onClose} className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center"><X /></button>}
      </div>
    </div>
  );
}

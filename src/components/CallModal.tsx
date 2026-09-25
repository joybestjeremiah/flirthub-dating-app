import { useEffect, useState } from 'react';
import { Phone, Video, X, Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Call, Match, Profile } from '@/lib/types';
import WebRTCCall from '@/components/WebRTCCall';

interface MatchWithProfile extends Match {
  otherProfile: Profile;
}

interface Props {
  match: MatchWithProfile;
  callType: 'audio' | 'video';
  onClose: () => void;
}

export default function CallModal({ match, callType, onClose }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<'calling' | 'ended'>('calling');
  const [muted, setMuted] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  useEffect(() => {
    const startCall = async () => {
      if (!user) return;
      const { data, error } = await supabase.from('calls').insert({
        match_id: match.id,
        caller: user.id,
        call_type: callType,
        status: 'initiated',
      }).select('id').single();

      if (error || !data) {
        console.error('Failed to start call', error);
        setStatus('ended');
        setTimeout(onClose, 1000);
        return;
      }

      setCallId(data.id);
      setCall({ id: data.id, match_id: match.id, caller: user.id, call_type: callType, status: 'initiated', started_at: '', ended_at: null });
    };
    startCall();
  }, [user, match.id, callType, onClose]);

  const handleEnd = async () => {
    if (callId) {
      const { error } = await supabase
        .from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', callId);
      if (error) console.error('Failed to end call', error);
    }
    setStatus('ended');
    setTimeout(onClose, 1000);
  };

  const other = match.otherProfile;

  if (call) return <WebRTCCall call={call} role="caller" otherProfile={other} onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-rose-950 to-gray-900 flex flex-col items-center justify-between p-8">
      <div className="w-full text-center pt-8">
        <div className="text-white/60 text-sm uppercase tracking-wide">
          {callType === 'video' ? 'Video Call' : 'Audio Call'}
        </div>
        <div className="text-white text-xl font-semibold mt-2">{other?.display_name}</div>
        <div className="text-white/50 text-sm mt-1">
          {status === 'calling' && 'Call request sent...'}
          {status === 'ended' && 'Call ended'}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className={`w-40 h-40 rounded-full overflow-hidden bg-white/10 border-4 border-white/20 ${status === 'calling' ? 'animate-pulse' : ''}`}>
          {other?.photo_url ? (
            <img src={other.photo_url} alt={other.display_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {callType === 'video' ? (
                <Video className="w-16 h-16 text-white/40" />
              ) : (
                <Phone className="w-16 h-16 text-white/40" />
              )}
            </div>
          )}
        </div>
        {status === 'calling' && (
          <div className="mt-6 text-center text-white/60 text-sm">
            Waiting for the other person to respond
          </div>
        )}
        {status === 'calling' && (
          <div className="mt-6 text-center text-white/60 text-sm">
            Waiting for the other person to respond
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 pb-8">
        {status !== 'ended' && (
          <button
            onClick={() => setMuted(!muted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              muted ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
            }`}
          >
            {muted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={handleEnd}
          className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-500/30"
        >
          <Phone className="w-7 h-7 rotate-[135deg]" />
        </button>
      </div>
    </div>
  );
}

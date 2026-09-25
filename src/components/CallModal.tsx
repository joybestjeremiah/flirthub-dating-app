import { useEffect, useState } from 'react';
import { Phone, Video, X, Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Match, Profile } from '@/lib/types';

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
  const [status, setStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const startCall = async () => {
      if (!user) return;
      await supabase.from('calls').insert({
        match_id: match.id,
        caller: user.id,
        call_type: callType,
        status: 'initiated',
      });
      setTimeout(() => setStatus('connected'), 2500);
    };
    startCall();
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const handleEnd = () => {
    setStatus('ended');
    setTimeout(onClose, 1000);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const other = match.otherProfile;

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-rose-950 to-gray-900 flex flex-col items-center justify-between p-8">
      <div className="w-full text-center pt-8">
        <div className="text-white/60 text-sm uppercase tracking-wide">
          {callType === 'video' ? 'Video Call' : 'Audio Call'}
        </div>
        <div className="text-white text-xl font-semibold mt-2">{other?.display_name}</div>
        <div className="text-white/50 text-sm mt-1">
          {status === 'calling' && 'Calling...'}
          {status === 'connected' && formatTime(duration)}
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
          <div className="mt-6 flex gap-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-white/40 animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
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

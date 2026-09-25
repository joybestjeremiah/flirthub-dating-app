import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, Video, VideoOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Call, Profile } from '@/lib/types';

interface Props {
  call: Call;
  role: 'caller' | 'callee';
  otherProfile?: Profile | null;
  onClose: () => void;
}

const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

if (turnUrl && turnUsername && turnCredential) {
  iceServers.push({
    urls: turnUrl,
    username: turnUsername,
    credential: turnCredential,
  });
}

const config: RTCConfiguration = {
  iceServers,
  iceTransportPolicy: 'all',
};

export default function WebRTCCall({ call, role, otherProfile, onClose }: Props) {
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(call.call_type === 'video');
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [remoteReady, setRemoteReady] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const appliedCandidates = useRef(new Set<string>());

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const run = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: call.call_type === 'video',
        });
        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        local.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;

        const connection = new RTCPeerConnection(config);
        pc.current = connection;
        stream.getTracks().forEach(track => connection.addTrack(track, stream));

        connection.onconnectionstatechange = () => {
          setConnectionState(connection.connectionState);
          if (connection.connectionState === 'failed' || connection.connectionState === 'disconnected') {
            setError('The call connection was lost. Please try again.');
            if (timer.current) {
              clearInterval(timer.current);
              timer.current = null;
            }
          } else if (connection.connectionState === 'connected') {
            setError(null);
            if (!timer.current) {
              timer.current = setInterval(() => setElapsed(value => value + 1), 1000);
            }
          }
        };

        connection.ontrack = event => {
          if (remoteVideo.current && event.streams[0]) {
            remoteVideo.current.srcObject = event.streams[0];
            setRemoteReady(true);
          }
        };

        const appendCandidate = async (candidate: RTCIceCandidate) => {
          await supabase.from('call_ice_candidates').insert({
            call_id: call.id,
            user_id: role === 'caller' ? call.caller : (await supabase.auth.getUser()).data.user?.id,
            candidate: candidate.toJSON(),
          });
        };

        connection.onicecandidate = event => {
          if (event.candidate) void appendCandidate(event.candidate);
        };

        channel = supabase.channel(`webrtc-call-${call.id}`);
        channel.on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_ice_candidates',
          filter: `call_id=eq.${call.id}`,
        }, async payload => {
          const row = payload.new as { user_id: string; candidate: RTCIceCandidateInit };
          if ((role === 'caller' && row.user_id === call.caller) || (role === 'callee' && row.user_id !== call.caller)) return;
          const candidate = row.candidate;
          const key = candidate.candidate || JSON.stringify(candidate);
          if (appliedCandidates.current.has(key)) return;
          if (!connection.remoteDescription) {
            pendingCandidates.current.push(candidate);
            return;
          }
          try {
            await connection.addIceCandidate(candidate);
            appliedCandidates.current.add(key);
          } catch {}
        });
        channel
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'calls',
            filter: `id=eq.${call.id}`,
          }, async payload => {
            const updated = payload.new as Call;

            if (updated.status === 'ended' || updated.status === 'rejected') {
              onClose();
              return;
            }

            if (role === 'caller' && updated.answer && !connection.currentRemoteDescription) {
              await connection.setRemoteDescription(updated.answer);
            }

            if (updated.answer && role === 'caller' && !connection.currentRemoteDescription) {
              await connection.setRemoteDescription(updated.answer);
            }
          })
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'call_ice_candidates',
            filter: `call_id=eq.${call.id}`,
          }, async payload => {
            const row = payload.new as { user_id: string; candidate: RTCIceCandidateInit };
            const currentUser = (await supabase.auth.getUser()).data.user?.id;
            if (!currentUser || row.user_id === currentUser) return;
            const candidate = row.candidate;
            const key = candidate.candidate || JSON.stringify(candidate);
            if (appliedCandidates.current.has(key)) return;
            if (!connection.remoteDescription) {
              pendingCandidates.current.push(candidate);
              return;
            }
            try {
              await connection.addIceCandidate(candidate);
              appliedCandidates.current.add(key);
            } catch {}
          })
          .subscribe();

        const { data: existingCandidates } = await supabase
          .from('call_ice_candidates')
          .select('user_id,candidate')
          .eq('call_id', call.id)
          .order('created_at', { ascending: true });

        if (existingCandidates) {
          for (const row of existingCandidates as { user_id: string; candidate: RTCIceCandidateInit }[]) {
            if ((role === 'caller' && row.user_id === call.caller) || (role === 'callee' && row.user_id !== call.caller)) continue;
            const key = row.candidate.candidate || JSON.stringify(row.candidate);
            if (appliedCandidates.current.has(key)) continue;
            if (!connection.remoteDescription) {
              pendingCandidates.current.push(row.candidate);
              continue;
            }
            try {
              await connection.addIceCandidate(row.candidate);
              appliedCandidates.current.add(key);
            } catch {}
          }
        }

        const { data: current } = await supabase.from('calls').select('*').eq('id', call.id).single();
        const currentCall = current as Call;

        if (role === 'caller') {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          await supabase.from('calls').update({
            offer: { type: offer.type, sdp: offer.sdp },
          }).eq('id', call.id);
        } else if (currentCall.offer) {
          await connection.setRemoteDescription(currentCall.offer);
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          await supabase.from('calls').update({
            answer: { type: answer.type, sdp: answer.sdp },
            status: 'accepted',
            started_at: new Date().toISOString(),
          }).eq('id', call.id);
        }
      } catch (err) {
        console.error('WebRTC setup failed', err);
        setError('Camera or microphone access failed. Please allow browser permissions and try again.');
      }
    };

    void run();

    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
      local.current?.getTracks().forEach(track => track.stop());
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      pc.current?.close();
      pc.current = null;
    };
  }, [call, role, onClose]);

  const formatElapsed = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remaining = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remaining}`;
  };

  const endCall = async () => {
    await supabase.from('calls').update({
      status: 'ended',
      ended_at: new Date().toISOString(),
    }).eq('id', call.id);
    onClose();
  };

  const toggleMute = () => {
    const track = local.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  const toggleCamera = () => {
    const track = local.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamera(track.enabled);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-gray-950 flex flex-col">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {connectionState === 'connected' && !remoteReady && !error && (
          <div className="absolute top-5 left-5 right-5 z-10 rounded-xl bg-black/50 px-4 py-2 text-center text-white text-sm backdrop-blur">
            Waiting for remote media…
          </div>
        )}
        {connectionState !== 'connected' && !error && (
          <div className="absolute top-5 left-5 right-5 z-10 rounded-xl bg-black/50 px-4 py-2 text-center text-white text-sm backdrop-blur">
            {connectionState === 'connecting' ? 'Connecting call…' : 'Setting up call…'}
          </div>
        )}
        <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover bg-gray-900" />
        {call.call_type === 'video' ? (
          <video ref={localVideo} autoPlay muted playsInline className="absolute top-5 right-5 w-28 h-40 rounded-2xl object-cover border border-white/20 bg-gray-800" />
        ) : (
          <div className="text-center text-white">
            <div className="w-28 h-28 mx-auto rounded-full overflow-hidden bg-white/10">
              {otherProfile?.photo_url && <img src={otherProfile.photo_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <p className="mt-4 text-lg font-semibold">{otherProfile?.display_name || 'Call'}</p>
          </div>
        )}
        {error && <div className="absolute bottom-6 left-6 right-6 rounded-xl bg-red-500/90 p-3 text-white text-sm text-center">{error}</div>}
      </div>
      <div className="flex flex-col items-center gap-4 p-7">
        {connectionState === 'connected' && <div className="text-white text-sm font-medium tabular-nums">{formatElapsed(elapsed)}</div>}
        <div className="flex justify-center items-center gap-5">
        <button onClick={toggleMute} className="w-14 h-14 rounded-full bg-white/15 text-white flex items-center justify-center">
          {muted ? <MicOff /> : <Mic />}
        </button>
        {call.call_type === 'video' && (
          <button onClick={toggleCamera} className="w-14 h-14 rounded-full bg-white/15 text-white flex items-center justify-center">
            {camera ? <Video /> : <VideoOff />}
          </button>
        )}
          <button onClick={endCall} className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center">
            <Phone className="rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
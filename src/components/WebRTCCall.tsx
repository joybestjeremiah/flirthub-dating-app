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

const config: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function WebRTCCall({ call, role, otherProfile, onClose }: Props) {
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(call.call_type === 'video');
  const [error, setError] = useState<string | null>(null);

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

        connection.ontrack = event => {
          if (remoteVideo.current && event.streams[0]) {
            remoteVideo.current.srcObject = event.streams[0];
          }
        };

        const appendCandidate = async (field: 'caller_ice' | 'callee_ice', candidate: RTCIceCandidate) => {
          const { data } = await supabase.from('calls').select(field).eq('id', call.id).single();
          const current = ((data?.[field] as RTCIceCandidateInit[] | null) || []);
          await supabase.from('calls').update({
            [field]: [...current, candidate.toJSON()],
          }).eq('id', call.id);
        };

        connection.onicecandidate = event => {
          if (event.candidate) {
            void appendCandidate(role === 'caller' ? 'caller_ice' : 'callee_ice', event.candidate);
          }
        };

        channel = supabase.channel(`webrtc-call-${call.id}`);
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

            const remoteCandidates = role === 'caller'
              ? (updated.callee_ice || [])
              : (updated.caller_ice || []);

            for (const candidate of remoteCandidates) {
              try {
                await connection.addIceCandidate(candidate);
              } catch {}
            }
          })
          .subscribe();

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
      pc.current?.close();
      pc.current = null;
    };
  }, [call, role, onClose]);

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
      <div className="flex justify-center items-center gap-5 p-7">
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
  );
}
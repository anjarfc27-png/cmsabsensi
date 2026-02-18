import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type CallStatus = 'ringing' | 'active' | 'ended' | 'missed' | 'rejected' | 'idle';

interface CallSession {
    id: string;
    caller_id: string;
    receiver_id: string;
    signaling_id: string;
    status: CallStatus;
    profile?: {
        full_name: string;
        avatar_url: string;
    }
}

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export const useVoiceCall = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
    const [isIncoming, setIsIncoming] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);

    // Initial check for existing ringing calls on load
    useEffect(() => {
        const checkExistingCall = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('calls' as any)
                .select('*, caller:profiles!caller_id(full_name, avatar_url)')
                .eq('receiver_id', user.id)
                .eq('status', 'ringing')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                setCurrentCall({
                    ...data,
                    profile: (data as any).caller
                } as any);
                setIsIncoming(true);
            }
        };
        checkExistingCall();
    }, [user]);

    const cleanup = useCallback(() => {
        console.log('Cleaning up voice call resources...');
        pcRef.current?.close();
        pcRef.current = null;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        localStream?.getTracks().forEach(track => track.stop());
        setLocalStream(null);
        setRemoteStream(null);

        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current = null;
        }
    }, [localStream]);

    // Update DB status helper
    const updateCallStatus = async (callId: string, status: CallStatus) => {
        await supabase
            .from('calls' as any)
            .update({
                status: status,
                ended_at: (status === 'ended' || status === 'rejected' || status === 'missed') ? new Date().toISOString() : null
            } as any)
            .eq('id', callId);
    };

    // SETUP WEBRTC
    const setupPeerConnection = useCallback(async (signalingId: string, isCaller: boolean) => {
        cleanup();

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        // Capture Mic
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        } catch (err) {
            console.error('Mic access denied:', err);
            toast({ title: "Error", description: "Akses mikrofon ditolak.", variant: "destructive" });
            return;
        }

        // Handle incoming remote stream
        pc.ontrack = (event) => {
            console.log('Received remote track');
            setRemoteStream(event.streams[0]);
        };

        // Signaling via Broadcast Channel
        const channel = supabase.channel(signalingId);
        channelRef.current = channel;

        channel
            .on('broadcast', { event: 'ice-candidate' }, ({ payload }) => {
                if (payload.candidate) {
                    pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                }
            })
            .on('broadcast', { event: 'sdp-offer' }, async ({ payload }) => {
                if (!isCaller) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    channel.send({ type: 'broadcast', event: 'sdp-answer', payload: { sdp: answer } });
                }
            })
            .on('broadcast', { event: 'sdp-answer' }, async ({ payload }) => {
                if (isCaller) {
                    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED' && isCaller) {
                    // Send offer if we are the caller
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    channel.send({ type: 'broadcast', event: 'sdp-offer', payload: { sdp: offer } });
                }
            });

        // Send ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                channel.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: event.candidate } });
            }
        };

        return pc;
    }, [cleanup, toast]);

    // ACTIONS
    const startCall = useCallback(async (receiverId: string, receiverName: string) => {
        if (!user) return;
        const signalingId = `vc_${user.id}_${Date.now()}`;

        const { data, error } = await supabase
            .from('calls' as any)
            .insert({
                caller_id: user.id,
                receiver_id: receiverId,
                status: 'ringing',
                signaling_id: signalingId
            })
            .select('*, profile:profiles!receiver_id(full_name, avatar_url)')
            .single();

        if (error) return;

        setCurrentCall({ ...data, profile: (data as any).profile } as any);
        setIsIncoming(false);
        setupPeerConnection(signalingId, true);
    }, [user, setupPeerConnection]);

    const acceptCall = useCallback(async () => {
        if (!currentCall) return;
        await updateCallStatus(currentCall.id, 'active');
        setCurrentCall(prev => prev ? { ...prev, status: 'active' } : null);
        await setupPeerConnection(currentCall.signaling_id, false);
    }, [currentCall, setupPeerConnection]);

    const endCall = useCallback(async (status: CallStatus = 'ended') => {
        if (!currentCall) return;
        await updateCallStatus(currentCall.id, status);
        cleanup();
        setCurrentCall(null);
        setIsIncoming(false);
    }, [currentCall, cleanup]);

    // Watch status changes from other side
    useEffect(() => {
        if (!currentCall?.id) return;

        const channel = supabase
            .channel(`call_status_${currentCall.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'calls',
                filter: `id=eq.${currentCall.id}`
            }, (payload: any) => {
                const updated = payload.new as CallSession;
                if (updated.status === 'ended' || updated.status === 'rejected' || updated.status === 'missed') {
                    cleanup();
                    setCurrentCall(null);
                    setIsIncoming(false);
                    toast({ title: "Panggilan Berakhir", description: `Status: ${updated.status}` });
                } else if (updated.status === 'active' && !localStream) {
                    // Receiver accepted, but we are caller
                    // The setupPeerConnection already handles the stream flow
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentCall?.id, cleanup, toast, localStream]);

    // Handle incoming call listeners
    useEffect(() => {
        if (!user || currentCall) return;

        const channel = supabase
            .channel('global_calls')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'calls',
                filter: `receiver_id=eq.${user.id}`
            }, async (payload: any) => {
                const newCall = payload.new as CallSession;
                if (newCall.status === 'ringing') {
                    // Fetch caller profile for UI
                    const { data: prof } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', newCall.caller_id).single();
                    setCurrentCall({ ...newCall, profile: prof as any });
                    setIsIncoming(true);

                    // Simple ringtone
                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3');
                    audio.loop = true;
                    audio.play().catch(() => { });
                    ringtoneRef.current = audio;
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user, currentCall]);

    return {
        currentCall,
        isIncoming,
        startCall,
        acceptCall,
        endCall,
        localStream,
        remoteStream
    };
};


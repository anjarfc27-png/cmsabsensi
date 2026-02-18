import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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

interface VoiceCallContextType {
    currentCall: CallSession | null;
    isIncoming: boolean;
    startCall: (receiverId: string, receiverName: string) => Promise<void>;
    acceptCall: () => Promise<void>;
    endCall: (status?: CallStatus) => Promise<void>;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
}

const VoiceCallContext = createContext<VoiceCallContextType | undefined>(undefined);

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export const VoiceCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
    const [isIncoming, setIsIncoming] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    const pcRef = useRef<RTCPeerConnection | null>(null);
    const channelRef = useRef<any>(null);
    const ringtoneRef = useRef<HTMLAudioElement | null>(null);

    const cleanup = useCallback(() => {
        console.log('Cleaning up voice call resources...');
        pcRef.current?.close();
        pcRef.current = null;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        setRemoteStream(null);

        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current = null;
        }
    }, [localStream]);

    const updateCallStatus = async (callId: string, status: CallStatus) => {
        await supabase
            .from('calls' as any)
            .update({
                status: status,
                ended_at: (status === 'ended' || status === 'rejected' || status === 'missed') ? new Date().toISOString() : null
            } as any)
            .eq('id', callId);
    };

    const setupPeerConnection = useCallback(async (signalingId: string, isCaller: boolean) => {
        // Close existing if any
        pcRef.current?.close();

        const pc = new RTCPeerConnection(ICE_SERVERS);
        pcRef.current = pc;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        } catch (err) {
            console.error('Mic access denied:', err);
            toast({ title: "Error", description: "Akses mikrofon ditolak.", variant: "destructive" });
            return;
        }

        pc.ontrack = (event) => {
            console.log('Received remote track');
            setRemoteStream(event.streams[0]);
        };

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
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    channel.send({ type: 'broadcast', event: 'sdp-offer', payload: { sdp: offer } });
                }
            });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                channel.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: event.candidate } });
            }
        };

        return pc;
    }, [toast]);

    const startCall = useCallback(async (receiverId: string, receiverName: string) => {
        if (!user) {
            toast({ title: "Error", description: "Anda harus login untuk menelpon.", variant: "destructive" });
            return;
        }

        const signalingId = `vc_${user.id}_${Date.now()}`;

        try {
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

            if (error) {
                toast({ title: "Gagal Menelpon", description: error.message, variant: "destructive" });
                return;
            }

            setCurrentCall({ ...data, profile: (data as any).profile } as any);
            setIsIncoming(false);
            await setupPeerConnection(signalingId, true);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    }, [user, setupPeerConnection, toast]);

    const acceptCall = useCallback(async () => {
        if (!currentCall) return;
        await updateCallStatus(currentCall.id, 'active');
        setCurrentCall(prev => prev ? { ...prev, status: 'active' } : null);
        await setupPeerConnection(currentCall.signaling_id, false);

        if (ringtoneRef.current) {
            ringtoneRef.current.pause();
            ringtoneRef.current = null;
        }
    }, [currentCall, setupPeerConnection]);

    const endCall = useCallback(async (status: CallStatus = 'ended') => {
        if (!currentCall) return;
        await updateCallStatus(currentCall.id, status);
        cleanup();
        setCurrentCall(null);
        setIsIncoming(false);
    }, [currentCall, cleanup]);

    // Initial check for existing ringing calls
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

    // Realtime listeners
    useEffect(() => {
        if (!user) return;

        // Listen for new calls
        const globalChannel = supabase
            .channel('global_calls_incoming')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'calls',
                filter: `receiver_id=eq.${user.id}`
            }, async (payload: any) => {
                const newCall = payload.new as CallSession;
                if (newCall.status === 'ringing') {
                    const { data: prof } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', newCall.caller_id).single();
                    setCurrentCall({ ...newCall, profile: prof as any });
                    setIsIncoming(true);

                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3');
                    audio.loop = true;
                    audio.play().catch(() => { });
                    ringtoneRef.current = audio;
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(globalChannel); };
    }, [user]);

    // Listen for current call status changes
    useEffect(() => {
        if (!currentCall?.id) return;

        const statusChannel = supabase
            .channel(`call_status_${currentCall.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'calls',
                filter: `id=eq.${currentCall.id}`
            }, (payload: any) => {
                const updated = payload.new as CallSession;
                if (['ended', 'rejected', 'missed'].includes(updated.status)) {
                    cleanup();
                    setCurrentCall(null);
                    setIsIncoming(false);
                    toast({ title: "Panggilan Berakhir", description: `Status: ${updated.status}` });
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(statusChannel); };
    }, [currentCall?.id, cleanup, toast]);

    return (
        <VoiceCallContext.Provider value={{
            currentCall,
            isIncoming,
            startCall,
            acceptCall,
            endCall,
            localStream,
            remoteStream
        }}>
            {children}
        </VoiceCallContext.Provider>
    );
};

export const useVoiceCall = () => {
    const context = useContext(VoiceCallContext);
    if (context === undefined) {
        throw new Error('useVoiceCall must be used within a VoiceCallProvider');
    }
    return context;
};

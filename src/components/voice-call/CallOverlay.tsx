import React, { useEffect, useRef } from 'react';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Mic, MicOff, Volume2, User, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const CallOverlay = () => {
    const { currentCall, isIncoming, acceptCall, endCall, remoteStream, localStream } = useVoiceCall();
    const remoteAudioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(console.error);
        }
    }, [remoteStream]);

    if (!currentCall) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
            >
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl pointer-events-auto" />

                <audio ref={remoteAudioRef} autoPlay />

                <motion.div
                    layout
                    className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl overflow-hidden pointer-events-auto"
                >
                    <div className="p-12 flex flex-col items-center text-center">
                        <div className="relative mb-8">
                            <div className={cn(
                                "absolute inset-0 rounded-full animate-ping opacity-20",
                                currentCall.status === 'ringing' ? "bg-blue-500" : "bg-green-500"
                            )} />
                            <div className="relative h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                                {currentCall.profile?.avatar_url ? (
                                    <img src={currentCall.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-10 w-10 text-slate-400" />
                                )}
                            </div>
                        </div>

                        <h2 className="text-xl font-black text-slate-900 mb-1">
                            {currentCall.profile?.full_name || 'User'}
                        </h2>

                        <div className="flex items-center gap-2 mb-12">
                            {currentCall.status === 'ringing' ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
                                        {isIncoming ? 'Panggilan Masuk...' : 'Memanggil...'}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-600">
                                        Panggilan Aktif
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-6">
                            {isIncoming && currentCall.status === 'ringing' ? (
                                <>
                                    <Button
                                        onClick={() => endCall('rejected')}
                                        className="h-16 w-16 rounded-full bg-red-50 text-red-600 hover:bg-red-100 shadow-lg shadow-red-100 transition-all border-none"
                                    >
                                        <PhoneOff className="h-7 w-7" />
                                    </Button>
                                    <Button
                                        onClick={acceptCall}
                                        className="h-20 w-20 rounded-full bg-green-600 text-white hover:bg-green-700 shadow-2xl shadow-green-200 transition-all scale-110 active:scale-95 border-none"
                                    >
                                        <Phone className="h-8 w-8" />
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant="outline"
                                        className="h-14 w-14 rounded-full border-slate-100 text-slate-400 hover:bg-slate-50"
                                    >
                                        <Mic className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        onClick={() => endCall('ended')}
                                        className="h-14 w-14 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-200 active:scale-90 border-none"
                                    >
                                        <PhoneOff className="h-6 w-6" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-14 w-14 rounded-full border-slate-100 text-slate-400 hover:bg-slate-50"
                                    >
                                        <Volume2 className="h-5 w-5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 px-8 py-4 flex justify-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {currentCall.status === 'active' ? 'Voice Call Secure' : 'Menunggu Jawaban'}
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

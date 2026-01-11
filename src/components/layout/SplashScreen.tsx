import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Total duration of splash screen
        const timer = setTimeout(() => {
            setIsVisible(false);
            // Give time for fade out animation before calling onFinish
            setTimeout(onFinish, 800);
        }, 3200);

        return () => clearTimeout(timer);
    }, [onFinish]);

    return (
        <div
            className={cn(
                "fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-all duration-700 ease-in-out",
                isVisible ? "bg-white opacity-100" : "bg-white opacity-0 pointer-events-none scale-110"
            )}
        >
            <style>{`
        @keyframes drawC {
          from { stroke-dashoffset: 300; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes slideInM {
          0% { transform: translateY(-60px); opacity: 0; }
          60% { transform: translateY(10px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes zoomInS {
          0% { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          70% { transform: scale(1.1) rotate(5deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes revealText {
          0% { transform: translateY(20px); opacity: 0; filter: blur(10px); }
          100% { transform: translateY(0); opacity: 1; filter: blur(0); }
        }
        @keyframes bounceBall {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.5); opacity: 0.5; }
        }
        @keyframes pulseBg {
          0%, 100% { background: radial-gradient(circle, rgba(239,246,255,1) 0%, rgba(255,255,255,1) 100%); }
          50% { background: radial-gradient(circle, rgba(219,234,254,1) 0%, rgba(255,255,255,1) 100%); }
        }
        
        .animate-draw-c {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: drawC 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        .animate-slide-m {
          animation: slideInM 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.6s forwards;
          opacity: 0;
        }
        
        .animate-zoom-s {
          animation: zoomInS 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 1.2s forwards;
          opacity: 0;
        }
        
        .animate-reveal-text {
          animation: revealText 0.8s ease-out 1.8s forwards;
          opacity: 0;
        }
        
        .bg-pulse-modern {
          animation: pulseBg 4s ease-in-out infinite;
        }
        
        .letter-shadow {
          filter: drop-shadow(0 10px 15px rgba(37, 99, 235, 0.15));
        }
      `}</style>

            {/* Background Pulse */}
            <div className="bg-pulse-modern absolute inset-0 -z-10" />

            {/* Logo Letters Container */}
            <div className="relative flex items-center mb-10 translate-x-2">
                {/* Letter C (Tracing Path) */}
                <div className="relative">
                    <svg width="100" height="100" viewBox="0 0 100 100" className="letter-shadow">
                        <path
                            d="M75,25 C65,15 45,15 30,25 C15,35 15,65 30,75 C45,85 65,85 75,75"
                            fill="none"
                            stroke="url(#blue-gradient)"
                            strokeWidth="14"
                            strokeLinecap="round"
                            className="animate-draw-c"
                        />
                        <defs>
                            <linearGradient id="blue-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#3b82f6" />
                                <stop offset="100%" stopColor="#2563eb" />
                            </linearGradient>
                        </defs>
                    </svg>
                </div>

                {/* Letter M (Slide/Bounce) */}
                <div className="animate-slide-m letter-shadow" style={{ marginLeft: '-15px', marginRight: '5px' }}>
                    <span className="text-8xl font-black text-blue-600 italic tracking-tighter">M</span>
                </div>

                {/* Letter S (Zoom/Scale) */}
                <div className="animate-zoom-s letter-shadow">
                    <span className="text-8xl font-black text-blue-700 italic tracking-tighter">S</span>
                </div>
            </div>

            {/* Brand Text Below */}
            <div className="flex flex-col items-center">
                <div className="animate-reveal-text flex flex-col items-center">
                    <h2 className="text-2xl font-black tracking-[0.4em] text-slate-900 mb-1">
                        DUTA SOLUSI
                    </h2>
                    <div className="h-1 w-12 bg-blue-600 rounded-full mb-6" />
                </div>

                {/* Loading Indicator Dots */}
                <div className="flex gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-200 animate-[bounceBall_1s_infinite_0s]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-[bounceBall_1s_infinite_0.2s]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-[bounceBall_1s_infinite_0.4s]" />
                </div>
            </div>

            {/* Version Info (Subtle) */}
            <div className="absolute bottom-10 text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
                Corporate Management System
            </div>
        </div>
    );
};

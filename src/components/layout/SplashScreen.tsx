import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onFinish, 800);
    }, 3500);

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
          from { stroke-dashoffset: 400; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes revealGreen {
          0% { transform: scaleX(0); opacity: 0; }
          100% { transform: scaleX(1); opacity: 1; }
        }
        @keyframes fadeInText {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoEntrance {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .animate-draw-c {
          stroke-dasharray: 400;
          stroke-dashoffset: 400;
          animation: drawC 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        .animate-green-inner {
          transform-origin: left center;
          animation: revealGreen 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 1s forwards;
          opacity: 0;
        }
        
        .animate-text-group {
          animation: fadeInText 0.8s ease-out 1.8s forwards;
          opacity: 0;
        }

        .cms-blue { fill: #1E3A8A; stroke: #1E3A8A; }
        .cms-green { fill: #22C55E; }
        .text-cms-blue { color: #1E3A8A; }
        .text-cms-green { color: #22C55E; }
      `}</style>

      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-white -z-10" />

      {/* Main Container */}
      <div className="flex flex-col items-center">
        {/* Animated Logo SVG */}
        <div className="relative w-48 h-48 mb-8">
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
            {/* Outer Blue C */}
            <path
              d="M150,60 A65,65 0 1,0 150,140"
              fill="none"
              strokeWidth="35"
              strokeLinecap="round"
              className="cms-blue animate-draw-c"
            />
            {/* Inner Green Shape (Representing the inner part of CMS Logo) */}
            <path
              d="M80,100 L120,100"
              fill="none"
              stroke="#22C55E"
              strokeWidth="25"
              strokeLinecap="round"
              className="animate-green-inner"
            />
            {/* Smaller green circle at the end of green shape */}
            <circle cx="80" cy="100" r="12" className="cms-green animate-green-inner" />
          </svg>
        </div>

        {/* Text Animation */}
        <div className="animate-text-group flex flex-col items-center">
          <h1 className="text-5xl font-black tracking-tighter text-cms-blue mb-1">
            CMS
          </h1>
          <p className="text-lg font-bold tracking-[0.3em] text-cms-green uppercase">
            DUTA SOLUSI
          </p>
        </div>

        {/* Loading status */}
        <div className="mt-12 flex space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"></div>
        </div>
      </div>

      <div className="absolute bottom-12 text-[10px] font-black tracking-[0.4em] text-slate-300 uppercase">
        Initializing Secure Session
      </div>
    </div>
  );
};

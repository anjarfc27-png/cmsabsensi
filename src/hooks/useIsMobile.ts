import { useState, useEffect } from 'react';

/**
 * Hook to detect if current device is mobile
 * Mobile detection is LOCKED - tampilan mobile tidak akan berubah
 * 
 * @returns boolean - true if mobile device (width < 768px)
 */
export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        // Initial check
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();

        // Listen for resize
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
}

/**
 * Hook to get current viewport width
 */
export function useViewportWidth(): number {
    const [width, setWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 0
    );

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return width;
}

/**
 * Breakpoints for responsive design
 * Mobile is LOCKED at < 768px
 */
export const BREAKPOINTS = {
    mobile: 768,
    tablet: 1024,
    desktop: 1280,
    wide: 1536,
} as const;

/**
 * Check if device is in specific breakpoint
 */
export function useBreakpoint() {
    const width = useViewportWidth();

    return {
        isMobile: width < BREAKPOINTS.mobile,
        isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.desktop,
        isDesktop: width >= BREAKPOINTS.desktop,
        isWide: width >= BREAKPOINTS.wide,
        width,
    };
}

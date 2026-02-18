import { useVoiceCall as useVoiceCallFromContext } from '@/contexts/VoiceCallContext';

/**
 * Hook to access voice call functionality.
 * This is now a wrapper around VoiceCallContext to ensure global state.
 */
export const useVoiceCall = () => {
    return useVoiceCallFromContext();
};

export type { CallStatus } from '@/contexts/VoiceCallContext';

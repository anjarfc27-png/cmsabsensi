import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FaceEnrollmentResult {
    success: boolean;
    encoding?: number[];
    error?: string;
}

interface FaceVerificationResult {
    success: boolean;
    match?: boolean;
    confidence?: number;
    distance?: number;
    error?: string;
}

export function usePythonFaceRecognition() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Convert image (Blob or File) to base64
     */
    const imageToBase64 = (image: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(image);
        });
    };

    /**
     * Enroll a new face
     * @param image - Image blob/file containing the face
     * @returns Face encoding array (128 dimensions)
     */
    const enrollFace = async (image: Blob): Promise<FaceEnrollmentResult> => {
        setLoading(true);
        setError(null);

        try {
            // Convert image to base64
            const base64Image = await imageToBase64(image);

            // Call Supabase Edge Function
            const { data, error: functionError } = await supabase.functions.invoke('face-recognition', {
                body: {
                    action: 'enroll',
                    image: base64Image,
                },
            });

            if (functionError) {
                throw new Error(functionError.message);
            }

            if (!data.success) {
                throw new Error(data.error || 'Face enrollment failed');
            }

            return {
                success: true,
                encoding: data.encoding,
            };
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to enroll face';
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setLoading(false);
        }
    };

    /**
     * Verify face against stored encoding
     * @param image - Current image to verify
     * @param storedEncoding - Previously stored face encoding
     * @returns Verification result with match status and confidence
     */
    const verifyFace = async (
        image: Blob,
        storedEncoding: number[]
    ): Promise<FaceVerificationResult> => {
        setLoading(true);
        setError(null);

        try {
            // Convert image to base64
            const base64Image = await imageToBase64(image);

            // Call Supabase Edge Function
            const { data, error: functionError } = await supabase.functions.invoke('face-recognition', {
                body: {
                    action: 'verify',
                    image: base64Image,
                    stored_encoding: storedEncoding,
                },
            });

            if (functionError) {
                throw new Error(functionError.message);
            }

            if (!data.success) {
                throw new Error(data.error || 'Face verification failed');
            }

            return {
                success: true,
                match: data.match,
                confidence: data.confidence,
                distance: data.distance,
            };
        } catch (err: any) {
            const errorMessage = err.message || 'Failed to verify face';
            setError(errorMessage);
            return {
                success: false,
                error: errorMessage,
            };
        } finally {
            setLoading(false);
        }
    };

    return {
        enrollFace,
        verifyFace,
        loading,
        error,
    };
}

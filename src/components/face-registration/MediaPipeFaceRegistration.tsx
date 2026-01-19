import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera as CameraIcon, CheckCircle, XCircle, RefreshCw, Eye, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useMediaPipeFace } from '@/hooks/useMediaPipeFace';
import { MediaPipeBlinkDetector } from '@/utils/mediaPipeBlinkDetection';
import { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

interface MediaPipeFaceRegistrationProps {
    onComplete?: (success: boolean, data?: any) => void;
    employeeId?: string;
}

type Step = 'intro' | 'capture' | 'blink-challenge' | 'processing' | 'success' | 'error';

export function MediaPipeFaceRegistration({ onComplete, employeeId }: MediaPipeFaceRegistrationProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const blinkDetectorRef = useRef(new MediaPipeBlinkDetector());
    const animationFrameRef = useRef<number>();

    const [step, setStep] = useState<Step>('intro');
    const [faceImage, setFaceImage] = useState<string | null>(null);
    const [faceDescriptor, setFaceDescriptor] = useState<Float32Array | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [blinkCount, setBlinkCount] = useState(0);
    const [requiredBlinks] = useState(2);
    const [detectedFace, setDetectedFace] = useState(false);
    const [showMesh, setShowMesh] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState('');

    const targetUserId = employeeId || user?.id;
    const { initialize, isReady, isLoading, error: mpError, detectFace, getFaceDescriptor } = useMediaPipeFace();

    // Start Camera - PARALLEL dengan init MediaPipe
    const startCamera = async () => {
        try {
            setStep('capture');
            setLoadingStatus('Mengaktifkan kamera...');

            // Parallel: Kamera + MediaPipe
            const cameraPromise = navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            // Start camera immediately
            const stream = await cameraPromise;
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setLoadingStatus('Kamera aktif');
                };
            }

            // Initialize MediaPipe in background
            if (!isReady) {
                setLoadingStatus('Memuat AI Face Mesh...');
                await initialize();
                setLoadingStatus('AI siap');
            }

        } catch (error) {
            console.error('Camera access error:', error);
            setErrorMessage('Gagal mengakses kamera. Pastikan izin diberikan.');
            setStep('error');
        }
    };

    // Stop Camera
    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    };

    // Draw face mesh on canvas
    const drawFaceMesh = (result: FaceLandmarkerResult) => {
        if (!canvasRef.current || !videoRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result.faceLandmarks && result.faceLandmarks.length > 0) {
            const landmarks = result.faceLandmarks[0];

            // Draw mesh points
            ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
            landmarks.forEach((landmark) => {
                const x = landmark.x * canvas.width;
                const y = landmark.y * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, 2 * Math.PI);
                ctx.fill();
            });

            // Draw key points
            const keyPoints = [33, 133, 362, 263, 1, 2, 61, 291];
            ctx.fillStyle = 'rgba(0, 255, 0, 1)';
            keyPoints.forEach(idx => {
                if (idx < landmarks.length) {
                    const landmark = landmarks[idx];
                    const x = landmark.x * canvas.width;
                    const y = landmark.y * canvas.height;
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
        }
    };

    // Capture Face
    const captureFace = async () => {
        if (!videoRef.current || !isReady) {
            toast({ title: 'AI belum siap', description: 'Tunggu sebentar...', variant: 'destructive' });
            return;
        }

        try {
            const result = await detectFace(videoRef.current);

            if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
                toast({ title: 'Wajah tidak terdeteksi', description: 'Pastikan wajah terlihat jelas', variant: 'destructive' });
                return;
            }

            const descriptor = getFaceDescriptor(result);
            if (!descriptor) {
                toast({ title: 'Gagal memproses wajah', variant: 'destructive' });
                return;
            }

            // Capture image
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
                setFaceImage(dataUrl);
                setFaceDescriptor(descriptor);

                blinkDetectorRef.current.reset();
                setBlinkCount(0);

                // Go to blink challenge - useEffect will start detection automatically
                setStep('blink-challenge');
            }
        } catch (error) {
            console.error('Capture error:', error);
            toast({ title: 'Gagal mengambil foto', variant: 'destructive' });
        }
    };

    // Render loop for capture step
    useEffect(() => {
        if (step === 'capture' && showMesh && isReady) {
            const renderLoop = async () => {
                if (!videoRef.current) return;

                const result = await detectFace(videoRef.current);
                if (result) {
                    drawFaceMesh(result);
                    setDetectedFace(result.faceLandmarks && result.faceLandmarks.length > 0);
                }

                if (step === 'capture') {
                    animationFrameRef.current = requestAnimationFrame(renderLoop);
                }
            };

            renderLoop();
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [step, showMesh, isReady, detectFace]);

    // Blink detection loop for blink-challenge step
    useEffect(() => {
        if (step === 'blink-challenge' && isReady && videoRef.current) {
            const detectBlinks = async () => {
                const video = videoRef.current;
                if (step !== 'blink-challenge' || !video || !isReady) {
                    return;
                }

                // Wait for video to be ready
                if (video.readyState < 2) {
                    if (step === 'blink-challenge') {
                        animationFrameRef.current = requestAnimationFrame(detectBlinks);
                    }
                    return;
                }

                const result = await detectFace(video);

                if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                    setDetectedFace(true);

                    blinkDetectorRef.current.processFrame(result);
                    const currentBlinks = blinkDetectorRef.current.getBlinkCount();
                    setBlinkCount(currentBlinks);

                    if (showMesh) {
                        drawFaceMesh(result);
                    }

                    // Check if enough blinks and auto-save
                    if (currentBlinks >= requiredBlinks) {
                        await saveEnrollment();
                        return;
                    }
                } else {
                    setDetectedFace(false);
                }

                // Continue loop
                if (step === 'blink-challenge') {
                    animationFrameRef.current = requestAnimationFrame(detectBlinks);
                }
            };

            detectBlinks();
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [step, isReady, showMesh, requiredBlinks, detectFace]);

    // Fix: Re-attach stream when step changes (because video element is re-mounted)
    useEffect(() => {
        if (streamRef.current && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(console.error);
        }
    }, [step]);

    // Save Enrollment
    const saveEnrollment = async () => {
        if (!faceImage || !faceDescriptor || !targetUserId) {
            setErrorMessage('Data tidak lengkap');
            setStep('error');
            return;
        }

        setStep('processing');

        try {
            const blob = await fetch(faceImage).then(r => r.blob());
            const fileName = `${targetUserId}/enrollment_${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('face-enrollments')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('face-enrollments')
                .getPublicUrl(fileName);

            const { error: dbError } = await supabase
                .from('face_enrollments')
                .upsert({
                    user_id: targetUserId,
                    face_descriptor: Array.from(faceDescriptor),
                    face_image_url: publicUrl,
                    is_active: true,
                    enrolled_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (dbError) throw dbError;

            setStep('success');
            toast({ title: 'Registrasi wajah berhasil!', className: 'bg-green-600 text-white' });

            setTimeout(() => {
                stopCamera();
                onComplete?.(true, { face_image_url: publicUrl });
            }, 2000);

        } catch (error: any) {
            console.error('Save error:', error);
            setErrorMessage(error.message || 'Gagal menyimpan data');
            setStep('error');
            toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
        }
    };

    // Cleanup
    useEffect(() => {
        return () => stopCamera();
    }, []);

    return (
        <div
            className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30"
            style={{
                paddingTop: 'max(1rem, env(safe-area-inset-top))',
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                paddingLeft: 'max(1rem, env(safe-area-inset-left))',
                paddingRight: 'max(1rem, env(safe-area-inset-right))',
            }}
        >
            <div className="w-full max-w-md px-4">
                <Card className="border-none shadow-2xl rounded-[32px] overflow-hidden bg-white">
                    <CardContent className="p-6 space-y-6">

                        {/* Intro */}
                        {step === 'intro' && (
                            <div className="text-center space-y-6 py-8">
                                <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
                                    <Sparkles className="h-10 w-10 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">Registrasi Wajah AI</h2>
                                    <p className="text-sm text-slate-500 mt-2">Teknologi MediaPipe Face Mesh</p>
                                </div>

                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl p-4 text-left space-y-2">
                                    <p className="text-xs font-bold text-blue-900">⚡ Fitur Premium:</p>
                                    <ul className="text-xs text-blue-700 space-y-1.5 ml-4 list-disc">
                                        <li>Face Mesh 478 titik (seperti Face ID)</li>
                                        <li>Blink detection anti-foto</li>
                                        <li>100% offline & cepat</li>
                                        <li>Google MediaPipe Technology</li>
                                    </ul>
                                </div>

                                <Button
                                    onClick={startCamera}
                                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl font-bold text-base shadow-lg"
                                >
                                    <CameraIcon className="mr-2 h-5 w-5" />
                                    Mulai Registrasi
                                </Button>
                            </div>
                </Card>
            </div>
        </div>
    );
}

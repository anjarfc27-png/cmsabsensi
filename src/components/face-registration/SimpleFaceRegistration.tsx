
import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Camera as CameraIcon, CheckCircle, XCircle, AlertCircle, RefreshCw, Smartphone, ImagePlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as faceapi from 'face-api.js';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';

interface SimpleFaceRegistrationProps {
    onComplete?: (success: boolean, data?: any) => void;
    employeeId?: string;
}

export function SimpleFaceRegistration({ onComplete, employeeId }: SimpleFaceRegistrationProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);

    const [step, setStep] = useState<'intro' | 'camera' | 'preview' | 'processing' | 'success' | 'error'>('intro');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [isStreaming, setIsStreaming] = useState(false);

    const targetUserId = employeeId || user?.id;
    const { loadModels, modelsLoaded, detectFace } = useFaceRecognition();

    // Start WebRTC Camera Stream (Live)
    const startCamera = async () => {
        try {
            setStep('camera');
            setErrorMessage('');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 }, // Try higher resolution first
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: false
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setIsStreaming(true);
            }
        } catch (error) {
            console.error('Camera access error:', error);
            setStep('error');
            setErrorMessage('Gagal mengakses kamera browser. Coba gunakan opsi "Kamera HP".');
        }
    };

    // Native Camera Intent (Capacitor)
    const handleNativeCamera = async () => {
        try {
            setErrorMessage('');
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera,
                saveToGallery: false,
                correctOrientation: true,
                width: 1280, // High quality width
                height: 1280
            });

            if (image.dataUrl) {
                setCapturedImage(image.dataUrl);
                setStep('preview');
            }
        } catch (error: any) {
            console.warn('Native camera cancelled/error:', error);
            // Don't show error if user just cancelled
            if (!error.message?.includes('cancelled')) {
                setErrorMessage('Gagal membuka kamera HP.');
            }
        }
    };

    // Stop Camera Stream
    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsStreaming(false);
        }
    };

    // Capture Photo from Video Stream
    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Mirror image if using front camera usually implies mirroring
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                setCapturedImage(dataUrl);
                stopCamera(); // Stop stream after capture
                setStep('preview');
            }
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    // Ensure models are loaded early
    useEffect(() => {
        loadModels();
    }, []);

    const processAndUploadFace = async (imageDataUrl: string) => {
        try {
            setStep('processing');
            setProgress(10);

            // 1. Ensure models are loaded
            if (!modelsLoaded) {
                await loadModels();
            }
            setProgress(20);

            // 2. Validate Face Quality & Get Descriptor
            const img = await faceapi.fetchImage(imageDataUrl);
            const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (!detection) {
                throw new Error('Wajah tidak terdeteksi dengan jelas. Silakan foto ulang dengan pencahayaan yang lebih baik.');
            }

            setProgress(40);

            // Check Face Quality (Score)
            if (detection.detection.score < 0.70) {
                throw new Error('Kualitas foto kurang baik. Pastikan wajah terlihat jelas dan terang.');
            }

            // 3. Prepare Upload
            const response = await fetch(imageDataUrl);
            const blob = await response.blob();

            // Upload to Supabase Storage
            const fileName = `${targetUserId}/${Date.now()}_face.jpg`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('face-images')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            setProgress(60);

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('face-images')
                .getPublicUrl(fileName);

            setProgress(80);

            // 4. Save to Database with Descriptor
            const descriptorArray = Array.from(detection.descriptor);

            const { error: dbError } = await supabase
                .from('face_enrollments')
                .upsert({
                    user_id: targetUserId,
                    face_image_url: publicUrl,
                    face_descriptor: descriptorArray, // Store face embedding
                    is_active: true,
                    enrolled_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id'
                });

            if (dbError) throw dbError;

            setProgress(100);
            setStep('success');

            toast({
                title: 'Berhasil!',
                description: 'Wajah Anda telah terdaftar. Data biometrik berhasil disimpan.',
            });

            setTimeout(() => {
                onComplete?.(true, { imageUrl: publicUrl });
            }, 2000);

        } catch (error: any) {
            console.error('Processing error:', error);
            const msg = error.message || 'Gagal memproses foto wajah';

            // User friendly error mapping
            let displayMsg = msg;
            if (msg.includes('dims')) displayMsg = 'Gagal memproses dimensi gambar';
            if (msg.includes('storage')) displayMsg = 'Gagal upload ke server penyimpanan';

            setErrorMessage(displayMsg);
            setStep('error');
            setProgress(0);
        }
    };

    const handleRetry = () => {
        setCapturedImage(null);
        setErrorMessage('');
        setProgress(0);
        // Don't auto-start camera here, let user choose method again or go back to intro
        setStep('intro');
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Intro Step */}
            {step === 'intro' && (
                <Card className="border-none shadow-xl">
                    <CardContent className="pt-8 space-y-8">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold">Pendaftaran Wajah</h3>
                            <p className="text-slate-500 text-sm">
                                Daftarkan wajah Anda untuk fitur absensi & keamanan.
                            </p>
                        </div>

                        <div className="flex justify-center py-4">
                            <div className="relative w-40 h-40 bg-blue-50 rounded-full flex items-center justify-center">
                                <Smartphone className="h-16 w-16 text-blue-500" />
                                <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-pulse"></div>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="font-semibold text-slate-800 text-sm mb-2">Panduan:</p>
                            <ul className="text-xs text-slate-600 space-y-1">
                                <li>✨ Pastikan wajah terlihat jelas (tidak backlight)</li>
                                <li>👓 Lepas aksesoris yang menutupi wajah</li>
                                <li>🙂 Ekspresi netral menghadap kamera</li>
                            </ul>
                        </div>

                        <div className="space-y-3">
                            <Button
                                onClick={startCamera}
                                className="w-full h-12 text-base rounded-xl font-bold shadow-lg shadow-blue-200"
                                size="lg"
                            >
                                <CameraIcon className="mr-2 h-5 w-5" />
                                Mulai Kamera Live (Cepat)
                            </Button>

                            <Button
                                onClick={handleNativeCamera}
                                className="w-full h-12 text-base rounded-xl border-2 border-blue-100 bg-white text-blue-700 hover:bg-blue-50"
                                size="lg"
                                variant="outline"
                            >
                                <ImagePlus className="mr-2 h-5 w-5" />
                                Gunakan Kamera HP (HD)
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Camera View Step */}
            {step === 'camera' && (
                <Card className="border-none shadow-xl overflow-hidden">
                    <CardContent className="p-0 relative bg-black aspect-[3/4] md:aspect-[4/3]">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover transform scale-x-[-1]"
                        />

                        {/* Overlay Guide */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-64 h-80 border-2 border-white/50 rounded-[40%] flex items-center justify-center relative">
                                <div className="absolute top-0 w-full text-center -mt-8 text-white text-sm font-medium drop-shadow-md">
                                    Posisikan wajah di dalam area
                                </div>
                                {/* Corner Markers */}
                                <div className="absolute top-10 left-10 w-4 h-4 border-t-2 border-l-2 border-white"></div>
                                <div className="absolute top-10 right-10 w-4 h-4 border-t-2 border-r-2 border-white"></div>
                                <div className="absolute bottom-10 left-10 w-4 h-4 border-b-2 border-l-2 border-white"></div>
                                <div className="absolute bottom-10 right-10 w-4 h-4 border-b-2 border-r-2 border-white"></div>
                            </div>
                        </div>

                        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4 z-10 px-6">
                            <Button
                                variant="destructive"
                                size="icon"
                                className="rounded-full w-12 h-12 bg-red-500/80 hover:bg-red-600 backdrop-blur-sm"
                                onClick={() => {
                                    stopCamera();
                                    setStep('intro');
                                }}
                            >
                                <XCircle className="h-6 w-6" />
                            </Button>

                            <Button
                                size="icon"
                                className="rounded-full w-16 h-16 bg-white hover:bg-slate-100 text-blue-600 border-4 border-blue-500/30 shadow-xl"
                                onClick={capturePhoto}
                            >
                                <div className="w-12 h-12 bg-blue-600 rounded-full border-2 border-white"></div>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Preview & Processing Step */}
            {(step === 'preview' || step === 'processing') && (
                <Card className="border-none shadow-xl">
                    <CardContent className="pt-6 space-y-6">
                        {capturedImage && (
                            <div className="relative">
                                <img
                                    src={capturedImage}
                                    alt="Captured face"
                                    className="w-full rounded-xl transform"
                                />
                                {step === 'processing' && (
                                    <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center text-white backdrop-blur-sm">
                                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
                                        <p className="font-semibold text-lg">Memproses Wajah...</p>
                                        <p className="text-sm text-white/70">Mohon tunggu sebentar</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'preview' && capturedImage && (
                            <div className="grid grid-cols-2 gap-4">
                                <Button variant="outline" onClick={handleRetry} className="h-12 rounded-xl">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Foto Ulang
                                </Button>
                                <Button
                                    className="h-12 bg-blue-600 hover:bg-blue-700 rounded-xl"
                                    onClick={() => capturedImage && processAndUploadFace(capturedImage)}
                                >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Simpan & Daftar
                                </Button>
                            </div>
                        )}

                        {step === 'processing' && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-slate-600 font-medium">
                                    <span>Analisis Biometrik</span>
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Success Step */}
            {step === 'success' && (
                <Card className="border-none shadow-xl bg-green-50/50">
                    <CardContent className="pt-8 space-y-6 text-center">
                        <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mx-auto shadow-sm">
                            <CheckCircle className="h-12 w-12 text-green-600" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-green-700">Pendaftaran Berhasil!</h3>
                            <p className="text-slate-600 mt-2">
                                Data wajah Anda telah tersimpan dengan aman. Sekarang Anda bisa menggunakan fitur absensi wajah.
                            </p>
                        </div>

                        {/* Mini preview of registered face */}
                        {capturedImage && (
                            <div className="flex justify-center">
                                <img src={capturedImage} className="w-24 h-24 rounded-full border-4 border-white shadow-md object-cover" alt="Registered" />
                            </div>
                        )}

                        <Badge variant="outline" className="bg-white border-green-200 text-green-700 px-4 py-1">
                            Status: Terdaftar & Aktif
                        </Badge>
                    </CardContent>
                </Card>
            )}

            {/* Error Step */}
            {step === 'error' && (
                <Card className="border-none shadow-xl bg-red-50/50">
                    <CardContent className="pt-8 space-y-6 text-center">
                        <div className="h-20 w-20 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                            <XCircle className="h-10 w-10 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-red-700">Terjadi Kesalahan</h3>
                            <p className="text-slate-600 mt-2 text-sm max-w-xs mx-auto">{errorMessage}</p>
                        </div>

                        <Button
                            onClick={handleRetry}
                            className="w-full h-12 text-base rounded-xl bg-white text-red-600 border border-red-200 hover:bg-red-50"
                        >
                            <RefreshCw className="mr-2 h-5 w-5" />
                            Coba Lagi
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

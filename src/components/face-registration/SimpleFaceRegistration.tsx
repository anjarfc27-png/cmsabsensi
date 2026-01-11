import { useState, useRef, useEffect } from 'react';
import { Camera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Camera as CameraIcon, CheckCircle, XCircle, AlertCircle, RefreshCw, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SimpleFaceRegistrationProps {
    onComplete?: (success: boolean, data?: any) => void;
    employeeId?: string;
}

export function SimpleFaceRegistration({ onComplete, employeeId }: SimpleFaceRegistrationProps) {
    const { user } = useAuth();
    const { toast } = useToast();

    const [step, setStep] = useState<'intro' | 'capture' | 'processing' | 'success' | 'error'>('intro');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [progress, setProgress] = useState(0);

    const targetUserId = employeeId || user?.id;

    const handleCaptureSelfie = async () => {
        try {
            setStep('capture');
            setErrorMessage('');

            // Request camera permission and capture photo
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera,
                saveToGallery: false,
                correctOrientation: true,
                width: 640,
                height: 480
            });

            if (image.dataUrl) {
                setCapturedImage(image.dataUrl);
                // Don't auto-upload, let user review and flip if needed
                // await processAndUploadFace(image.dataUrl);
            }
        } catch (error: any) {
            console.error('Camera error:', error);
            setErrorMessage('Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.');
            setStep('error');
        }
    };

    const processAndUploadFace = async (imageDataUrl: string) => {
        try {
            setStep('processing');
            setProgress(20);

            // Convert data URL to blob
            const response = await fetch(imageDataUrl);
            const blob = await response.blob();

            setProgress(40);

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

            // Save to database (simple version - just store the image URL)
            // In production, you would process this with face-api.js or backend AI
            const { error: dbError } = await supabase
                .from('face_enrollments')
                .upsert({
                    user_id: targetUserId,
                    face_image_url: publicUrl,
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
                description: 'Wajah Anda telah terdaftar. Sekarang Anda bisa menggunakan face recognition untuk absensi.',
            });

            setTimeout(() => {
                onComplete?.(true, { imageUrl: publicUrl });
            }, 2000);

        } catch (error: any) {
            console.error('Processing error:', error);
            setErrorMessage(error.message || 'Gagal memproses foto wajah');
            setStep('error');
            setProgress(0);
        }
    };

    const handleRetry = () => {
        setCapturedImage(null);
        setErrorMessage('');
        setProgress(0);
        setStep('intro');
    };

    const flipImage = (dataUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.translate(img.width, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg', 0.9));
                } else {
                    resolve(dataUrl);
                }
            };
            img.src = dataUrl;
        });
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Intro Step */}
            {step === 'intro' && (
                <Card className="border-none shadow-xl">
                    <CardContent className="pt-8 space-y-8">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold">Verifikasi Wajah</h3>
                            <p className="text-slate-500 text-sm">
                                Untuk keamanan akun, silakan lakukan pendaftaran wajah.
                            </p>
                        </div>

                        {/* Visual Guide Frame */}
                        <div className="relative w-48 h-64 mx-auto border-4 border-dashed border-blue-400 rounded-[45%] flex flex-col items-center justify-center bg-blue-50/50 cursor-pointer hover:bg-blue-50 transition-colors group" onClick={handleCaptureSelfie}>
                            <div className="absolute inset-0 rounded-[45%] border-2 border-white/50 pointer-events-none"></div>

                            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform mb-2">
                                <CameraIcon className="h-8 w-8 text-blue-600" />
                            </div>
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Ambil Selfie</p>

                            {/* Corner Markers */}
                            <div className="absolute top-4 left-8 w-4 h-4 border-t-2 border-l-2 border-blue-600 rounded-tl-lg"></div>
                            <div className="absolute top-4 right-8 w-4 h-4 border-t-2 border-r-2 border-blue-600 rounded-tr-lg"></div>
                            <div className="absolute bottom-4 left-8 w-4 h-4 border-b-2 border-l-2 border-blue-600 rounded-bl-lg"></div>
                            <div className="absolute bottom-4 right-8 w-4 h-4 border-b-2 border-r-2 border-blue-600 rounded-br-lg"></div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 text-center">
                            <p className="font-semibold text-slate-800 text-sm mb-2">Instruksi:</p>
                            <ul className="text-xs text-slate-600 space-y-1">
                                <li>✨ Pastikan wajah terlihat jelas & terang</li>
                                <li>👓 Lepas kacamata hitam / masker</li>
                                <li>📱 Posisikan HP sejajar dengan mata</li>
                            </ul>
                        </div>

                        <Button
                            onClick={handleCaptureSelfie}
                            className="w-full h-12 text-base rounded-xl font-bold shadow-lg shadow-blue-200"
                            size="lg"
                        >
                            Mulai Kamera
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Capture/Processing Step */}
            {(step === 'capture' || step === 'processing') && (
                <Card className="border-none shadow-xl">
                    <CardContent className="pt-6 space-y-6">
                        {capturedImage && (
                            <div className="relative">
                                <img
                                    src={capturedImage}
                                    alt="Captured face"
                                    className="w-full rounded-xl"
                                />
                                {step === 'capture' && (
                                    <div className="absolute bottom-4 right-4 flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={async () => {
                                                const flipped = await flipImage(capturedImage);
                                                setCapturedImage(flipped);
                                            }}
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Balik Foto (Mirror)
                                        </Button>
                                    </div>
                                )}
                                {step === 'processing' && (
                                    <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                                        <div className="text-center text-white">
                                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-4"></div>
                                            <p className="font-semibold">Memproses foto...</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'capture' && capturedImage && (
                            <div className="grid grid-cols-2 gap-4">
                                <Button variant="outline" onClick={handleRetry} className="h-12">
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Ambil Ulang
                                </Button>
                                <Button
                                    className="h-12 bg-blue-600 hover:bg-blue-700"
                                    onClick={() => capturedImage && processAndUploadFace(capturedImage)}
                                >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Simpan Foto
                                </Button>
                            </div>
                        )}

                        {step === 'processing' && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Progress</span>
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
                <Card className="border-none shadow-xl">
                    <CardContent className="pt-6 space-y-6">
                        <div className="text-center space-y-4">
                            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto">
                                <CheckCircle className="h-12 w-12 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-green-600">Berhasil!</h3>
                                <p className="text-slate-600 mt-2">
                                    Wajah Anda telah terdaftar di sistem
                                </p>
                            </div>
                        </div>

                        {capturedImage && (
                            <img
                                src={capturedImage}
                                alt="Registered face"
                                className="w-48 h-48 object-cover rounded-full mx-auto border-4 border-green-500"
                            />
                        )}

                        <Badge className="w-full justify-center py-2 bg-green-100 text-green-700 hover:bg-green-100">
                            Face Recognition Aktif
                        </Badge>
                    </CardContent>
                </Card>
            )}

            {/* Error Step */}
            {step === 'error' && (
                <Card className="border-none shadow-xl">
                    <CardContent className="pt-6 space-y-6">
                        <div className="text-center space-y-4">
                            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto">
                                <XCircle className="h-12 w-12 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-red-600">Gagal</h3>
                                <p className="text-slate-600 mt-2">{errorMessage}</p>
                            </div>
                        </div>

                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>

                        <Button
                            onClick={handleRetry}
                            className="w-full h-12 text-base"
                            variant="outline"
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

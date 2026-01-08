import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCamera } from '@/hooks/useCamera';
import { Camera, Loader2, MapPin, CheckCircle2, AlertCircle, Clock, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function QuickAttendancePage() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { videoRef, startCamera, stopCamera, capturePhoto } = useCamera();

    const [step, setStep] = useState<'idle' | 'camera' | 'processing'>('idle');
    const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [locationChecking, setLocationChecking] = useState(false);

    useEffect(() => {
        getLocation();
    }, []);

    const getLocation = () => {
        setLocationChecking(true);
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLatitude(position.coords.latitude);
                    setLongitude(position.coords.longitude);
                    setLocationChecking(false);
                },
                (error) => {
                    console.error('Location error:', error);
                    setLocationChecking(false);
                    toast({
                        title: 'Lokasi Tidak Terdeteksi',
                        description: 'Mohon izinkan akses lokasi untuk melanjutkan.',
                        variant: 'destructive',
                    });
                }
            );
        }
    };

    const handleStartCamera = async () => {
        try {
            await startCamera();
            setStep('camera');
        } catch (error) {
            toast({
                title: 'Gagal Membuka Kamera',
                description: 'Pastikan Anda memberikan izin kamera.',
                variant: 'destructive',
            });
        }
    };

    const handleCapture = async () => {
        try {
            const photo = await capturePhoto();
            setCapturedPhoto(photo);
            setPhotoPreview(URL.createObjectURL(photo));
            stopCamera();
            setStep('processing');
        } catch (error) {
            toast({
                title: 'Gagal Mengambil Foto',
                description: 'Silakan coba lagi.',
                variant: 'destructive',
            });
        }
    };

    const handleSubmit = async () => {
        if (!user || !capturedPhoto || latitude === null || longitude === null) {
            toast({
                title: 'Data Tidak Lengkap',
                description: 'Pastikan foto dan lokasi tersedia.',
                variant: 'destructive',
            });
            return;
        }

        setSubmitting(true);
        try {
            const today = format(new Date(), 'yyyy-MM-dd');

            // Check existing attendance
            const { data: existing } = await supabase
                .from('attendances')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', today)
                .maybeSingle();

            const type = !existing ? 'clock_in' : 'clock_out';
            const fileName = `${user.id}/${today}_${type}_${Date.now()}.jpg`;

            // Upload photo
            const { error: uploadError } = await supabase.storage
                .from('attendance-photos')
                .upload(fileName, capturedPhoto);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('attendance-photos')
                .getPublicUrl(fileName);

            const now = new Date();

            if (type === 'clock_in') {
                await supabase.from('attendances').insert({
                    user_id: user.id,
                    date: today,
                    clock_in: now.toISOString(),
                    clock_in_latitude: latitude,
                    clock_in_longitude: longitude,
                    clock_in_photo_url: publicUrl,
                    status: 'present',
                });

                toast({
                    title: 'Absen Masuk Berhasil!',
                    description: `Tercatat pada ${format(now, 'HH:mm', { locale: id })}`,
                });
            } else {
                const clockInTime = new Date(existing.clock_in);
                const workMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);

                await supabase
                    .from('attendances')
                    .update({
                        clock_out: now.toISOString(),
                        clock_out_latitude: latitude,
                        clock_out_longitude: longitude,
                        clock_out_photo_url: publicUrl,
                        work_hours_minutes: workMinutes,
                    })
                    .eq('id', existing.id);

                toast({
                    title: 'Absen Pulang Berhasil!',
                    description: `Total kerja: ${Math.floor(workMinutes / 60)}j ${workMinutes % 60}m`,
                });
            }

            setTimeout(() => navigate('/dashboard'), 1500);
        } catch (error) {
            console.error(error);
            toast({
                title: 'Gagal Menyimpan Absensi',
                description: 'Terjadi kesalahan sistem.',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRetake = () => {
        setCapturedPhoto(null);
        setPhotoPreview(null);
        setStep('idle');
    };

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-400 flex items-center justify-center p-4">
                <Card className="w-full max-w-md border-none shadow-2xl rounded-[32px] overflow-hidden">
                    <CardContent className="p-0">
                        {/* Header */}
                        <div className="bg-white p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <h1 className="text-2xl font-black text-slate-900">Absen Cepat</h1>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => navigate('/dashboard')}
                                    className="rounded-full"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                            <p className="text-sm text-slate-500">
                                {format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6 bg-slate-50">
                            {step === 'idle' && (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl p-6 text-center">
                                        <div className="h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Camera className="h-12 w-12 text-blue-600" />
                                        </div>
                                        <h3 className="font-bold text-slate-900 mb-2">Siap Absen?</h3>
                                        <p className="text-sm text-slate-500 mb-6">
                                            Gunakan kamera untuk verifikasi wajah Anda
                                        </p>
                                        <Button
                                            onClick={handleStartCamera}
                                            size="lg"
                                            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl"
                                            disabled={locationChecking}
                                        >
                                            {locationChecking ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    Mengecek Lokasi...
                                                </>
                                            ) : (
                                                <>
                                                    <Camera className="mr-2 h-5 w-5" />
                                                    Buka Kamera
                                                </>
                                            )}
                                        </Button>
                                    </div>

                                    {latitude && longitude && (
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                                            <MapPin className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-bold text-green-900">Lokasi Terdeteksi</p>
                                                <p className="text-xs text-green-700">
                                                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {step === 'camera' && (
                                <div className="space-y-4">
                                    <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 border-4 border-white/30 rounded-2xl pointer-events-none" />
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                stopCamera();
                                                setStep('idle');
                                            }}
                                            className="flex-1 rounded-xl"
                                        >
                                            Batal
                                        </Button>
                                        <Button
                                            onClick={handleCapture}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl"
                                        >
                                            <Camera className="mr-2 h-5 w-5" />
                                            Ambil Foto
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {step === 'processing' && photoPreview && (
                                <div className="space-y-4">
                                    <div className="relative aspect-[3/4] bg-slate-100 rounded-2xl overflow-hidden">
                                        <img
                                            src={photoPreview}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={handleRetake}
                                            className="flex-1 rounded-xl"
                                            disabled={submitting}
                                        >
                                            Ulangi
                                        </Button>
                                        <Button
                                            onClick={handleSubmit}
                                            className="flex-1 bg-green-600 hover:bg-green-700 rounded-xl"
                                            disabled={submitting}
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                    Menyimpan...
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle2 className="mr-2 h-5 w-5" />
                                                    Konfirmasi
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
}

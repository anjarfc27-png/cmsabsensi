import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Camera, Clock, ShieldCheck, Target } from 'lucide-react';

export function AttendanceTour() {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const [run, setRun] = useState(false);

    const steps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="text-center space-y-4 px-2 py-4 animate-in fade-in zoom-in duration-500">
                    <div className="text-6xl mb-2" style={{ animation: 'float-animation 3s ease-in-out infinite' }}>📍</div>
                    <div>
                        <h3 className="font-black text-2xl text-slate-900 mb-2 leading-tight">Panduan Presensi</h3>
                        <p className="text-slate-500 leading-relaxed text-sm font-medium">
                            Halo {profile?.full_name?.split(' ')[0]}! Mari kami tunjukkan cara absen yang <strong>benar & cepat</strong> agar data Anda selalu akurat.
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="gps-indicator"]',
            content: (
                <div className="space-y-3 text-left p-1">
                    <div className="flex items-center gap-2 text-emerald-600">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Target className="h-5 w-5" />
                        </div>
                        <h4 className="font-black text-lg">Validasi GPS</h4>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Pastikan kotak ini berwarna <strong>Hijau</strong>. Jika masih Kuning, tunggu sebentar atau klik 'Perbarui GPS' agar lokasi Anda terkunci akurat.
                    </p>
                </div>
            ),
            spotlightPadding: 10,
        },
        {
            target: '[data-tour="face-photo"]',
            content: (
                <div className="space-y-3 text-left p-1">
                    <div className="flex items-center gap-2 text-blue-600">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Camera className="h-5 w-5" />
                        </div>
                        <h4 className="font-black text-lg">Bukti Swafoto</h4>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Klik di sini untuk mengambil foto selfie. Pastikan wajah terlihat jelas tanpa masker/kacamata hitam sebagai bukti kehadiran Anda.
                    </p>
                </div>
            ),
        },
        {
            target: '[data-tour="presence-map"]',
            content: (
                <div className="space-y-3 text-left p-1">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <MapPin className="h-5 w-5" />
                        </div>
                        <h4 className="font-black text-lg">Radius Kantor</h4>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Lingkaran biru di peta menunjukkan <strong>zona absen sah</strong>. Anda harus berada di dalam lingkaran ini agar tombol absen aktif.
                    </p>
                </div>
            ),
        },
        {
            target: '[data-tour="submit-attendance"]',
            content: (
                <div className="space-y-3 text-left p-1">
                    <div className="flex items-center gap-2 text-slate-900">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <h4 className="font-black text-lg">Konfirmasi Akhir</h4>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Setelah GPS terkunci dan foto diambil, tombol ini akan aktif. Klik untuk mengirim data kehadiran Anda ke server pusat.
                    </p>
                </div>
            ),
        },
    ];

    useEffect(() => {
        const checkTourStatus = async () => {
            if (!user) return;

            // TESTING MODE: Force tour to run every time
            setRun(true);

            /* Logic disabled for testing
            const hasSeenTourLocal = localStorage.getItem(`attendance_tour_seen_${user.id}`);
            if (hasSeenTourLocal) return;
            setRun(true);
            */
        };
        checkTourStatus();
    }, [user]);

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status } = data;
        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRun(false);
            if (user) {
                localStorage.setItem(`attendance_tour_seen_${user.id}`, 'true');
            }
            if (status === STATUS.FINISHED) {
                toast({
                    title: "Siap Beraksi! 🚀",
                    description: "Sekarang Anda sudah ahli dalam menggunakan sistem presensi.",
                });
            }
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showSkipButton
            showProgress
            scrollToFirstStep
            disableOverlayClose={true}
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#2563eb',
                    zIndex: 10000,
                    overlayColor: 'rgba(15, 23, 42, 0.9)',
                    backgroundColor: '#fff',
                    textColor: '#1e293b',
                },
                tooltip: {
                    borderRadius: '28px',
                    padding: '24px',
                },
                buttonNext: {
                    borderRadius: '14px',
                    fontWeight: '900',
                    padding: '10px 20px',
                    textTransform: 'uppercase',
                },
                spotlight: {
                    borderRadius: '20px',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.9), 0 0 20px rgba(37, 99, 235, 0.6)'
                }
            }}
            locale={{
                back: 'Kembali',
                close: 'Tutup',
                last: 'Mulai Absen Sekarang',
                next: 'Lanjut',
                skip: 'Lewati',
            }}
        />
    );
}

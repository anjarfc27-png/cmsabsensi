import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { User, Clock, LayoutGrid, Megaphone, ShieldCheck } from 'lucide-react';

export function DashboardTour() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [run, setRun] = useState(false);

    const steps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="text-center space-y-4 px-2 py-4 animate-in fade-in zoom-in duration-500">
                    <div className="text-6xl mb-2" style={{ animation: 'float-animation 3s ease-in-out infinite' }}>👋</div>
                    <div>
                        <h3 className="font-black text-2xl text-slate-900 mb-2 leading-tight">Selamat Datang, {profile?.full_name?.split(' ')[0]}!</h3>
                        <p className="text-slate-500 leading-relaxed text-sm font-medium">
                            Mari kami pandu Anda mengenal dashboard <strong>Duta Mruput</strong> terbaru yang lebih cerdas dan cepat.
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '[data-tour="attendance-card"]',
            content: (
                <div className="space-y-3 text-left p-1">
                    <div className="flex items-center gap-2 text-blue-600">
                        <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <User className="h-5 w-5" />
                        </div>
                        <h4 className="font-black text-lg">Identitas Digital</h4>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Di sini adalah profil Anda. Pastikan <strong>Employee ID</strong> dan <strong>Supervisor</strong> Anda sudah sesuai untuk kemudahan koordinasi.
                    </p>
                </div>
            ),
            disableBeacon: true,
            spotlightPadding: 16,
        },
        {
            target: '[data-tour="attendance-card"]',
            content: (
                <div className="space-y-3 text-left p-1">
                    <div className="flex items-center gap-2 text-amber-600">
                        <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                            <Clock className="h-5 w-5" />
                        </div>
                        <h4 className="font-black text-lg">Live Status</h4>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Kartu ini akan berubah warna otomatis. <b>Biru</b> untuk belum absen, <b>Oranye</b> saat bekerja, dan <b>Hijau</b> saat tugas selesai.
                    </p>
                </div>
            ),
            spotlightPadding: 10,
        },
        {
            target: '[data-tour="main-menu-grid"]',
            content: (
                <div className="space-y-3 text-left p-1">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <LayoutGrid className="h-5 w-5" />
                        </div>
                        <h4 className="font-black text-lg">Pusat Layanan HR</h4>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Semua kebutuhan Anda ada di sini: <b>Absensi GPS</b>, pengajuan <b>Cuti/Lembur</b>, hingga catatan harian dan album kegiatan.
                    </p>
                </div>
            ),
            spotlightPadding: 15,
        },
        {
            target: '[data-tour="news-feed"]',
            content: (
                <div className="space-y-3 text-left p-1">
                    <div className="flex items-center gap-2 text-pink-600">
                        <div className="h-8 w-8 rounded-lg bg-pink-50 flex items-center justify-center">
                            <Megaphone className="h-5 w-5" />
                        </div>
                        <h4 className="font-black text-lg">Berita & Pengumuman</h4>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Jangan lewatkan info terbaru dari manajemen. Semua kebijakan dan berita perusahaan akan muncul secara <i>real-time</i> di sini.
                    </p>
                </div>
            ),
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-4 px-2 py-6">
                    <div className="text-6xl" style={{ animation: 'tour-pulse 2s infinite' }}>🛡️</div>
                    <div>
                        <h3 className="font-black text-2xl text-slate-900 mb-2">Smart Biometrics</h3>
                        <p className="text-slate-500 leading-relaxed text-sm font-medium">
                            Anda juga bisa masuk ke aplikasi menggunakan <strong>Sidik Jari</strong> atau <strong>Face ID</strong> bawaan HP Anda. Lebih aman dan praktis!
                        </p>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-5 px-2 py-6">
                    <div className="text-6xl animate-bounce">🚀</div>
                    <div>
                        <h3 className="font-black text-2xl text-slate-900 mb-2">Siap Mulai?</h3>
                        <p className="text-slate-500 leading-relaxed text-sm font-medium mb-6">
                            Sekarang Anda sudah siap menggunakan sistem <strong>Duta Mruput Enterprise</strong>. Selamat bekerja dan raih prestasi maksimal!
                        </p>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 w-full animate-in slide-in-from-left duration-1000" />
                        </div>
                    </div>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
    ];

    useEffect(() => {
        const checkTourStatus = async () => {
            if (!user) return;

            // TESTING MODE: Force tour to run every time
            setRun(true);

            /* Logic disabled for testing
            const hasSeenTourLocal = localStorage.getItem(`tour_seen_${user.id}`);
            if (hasSeenTourLocal) return;

            const { data } = await supabase
                .from('profiles')
                .select('has_seen_tour')
                .eq('id', user.id)
                .single();

            if (!data?.has_seen_tour) {
                setRun(true);
            }
            */
        };

        checkTourStatus();
    }, [user]);

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status } = data;

        // Save 'seen' status if finished or skipped
        if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
            setRun(false);
            if (user) {
                localStorage.setItem(`tour_seen_${user.id}`, 'true');

                await supabase
                    .from('profiles')
                    .update({ has_seen_tour: true })
                    .eq('id', user.id);
            }

            if (status === STATUS.FINISHED) {
                toast({
                    title: "Tour Selesai 🎉",
                    description: "Selamat datang di pengalaman kerja baru!",
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
            spotlightClicks={false}
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#2563eb', // blue-600
                    zIndex: 10000,
                    overlayColor: 'rgba(15, 23, 42, 0.9)', // Premium Zinc-900 overlay
                    arrowColor: '#fff',
                    backgroundColor: '#fff',
                    textColor: '#1e293b',
                },
                tooltip: {
                    borderRadius: '28px',
                    fontFamily: 'inherit',
                    padding: '24px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                },
                buttonNext: {
                    borderRadius: '16px',
                    fontWeight: '900',
                    padding: '12px 24px',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                    transition: 'all 0.2s ease'
                },
                buttonBack: {
                    color: '#94a3b8',
                    marginRight: '10px',
                    fontWeight: '700',
                    fontSize: '14px'
                },
                buttonSkip: {
                    color: '#94a3b8',
                    fontWeight: '700',
                    fontSize: '12px',
                    textTransform: 'uppercase'
                },
                spotlight: {
                    borderRadius: '24px',
                    boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.9), 0 0 20px rgba(37, 99, 235, 0.3)'
                }
            }}
            locale={{
                back: 'Kembali',
                close: 'Tutup',
                last: 'Gabung Sekarang 🚀',
                next: 'Lanjut',
                skip: 'Lewati',
            }}
        />
    );
}

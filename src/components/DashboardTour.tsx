import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';

export function DashboardTour() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [run, setRun] = useState(false);

    const steps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="text-center space-y-4 px-2 py-2">
                    <div className="text-5xl animate-bounce">👋</div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-2">Selamat Datang!</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Halo! Selamat datang di aplikasi <strong>CMS Duta Solusi</strong>.
                            <br />Mari kami pandu Anda mengenal fitur-fitur utama agar aktivitas kerja Anda lebih mudah.
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
                <div className="space-y-2 text-left">
                    <h4 className="font-bold text-lg text-blue-600">Status Kehadiran</h4>
                    <p className="text-slate-600 text-sm">
                        Pantau jam masuk dan pulang Anda secara real-time di sini.
                        Warna kartu akan berubah sesuai status kehadiran Anda.
                    </p>
                </div>
            ),
            disableBeacon: true,
        },
        {
            target: '[data-tour="quick-action"]',
            content: (
                <div className="space-y-2 text-left">
                    <h4 className="font-bold text-lg text-indigo-600">Absen Cepat</h4>
                    <p className="text-slate-600 text-sm">
                        Klik tombol <strong>Absen</strong> ini untuk melakukan clock-in atau clock-out harian Anda dengan mudah.
                    </p>
                </div>
            ),
        },
        {
            target: '[data-tour="nav-history"]',
            content: (
                <div className="space-y-2 text-left">
                    <h4 className="font-bold text-lg text-purple-600">Riwayat & Laporan</h4>
                    <p className="text-slate-600 text-sm">
                        Lihat rekap kehadiran, keterlambatan, dan lembur Anda di menu <strong>Riwayat</strong>.
                    </p>
                </div>
            ),
        },
        {
            target: '[data-tour="nav-schedule"]',
            content: (
                <div className="space-y-2 text-left">
                    <h4 className="font-bold text-lg text-orange-600">Agenda & Jadwal</h4>
                    <p className="text-slate-600 text-sm">
                        Jangan lewatkan jadwal shift dan agenda penting perusahaan di sini.
                    </p>
                </div>
            ),
        },
        {
            target: '[data-tour="nav-profile"]',
            content: (
                <div className="space-y-2 text-left">
                    <h4 className="font-bold text-lg text-slate-700">Profil & Pengaturan</h4>
                    <p className="text-slate-600 text-sm">
                        Kelola data diri, ganti password, dan pengaturan akun lainnya di menu Profil.
                    </p>
                </div>
            ),
        },
        {
            target: 'body',
            content: (
                <div className="text-center space-y-4 px-2 py-2">
                    <div className="text-5xl">🔐</div>
                    <div>
                        <h3 className="font-black text-xl text-slate-900 mb-2">Satu Langkah Lagi</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Untuk keamanan akun dan kemudahan login, Anda wajib mendaftarkan wajah Anda.
                        </p>
                        <div className='mt-4 bg-blue-50 p-3 rounded-lg border border-blue-100'>
                            <p className="text-xs font-bold text-blue-700">
                                Klik "Selesai" untuk menuju halaman Registrasi Wajah.
                            </p>
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

            // Check local storage first for immediate feedback
            const hasSeenTourLocal = localStorage.getItem(`tour_seen_${user.id}`);
            if (hasSeenTourLocal) return;

            // Check database (optional, if you want to sync across devices)
            const { data } = await supabase
                .from('profiles')
                .select('has_seen_tour')
                .eq('id', user.id)
                .single();

            if (!data?.has_seen_tour) {
                setRun(true);
            }
        };

        checkTourStatus();
    }, [user]);

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status, action, index, type } = data;

        // Save 'seen' status if finished or skipped
        if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
            setRun(false);
            if (user) {
                localStorage.setItem(`tour_seen_${user.id}`, 'true');

                // Update DB asynchronously
                await supabase
                    .from('profiles')
                    .update({ has_seen_tour: true })
                    .eq('id', user.id);
            }

            // Redirect to Face Registration ONLY if they finished naturally (didn't skip mid-way)
            // Or if user specifically requested, we force redirect. 
            // Here we redirect if finished.
            if (status === STATUS.FINISHED) {
                navigate('/face-registration');
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
                    overlayColor: 'rgba(0, 0, 0, 0.75)', // Darker overlay for focus
                    arrowColor: '#fff',
                    backgroundColor: '#fff',
                    textColor: '#334155',
                },
                tooltip: {
                    borderRadius: '24px',
                    fontFamily: 'inherit',
                    padding: '20px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                },
                buttonNext: {
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    padding: '10px 20px',
                    fontSize: '14px',
                    boxShadow: '0 4px 6px -1px rgb(37 99 235 / 0.2)'
                },
                buttonBack: {
                    color: '#64748b',
                    marginRight: '10px',
                    fontWeight: '600'
                },
                buttonSkip: {
                    color: '#94a3b8',
                    fontWeight: '500',
                    fontSize: '12px'
                },
                spotlight: {
                    borderRadius: '16px',
                }
            }}
            locale={{
                back: 'Kembali',
                close: 'Tutup',
                last: 'Selesai & Daftar Wajah',
                next: 'Lanjut',
                skip: 'Lewati Tour',
            }}
        />
    );
}

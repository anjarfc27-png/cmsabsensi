
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import {
    Smartphone,
    Lock,
    ArrowLeft
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

interface AttendanceDesktopViewProps {
    user: any;
    navigate: (path: string) => void;
}

export default function AttendanceDesktopView({
    user,
    navigate,
}: AttendanceDesktopViewProps) {
    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 py-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-8 mb-12">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Presensi Kehadiran</h1>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: id })}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/dashboard')}
                        className="text-slate-500 font-bold gap-2 hover:bg-slate-100 rounded-xl"
                    >
                        <ArrowLeft className="h-4 w-4" /> Kembali k Beranda
                    </Button>
                </div>

                {/* DESKTOP BLOCKER - USER REQUESTED */}
                <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[40px] overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <div className="flex flex-col items-center justify-center py-24 px-8 text-center bg-gradient-to-b from-white to-slate-50/50">
                            <div className="relative mb-8">
                                <div className="h-28 w-28 bg-blue-50 rounded-[36px] flex items-center justify-center shadow-inner animate-pulse">
                                    <Smartphone className="h-14 w-14 text-blue-600" />
                                </div>
                                <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-3 shadow-xl border border-red-50">
                                    <Lock className="h-7 w-7 text-red-500" />
                                </div>
                            </div>

                            <div className="max-w-md space-y-4">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Akses Terbatas</h2>
                                <p className="text-slate-500 font-bold leading-relaxed">
                                    Mohon maaf, fitur absensi hanya dapat diakses melalui <span className="text-blue-600 underline">Aplikasi Mobile (Android/iOS)</span>.
                                </p>
                                <p className="text-xs text-slate-400 font-medium">
                                    Hal ini diperlukan untuk memvalidasi identitas Anda menggunakan sensor sidik jari native yang hanya tersedia pada perangkat smartphone.
                                </p>
                            </div>

                            <div className="mt-12 w-full max-w-xs">
                                <Button
                                    size="lg"
                                    onClick={() => navigate('/dashboard')}
                                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                                >
                                    Paham, Kembali ke Dashboard
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Info Text */}
                <p className="text-center mt-8 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
                    CMS Absensi • Secure Verification System
                </p>
            </div>
        </DashboardLayout>
    );
}

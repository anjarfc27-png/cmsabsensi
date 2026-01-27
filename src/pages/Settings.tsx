
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';
import { Loader2, Camera, ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

import { useIsMobile } from "@/hooks/useIsMobile";

export default function Settings() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, role } = useAuth();
    const isMobile = useIsMobile();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Config States
    const [requireFaceVerification, setRequireFaceVerification] = useState(true);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'require_face_verification')
                .single();

            if (error && error.code !== 'PGRST116') throw error; // Ignore no rows error

            if (data) {
                console.log('Settings raw value:', data.value, 'type:', typeof data.value);
                console.log('Settings parsed to boolean:', Boolean(data.value));
                setRequireFaceVerification(Boolean(data.value));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('app_settings')
                .update({
                    value: requireFaceVerification,
                    description: 'Toggle apakah verifikasi wajah diperlukan untuk absensi',
                    updated_at: new Date().toISOString(),
                    updated_by: user?.id
                })
                .eq('key', 'require_face_verification');

            if (error) throw error;

            toast({
                title: "Pengaturan Disimpan",
                description: "Perubahan konfigurasi absensi telah diperbarui.",
                className: "bg-green-500 text-white border-none"
            });
        } catch (error: any) {
            console.error('Error saving settings:', error);
            toast({
                title: "Gagal Menyimpan",
                description: error.message || "Terjadi kesalahan saat menyimpan pengaturan.",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

    // COMPACT MOBILE VIEW
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="min-h-screen bg-slate-50 pt-[calc(1rem+env(safe-area-inset-top))] pb-32">
                    <div className="px-6 mb-6 flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/dashboard')}
                            className="-ml-3 h-10 w-10 text-slate-500 hover:text-slate-900 rounded-full"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Pengaturan</h1>
                            <p className="text-sm font-medium text-slate-500">Konfigurasi sistem global.</p>
                        </div>
                    </div>

                    <div className="px-4 space-y-4">
                        {/* Group: Keamanan Absensi */}
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
                                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                                    <Camera className="h-4 w-4 text-blue-600" />
                                </div>
                                <h2 className="text-sm font-bold text-slate-800">Validasi Absensi</h2>
                            </div>

                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <Label className="text-sm font-bold text-slate-900">Wajib Verifikasi Wajah</Label>
                                    <p className="text-xs text-slate-400 leading-snug">
                                        Karyawan wajib selfie saat absen. Jika mati, hanya butuh GPS.
                                    </p>
                                </div>
                                <Switch
                                    checked={requireFaceVerification}
                                    onCheckedChange={setRequireFaceVerification}
                                    className="data-[state=checked]:bg-blue-600 shrink-0 mt-1"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Fixed Bottom Save Button */}
                    <div className="fixed bottom-[80px] left-0 w-full px-4 py-3 bg-white/80 backdrop-blur-md border-t border-slate-200 z-30">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full h-12 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200/50"
                        >
                            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : "Simpan Perubahan"}
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    // DESKTOP VIEW
    return (
        <DashboardLayout>
            <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengaturan Sistem</h1>
                    <p className="text-slate-500">Konfigurasi global untuk aplikasi Absensi.</p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Camera className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Metode Validasi Absensi</CardTitle>
                                <CardDescription>Atur keamanan saat karyawan melakukan Clock In/Out.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2 border p-4 rounded-xl bg-slate-50">
                            <div className="space-y-1">
                                <Label className="text-base font-semibold">Wajib Verifikasi Wajah</Label>
                                <p className="text-sm text-slate-500 max-w-[80%]">
                                    Jika aktif, kamera akan menyala dan karyawan harus scan wajah.
                                    Jika non-aktif, karyawan hanya perlu konfirmasi lokasi GPS.
                                </p>
                            </div>
                            <Switch
                                checked={requireFaceVerification}
                                onCheckedChange={setRequireFaceVerification}
                                className="data-[state=checked]:bg-blue-600 scale-125 mr-2"
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t">
                            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 min-w-[140px] shadow-lg shadow-blue-200">
                                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : "Simpan Perubahan"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div >
        </DashboardLayout >
    );
}

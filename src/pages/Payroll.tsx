import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calculator, ChevronLeft, Info } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export default function PayrollPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // ----------------------------------------------------------------------
  // MOBILE VIEW (PRESERVED COMING SOON)
  // ----------------------------------------------------------------------
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="relative min-h-screen bg-slate-50/50">
          {/* Background Gradient */}
          <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

          <div className="relative z-10 space-y-6 max-w-7xl mx-auto px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-6">
            <div className="flex items-start gap-3 text-white pb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/dashboard')}
                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold tracking-tight drop-shadow-md">Gaji & Payroll</h1>
                <p className="text-xs text-blue-50 font-medium opacity-90 mt-1">
                  Kelola penggajian karyawan
                </p>
              </div>
            </div>

            {/* Coming Soon Card */}
            <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden max-w-2xl mx-auto">
              <CardContent className="p-8 md:p-12 flex flex-col items-center text-center">
                <div className="h-20 w-20 bg-gradient-to-br from-green-100 to-emerald-50 rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <Calculator className="h-10 w-10 text-green-600" />
                </div>

                <Badge className="mb-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white border-none shadow-md px-4 py-1">
                  Coming Soon
                </Badge>

                <h2 className="text-2xl font-black text-slate-900 mb-3">
                  Fitur Payroll Sedang Dikembangkan
                </h2>

                <p className="text-slate-600 max-w-md mb-8 leading-relaxed">
                  Kami sedang menyiapkan sistem penggajian otomatis yang lebih akurat untuk versi Mobile. Silakan akses via Desktop untuk fitur lengkap.
                </p>

                <Button
                  onClick={() => navigate('/dashboard')}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg rounded-xl px-8"
                >
                  Kembali ke Dashboard
                </Button>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="border-blue-200 bg-blue-50/50 max-w-2xl mx-auto rounded-2xl">
              <CardContent className="p-6 flex gap-4">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-blue-900">Sedang dalam Tahap Pengembangan</p>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    Saat ini sistem masih dalam masa transisi. Untuk keperluan payroll, silakan hubungi tim HRD.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ----------------------------------------------------------------------
  // DESKTOP VIEW (COMING SOON)
  // ----------------------------------------------------------------------
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-6 py-8 h-[calc(100vh-80px)] flex flex-col items-center justify-center text-center">
        <Card className="border-none shadow-2xl bg-white rounded-[32px] overflow-hidden max-w-2xl w-full relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
          <CardContent className="p-16 flex flex-col items-center text-center space-y-8">
            <div className="h-32 w-32 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-full flex items-center justify-center shadow-inner">
              <Calculator className="h-16 w-16 text-indigo-600" />
            </div>

            <div className="space-y-4">
              <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0 px-4 py-1.5 text-sm font-semibold shadow-md">
                Segera Hadir
              </Badge>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Manajemen Payroll</h1>
              <p className="text-lg text-slate-500 max-w-lg mx-auto leading-relaxed">
                Kami sedang membangun sistem penggajian lengkap dengan integrasi PPh 21, BPJS, dan slip gaji digital otomatis.
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={() => navigate('/dashboard')} variant="outline" className="h-12 px-8 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold">
                Kembali ke Dashboard
              </Button>
              <Button disabled className="h-12 px-8 rounded-xl bg-slate-100 text-slate-400 font-bold cursor-not-allowed">
                Beritahu Saya
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

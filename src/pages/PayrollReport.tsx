import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Receipt, ChevronLeft } from 'lucide-react';

export default function PayrollReportPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 animate-pulse" />
          <div className="relative h-24 w-24 bg-green-50 rounded-3xl flex items-center justify-center shadow-inner">
            <Receipt className="h-12 w-12 text-green-600 animate-bounce" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2 mt-4">Laporan Gaji Segera Hadir!</h1>
        <p className="text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
          Modul laporan penggajian (Payroll) yang komprehensif sedang dalam tahap pengembangan akhir. <br />
          Nantikan kemudahan manajemen gaji, slip gaji otomatis, dan export laporan pajak dalam update berikutnya.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          <Button onClick={() => navigate('/dashboard')} variant="outline" className="flex-1 rounded-xl h-12">
            <ChevronLeft className="mr-2 h-4 w-4" /> Kembali ke Dashboard
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

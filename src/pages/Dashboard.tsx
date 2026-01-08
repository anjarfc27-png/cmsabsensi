import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance } from '@/types';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { AppLogo } from '@/components/AppLogo';
import {
  Clock,
  Calendar,
  FileText,
  Receipt,
  Wallet,
  Users,
  MapPin,
  BarChart3,
  DollarSign,
  ClipboardCheck,
  AlertCircle,
  Briefcase,
  TrendingUp,
} from 'lucide-react';

export default function Dashboard() {
  const isMobile = useIsMobile();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [stats, setStats] = useState({ present: 0, late: 0, leave: 0, overtime: 0 });
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user?.id]);

  const fetchDashboardData = async () => {
    try {
      if (!user) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

      const [todayRes, monthRes, annRes] = await Promise.all([
        supabase.from('attendances').select('*').eq('user_id', user.id).eq('date', today).maybeSingle(),
        supabase.from('attendances').select('*').eq('user_id', user.id).gte('date', startOfMonth).lte('date', today),
        supabase.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(5)
      ]);

      setTodayAttendance(todayRes.data as Attendance | null);
      setAnnouncements(annRes.data || []);

      if (monthRes.data) {
        setStats({
          present: monthRes.data.filter(a => a.status === 'present').length,
          late: monthRes.data.filter(a => a.is_late).length,
          leave: monthRes.data.filter(a => a.status === 'leave').length,
          overtime: monthRes.data.reduce((acc, a) => acc + (a.work_hours_minutes && a.work_hours_minutes > 480 ? 1 : 0), 0),
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardLayout><div className="p-4 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div></DashboardLayout>;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  // -------------------------------------------------------------------------
  // RENDER MOBILE DASHBOARD (FROZEN LOOK)
  // -------------------------------------------------------------------------
  if (isMobile) {
    return (
      <DashboardLayout>
        <div className="relative">
          {/* Background Header */}
          <div className="absolute -top-4 -left-4 w-[calc(100%+2rem)] h-[210px] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

          <div className="relative z-10 space-y-6 max-w-5xl mx-auto pb-24">
            {/* Mobile Header */}
            <div className="flex items-center justify-between pt-[calc(3.5rem+env(safe-area-inset-top))] pb-2 px-2 text-white">
              <div className="flex items-center gap-3">
                <div className="h-14 min-w-[140px] px-4 rounded-2xl bg-white shadow-lg flex items-center justify-center">
                  <AppLogo className="h-9 w-auto" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Hi, {profile?.full_name?.split(' ')[0]}</h1>
                  <p className="text-xs text-blue-50 font-medium opacity-90">{getGreeting()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell iconClassName="text-white" />
              </div>
            </div>

            {/* Mobile Menu Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 -mt-2 mx-2">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <div className="h-1 w-4 bg-blue-500 rounded-full" /> Menu Karyawan
              </h3>
              <div className="grid grid-cols-4 gap-y-6 gap-x-4 text-center">
                <MenuGridItem href="/attendance" icon={Clock} label="Absen" color="text-blue-600" bg="bg-blue-50" />
                <MenuGridItem href="/history" icon={Calendar} label="Riwayat" color="text-purple-600" bg="bg-purple-50" />
                <MenuGridItem href="/leave" icon={FileText} label="Cuti" color="text-orange-600" bg="bg-orange-50" />
                <MenuGridItem href="/overtime" icon={Clock} label="Lembur" color="text-red-500" bg="bg-red-50" />
                <MenuGridItem href="/reimbursement" icon={Receipt} label="Klaim" color="text-emerald-600" bg="bg-emerald-50" />
                <MenuGridItem href="/salary-slips" icon={Wallet} label="Gaji" color="text-teal-600" bg="bg-teal-50" />
              </div>

              {/* Mobile Admin Section */}
              {(profile?.role === 'admin_hr' || profile?.role === 'manager') && (
                <>
                  <div className="my-6 border-t border-slate-100" />
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <div className="h-1 w-4 bg-purple-500 rounded-full" /> Menu Admin
                  </h3>
                  <div className="grid grid-cols-4 gap-y-6 gap-x-4 text-center">
                    <MenuGridItem href="/team-map" icon={Users} label="Pantau" color="text-cyan-600" bg="bg-cyan-50" />
                    <MenuGridItem href="/employees" icon={Users} label="Karyawan" color="text-indigo-600" bg="bg-indigo-50" />
                    <MenuGridItem href="/shifts" icon={Clock} label="Shift" color="text-pink-600" bg="bg-pink-50" />
                    <MenuGridItem href="/approvals" icon={ClipboardCheck} label="Approval" color="text-amber-600" bg="bg-amber-50" />
                    <MenuGridItem href="/payroll" icon={DollarSign} label="Payroll" color="text-green-600" bg="bg-green-50" />
                    <MenuGridItem href="/locations" icon={MapPin} label="Lokasi" color="text-rose-600" bg="bg-rose-50" />
                    <MenuGridItem href="/reports" icon={BarChart3} label="Laporan" color="text-slate-600" bg="bg-slate-50" />
                  </div>
                </>
              )}
            </div>

            {/* Mobile Status Card */}
            <div className="mx-2">
              <div className="w-full h-[140px] rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute right-0 top-0 h-24 w-24 bg-white/10 rounded-bl-full -mr-4 -mt-4" />
                <div>
                  <p className="text-xs font-medium text-blue-100 mb-1">Status Hari Ini</p>
                  <h3 className="text-xl font-bold">{todayAttendance ? (todayAttendance.clock_out ? 'Sudah Pulang' : 'Bekerja') : 'Belum Absen'}</h3>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-blue-200 uppercase font-black tracking-widest leading-none mb-1">Masuk</span>
                    <span className="font-mono text-xl font-bold">{todayAttendance ? format(new Date(todayAttendance.clock_in), 'HH:mm') : '--:--'}</span>
                  </div>
                  <Button size="sm" variant="secondary" className="h-9 px-4 text-xs bg-white text-blue-700 hover:bg-blue-50 border-0 rounded-xl font-black" asChild>
                    <Link to="/attendance">ABSEN</Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile Announcements (Berita & Artikel) */}
            <div className="mx-2">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <div className="h-1 w-4 bg-orange-500 rounded-full" /> Berita & Pengumuman
              </h3>
              <div className="space-y-3">
                {announcements.length > 0 ? (
                  announcements.map((ann) => (
                    <Card key={ann.id} className="border border-slate-100 shadow-sm rounded-xl overflow-hidden active:scale-[0.98] transition-transform">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-blue-200 text-blue-600 bg-blue-50">Info</Badge>
                          <span className="text-[10px] text-slate-400">{format(new Date(ann.created_at), 'd MMM yyyy', { locale: id })}</span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 mb-1 line-clamp-2">{ann.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2">{ann.content}</p>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-400 italic">Belum ada berita terbaru</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER DESKTOP DASHBOARD (FREE TO EDIT)
  // -------------------------------------------------------------------------
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Desktop Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{getGreeting()}, {profile?.full_name}</h1>
            <p className="text-slate-500 mt-1 font-medium">Selamat datang kembali di sistem HRIS.</p>
          </div>
        </div>

        {/* Desktop Statistics Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden hover:scale-105 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Kehadiran</p>
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-3xl font-black text-slate-900">{stats.present}</div>
              <p className="text-xs text-slate-400 mt-1">Tepat waktu bulan ini</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden hover:scale-105 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Terlambat</p>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-3xl font-black text-slate-900">{stats.late}</div>
              <p className="text-xs text-slate-400 mt-1">Sesi terlambat terdeteksi</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden hover:scale-105 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cuti / Izin</p>
                <Calendar className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-3xl font-black text-slate-900">{stats.leave}</div>
              <p className="text-xs text-slate-400 mt-1">Hari absen terdaftar</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white rounded-3xl overflow-hidden hover:scale-105 transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Lembur</p>
                <Briefcase className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-3xl font-black text-slate-900">{stats.overtime}</div>
              <p className="text-xs text-slate-400 mt-1">Sesi lembur divalidasi</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Today Status Card */}
          <Card className="lg:col-span-2 border-none shadow-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-[32px]">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm mb-2">Status Absensi Hari Ini</p>
                  <h2 className="text-3xl font-black mb-1">
                    {todayAttendance ? (todayAttendance.clock_out ? 'Sudah Selesai' : 'Sedang Bekerja') : 'Belum Absen'}
                  </h2>
                  {todayAttendance && (
                    <p className="text-blue-100">
                      Masuk: {format(new Date(todayAttendance.clock_in), 'HH:mm')}
                      {todayAttendance.clock_out && ` • Pulang: ${format(new Date(todayAttendance.clock_out), 'HH:mm')}`}
                    </p>
                  )}
                </div>
                <Button
                  size="lg"
                  onClick={() => navigate('/attendance')}
                  className="bg-white text-blue-700 hover:bg-blue-50 rounded-2xl px-8 font-black shadow-xl"
                >
                  {todayAttendance && !todayAttendance.clock_out ? 'Absen Pulang' : 'Buka Absensi'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Desktop Announcements */}
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Berita & Pengumuman
            </h3>
            <div className="space-y-3">
              {announcements.length > 0 ? (
                announcements.map((ann) => (
                  <Card key={ann.id} className="border-none shadow-lg bg-white rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-1">
                        <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-blue-50 text-blue-700">Info</Badge>
                        <span className="text-[10px] text-slate-400">{format(new Date(ann.created_at), 'd MMM yyyy', { locale: id })}</span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 mb-1 mt-2 line-clamp-1">{ann.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2">{ann.content}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed border-2 border-slate-200 shadow-none bg-transparent">
                  <CardContent className="p-6 text-center text-slate-400 text-sm">
                    Tidak ada pengumuman saat ini.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Helper Components
function MenuGridItem({ href, icon: Icon, label, color, bg }: any) {
  return (
    <Link to={href} className="flex flex-col items-center gap-2 group">
      <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-200 group-hover:scale-105 shadow-sm border border-slate-50", bg)}>
        <Icon className={cn("h-7 w-7", color)} />
      </div>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-blue-600">{label}</span>
    </Link>
  );
}

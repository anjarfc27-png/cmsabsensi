import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, BarChart3, Filter, FileText, TrendingUp, Clock, AlertCircle, ChevronLeft } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { id } from 'date-fns/locale';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/ui/badge';

type AttendanceRow = {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  work_mode: 'wfo' | 'wfh' | 'field';
  is_late: boolean | null;
  late_minutes: number | null;
  work_hours_minutes: number | null;
  status: 'present' | 'late' | 'absent' | 'leave' | 'sick';
};

type ProfileRow = {
  id: string;
  full_name: string;
  employee_id: string | null;
  department: string | null;
  role: string | null;
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<AttendanceRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  // Filters State
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uniqueDepts, setUniqueDepts] = useState<string[]>([]);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const [attRes, profRes] = await Promise.all([
        supabase
          .from('attendances')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, employee_id, department, role')
          .order('full_name', { ascending: true }),
      ]);

      if (attRes.error) throw attRes.error;
      if (profRes.error) throw profRes.error;

      const attData = (attRes.data as AttendanceRow[]) || [];
      const profData = (profRes.data as ProfileRow[]) || [];

      setAttendances(attData);
      setProfiles(profData);

      // Extract Unique Departments
      const depts = new Set<string>();
      profData.forEach(p => { if (p.department) depts.add(p.department); });
      setUniqueDepts(Array.from(depts));

    } catch (e) {
      toast({ title: 'Error', description: 'Gagal memuat laporan', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  // Filter Logic
  const filteredAttendances = useMemo(() => {
    return attendances.filter(a => {
      const userProfile = profileMap.get(a.user_id);
      if (!userProfile) return false;

      // Search Filter
      if (searchQuery && !userProfile.full_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Department Filter
      if (selectedDept !== 'all' && userProfile.department !== selectedDept) {
        return false;
      }

      // Role Filter
      if (selectedRole !== 'all' && userProfile.role !== selectedRole) {
        return false;
      }

      return true;
    });
  }, [attendances, profileMap, searchQuery, selectedDept, selectedRole]);

  const stats = useMemo(() => {
    if (filteredAttendances.length === 0) return null;
    const totalLate = filteredAttendances.filter(a => a.is_late).length;
    const latePercent = Math.round((totalLate / filteredAttendances.length) * 100);
    const avgWorkMinutes = Math.round(filteredAttendances.reduce((acc, a) => acc + (a.work_hours_minutes || 0), 0) / filteredAttendances.length);

    return {
      total: filteredAttendances.length,
      late: totalLate,
      latePercent,
      avgHours: (avgWorkMinutes / 60).toFixed(1)
    };
  }, [filteredAttendances]);

  const quickFilter = (type: 'this_month' | 'last_month' | 'year') => {
    let start = new Date();
    let end = new Date();

    if (type === 'this_month') {
      start = startOfMonth(new Date());
      end = endOfMonth(new Date());
    } else if (type === 'last_month') {
      start = startOfMonth(subMonths(new Date(), 1));
      end = endOfMonth(subMonths(new Date(), 1));
    } else if (type === 'year') {
      start = startOfYear(new Date());
      end = endOfMonth(new Date());
    }

    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  const exportCsv = () => {
    const headers = ['Tanggal', 'Nama', 'Departemen', 'Jabatan', 'Clock In', 'Clock Out', 'Mode', 'Terlambat', 'Menit Terlambat', 'Status'];
    const rows = filteredAttendances.map((a) => {
      const p = profileMap.get(a.user_id);
      return [
        a.date,
        p?.full_name || '-',
        p?.department || '-',
        p?.role || '-',
        a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '-',
        a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : '-',
        a.work_mode.toUpperCase(),
        a.is_late ? 'YA' : 'TIDAK',
        String(a.late_minutes ?? 0),
        a.status.toUpperCase(),
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Report_Absensi_${startDate}_${endDate}.csv`;
    link.click();
  };

  if (profile?.role !== 'admin_hr' && profile?.role !== 'super_admin' && profile?.role !== 'manager') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold">Akses Ditolak</h2>
          <p className="text-muted-foreground">Hanya Admin atau Manager yang dapat mengakses laporan ini.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="relative min-h-screen bg-slate-50/50">
        <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

        <div className="relative z-10 space-y-4 max-w-[1600px] mx-auto pt-[calc(1rem+env(safe-area-inset-top))] pb-20 px-4 md:px-6">
          {/* Header with Back Button - Compact */}
          <div className="flex items-start gap-3 text-white">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
              className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg md:text-xl font-bold tracking-tight drop-shadow-md flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Laporan Kehadiran
              </h1>
              <p className="text-xs text-blue-50 font-medium opacity-90 mt-0.5">Pantau produktivitas karyawan</p>
            </div>
            <Button variant="secondary" className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg text-xs h-8 px-3" onClick={exportCsv} disabled={filteredAttendances.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
            </Button>
          </div>

          {/* Quick Filters */}
          <Card className="border-none shadow-xl bg-white/95 backdrop-blur-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col gap-4">
                {/* Row 1: Date & Presets */}
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2 w-full md:w-auto">
                    <Label className="text-xs font-bold uppercase text-slate-500">Mulai</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-10" />
                  </div>
                  <div className="space-y-2 w-full md:w-auto">
                    <Label className="text-xs font-bold uppercase text-slate-500">Selesai</Label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-10" />
                  </div>
                  <div className="flex gap-2 flex-1 md:flex-none">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                      <Button variant="ghost" size="sm" onClick={() => quickFilter('this_month')} className="text-[10px] h-8 px-3">Bulan Ini</Button>
                      <Button variant="ghost" size="sm" onClick={() => quickFilter('last_month')} className="text-[10px] h-8 px-3">Bulan Lalu</Button>
                    </div>
                  </div>
                </div>

                {/* Row 2: Advanced Filters (Dept, Role, Search) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Departemen</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                    >
                      <option value="all">Semua Departemen</option>
                      {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Role / Jabatan</Label>
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                    >
                      <option value="all">Semua Role</option>
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin_hr">Admin HR</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-500">Cari Nama</Label>
                    <Input
                      placeholder="Ketik nama karyawan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={fetchReport} className="bg-blue-600 hover:bg-blue-700 h-10 px-8 w-full md:w-auto shadow-lg shadow-blue-200">
                    <Filter className="mr-2 h-4 w-4" /> Terapkan Filter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <TrendingUp className="h-4 w-4 text-blue-500 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Total Data</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <AlertCircle className="h-4 w-4 text-red-500 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Keterlambatan</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold">{stats?.late || 0}</p>
                  <span className="text-xs text-red-500">({stats?.latePercent || 0}%)</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <Clock className="h-4 w-4 text-green-500 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Rata-rata Jam Kerja</p>
                <p className="text-2xl font-bold">{stats?.avgHours || 0} <span className="text-xs font-normal">h/day</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                <TrendingUp className="h-4 w-4 text-purple-500 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Efisiensi Tim</p>
                <p className="text-2xl font-bold">{stats ? 100 - (stats.latePercent || 0) : 0}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Table Content */}
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Detil Laporan
              </h3>
            </div>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4"><TableSkeleton rows={10} columns={7} /></div>
              ) : filteredAttendances.length === 0 ? (
                <EmptyState icon={BarChart3} title="Data tidak ditemukan" description="Tidak ada data absensi untuk filter yang Anda pilih." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="text-xs font-bold uppercase">Tanggal</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Karyawan</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Mode</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Masuk</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Pulang</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Durasi</TableHead>
                        <TableHead className="text-xs font-bold uppercase">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendances.map((a) => {
                        const profile = profileMap.get(a.user_id);
                        return (
                          <TableRow key={a.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-medium text-xs">
                              {format(new Date(a.date), 'dd MMM yyyy', { locale: id })}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold text-xs text-slate-800">{profile?.full_name || '-'}</span>
                                <span className="text-[10px] text-slate-500">{profile?.department || 'Umum'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] h-5 uppercase">{a.work_mode}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '--:--'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : '--:--'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {a.work_hours_minutes ? `${Math.floor(a.work_hours_minutes / 60)}j ${a.work_hours_minutes % 60}m` : '-'}
                            </TableCell>
                            <TableCell>
                              {a.is_late ? (
                                <div className="flex flex-col">
                                  <Badge variant="destructive" className="text-[9px] h-5 w-fit">Terlambat</Badge>
                                  <span className="text-[10px] text-red-500 mt-0.5">{a.late_minutes}m</span>
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-[9px] h-5 text-green-600 bg-green-50 border-green-200">Tepat Waktu</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

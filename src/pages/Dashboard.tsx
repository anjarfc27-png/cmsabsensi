import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Calendar, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Timer,
  ArrowRight,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance, LeaveRequest, OvertimeRequest } from '@/types';

export default function Dashboard() {
  const { profile, role } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [monthStats, setMonthStats] = useState({
    totalPresent: 0,
    totalLate: 0,
    totalLeave: 0,
    totalOvertime: 0,
  });
  const [pendingRequests, setPendingRequests] = useState({
    leave: 0,
    overtime: 0,
  });
  const [recentLeave, setRecentLeave] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

      // Fetch today's attendance
      const { data: todayData } = await supabase
        .from('attendances')
        .select('*')
        .eq('date', today)
        .maybeSingle();
      
      setTodayAttendance(todayData as Attendance | null);

      // Fetch month statistics
      const { data: monthData } = await supabase
        .from('attendances')
        .select('*')
        .gte('date', startOfMonth)
        .lte('date', today);

      if (monthData) {
        setMonthStats({
          totalPresent: monthData.filter((a) => a.status === 'present' || a.status === 'late').length,
          totalLate: monthData.filter((a) => a.is_late).length,
          totalLeave: monthData.filter((a) => a.status === 'leave' || a.status === 'sick').length,
          totalOvertime: monthData.reduce((acc, a) => acc + (a.work_hours_minutes && a.work_hours_minutes > 480 ? a.work_hours_minutes - 480 : 0), 0),
        });
      }

      // Fetch pending requests count for admin/manager
      if (role === 'admin_hr' || role === 'manager') {
        const { data: pendingLeave } = await supabase
          .from('leave_requests')
          .select('id')
          .eq('status', 'pending');

        const { data: pendingOvertime } = await supabase
          .from('overtime_requests')
          .select('id')
          .eq('status', 'pending');

        setPendingRequests({
          leave: pendingLeave?.length || 0,
          overtime: pendingOvertime?.length || 0,
        });
      }

      // Fetch recent leave requests
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      setRecentLeave((leaveData as LeaveRequest[]) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}j ${mins}m`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">
            {getGreeting()}, {profile?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Today's Attendance Status */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Status Absensi Hari Ini</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {todayAttendance ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Clock In</p>
                      <p className="text-lg font-semibold">
                        {todayAttendance.clock_in 
                          ? format(new Date(todayAttendance.clock_in), 'HH:mm')
                          : '-'
                        }
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Clock Out</p>
                      <p className="text-lg font-semibold">
                        {todayAttendance.clock_out 
                          ? format(new Date(todayAttendance.clock_out), 'HH:mm')
                          : '-'
                        }
                      </p>
                    </div>
                    <Badge 
                      variant={todayAttendance.is_late ? 'destructive' : 'default'}
                    >
                      {todayAttendance.is_late ? 'Terlambat' : 'Tepat Waktu'}
                    </Badge>
                  </div>
                  {!todayAttendance.clock_out && (
                    <Button asChild className="w-full">
                      <Link to="/attendance">
                        Clock Out Sekarang
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted-foreground">Anda belum melakukan absensi hari ini</p>
                  <Button asChild className="w-full">
                    <Link to="/attendance">
                      Clock In Sekarang
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Stats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Kehadiran Bulan Ini</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthStats.totalPresent} Hari</div>
              <p className="text-xs text-muted-foreground">
                {monthStats.totalLate > 0 && `${monthStats.totalLate} kali terlambat`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Cuti/Izin</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthStats.totalLeave} Hari</div>
              <p className="text-xs text-muted-foreground">Bulan ini</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin/Manager Section */}
        {(role === 'admin_hr' || role === 'manager') && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pengajuan Cuti Pending</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingRequests.leave}</div>
                <Button variant="link" asChild className="p-0 h-auto">
                  <Link to="/approvals">Lihat Semua</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pengajuan Lembur Pending</CardTitle>
                <Timer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingRequests.overtime}</div>
                <Button variant="link" asChild className="p-0 h-auto">
                  <Link to="/approvals">Lihat Semua</Link>
                </Button>
              </CardContent>
            </Card>

            {role === 'admin_hr' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Kelola Karyawan</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Button variant="outline" asChild className="w-full">
                    <Link to="/employees">
                      Lihat Karyawan
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Recent Leave Requests */}
        {recentLeave.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pengajuan Cuti Terbaru</CardTitle>
              <CardDescription>Riwayat pengajuan cuti Anda</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentLeave.map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium capitalize">{leave.leave_type.replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(leave.start_date), 'd MMM', { locale: id })} - {format(new Date(leave.end_date), 'd MMM yyyy', { locale: id })}
                      </p>
                    </div>
                    <Badge 
                      variant={
                        leave.status === 'approved' ? 'default' : 
                        leave.status === 'rejected' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {leave.status === 'approved' ? 'Disetujui' : 
                       leave.status === 'rejected' ? 'Ditolak' : 
                       'Menunggu'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, Download, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Attendance } from '@/types';

export default function HistoryPage() {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchAttendances();
  }, [selectedMonth, filterStatus]);

  const fetchAttendances = async () => {
    setLoading(true);
    try {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      let query = supabase
        .from('attendances')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });

      if (filterStatus !== 'all') {
        if (filterStatus === 'late') {
          query = query.eq('is_late', true);
        } else {
          query = query.eq('status', filterStatus as 'present' | 'late' | 'absent' | 'leave' | 'sick');
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setAttendances((data as Attendance[]) || []);
    } catch (error) {
      console.error('Error fetching attendances:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '-';
    return format(new Date(isoString), 'HH:mm');
  };

  const formatMinutes = (minutes: number | null) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}j ${mins}m`;
  };

  const getStatusBadge = (attendance: Attendance) => {
    if (attendance.is_late) {
      return <Badge variant="destructive">Terlambat</Badge>;
    }
    
    switch (attendance.status) {
      case 'present':
        return <Badge>Hadir</Badge>;
      case 'late':
        return <Badge variant="destructive">Terlambat</Badge>;
      case 'absent':
        return <Badge variant="secondary">Tidak Hadir</Badge>;
      case 'leave':
        return <Badge variant="outline">Cuti</Badge>;
      case 'sick':
        return <Badge variant="outline">Sakit</Badge>;
      default:
        return <Badge variant="secondary">{attendance.status}</Badge>;
    }
  };

  const getWorkModeBadge = (mode: string) => {
    switch (mode) {
      case 'wfo':
        return <Badge variant="outline">WFO</Badge>;
      case 'wfh':
        return <Badge variant="outline">WFH</Badge>;
      case 'field':
        return <Badge variant="outline">Dinas</Badge>;
      default:
        return <Badge variant="secondary">{mode}</Badge>;
    }
  };

  const stats = {
    total: attendances.length,
    present: attendances.filter(a => a.status === 'present' || a.status === 'late').length,
    late: attendances.filter(a => a.is_late).length,
    leave: attendances.filter(a => a.status === 'leave' || a.status === 'sick').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Riwayat Absensi</h1>
            <p className="text-muted-foreground">Lihat riwayat kehadiran Anda</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            >
              ←
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[180px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedMonth, 'MMMM yyyy', { locale: id })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => date && setSelectedMonth(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            >
              →
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Hari</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Hadir</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.present}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Terlambat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.late}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cuti/Izin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.leave}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="present">Hadir</SelectItem>
              <SelectItem value="late">Terlambat</SelectItem>
              <SelectItem value="leave">Cuti</SelectItem>
              <SelectItem value="sick">Sakit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : attendances.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Tidak ada data absensi untuk periode ini
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Jam Kerja</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.map((attendance) => (
                    <TableRow key={attendance.id}>
                      <TableCell className="font-medium">
                        {format(new Date(attendance.date), 'd MMM yyyy', { locale: id })}
                      </TableCell>
                      <TableCell>{formatTime(attendance.clock_in)}</TableCell>
                      <TableCell>{formatTime(attendance.clock_out)}</TableCell>
                      <TableCell>{formatMinutes(attendance.work_hours_minutes)}</TableCell>
                      <TableCell>{getWorkModeBadge(attendance.work_mode)}</TableCell>
                      <TableCell>{getStatusBadge(attendance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

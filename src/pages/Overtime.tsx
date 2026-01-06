import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OvertimeRequest } from '@/types';

export default function OvertimePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('20:00');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('overtime_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests((data as OvertimeRequest[]) || []);
    } catch (error) {
      console.error('Error fetching overtime requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = (start: string, end: string): number => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return endMinutes - startMinutes;
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} jam ${mins} menit`;
  };

  const handleSubmit = async () => {
    if (!user || !date || !startTime || !endTime || !reason.trim()) {
      toast({
        title: 'Error',
        description: 'Mohon lengkapi semua field',
        variant: 'destructive',
      });
      return;
    }

    const duration = calculateDuration(startTime, endTime);
    
    if (duration <= 0) {
      toast({
        title: 'Error',
        description: 'Waktu selesai harus setelah waktu mulai',
        variant: 'destructive',
      });
      return;
    }

    if (duration > 240) {
      toast({
        title: 'Error',
        description: 'Lembur maksimal 4 jam per hari sesuai peraturan',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.from('overtime_requests').insert({
        user_id: user.id,
        date: format(date, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
        duration_minutes: duration,
        reason: reason.trim(),
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Pengajuan lembur berhasil dikirim',
      });

      setDialogOpen(false);
      setDate(new Date());
      setStartTime('17:00');
      setEndTime('20:00');
      setReason('');
      fetchRequests();
    } catch (error) {
      console.error('Error submitting overtime request:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim pengajuan. Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge>Disetujui</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Ditolak</Badge>;
      case 'pending':
        return <Badge variant="secondary">Menunggu</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lembur</h1>
            <p className="text-muted-foreground">Kelola pengajuan lembur Anda</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Ajukan Lembur
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Ajukan Lembur</DialogTitle>
                <DialogDescription>
                  Isi formulir di bawah untuk mengajukan lembur (maks. 4 jam/hari)
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "d MMMM yyyy", { locale: id }) : "Pilih tanggal"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Waktu Mulai</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Waktu Selesai</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {startTime && endTime && calculateDuration(startTime, endTime) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Durasi: {formatDuration(calculateDuration(startTime, endTime))}
                  </p>
                )}

                <div className="space-y-2">
                  <Label>Alasan</Label>
                  <Textarea
                    placeholder="Jelaskan alasan lembur..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Batal
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    'Kirim Pengajuan'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pengajuan</CardTitle>
            <CardDescription>Daftar pengajuan lembur Anda</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Belum ada pengajuan lembur
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Durasi</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {format(new Date(request.date), 'd MMM yyyy', { locale: id })}
                      </TableCell>
                      <TableCell>
                        {request.start_time.slice(0, 5)} - {request.end_time.slice(0, 5)}
                      </TableCell>
                      <TableCell>{formatDuration(request.duration_minutes)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {request.reason}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
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

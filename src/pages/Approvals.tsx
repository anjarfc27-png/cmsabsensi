import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { LeaveRequest, OvertimeRequest } from '@/types';

export default function ApprovalsPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const [leaveRes, overtimeRes] = await Promise.all([
        supabase.from('leave_requests').select('*').eq('status', 'pending').order('created_at'),
        supabase.from('overtime_requests').select('*').eq('status', 'pending').order('created_at'),
      ]);

      setLeaveRequests((leaveRes.data as LeaveRequest[]) || []);
      setOvertimeRequests((overtimeRes.data as OvertimeRequest[]) || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (type: 'leave' | 'overtime', id: string, approved: boolean) => {
    try {
      const table = type === 'leave' ? 'leave_requests' : 'overtime_requests';
      await supabase.from(table).update({
        status: approved ? 'approved' : 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      }).eq('id', id);

      toast({ title: 'Berhasil', description: `Pengajuan ${approved ? 'disetujui' : 'ditolak'}` });
      fetchRequests();
    } catch (error) {
      toast({ title: 'Error', description: 'Gagal memproses', variant: 'destructive' });
    }
  };

  if (role !== 'admin_hr' && role !== 'manager') {
    return <DashboardLayout><div className="text-center py-12 text-muted-foreground">Tidak ada akses</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Persetujuan</h1>
        
        <Tabs defaultValue="leave">
          <TabsList>
            <TabsTrigger value="leave">Cuti ({leaveRequests.length})</TabsTrigger>
            <TabsTrigger value="overtime">Lembur ({overtimeRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="leave">
            <Card>
              <CardContent className="p-0">
                {loading ? <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div> :
                leaveRequests.length === 0 ? <div className="py-12 text-center text-muted-foreground">Tidak ada pengajuan</div> :
                <Table>
                  <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Durasi</TableHead><TableHead>Alasan</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {leaveRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{format(new Date(r.start_date), 'd MMM', { locale: id })} - {format(new Date(r.end_date), 'd MMM', { locale: id })}</TableCell>
                        <TableCell>{r.total_days} hari</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.reason}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApproval('leave', r.id, true)}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="destructive" onClick={() => handleApproval('leave', r.id, false)}><X className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="overtime">
            <Card>
              <CardContent className="p-0">
                {loading ? <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div> :
                overtimeRequests.length === 0 ? <div className="py-12 text-center text-muted-foreground">Tidak ada pengajuan</div> :
                <Table>
                  <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Waktu</TableHead><TableHead>Alasan</TableHead><TableHead>Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {overtimeRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{format(new Date(r.date), 'd MMM yyyy', { locale: id })}</TableCell>
                        <TableCell>{r.start_time?.slice(0,5)} - {r.end_time?.slice(0,5)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.reason}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApproval('overtime', r.id, true)}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="destructive" onClick={() => handleApproval('overtime', r.id, false)}><X className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

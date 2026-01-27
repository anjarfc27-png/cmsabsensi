
import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, ShieldAlert, FileText, Calendar, Filter, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Placeholder type until we have a real table
interface AuditLog {
    id: string;
    created_at: string;
    user_id: string;
    action: string;
    table_name: string;
    record_id: string;
    old_data: any;
    new_data: any;
    profiles: {
        full_name: string;
        email: string;
    };
}

export default function AuditLogs() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            // Note: asking Supabase for a table that might not exist yet.
            // If it fails, we fall back to empty state.
            const { data, error } = await supabase
                .from('audit_logs')
                .select(`
                    *,
                    profiles:user_id (
                        full_name,
                        email
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setLogs(data || []);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.table_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isMobile = useIsMobile();

    return (
        <DashboardLayout>
            <div className={`max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8 min-h-screen pb-24 ${isMobile ? 'pt-[calc(1rem+env(safe-area-inset-top))]' : 'pt-8'}`}>

                {/* Header Section */}
                <div className="flex flex-col gap-4 mb-6">
                    {/* Title Row with Back Button for Mobile */}
                    <div className="flex items-center gap-3">
                        {isMobile && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="-ml-3 h-10 w-10 text-slate-500 hover:text-slate-900"
                            >
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                        )}
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Audit Logs</h1>
                            <p className="text-slate-500 font-medium text-xs md:text-sm">Monitor perubahan data dan aktivitas.</p>
                        </div>
                    </div>

                    {/* Filter Row */}
                    <div className="flex gap-2 w-full">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari log..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white h-10 rounded-xl border-slate-200"
                            />
                        </div>
                        <Button variant="outline" onClick={fetchLogs} className="h-10 rounded-xl px-3 shrink-0">
                            <Filter className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Filter</span>
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Summary Cards - Optimized for Mobile */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                        <Card className="bg-slate-900 text-white border-none shadow-md col-span-2 md:col-span-1 rounded-2xl">
                            <CardHeader className="pb-2 p-4 md:p-6">
                                <CardTitle className="text-xs md:text-sm font-medium text-slate-400">Total Aktivitas</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-6 pt-0">
                                <div className="text-2xl md:text-3xl font-black">{logs.length}</div>
                                <p className="text-[10px] text-slate-500 mt-1">7 Hari Terakhir</p>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-100 shadow-sm rounded-2xl">
                            <CardHeader className="pb-2 p-4 md:p-6">
                                <CardTitle className="text-xs md:text-sm font-medium text-slate-500">Perubahan Kritis</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-6 pt-0">
                                <div className="text-2xl md:text-3xl font-black text-red-600">0</div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-100 shadow-sm rounded-2xl">
                            <CardHeader className="pb-2 p-4 md:p-6">
                                <CardTitle className="text-xs md:text-sm font-medium text-slate-500">User Aktif</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-6 pt-0">
                                <div className="text-2xl md:text-3xl font-black text-blue-600">-</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-none shadow-none md:shadow-lg bg-transparent md:bg-white overflow-hidden">
                        <CardHeader className="px-0 md:px-6">
                            <CardTitle>Riwayat Aktivitas</CardTitle>
                            <CardDescription>Menampilkan 50 aktivitas terakhir di sistem.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 md:p-6">
                            {isMobile ? (
                                // MOBILE LIST VIEW
                                <div className="space-y-3">
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-100">
                                            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                                            <p className="text-xs font-bold text-slate-400">Memuat data...</p>
                                        </div>
                                    ) : filteredLogs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-dashed border-slate-200 text-center">
                                            <ShieldAlert className="h-10 w-10 text-slate-300 mb-2" />
                                            <p className="text-sm font-bold text-slate-500">Tidak ada audit log</p>
                                        </div>
                                    ) : (
                                        filteredLogs.map((log) => (
                                            <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-10 w-10 border border-slate-100">
                                                            <AvatarFallback className="bg-blue-50 text-blue-600 font-bold text-xs">
                                                                {log.profiles?.full_name?.substring(0, 2).toUpperCase() || 'SY'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-800">{log.profiles?.full_name || 'System'}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">{format(new Date(log.created_at), 'dd MMM yyyy, HH:mm')}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className={cn(
                                                        "uppercase text-[10px] font-bold border-none px-2 py-0.5",
                                                        log.action === 'DELETE' ? "bg-red-50 text-red-600" :
                                                            log.action === 'UPDATE' ? "bg-amber-50 text-amber-600" :
                                                                "bg-blue-50 text-blue-600"
                                                    )}>
                                                        {log.action}
                                                    </Badge>
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <FileText className="h-3 w-3 text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{log.table_name}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-600 font-mono line-clamp-2 leading-relaxed">
                                                        {JSON.stringify(log.new_data)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                // DESKTOP TABLE VIEW
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Waktu</TableHead>
                                                <TableHead>Actor</TableHead>
                                                <TableHead>Action</TableHead>
                                                <TableHead>Target</TableHead>
                                                <TableHead>Detail</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                                            <span className="text-slate-500">Memuat data log...</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : filteredLogs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-32 text-center">
                                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                                            <ShieldAlert className="h-10 w-10 mb-2 opacity-50" />
                                                            <p className="font-medium text-slate-900">Belum ada data audit</p>
                                                            <p className="text-sm">Sistem logging mungkin belum diaktifkan atau belum ada aktivitas tercatat.</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredLogs.map((log) => (
                                                    <TableRow key={log.id}>
                                                        <TableCell className="whitespace-nowrap font-mono text-xs">
                                                            {format(new Date(log.created_at), 'dd MMM HH:mm:ss')}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-sm">{log.profiles?.full_name || 'System'}</span>
                                                                <span className="text-xs text-slate-500">{log.profiles?.email}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="uppercase text-[10px] bg-slate-50">
                                                                {log.action}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs text-slate-600">
                                                            {log.table_name}
                                                        </TableCell>
                                                        <TableCell className="max-w-[200px] truncate text-xs text-slate-500">
                                                            {JSON.stringify(log.new_data)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
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

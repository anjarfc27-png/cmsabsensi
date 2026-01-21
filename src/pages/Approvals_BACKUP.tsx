import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    CheckCircle2,
    XCircle,
    FileText,
    MessageSquare,
    ChevronLeft,
    Loader2,
    AlertCircle,
    Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';

interface LeaveRequest {
    id: string;
    user_id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    attachment_url?: string;
    total_days?: number;
    status: string;
    rejection_reason?: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        position: string;
        avatar_url: string;
        departments: { name: string } | null;
    } | null;
}

interface OvertimeRequest {
    id: string;
    user_id: string;
    date: string;
    duration_minutes: number;
    hours?: number;
    reason: string;
    status: string;
    rejection_reason?: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        position: string;
        avatar_url: string;
        departments: { name: string } | null;
    } | null;
}

interface CorrectionRequest {
    id: string;
    user_id: string;
    date: string;
    original_clock_in: string;
    original_clock_out: string;
    corrected_clock_in: string;
    corrected_clock_out: string;
    reason: string;
    proof_url?: string;
    status: string;
    rejection_reason?: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        position: string;
        avatar_url: string;
        departments: { name: string } | null;
    } | null;
}

interface ReimbursementRequest {
    id: string;
    user_id: string;
    claim_date: string;
    type: string;
    amount: number;
    description: string;
    attachment_url?: string;
    status: string;
    rejection_reason?: string;
    created_at: string;
    profiles: {
        full_name: string;
        email: string;
        position: string;
        avatar_url: string;
        departments: { name: string } | null;
    } | null;
}

interface PendingAccount {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    nik_ktp?: string;
    position?: string;
    department_id?: string;
    job_position_id?: string;
    role: string;
    is_active: boolean;
    created_at: string;
    department?: { name: string } | null;
    job_position?: { title: string } | null;
}

type RequestType = 'leave' | 'overtime' | 'correction' | 'reimbursement' | 'account';

export default function ApprovalsPage() {
    const { user, role } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
    const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
    const [reimbursementRequests, setReimbursementRequests] = useState<ReimbursementRequest[]>([]);
    const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
    const [loading, setLoading] = useState(true);

    const [actionDialog, setActionDialog] = useState<{
        open: boolean;
        type: 'approve' | 'reject' | null;
        requestType: RequestType | null;
        requestId: string | null;
    }>({ open: false, type: null, requestType: null, requestId: null });

    const [attachmentDialog, setAttachmentDialog] = useState<{
        open: boolean;
        url: string | null;
    }>({ open: false, url: null });

    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const pendingCount =
        leaveRequests.filter(r => r.status === 'pending').length +
        overtimeRequests.filter(r => r.status === 'pending').length +
        correctionRequests.filter(r => r.status === 'pending').length +
        reimbursementRequests.filter(r => r.status === 'pending').length +
        pendingAccounts.filter(a => !a.is_active).length;

    useEffect(() => {
        if (user && (role === 'admin_hr' || role === 'manager')) {
            fetchRequests();
        }
    }, [user, role, activeTab]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const statusFilter = activeTab === 'pending' ? 'pending' : ['approved', 'rejected'];

            // Fetch leave requests
            const { data: leaveData, error: leaveError } = await supabase
                .from('leave_requests')
                .select('*, profiles:user_id(full_name, email, position, avatar_url, departments(name))')
                .in('status', Array.isArray(statusFilter) ? statusFilter : [statusFilter])
                .order('created_at', { ascending: false });

            if (leaveError) throw leaveError;

            // Fetch overtime requests
            const { data: overtimeData, error: overtimeError } = await supabase
                .from('overtime_requests')
                .select('*, profiles:user_id(full_name, email, position, avatar_url, departments(name))')
                .in('status', Array.isArray(statusFilter) ? statusFilter : [statusFilter])
                .order('created_at', { ascending: false });

            if (overtimeError) throw overtimeError;

            // Fetch correction requests
            const { data: correctionData, error: correctionError } = await supabase
                .from('attendance_corrections')
                .select('*, profiles:user_id(full_name, email, position, avatar_url, departments(name))')
                .in('status', Array.isArray(statusFilter) ? statusFilter : [statusFilter])
                .order('created_at', { ascending: false });

            if (correctionError) throw correctionError;

            // Fetch reimbursement requests
            const { data: reimbursementData, error: reimbursementError } = await supabase
                .from('reimbursements')
                .select('*, profiles:user_id(full_name, email, position, avatar_url, departments(name))')
                .in('status', Array.isArray(statusFilter) ? statusFilter : [statusFilter])
                .order('created_at', { ascending: false });

            if (reimbursementError) throw reimbursementError;

            // Fetch pending accounts
            const { data: accountsData, error: accountsError } = await supabase
                .from('profiles')
                .select('*, department:departments(name), job_position:job_positions(title)')
                .eq('is_active', activeTab === 'pending' ? false : true)
                .order('created_at', { ascending: false });

            if (accountsError) throw accountsError;

            setLeaveRequests((leaveData as unknown) as LeaveRequest[] || []);
            setOvertimeRequests((overtimeData as unknown) as OvertimeRequest[] || []);
            setCorrectionRequests((correctionData as unknown) as CorrectionRequest[] || []);
            setReimbursementRequests((reimbursementData as unknown) as ReimbursementRequest[] || []);
            setPendingAccounts((accountsData as unknown) as PendingAccount[] || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
            toast({
                title: 'Gagal Memuat Data',
                description: 'Terjadi kesalahan saat mengambil data permohonan.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (type: 'approve' | 'reject', requestType: RequestType, requestId: string) => {
        setActionDialog({ open: true, type, requestType, requestId });
        setRejectionReason('');
    };

    const confirmAction = async () => {
        if (!actionDialog.type || !actionDialog.requestType || !actionDialog.requestId) return;

        if (actionDialog.type === 'reject' && !rejectionReason.trim() && actionDialog.requestType !== 'account') {
            toast({
                title: 'Alasan Diperlukan',
                description: 'Mohon berikan alasan penolakan.',
                variant: 'destructive',
            });
            return;
        }

        setProcessing(true);
        try {
            let tableName = '';
            let notifType = '';
            let notifLink = '';
            let typeLabel = '';
            let request: any;

            if (actionDialog.requestType === 'account') {
                // Handle account activation differently
                tableName = 'profiles';
                request = pendingAccounts.find(a => a.id === actionDialog.requestId);

                if (actionDialog.type === 'approve') {
                    const { error } = await supabase
                        .from('profiles')
                        .update({ is_active: true })
                        .eq('id', actionDialog.requestId);

                    if (error) throw error;

                    toast({
                        title: 'Akun Diaktifkan!',
                        description: `Akun ${request?.full_name} telah diaktifkan.`,
                    });
                } else {
                    // Reject: delete the account
                    const { error } = await supabase
                        .from('profiles')
                        .delete()
                        .eq('id', actionDialog.requestId);

                    if (error) throw error;

                    toast({
                        title: 'Akun Ditolak',
                        description: `Akun ${request?.full_name} telah ditolak dan dihapus.`,
                    });
                }

                setActionDialog({ open: false, type: null, requestType: null, requestId: null });
                fetchRequests();
                setProcessing(false);
                return;
            }

            if (actionDialog.requestType === 'leave') {
                tableName = 'leave_requests';
                request = leaveRequests.find(r => r.id === actionDialog.requestId);
                notifType = 'leave_status';
                notifLink = '/leave';
                typeLabel = 'cuti';
            } else if (actionDialog.requestType === 'overtime') {
                tableName = 'overtime_requests';
                request = overtimeRequests.find(r => r.id === actionDialog.requestId);
                notifType = 'overtime_status';
                notifLink = '/overtime';
                typeLabel = 'lembur';
            } else if (actionDialog.requestType === 'correction') {
                tableName = 'attendance_corrections';
                request = correctionRequests.find(r => r.id === actionDialog.requestId);
                notifType = 'correction_status';
                notifLink = '/corrections';
                typeLabel = 'koreksi absensi';
            } else if (actionDialog.requestType === 'reimbursement') {
                tableName = 'reimbursements';
                request = reimbursementRequests.find(r => r.id === actionDialog.requestId);
                notifType = 'reimbursement_status';
                notifLink = '/reimbursement';
                typeLabel = 'reimbursement';
            }

            const newStatus = actionDialog.type === 'approve' ? 'approved' : 'rejected';

            const updateData: any = { status: newStatus };
            if (actionDialog.type === 'reject') {
                updateData.rejection_reason = rejectionReason.trim();
            }

            const { error } = await supabase
                .from(tableName)
                .update(updateData)
                .eq('id', actionDialog.requestId);

            if (error) throw error;

            // Send notification to user
            try {
                if (request) {
                    const title = actionDialog.type === 'approve' ? 'Permohonan Disetujui' : 'Permohonan Ditolak';
                    const message = actionDialog.type === 'approve'
                        ? `Permohonan ${typeLabel} Anda telah disetujui.`
                        : `Permohonan ${typeLabel} Anda ditolak. Alasan: ${rejectionReason}`;

                    await supabase.from('notifications').insert({
                        user_id: request.user_id,
                        title: title,
                        message: message,
                        type: notifType,
                        link: notifLink,
                        is_read: false
                    });
                }
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            toast({
                title: actionDialog.type === 'approve' ? 'Disetujui!' : 'Ditolak',
                description: `Permohonan telah ${actionDialog.type === 'approve' ? 'disetujui' : 'ditolak'}.`,
            });

            setActionDialog({ open: false, type: null, requestType: null, requestId: null });
            fetchRequests();
        } catch (error) {
            console.error('Error processing request:', error);
            toast({
                title: 'Gagal Memproses',
                description: 'Terjadi kesalahan saat memproses permohonan.',
                variant: 'destructive',
            });
        } finally {
            setProcessing(false);
        }
    };

    const isMobile = useIsMobile();
    const [selectedRequest, setSelectedRequest] = useState<any>(null);

    // Helpers (reused from RequestCard logic)
    const getTypeLabel = (type: string) => {
        if (type === 'leave') return 'Cuti';
        if (type === 'overtime') return 'Lembur';
        if (type === 'correction') return 'Koreksi';
        if (type === 'reimbursement') return 'Reimbursement';
        if (type === 'account') return 'Akun Baru';
        return type;
    };

    const getLeaveTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            annual: 'Tahunan',
            sick: 'Sakit',
            unpaid: 'Izin',
            maternity: 'Melahirkan',
            paternity: 'Ayah',
            marriage: 'Menikah',
            bereavement: 'Duka'
        };
        return types[type] || type;
    };

    // ----------------------------------------------------------------------
    // MOBILE VIEW (Preserved from original)
    // ----------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50">
                    {/* Background Gradient */}
                    {/* eslint-disable-next-line react/no-unknown-property */}
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8 max-w-6xl mx-auto">
                        {/* Header with Back Button */}
                        <div className="flex items-start gap-3 text-white">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold tracking-tight drop-shadow-md">Persetujuan</h1>
                                <p className="text-xs text-blue-50 font-medium opacity-90 mt-0.5">
                                    Review & kelola permohonan karyawan
                                </p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 backdrop-blur-md p-1 rounded-2xl mb-6 border border-white/20">
                                <TabsTrigger
                                    value="pending"
                                    className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold text-slate-600 rounded-xl relative transition-all"
                                >
                                    Menunggu
                                    {pendingCount > 0 && (
                                        <Badge className="ml-2 bg-red-500 text-white h-5 min-w-[20px] px-1.5 flex items-center justify-center">
                                            {pendingCount}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm font-bold text-slate-600 rounded-xl transition-all"
                                >
                                    Riwayat
                                </TabsTrigger>
                            </TabsList>

                            {/* Pending Requests */}
                            <TabsContent value="pending" className="space-y-4">
                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                    </div>
                                ) : (
                                    <>
                                        {leaveRequests.filter(r => r.status === 'pending').length === 0 &&
                                            overtimeRequests.filter(r => r.status === 'pending').length === 0 &&
                                            correctionRequests.filter(r => r.status === 'pending').length === 0 &&
                                            reimbursementRequests.filter(r => r.status === 'pending').length === 0 ? (
                                            <Card className="border-none shadow-md">
                                                <CardContent className="py-12 text-center">
                                                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                                                    <h3 className="font-bold text-slate-900 mb-2">Semua Beres!</h3>
                                                    <p className="text-slate-500">Tidak ada permohonan yang menunggu persetujuan.</p>
                                                </CardContent>
                                            </Card>
                                        ) : (
                                            <div className="space-y-4">
                                                {/* Account Approvals First */}
                                                {pendingAccounts
                                                    .filter(a => !a.is_active)
                                                    .map(account => (
                                                        <Card key={account.id} className="border shadow-sm overflow-hidden transition-all bg-white hover:shadow-md">
                                                            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg">
                                                                            {account.full_name?.charAt(0).toUpperCase() || '?'}
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="font-bold text-slate-900">{account.full_name}</h4>
                                                                            <p className="text-xs text-slate-500">{account.email}</p>
                                                                            <Badge className="mt-1 bg-purple-100 text-purple-700 border-none text-[10px]">
                                                                                Akun Baru
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                                    <div>
                                                                        <p className="text-slate-400 font-medium">Departemen</p>
                                                                        <p className="text-slate-700 font-semibold">{account.department?.name || '-'}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-slate-400 font-medium">Jabatan</p>
                                                                        <p className="text-slate-700 font-semibold">{account.job_position?.title || account.position || '-'}</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2 mt-4">
                                                                    <Button
                                                                        onClick={() => handleAction('reject', 'account', account.id)}
                                                                        variant="outline"
                                                                        className="flex-1 h-9 border-red-200 text-red-600 hover:bg-red-50 rounded-xl"
                                                                    >
                                                                        Tolak
                                                                    </Button>
                                                                    <Button
                                                                        onClick={() => handleAction('approve', 'account', account.id)}
                                                                        className="flex-1 h-9 bg-purple-600 hover:bg-purple-700 text-white rounded-xl"
                                                                    >
                                                                        Aktifkan Akun
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    ))}

                                                {leaveRequests
                                                    .filter(r => r.status === 'pending')
                                                    .map(req => (
                                                        <RequestCard
                                                            key={req.id}
                                                            type="leave"
                                                            request={req}
                                                            onApprove={() => handleAction('approve', 'leave', req.id)}
                                                            onReject={() => handleAction('reject', 'leave', req.id)}
                                                            onViewAttachment={(url) => setAttachmentDialog({ open: true, url })}
                                                        />
                                                    ))}

                                                {overtimeRequests
                                                    .filter(r => r.status === 'pending')
                                                    .map(req => (
                                                        <RequestCard
                                                            key={req.id}
                                                            type="overtime"
                                                            request={req}
                                                            onApprove={() => handleAction('approve', 'overtime', req.id)}
                                                            onReject={() => handleAction('reject', 'overtime', req.id)}
                                                            onViewAttachment={(url) => setAttachmentDialog({ open: true, url })}
                                                        />
                                                    ))}

                                                {correctionRequests
                                                    .filter(r => r.status === 'pending')
                                                    .map(req => (
                                                        <RequestCard
                                                            key={req.id}
                                                            type="correction"
                                                            request={req}
                                                            onApprove={() => handleAction('approve', 'correction', req.id)}
                                                            onReject={() => handleAction('reject', 'correction', req.id)}
                                                            onViewAttachment={req.proof_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined}
                                                        />
                                                    ))}

                                                {reimbursementRequests
                                                    .filter(r => r.status === 'pending')
                                                    .map(req => (
                                                        <RequestCard
                                                            key={req.id}
                                                            type="reimbursement"
                                                            request={req}
                                                            onApprove={() => handleAction('approve', 'reimbursement', req.id)}
                                                            onReject={() => handleAction('reject', 'reimbursement', req.id)}
                                                            onViewAttachment={req.attachment_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined}
                                                        />
                                                    ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </TabsContent>

                            {/* History */}
                            <TabsContent value="history" className="space-y-4">
                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {leaveRequests
                                            .filter(r => r.status !== 'pending')
                                            .map(req => (
                                                <RequestCard
                                                    key={req.id}
                                                    type="leave"
                                                    request={req}
                                                    historyMode
                                                    onViewAttachment={(url) => setAttachmentDialog({ open: true, url })}
                                                />
                                            ))}

                                        {overtimeRequests
                                            .filter(r => r.status !== 'pending')
                                            .map(req => (
                                                <RequestCard
                                                    key={req.id}
                                                    type="overtime"
                                                    request={req}
                                                    historyMode
                                                    onViewAttachment={(url) => setAttachmentDialog({ open: true, url })}
                                                />
                                            ))}

                                        {correctionRequests
                                            .filter(r => r.status !== 'pending')
                                            .map(req => (
                                                <RequestCard
                                                    key={req.id}
                                                    type="correction"
                                                    request={req}
                                                    historyMode
                                                    onViewAttachment={req.proof_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined}
                                                />
                                            ))}

                                        {reimbursementRequests
                                            .filter(r => r.status !== 'pending')
                                            .map(req => (
                                                <RequestCard
                                                    key={req.id}
                                                    type="reimbursement"
                                                    request={req}
                                                    historyMode
                                                    onViewAttachment={req.attachment_url ? (url) => setAttachmentDialog({ open: true, url }) : undefined}
                                                />
                                            ))}

                                        {/* Activated Accounts */}
                                        {pendingAccounts
                                            .filter(a => a.is_active)
                                            .map(account => (
                                                <Card key={account.id} className="border shadow-sm overflow-hidden bg-white">
                                                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg">
                                                                    {account.full_name?.charAt(0).toUpperCase() || '?'}
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-bold text-slate-900">{account.full_name}</h4>
                                                                    <p className="text-xs text-slate-500">{account.email}</p>
                                                                    <Badge className="mt-1 bg-green-100 text-green-700 border-none text-[10px]">
                                                                        Akun Diaktifkan
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                                            <div>
                                                                <p className="text-slate-400 font-medium">Departemen</p>
                                                                <p className="text-slate-700 font-semibold">{account.department?.name || '-'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-slate-400 font-medium">Jabatan</p>
                                                                <p className="text-slate-700 font-semibold">{account.job_position?.title || account.position || '-'}</p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 text-xs text-slate-500">
                                                            Diaktifkan pada {format(new Date(account.created_at), 'd MMMM yyyy', { locale: id })}
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))}

                                        {leaveRequests.filter(r => r.status !== 'pending').length === 0 &&
                                            overtimeRequests.filter(r => r.status !== 'pending').length === 0 &&
                                            correctionRequests.filter(r => r.status !== 'pending').length === 0 &&
                                            reimbursementRequests.filter(r => r.status !== 'pending').length === 0 &&
                                            pendingAccounts.filter(a => a.is_active).length === 0 && (
                                                <Card className="border-none shadow-md">
                                                    <CardContent className="py-12 text-center">
                                                        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                                                        <p className="text-slate-500">Belum ada riwayat persetujuan.</p>
                                                    </CardContent>
                                                </Card>
                                            )}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Action Dialog (Used by both) */}
                    <Dialog
                        open={actionDialog.open}
                        onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, requestType: null, requestId: null })}
                    >
                        <DialogContent className="rounded-3xl">
                            <DialogHeader>
                                <DialogTitle>
                                    {actionDialog.type === 'approve' ? 'Setujui Permohonan?' : 'Tolak Permohonan?'}
                                </DialogTitle>
                                <DialogDescription>
                                    {actionDialog.type === 'approve'
                                        ? 'Permohonan akan disetujui dan karyawan akan mendapat notifikasi.'
                                        : 'Berikan alasan penolakan untuk karyawan.'}
                                </DialogDescription>
                            </DialogHeader>

                            {actionDialog.type === 'reject' && (
                                <div className="py-4">
                                    <Textarea
                                        placeholder="Tulis alasan penolakan di sini..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="min-h-[100px] rounded-xl"
                                    />
                                </div>
                            )}

                            <DialogFooter className="gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setActionDialog({ open: false, type: null, requestType: null, requestId: null })}
                                    disabled={processing}
                                    className="rounded-xl"
                                >
                                    Batal
                                </Button>
                                <Button
                                    onClick={confirmAction}
                                    disabled={processing}
                                    className={`rounded-xl ${actionDialog.type === 'approve'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    {processing ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : actionDialog.type === 'approve' ? (
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                    ) : (
                                        <XCircle className="mr-2 h-4 w-4" />
                                    )}
                                    {actionDialog.type === 'approve' ? 'Setujui' : 'Tolak'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Attachment Preview (Used by both) */}
                    <Dialog
                        open={attachmentDialog.open}
                        onOpenChange={(open) => !open && setAttachmentDialog({ open: false, url: null })}
                    >
                        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
                            {attachmentDialog.url && (
                                <div className="relative w-full max-h-[85vh] flex flex-col items-center justify-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute -top-12 right-0 text-white hover:bg-white/20 rounded-full h-10 w-10 z-50 transition-colors"
                                        onClick={() => setAttachmentDialog({ open: false, url: null })}
                                    >
                                        <XCircle className="h-8 w-8" />
                                    </Button>

                                    <div className="bg-black/80 backdrop-blur-sm rounded-xl overflow-hidden p-1 shadow-2xl relative">
                                        {attachmentDialog.url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                            <video
                                                src={attachmentDialog.url}
                                                controls
                                                className="max-w-full max-h-[80vh] rounded-lg"
                                                autoPlay
                                            />
                                        ) : (
                                            <img
                                                src={attachmentDialog.url}
                                                alt="Lampiran Bukti"
                                                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                                            />
                                        )}
                                    </div>

                                    <Button
                                        variant="outline"
                                        className="mt-4 bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-full"
                                        onClick={() => window.open(attachmentDialog.url || '', '_blank')}
                                    >
                                        <Eye className="mr-2 h-4 w-4" />
                                        Buka Ukuran Penuh
                                    </Button>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        );
    }

    // ----------------------------------------------------------------------
    // DESKTOP VIEW
    // ----------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-6 py-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
                {/* Desktop Header */}
                <div className="flex items-center justify-between mb-6 shrink-0">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Persetujuan & Request</h1>
                        <p className="text-slate-500 font-medium text-sm">Kelola permohonan cuti, lembur, dan reimbursement.</p>
                    </div>
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'history')} className="w-[300px]">
                        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl">
                            <TabsTrigger
                                value="pending"
                                className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-slate-600 font-bold rounded-lg"
                            >
                                Menunggu
                                {pendingCount > 0 && <Badge className="ml-2 bg-red-500 text-white border-0">{pendingCount}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-slate-600 font-bold rounded-lg"
                            >
                                Riwayat
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>

                {/* Split View */}
                <div className="flex-1 flex gap-6 overflow-hidden">
                    {/* LEFT LIST (Scrollable) */}
                    <Card className="w-1/3 border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-sm rounded-[32px] overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                            {loading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="animate-spin text-slate-300" />
                                </div>
                            ) : (
                                <>
                                    <DesktopRequestList
                                        title="AKUN BARU"
                                        requests={pendingAccounts.filter(a => activeTab === 'pending' ? !a.is_active : a.is_active).map(a => ({ ...a, type: 'account' }))}
                                        selected={selectedRequest}
                                        onSelect={(r: any) => setSelectedRequest(r)}
                                        loading={loading}
                                        type="account"
                                        getLeaveTypeLabel={getLeaveTypeLabel}
                                        getTypeLabel={getTypeLabel}
                                    />
                                    <DesktopRequestList
                                        title="CUTI / IZIN"
                                        requests={leaveRequests.filter(r => activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending').map(r => ({ ...r, type: 'leave' }))}
                                        selected={selectedRequest}
                                        onSelect={(r: any) => setSelectedRequest(r)}
                                        loading={loading}
                                        type="leave"
                                        getLeaveTypeLabel={getLeaveTypeLabel}
                                        getTypeLabel={getTypeLabel}
                                    />
                                    <DesktopRequestList
                                        title="LEMBUR"
                                        requests={overtimeRequests.filter(r => activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending').map(r => ({ ...r, type: 'overtime' }))}
                                        selected={selectedRequest}
                                        onSelect={setSelectedRequest}
                                        loading={loading}
                                        type="overtime"
                                        getLeaveTypeLabel={getLeaveTypeLabel}
                                        getTypeLabel={getTypeLabel}
                                    />
                                    <DesktopRequestList
                                        title="KOREKSI ABSEN"
                                        requests={correctionRequests.filter(r => activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending').map(r => ({ ...r, type: 'correction' }))}
                                        selected={selectedRequest}
                                        onSelect={setSelectedRequest}
                                        loading={loading}
                                        type="correction"
                                        getLeaveTypeLabel={getLeaveTypeLabel}
                                        getTypeLabel={getTypeLabel}
                                    />
                                    <DesktopRequestList
                                        title="REIMBURSEMENT"
                                        requests={reimbursementRequests.filter(r => activeTab === 'pending' ? r.status === 'pending' : r.status !== 'pending').map(r => ({ ...r, type: 'reimbursement' }))}
                                        selected={selectedRequest}
                                        onSelect={setSelectedRequest}
                                        loading={loading}
                                        type="reimbursement"
                                        getLeaveTypeLabel={getLeaveTypeLabel}
                                        getTypeLabel={getTypeLabel}
                                    />
                                </>
                            )}
                        </div>
                    </Card>

                    {/* RIGHT DETAIL (Stick) */}
                    <Card className="flex-1 border-none shadow-xl shadow-slate-200/50 bg-white rounded-[32px] overflow-hidden flex flex-col relative">
                        {selectedRequest ? (
                            <div className="flex flex-col h-full">
                                {/* Detail Header */}
                                <div className="p-8 border-b border-slate-50 flex justify-between items-start bg-slate-50/30">
                                    <div className="flex items-center gap-5">
                                        <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                                            <AvatarImage src={selectedRequest.type === 'account' ? selectedRequest.avatar_url : selectedRequest.profiles?.avatar_url} />
                                            <AvatarFallback className={`text-2xl ${selectedRequest.type === 'account' ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-600 to-cyan-500'} text-white font-black`}>
                                                {selectedRequest.type === 'account'
                                                    ? selectedRequest.full_name?.substring(0, 2).toUpperCase()
                                                    : selectedRequest.profiles?.full_name?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-800">
                                                {selectedRequest.type === 'account' ? selectedRequest.full_name : selectedRequest.profiles?.full_name}
                                            </h2>
                                            <p className="text-slate-500 font-medium">
                                                {selectedRequest.type === 'account'
                                                    ? `${selectedRequest.job_position?.title || selectedRequest.position || '-'} • ${selectedRequest.department?.name || '-'}`
                                                    : `${selectedRequest.profiles?.position} • ${selectedRequest.profiles?.departments?.name}`}
                                            </p>
                                            <div className="flex gap-2 mt-2">
                                                <Badge className={`${selectedRequest.type === 'account' ? 'bg-purple-600' : 'bg-slate-900'} text-white border-0 px-3 py-1`}>
                                                    {selectedRequest.type === 'account' ? 'Akun Baru' : selectedRequest.type === 'leave' ? getLeaveTypeLabel(selectedRequest.leave_type) : getTypeLabel(selectedRequest.type)}
                                                </Badge>
                                                <Badge variant="outline" className="bg-white">
                                                    {format(new Date(selectedRequest.created_at), 'd MMMM yyyy', { locale: id })}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    {selectedRequest.type === 'account'
                                        ? (selectedRequest.is_active && (
                                            <Badge className="text-sm px-4 py-1.5 bg-green-100 text-green-700">
                                                AKTIF
                                            </Badge>
                                        ))
                                        : (selectedRequest.status !== 'pending' && (
                                            <Badge className={`text-sm px-4 py-1.5 ${selectedRequest.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {selectedRequest.status === 'approved' ? 'DISETUJUI' : 'DITOLAK'}
                                            </Badge>
                                        ))}
                                </div>

                                {/* Detail Content */}
                                <div className="flex-1 p-8 overflow-y-auto">
                                    {selectedRequest.type === 'account' ? (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Email</h4>
                                                    <p className="text-lg font-bold text-slate-800">{selectedRequest.email}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">No. Telepon</h4>
                                                    <p className="text-lg font-bold text-slate-800">{selectedRequest.phone || '-'}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">NIK KTP</h4>
                                                    <p className="text-lg font-bold text-slate-800 font-mono">{selectedRequest.nik_ktp || '-'}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Role</h4>
                                                    <Badge className="bg-purple-100 text-purple-700 border-none">
                                                        {selectedRequest.role?.replace('_', ' ').toUpperCase()}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Departemen</h4>
                                                    <p className="text-lg font-bold text-slate-800">{selectedRequest.department?.name || '-'}</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Jabatan</h4>
                                                    <p className="text-lg font-bold text-slate-800">{selectedRequest.job_position?.title || selectedRequest.position || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6">
                                                <h4 className="text-sm font-black text-purple-900 mb-2">Informasi Pendaftaran</h4>
                                                <p className="text-sm text-purple-700">
                                                    Akun ini didaftarkan pada {format(new Date(selectedRequest.created_at), 'd MMMM yyyy, HH:mm', { locale: id })} WIB.
                                                    Setelah diaktifkan, pengguna dapat login dan mengakses sistem.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-8 mb-8">
                                            <div className="space-y-4">
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Tanggal Request</h4>
                                                    <p className="text-lg font-bold text-slate-800">
                                                        {selectedRequest.type === 'leave'
                                                            ? `${format(new Date(selectedRequest.start_date), 'd MMM yyyy', { locale: id })} - ${format(new Date(selectedRequest.end_date), 'd MMM yyyy', { locale: id })}`
                                                            : selectedRequest.type === 'reimbursement'
                                                                ? format(new Date(selectedRequest.claim_date), 'd MMMM yyyy', { locale: id })
                                                                : format(new Date(selectedRequest.date), 'd MMMM yyyy', { locale: id })
                                                        }
                                                    </p>
                                                    {selectedRequest.type === 'leave' && (
                                                        <p className="text-sm text-slate-500 font-medium">Total: {selectedRequest.total_days} Hari</p>
                                                    )}
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Keterangan</h4>
                                                    <p className="text-slate-700 leading-relaxed font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                        "{selectedRequest.reason || selectedRequest.description}"
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Logic for Attachment */}
                                                {(selectedRequest.attachment_url || selectedRequest.proof_url) ? (
                                                    <div
                                                        onClick={() => setAttachmentDialog({ open: true, url: selectedRequest.attachment_url || selectedRequest.proof_url })}
                                                        className="aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-300 transition-all group"
                                                    >
                                                        <FileText className="h-8 w-8 text-slate-400 group-hover:text-blue-500 mb-2" />
                                                        <p className="text-xs font-bold text-slate-500 group-hover:text-blue-600">Lihat Lampiran</p>
                                                    </div>
                                                ) : (
                                                    <div className="aspect-video bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center">
                                                        <p className="text-xs text-slate-400 font-medium italic">Tidak ada lampiran</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Footer for Desktop */}
                                    {(selectedRequest.type === 'account' ? !selectedRequest.is_active : selectedRequest.status === 'pending') && (
                                        <div className="flex gap-4 pt-8 border-t border-slate-100">
                                            <Button
                                                onClick={() => handleAction('reject', selectedRequest.type, selectedRequest.id)}
                                                className="flex-1 bg-white border-2 border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 h-14 text-base font-bold rounded-2xl shadow-none"
                                            >
                                                <XCircle className="mr-2 h-5 w-5" /> Tolak Permohonan
                                            </Button>
                                            <Button
                                                onClick={() => handleAction('approve', selectedRequest.type, selectedRequest.id)}
                                                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white h-14 text-base font-bold rounded-2xl shadow-xl shadow-blue-200"
                                            >
                                                <CheckCircle2 className="mr-2 h-5 w-5" /> Setujui Permohonan
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-4">
                                <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center">
                                    <FileText className="h-10 w-10 text-slate-200" />
                                </div>
                                <p className="font-bold text-slate-400">Pilih permohonan untuk melihat detail</p>
                            </div>
                        )}
                    </Card>
                </div>

                {/* Action Dialog (Reused) */}
                <Dialog
                    open={actionDialog.open}
                    onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, requestType: null, requestId: null })}
                >
                    <DialogContent className="rounded-3xl">
                        <DialogHeader>
                            <DialogTitle>
                                {actionDialog.type === 'approve' ? 'Setujui Permohonan?' : 'Tolak Permohonan?'}
                            </DialogTitle>
                            <DialogDescription>
                                {actionDialog.type === 'approve'
                                    ? 'Permohonan akan disetujui dan karyawan akan mendapat notifikasi.'
                                    : 'Berikan alasan penolakan untuk karyawan.'}
                            </DialogDescription>
                        </DialogHeader>

                        {actionDialog.type === 'reject' && (
                            <div className="py-4">
                                <Textarea
                                    placeholder="Tulis alasan penolakan di sini..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="min-h-[100px] rounded-xl"
                                />
                            </div>
                        )}

                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setActionDialog({ open: false, type: null, requestType: null, requestId: null })}
                                disabled={processing}
                                className="rounded-xl"
                            >
                                Batal
                            </Button>
                            <Button
                                onClick={confirmAction}
                                disabled={processing}
                                className={`rounded-xl ${actionDialog.type === 'approve'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : 'bg-red-600 hover:bg-red-700'
                                    }`}
                            >
                                {processing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : actionDialog.type === 'approve' ? (
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                ) : (
                                    <XCircle className="mr-2 h-4 w-4" />
                                )}
                                {actionDialog.type === 'approve' ? 'Setujui' : 'Tolak'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Attachment Preview (Reused) */}
                <Dialog
                    open={attachmentDialog.open}
                    onOpenChange={(open) => !open && setAttachmentDialog({ open: false, url: null })}
                >
                    <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
                        {attachmentDialog.url && (
                            <div className="relative w-full max-h-[85vh] flex flex-col items-center justify-center">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute -top-12 right-0 text-white hover:bg-white/20 rounded-full h-10 w-10 z-50 transition-colors"
                                    onClick={() => setAttachmentDialog({ open: false, url: null })}
                                >
                                    <XCircle className="h-8 w-8" />
                                </Button>

                                <div className="bg-black/80 backdrop-blur-sm rounded-xl overflow-hidden p-1 shadow-2xl relative">
                                    {attachmentDialog.url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                        <video
                                            src={attachmentDialog.url}
                                            controls
                                            className="max-w-full max-h-[80vh] rounded-lg"
                                            autoPlay
                                        />
                                    ) : (
                                        <img
                                            src={attachmentDialog.url}
                                            alt="Lampiran Bukti"
                                            className="max-w-full max-h-[80vh] object-contain rounded-lg"
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div >
        </DashboardLayout >
    );

}

// Request Card Component
function RequestCard({
    type,
    request,
    onApprove,
    onReject,
    onViewAttachment,
    historyMode = false,
}: {
    type: 'leave' | 'overtime' | 'correction' | 'reimbursement';
    request: any;
    onApprove?: () => void;
    onReject?: () => void;
    onViewAttachment?: (url: string) => void;
    historyMode?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const getTypeLabel = () => {
        if (type === 'leave') return 'Cuti';
        if (type === 'overtime') return 'Lembur';
        if (type === 'correction') return 'Koreksi';
        if (type === 'reimbursement') return 'Reimbursement';
        return type;
    };

    const getLeaveTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            annual: 'Tahunan',
            sick: 'Sakit',
            unpaid: 'Izin',
            maternity: 'Melahirkan',
            paternity: 'Ayah',
            marriage: 'Menikah',
            bereavement: 'Duka'
        };
        return types[type] || type;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-2 h-5">Disetujui</Badge>;
            case 'rejected':
                return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-2 h-5">Ditolak</Badge>;
            default:
                return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px] px-2 h-5">Menunggu</Badge>;
        }
    };

    return (
        <Card className="border shadow-sm overflow-hidden transition-all bg-white hover:shadow-md">
            <div
                className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <Avatar className="h-9 w-9 border border-slate-200">
                        <AvatarImage src={request.profiles?.avatar_url} />
                        <AvatarFallback className="bg-blue-50 text-blue-600 text-xs font-bold">
                            {request.profiles?.full_name?.substring(0, 2).toUpperCase() || 'UN'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-semibold text-sm text-slate-900 truncate">
                                {request.profiles?.full_name || 'Tanpa Nama'}
                            </h4>
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal text-slate-600 hidden sm:inline-flex bg-slate-100">
                                {request.profiles?.departments?.name || 'Umum'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="truncate font-medium text-slate-700">
                                {type === 'leave' ? getLeaveTypeLabel(request.leave_type) : getTypeLabel()}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="truncate">
                                {type === 'leave'
                                    ? format(new Date(request.start_date), 'd MMM', { locale: id })
                                    : type === 'reimbursement'
                                        ? format(new Date(request.claim_date), 'd MMM', { locale: id })
                                        : format(new Date(request.date), 'd MMM', { locale: id })
                                }
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    {getStatusBadge(request.status)}
                    <div className={`p-1 rounded-full transition-colors ${isOpen ? 'bg-slate-100' : ''}`}>
                        <ChevronLeft className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? '-rotate-90' : 'rotate-180'}`} />
                    </div>
                </div>
            </div>

            {/* Accordion Content */}
            {isOpen && (
                <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2">
                    <div className="border-t border-slate-100 pt-3 mt-1 space-y-3">

                        {/* Detail Info Grid */}
                        <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Departemen</p>
                                <p className="text-xs text-slate-700 font-medium">{request.profiles?.departments?.name || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Posisi</p>
                                <p className="text-xs text-slate-700 font-medium">{request.profiles?.position || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Diajukan Pada</p>
                                <p className="text-xs text-slate-700 font-medium">{format(new Date(request.created_at), 'd MMM yyy, HH:mm', { locale: id })}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Info Tambahan</p>
                                <p className="text-xs text-slate-700 font-medium">
                                    {type === 'leave'
                                        ? `${request.total_days || 1} Hari`
                                        : type === 'overtime'
                                            ? request.duration_minutes ? `${Math.floor(request.duration_minutes / 60)}j ${request.duration_minutes % 60}m` : `${request.hours || 0} Jam`
                                            : type === 'reimbursement'
                                                ? `Rp ${(request.amount || 0).toLocaleString('id-ID')}`
                                                : type === 'correction'
                                                    ? `${request.corrected_clock_in ? format(new Date(request.corrected_clock_in), 'HH:mm') : '-'} s/d ${request.corrected_clock_out ? format(new Date(request.corrected_clock_out), 'HH:mm') : '-'}`
                                                    : '-'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Reason Box */}
                        <div>
                            <p className="text-[11px] text-slate-500 font-medium mb-1.5 ml-1">Alasan Pengajuan:</p>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm text-slate-700 italic relative">
                                <MessageSquare className="absolute top-3 left-3 h-3 w-3 text-slate-300" />
                                <span className="pl-5 block">"{request.reason}"</span>
                            </div>
                        </div>

                        {/* Common Logic for Attachment URL */}
                        {(request.attachment_url || request.proof_url) && (
                            <div>
                                <p className="text-[11px] text-slate-500 font-medium mb-1.5 ml-1">Lampiran Bukti:</p>
                                <div
                                    onClick={() => onViewAttachment?.(request.attachment_url || request.proof_url)}
                                    className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors group cursor-pointer"
                                >
                                    <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-white text-blue-600 transition-colors">
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-semibold text-blue-700">Lihat File Lampiran</p>
                                        <p className="text-[10px] text-blue-500">Klik untuk melihat preview</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Rejection Reason */}
                        {request.status === 'rejected' && request.rejection_reason && (
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex gap-3">
                                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                <div>
                                    <p className="text-xs font-bold text-red-700 mb-0.5">Ditolak Karena:</p>
                                    <p className="text-sm text-red-600">{request.rejection_reason}</p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {!historyMode && request.status === 'pending' && (
                            <div className="flex gap-2 pt-2 border-t border-slate-100 mt-2">
                                <Button
                                    onClick={(e) => { e.stopPropagation(); onReject?.(); }}
                                    variant="outline"
                                    className="flex-1 h-9 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                >
                                    Tolak
                                </Button>
                                <Button
                                    onClick={(e) => { e.stopPropagation(); onApprove?.(); }}
                                    className="flex-1 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                                >
                                    Setujui
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}

// ----------------------------------------------------------------------
// NEW DESKTOP COMPONENTS
// ----------------------------------------------------------------------
function DesktopRequestList({
    loading,
    requests,
    selected,
    onSelect,
    title,
    type,
    getLeaveTypeLabel,
    getTypeLabel
}: any) {
    if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;

    if (requests.length === 0) return (
        <div className="p-8 text-center border-b border-slate-100 last:border-0">
            <p className="text-sm font-bold text-slate-400">Tidak ada permohonan {title}</p>
        </div>
    );

    return (
        <div className="space-y-1 p-2">
            <h3 className="px-4 py-2 text-xs font-black text-slate-400 uppercase tracking-widest">{title}</h3>
            {requests.map((req: any) => (
                <div
                    key={req.id}
                    onClick={() => onSelect(req, req.type)} // Pass req.type here
                    className={`group flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border ${selected?.id === req.id
                        ? 'bg-blue-50 border-blue-200 shadow-sm'
                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                        }`}
                >
                    <Avatar className={`h-10 w-10 border-2 ${selected?.id === req.id ? 'border-blue-200' : 'border-slate-100'}`}>
                        <AvatarImage src={req.profiles?.avatar_url} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white font-bold text-xs">
                            {req.profiles?.full_name?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-0.5">
                            <h4 className={`text-sm font-bold truncate ${selected?.id === req.id ? 'text-blue-700' : 'text-slate-700'}`}>
                                {req.profiles?.full_name}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                                {format(new Date(req.created_at), 'd MMM', { locale: id })}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mb-1">
                            {req.profiles?.position} • {req.profiles?.departments?.name}
                        </p>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`text-[10px] h-5 px-1.5 border ${req.type === 'leave' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                {req.type === 'leave' ? getLeaveTypeLabel(req.leave_type) : getTypeLabel(req.type)}
                            </Badge>
                            {req.status !== 'pending' && (
                                <Badge className={`text-[10px] h-5 px-1.5 border-0 ${req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {req.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                                </Badge>
                            )}
                        </div>
                    </div>


                    <ChevronLeft className={`h-4 w-4 text-slate-300 transition-transform ${selected?.id === req.id ? 'rotate-180 text-blue-400' : ''}`} />

                </div>
            ))}
        </div>
    );
}

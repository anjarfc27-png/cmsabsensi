
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
    Calendar as CalendarIcon,
    MapPin,
    Link as LinkIcon,
    Users,
    Plus,
    ChevronLeft,
    ChevronRight,
    Clock,
    MoreVertical,
    CheckCircle2,
    XCircle,
    HelpCircle,
    Video,
    Search,
    Edit,
    Trash2,
    Loader2
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, getDay, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Agenda, AgendaParticipant, Profile } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function AgendaPage() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [agendas, setAgendas] = useState<Agenda[]>([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState(new Date());

    // CRUD State
    const [createOpen, setCreateOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAgendaId, setCurrentAgendaId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    // Delete State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, title: string } | null>(null);

    const [employees, setEmployees] = useState<Profile[]>([]);
    const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
    const [form, setForm] = useState({
        title: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '10:00',
        location: '',
        meetingLink: ''
    });

    const [employeeSearch, setEmployeeSearch] = useState('');

    const canManage = ['admin_hr', 'manager'].includes(profile?.role || '');

    const filteredEmployees = useMemo(() => {
        if (!employeeSearch) return employees;
        return employees.filter(e =>
            e.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
            e.email?.toLowerCase().includes(employeeSearch.toLowerCase())
        );
    }, [employees, employeeSearch]);

    const groupedEmployees = useMemo(() => {
        const groups: Record<string, Profile[]> = {};
        filteredEmployees.forEach(emp => {
            const deptName = (emp as any).job_position?.department?.name || 'Umum';
            if (!groups[deptName]) groups[deptName] = [];
            groups[deptName].push(emp);
        });
        return groups;
    }, [filteredEmployees]);

    useEffect(() => {
        fetchAgendas();
    }, [selectedMonth]);

    useEffect(() => {
        if (createOpen && canManage) {
            fetchEmployees();
        }
    }, [createOpen, canManage]);

    const fetchAgendas = async () => {
        try {
            setLoading(true);
            // Fetch range: 1 week before start of month to 1 week after end of month
            // This ensures all visible calendar days are covered
            const startOfView = startOfWeek(startOfMonth(selectedMonth));
            const endOfView = endOfWeek(endOfMonth(selectedMonth));

            // Add buffer just in case
            const queryStart = format(subMonths(startOfView, 0), 'yyyy-MM-dd');
            const queryEnd = format(addMonths(endOfView, 0), 'yyyy-MM-dd');

            console.log('Fetching agendas range:', queryStart, 'to', queryEnd);

            const { data, error } = await supabase
                .from('agendas')
                .select(`
                  *,
                  participants:agenda_participants(*)
                `)
                .gte('start_time', `${queryStart}T00:00:00`)
                .lte('start_time', `${queryEnd}T23:59:59`);

            if (error) throw error;

            console.log('Fetched Agendas Total:', data?.length, data);
            setAgendas(data || []);
        } catch (error) {
            console.error('Fetch Error:', error);
            toast({ title: 'Gagal memuat agenda', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        const { data } = await supabase.from('profiles').select(`
            *,
            job_position:job_positions(
                title,
                department:departments(name)
            )
        `).eq('is_active', true).order('full_name');
        setEmployees(data || []);
    };

    const resetForm = () => {
        setForm({
            title: '',
            description: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            startTime: '09:00',
            endTime: '10:00',
            location: '',
            meetingLink: ''
        });
        setSelectedParticipants([]);
        setIsEditing(false);
        setCurrentAgendaId(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setCreateOpen(true);
    };

    const handleOpenEdit = (agenda: Agenda) => {
        const startDate = parseISO(agenda.start_time);
        const endDate = parseISO(agenda.end_time);

        setForm({
            title: agenda.title,
            description: agenda.description || '',
            date: format(startDate, 'yyyy-MM-dd'),
            startTime: format(startDate, 'HH:mm'),
            endTime: format(endDate, 'HH:mm'),
            location: agenda.location || '',
            meetingLink: agenda.meeting_link || ''
        });

        // Load participants
        const participants = agenda.participants?.map((p: any) => p.user_id) || [];
        setSelectedParticipants(participants);

        setIsEditing(true);
        setCurrentAgendaId(agenda.id);
        setCreateOpen(true);
    };

    const handleOpenDelete = (agenda: Agenda) => {
        setItemToDelete({ id: agenda.id, title: agenda.title });
        setDeleteOpen(true);
    };

    const handleSaveAgenda = async () => {
        if (!form.title || !form.date || !form.startTime || !form.endTime) {
            toast({ title: 'Mohon isi semua field wajib', variant: 'destructive' });
            return;
        }

        try {
            setCreating(true);
            const start = new Date(`${form.date}T${form.startTime}`).toISOString();
            const end = new Date(`${form.date}T${form.endTime}`).toISOString();

            let resultAgendaId = currentAgendaId;

            if (isEditing && currentAgendaId) {
                // Update existing agenda
                const { error } = await supabase
                    .from('agendas')
                    .update({
                        title: form.title,
                        description: form.description,
                        start_time: start,
                        end_time: end,
                        location: form.location,
                        meeting_link: form.meetingLink,
                    })
                    .eq('id', currentAgendaId);

                if (error) throw error;
            } else {
                // Create new agenda
                const { data, error } = await supabase
                    .from('agendas')
                    .insert({
                        title: form.title,
                        description: form.description,
                        start_time: start,
                        end_time: end,
                        location: form.location,
                        meeting_link: form.meetingLink,
                        created_by: user?.id
                    })
                    .select()
                    .single();

                if (error) throw error;
                resultAgendaId = data.id;
            }

            // Sync Participants (Delete all then insert new)
            // Note: This is a simple approach. For scaling, diffing is better.
            if (resultAgendaId) {
                // Remove existing
                if (isEditing) {
                    await supabase.from('agenda_participants').delete().eq('agenda_id', resultAgendaId);
                }

                // Insert selected
                if (selectedParticipants.length > 0) {
                    const participantData = selectedParticipants.map(uid => ({
                        agenda_id: resultAgendaId,
                        user_id: uid
                    }));
                    const { error: partError } = await supabase.from('agenda_participants').insert(participantData);
                    if (partError) throw partError;
                }
            }

            toast({ title: isEditing ? 'Agenda diperbarui' : 'Agenda berhasil dibuat' });
            setCreateOpen(false);
            resetForm();
            fetchAgendas();

        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Gagal menyimpan agenda',
                description: error.message || 'Terjadi kesalahan sistem',
                variant: 'destructive'
            });
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        try {
            const { error } = await supabase
                .from('agendas')
                .delete()
                .eq('id', itemToDelete.id);

            if (error) throw error;

            toast({ title: 'Agenda dihapus' });
            fetchAgendas();
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Gagal menghapus',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setDeleteOpen(false);
            setItemToDelete(null);
        }
    };

    const agendasForSelectedDay = agendas.filter(a => {
        const dateA = new Date(a.start_time);
        return dateA.toDateString() === selectedDay.toDateString();
    });

    return (
        <DashboardLayout>
            <div className="relative min-h-screen bg-slate-50/50">
                {/* Background Gradient */}
                <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[32px] z-0 shadow-lg" />

                <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8">
                    {/* Header Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-white">
                        <div className="flex items-start gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/dashboard')}
                                className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">Agenda Kerja</h1>
                                <p className="text-xs text-blue-50 font-medium opacity-90">Pantau jadwal rapat dan kegiatan tim Anda</p>
                            </div>
                        </div>

                        {canManage && (
                            <Button
                                onClick={handleOpenCreate}
                                className="bg-white hover:bg-white/90 text-blue-700 border-none shadow-lg font-bold transition-all active:scale-95 text-xs gap-2 rounded-xl"
                            >
                                <Plus className="h-4 w-4" />
                                Buat Agenda
                            </Button>
                        )}

                        {/* Dialog Create/Edit */}
                        <Dialog open={createOpen} onOpenChange={(open) => {
                            if (!open) resetForm();
                            setCreateOpen(open);
                        }}>
                            <DialogContent className="sm:max-w-[500px] rounded-3xl">
                                <DialogHeader>
                                    <DialogTitle>{isEditing ? 'Edit Agenda' : 'Buat Agenda Baru'}</DialogTitle>
                                    <DialogDescription>{isEditing ? 'Perbarui detail kegiatan.' : 'Tambahkan jadwal rapat atau kegiatan tim baru.'}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Judul Kegiatan *</Label>
                                        <Input placeholder="Misal: Rapat Koordinasi Mingguan" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="rounded-xl" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal *</Label>
                                            <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="rounded-xl" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Jam Mulai *</Label>
                                            <Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Jam Selesai *</Label>
                                            <Input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="rounded-xl" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Lokasi (Opsional)</Label>
                                            <Input placeholder="Misal: Ruang Rapat 1" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Link Meeting (Opsional)</Label>
                                        <Input placeholder="https://zoom.us/..." value={form.meetingLink} onChange={e => setForm({ ...form, meetingLink: e.target.value })} className="rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Deskripsi</Label>
                                        <Textarea placeholder="Detail kegiatan..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl min-h-[80px]" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Peserta</Label>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                {selectedParticipants.length} orang terpilih
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Cari nama karyawan..."
                                                value={employeeSearch}
                                                onChange={e => setEmployeeSearch(e.target.value)}
                                                className="pl-9 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-all"
                                            />
                                        </div>

                                        <div className="border rounded-2xl overflow-hidden bg-white border-slate-200 max-h-[200px] overflow-y-auto custom-scrollbar">
                                            {Object.keys(groupedEmployees).length === 0 ? (
                                                <div className="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                                                    <Users className="h-8 w-8 mb-2 opacity-50" />
                                                    <span className="text-xs">Tidak ada karyawan ditemukan</span>
                                                </div>
                                            ) : (
                                                Object.entries(groupedEmployees).map(([dept, emps]) => (
                                                    <div key={dept}>
                                                        <div className="bg-slate-50/80 backdrop-blur-sm px-3 py-2 border-y border-slate-100 flex items-center justify-between sticky top-0 z-10">
                                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                                {dept}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-5 text-[10px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                                                                onClick={() => {
                                                                    const ids = emps.map(e => e.id);
                                                                    const allSelected = ids.every(id => selectedParticipants.includes(id));
                                                                    if (allSelected) {
                                                                        setSelectedParticipants(prev => prev.filter(id => !ids.includes(id)));
                                                                    } else {
                                                                        setSelectedParticipants(prev => [...new Set([...prev, ...ids])]);
                                                                    }
                                                                }}
                                                            >
                                                                {emps.every(e => selectedParticipants.includes(e.id)) ? 'Batal' : 'Pilih Semua'}
                                                            </Button>
                                                        </div>
                                                        <div>
                                                            {emps.map(emp => (
                                                                <div
                                                                    key={emp.id}
                                                                    className={cn(
                                                                        "flex items-center gap-3 p-2.5 hover:bg-blue-50/50 transition-all border-b border-slate-50 last:border-0 cursor-pointer group",
                                                                        selectedParticipants.includes(emp.id) ? "bg-blue-50/30" : ""
                                                                    )}
                                                                    onClick={() => {
                                                                        if (selectedParticipants.includes(emp.id)) {
                                                                            setSelectedParticipants(prev => prev.filter(id => id !== emp.id));
                                                                        } else {
                                                                            setSelectedParticipants(prev => [...prev, emp.id]);
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className={cn(
                                                                        "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
                                                                        selectedParticipants.includes(emp.id) ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white group-hover:border-blue-400"
                                                                    )}>
                                                                        {selectedParticipants.includes(emp.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                                    </div>

                                                                    <Avatar className="h-8 w-8 border border-slate-100 shadow-sm">
                                                                        <AvatarImage src={emp.avatar_url || ''} />
                                                                        <AvatarFallback className="text-[10px] bg-sky-100 text-sky-700 font-bold">{emp.full_name[0]}</AvatarFallback>
                                                                    </Avatar>

                                                                    <div className="flex-1 overflow-hidden">
                                                                        <p className={cn("text-xs font-bold truncate transition-colors", selectedParticipants.includes(emp.id) ? "text-blue-700" : "text-slate-700")}>{emp.full_name}</p>
                                                                        <p className="text-[10px] text-slate-400 truncate">{(emp as any).job_position?.title || 'Staff'}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="gap-2 sm:gap-0">
                                    <Button variant="ghost" onClick={() => setCreateOpen(false)} className="rounded-xl font-bold">Batal</Button>
                                    <Button onClick={handleSaveAgenda} disabled={creating} className="rounded-xl bg-blue-600 hover:bg-blue-700 font-bold px-8 shadow-lg shadow-blue-500/20">
                                        {creating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Menyimpan...
                                            </>
                                        ) : (
                                            'Simpan Agenda'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 lg:col-span-12 gap-6">
                        {/* Calendar Side */}
                        <div className="lg:col-span-8">
                            <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden bg-white rounded-3xl">
                                <CardHeader className="flex flex-row items-center justify-between pb-4 bg-slate-50/50 border-b border-slate-100 px-6 h-16">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 p-2 rounded-xl">
                                            <CalendarIcon className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <CardTitle className="text-lg font-black text-slate-800 tracking-tight">
                                            {format(selectedMonth, 'MMMM yyyy', { locale: id })}
                                        </CardTitle>
                                    </div>
                                    <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))} className="h-8 w-8 rounded-lg hover:bg-slate-50 transition-all">
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(new Date())} className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-lg px-3">
                                            Bulan Ini
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} className="h-8 w-8 rounded-lg hover:bg-slate-50 transition-all">
                                            <ChevronRight className="h-4 w-4 rotate-180" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="grid grid-cols-7 mb-4">
                                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
                                            <div key={day} className="text-center py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                                {day}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-7 gap-2">
                                        {(() => {
                                            const monthStart = startOfMonth(selectedMonth);
                                            const monthEnd = endOfMonth(monthStart);
                                            const calendarStart = startOfWeek(monthStart);
                                            const calendarEnd = endOfWeek(monthEnd);
                                            const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

                                            return days.map((day, idx) => {
                                                const isCurrentMonth = isSameMonth(day, monthStart);
                                                const isSelected = isSameDay(day, selectedDay);
                                                const isToday = isSameDay(day, new Date());
                                                const dailyAgendas = agendas.filter(a => isSameDay(parseISO(a.start_time), day));

                                                return (
                                                    <div
                                                        key={idx}
                                                        onClick={() => isCurrentMonth && setSelectedDay(day)}
                                                        className={cn(
                                                            "aspect-square flex flex-col items-center justify-center rounded-[20px] border text-sm transition-all relative cursor-pointer group",
                                                            !isCurrentMonth ? "opacity-10 pointer-events-none" : "hover:bg-blue-50 hover:border-blue-100",
                                                            isSelected ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/30 scale-105 z-10" : "bg-transparent border-transparent text-slate-700",
                                                            isToday && !isSelected && "bg-white border-blue-200 text-blue-600 ring-4 ring-blue-50"
                                                        )}
                                                    >
                                                        <span className={cn("font-bold text-sm", isSelected ? "text-white" : "")}>
                                                            {format(day, 'd')}
                                                        </span>
                                                        {dailyAgendas.length > 0 && isCurrentMonth && (
                                                            <div className="mt-1 flex gap-0.5 justify-center">
                                                                {dailyAgendas.slice(0, 3).map((_, i) => (
                                                                    <div key={i} className={cn("w-1 h-1 rounded-full", isSelected ? "bg-white" : "bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.5)]")} />
                                                                ))}
                                                            </div>
                                                        )}
                                                        {isToday && !isSelected && (
                                                            <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* List Side */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-xl shadow-slate-200/40 sticky top-24">
                                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-50">
                                    <div>
                                        <h3 className="font-black text-slate-800 text-sm tracking-tight flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-blue-500" />
                                            {format(selectedDay, 'EEEE, d MMM', { locale: id })}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">Jadwal Agenda</p>
                                    </div>
                                    <Badge className="bg-blue-50 text-blue-600 border-none px-3 font-black text-xs h-7 rounded-lg">
                                        {agendasForSelectedDay.length}
                                    </Badge>
                                </div>

                                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {agendasForSelectedDay.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <div className="bg-slate-50 p-4 rounded-3xl mb-4 group-hover:scale-110 transition-transform">
                                                <HelpCircle className="h-10 w-10 text-slate-300" />
                                            </div>
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tidak ada agenda</p>
                                            <p className="text-[10px] text-slate-300 mt-1">Silakan pilih tanggal lain atau buat agenda baru</p>
                                        </div>
                                    ) : (
                                        agendasForSelectedDay.map((agenda) => (
                                            <div key={agenda.id} className="group px-3 py-2.5 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-md transition-all duration-300 relative overflow-hidden">
                                                {/* Left Accent Bar */}
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-md" />

                                                <div className="pl-2.5 flex flex-col gap-1.5 relative z-10 text-left">
                                                    {/* Row 1: Title & Time & Menu */}
                                                    <div className="flex justify-between items-start gap-2">
                                                        <h4 className="font-bold text-slate-800 text-sm leading-tight line-clamp-1 flex-1 pt-0.5">{agenda.title}</h4>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <div className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                                {format(parseISO(agenda.start_time), 'HH:mm')}
                                                            </div>
                                                            {canManage && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full text-slate-300 hover:text-slate-600">
                                                                            <MoreVertical className="h-3 w-3" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="rounded-xl shadow-xl">
                                                                        <DropdownMenuItem onClick={() => handleOpenEdit(agenda)} className="text-xs font-bold"><Edit className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => handleOpenDelete(agenda)} className="text-xs font-bold text-red-500"><Trash2 className="mr-2 h-3.5 w-3.5" />Hapus</DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Details Inline (Location • Link • Participants) */}
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-medium leading-none">
                                                        {agenda.location && (
                                                            <div className="flex items-center gap-1.5 min-w-0 max-w-[120px]">
                                                                <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                                                <span className="truncate">{agenda.location}</span>
                                                            </div>
                                                        )}

                                                        {agenda.meeting_link && (
                                                            <div className="flex items-center gap-1.5 min-w-0 max-w-[100px]">
                                                                <Video className="h-3 w-3 shrink-0 text-blue-500" />
                                                                <a href={agenda.meeting_link} target="_blank" rel="noopener noreferrer" className="hover:underline truncate text-blue-600">Meeting</a>
                                                            </div>
                                                        )}

                                                        {/* Participants Dropdown Trigger */}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="flex items-center gap-1.5 hover:bg-slate-50 px-1 py-0.5 -ml-1 rounded transition-colors group/btn outline-none">
                                                                    <Users className="h-3 w-3 shrink-0 text-slate-400 group-hover/btn:text-blue-500" />
                                                                    <span className="group-hover/btn:text-blue-700">{agenda.participants?.length || 0} Org</span>
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="start" className="w-56 rounded-xl p-2 max-h-60 overflow-y-auto z-50 bg-white shadow-xl border-slate-100">
                                                                <div className="px-2 py-1.5 text-xs font-bold text-slate-500 border-b border-slate-100 mb-1">
                                                                    Daftar Peserta
                                                                </div>
                                                                {agenda.participants?.length === 0 ? (
                                                                    <div className="text-[10px] p-2 text-slate-400 text-center">Belum ada peserta</div>
                                                                ) : (
                                                                    agenda.participants?.map((p: any, idx: number) => {
                                                                        // AMAN: Lookup manual ke state employees
                                                                        const emp = employees.find(e => e.id === p.user_id);
                                                                        const name = emp ? emp.full_name : 'User Tidak Dikenal';
                                                                        const avatar = emp ? emp.avatar_url : null;
                                                                        const initial = name ? name[0] : '?';

                                                                        return (
                                                                            <div key={idx} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded-lg">
                                                                                <Avatar className="h-5 w-5 border border-slate-100">
                                                                                    <AvatarImage src={avatar || ''} />
                                                                                    <AvatarFallback className="text-[8px] bg-blue-50 text-blue-600 font-bold">{initial}</AvatarFallback>
                                                                                </Avatar>
                                                                                <span className="text-xs text-slate-700 truncate font-medium">{name}</span>
                                                                            </div>
                                                                        );
                                                                    })
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Alert */}
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Agenda?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Anda yakin ingin menghapus agenda <b>"{itemToDelete?.title}"</b>? Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl font-bold">Batal</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmDelete} className="rounded-xl bg-red-500 hover:bg-red-600 font-bold text-white">
                                Ya, Hapus
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    );
}

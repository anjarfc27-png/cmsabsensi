import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    ChevronLeft,
    Plus,
    Calendar,
    Trash2,
    Loader2,
    CalendarDays,
    Search,
    Globe
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import { format, isFuture, isPast, differenceInDays, isSameDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PublicHoliday {
    id: string;
    date: string;
    name: string;
    description: string | null;
    is_recurring: boolean;
    created_at: string;
}

export default function HolidaysPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
    const [loading, setLoading] = useState(true);

    // Form States
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date>();
    const [holidayName, setHolidayName] = useState('');
    const [holidayDescription, setHolidayDescription] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [saving, setSaving] = useState(false);

    // Delete States
    const [selectedHoliday, setSelectedHoliday] = useState<PublicHoliday | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Filter State
    const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString());

    useEffect(() => {
        fetchHolidays();
    }, []);

    const fetchHolidays = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('public_holidays')
                .select('*')
                .order('date', { ascending: true });

            if (error) throw error;
            setHolidays((data as PublicHoliday[]) || []);
        } catch (error) {
            console.error('Error fetching holidays:', error);
            toast({
                title: 'Gagal memuat data',
                description: 'Tidak dapat mengambil data hari libur.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedDate || !holidayName.trim()) {
            toast({
                title: 'Data Tidak Lengkap',
                description: 'Mohon isi tanggal dan nama hari libur.',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase
                .from('public_holidays')
                .insert({
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    name: holidayName.trim(),
                    description: holidayDescription.trim() || null,
                    is_recurring: isRecurring,
                });

            if (error) throw error;

            toast({
                title: 'Berhasil!',
                description: 'Hari libur telah ditambahkan.',
            });

            // Reset form
            setDialogOpen(false);
            setSelectedDate(undefined);
            setHolidayName('');
            setHolidayDescription('');
            setIsRecurring(false);

            fetchHolidays();
        } catch (error: any) {
            console.error('Error adding holiday:', error);
            toast({
                title: 'Gagal Menambah',
                description: error.message || 'Terjadi kesalahan saat menambah hari libur.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (holiday: PublicHoliday) => {
        setSelectedHoliday(holiday);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!selectedHoliday) return;

        setDeleting(true);
        try {
            const { error } = await supabase
                .from('public_holidays')
                .delete()
                .eq('id', selectedHoliday.id);

            if (error) throw error;

            toast({
                title: 'Berhasil Dihapus',
                description: `Hari libur "${selectedHoliday.name}" telah dihapus.`,
            });

            fetchHolidays();
        } catch (error: any) {
            toast({
                title: 'Gagal Menghapus',
                description: error.message,
                variant: 'destructive',
            });
        } finally {
            setDeleting(false);
            setIsDeleteDialogOpen(false);
            setSelectedHoliday(null);
        }
    };

    // Filter Logic
    const filteredHolidays = holidays.filter(h => {
        if (yearFilter === 'all') return true;
        const hYear = new Date(h.date).getFullYear().toString();
        return hYear === yearFilter;
    });

    const upcomingHolidays = holidays.filter(h => isFuture(new Date(h.date)));
    const nextHoliday = upcomingHolidays.length > 0 ? upcomingHolidays[0] : null;

    // ----------------------------------------------------------------------
    // MOBILE VIEW (PRESERVED)
    // ----------------------------------------------------------------------
    if (isMobile) {
        return (
            <DashboardLayout>
                <div className="relative min-h-screen bg-slate-50/50">
                    <div className="absolute top-0 left-0 w-full h-[calc(180px+env(safe-area-inset-top))] bg-gradient-to-r from-blue-600 to-cyan-500 rounded-b-[40px] z-0 shadow-lg" />

                    <div className="relative z-10 space-y-6 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-24 md:px-8 max-w-6xl mx-auto">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
                            <div className="flex items-start gap-3">
                                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-white hover:bg-white/20 hover:text-white shrink-0 -ml-2 h-8 w-8">
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <h1 className="text-xl md:text-2xl font-bold tracking-tight drop-shadow-md flex items-center gap-2">
                                        <CalendarDays className="h-6 w-6" />
                                        Hari Libur Nasional
                                    </h1>
                                    <p className="text-blue-50 font-medium opacity-90 mt-1 text-xs">Kelola kalender hari libur perusahaan dan nasional.</p>
                                </div>
                            </div>
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-white/10 hover:bg-white/20 text-white border-none shadow-none backdrop-blur-sm">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Tambah Hari Libur
                                    </Button>
                                </DialogTrigger>
                                <HolidayFormDialog
                                    selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                                    holidayName={holidayName} setHolidayName={setHolidayName}
                                    holidayDescription={holidayDescription} setHolidayDescription={setHolidayDescription}
                                    isRecurring={isRecurring} setIsRecurring={setIsRecurring}
                                    handleSubmit={handleSubmit} saving={saving} id={id}
                                />
                            </Dialog>
                        </div>

                        {/* Content */}
                        <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/95 backdrop-blur-sm overflow-hidden rounded-2xl">
                            <CardHeader className="border-b border-slate-100">
                                <CardTitle className="text-lg">Daftar Hari Libur</CardTitle>
                                <CardDescription>Total {holidays.length} hari libur terdaftar.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow>
                                                <TableHead className="font-bold text-slate-700">Tanggal</TableHead>
                                                <TableHead className="font-bold text-slate-700">Nama Hari Libur</TableHead>
                                                <TableHead className="font-bold text-slate-700">Keterangan</TableHead>
                                                <TableHead className="font-bold text-slate-700 text-center">Tipe</TableHead>
                                                <TableHead className="text-right font-bold text-slate-700">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-48 text-center">
                                                        <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                                            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                            <p className="text-xs">Memuat data...</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ) : holidays.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-48 text-center text-slate-500 italic">
                                                        Belum ada hari libur yang terdaftar. Klik "Tambah Hari Libur" untuk memulai.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                holidays.map((holiday) => (
                                                    <TableRow key={holiday.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex flex-col items-center justify-center text-white shadow-sm">
                                                                    <span className="text-[10px] font-bold uppercase">{format(new Date(holiday.date), 'MMM', { locale: id })}</span>
                                                                    <span className="text-lg font-black leading-none">{format(new Date(holiday.date), 'd')}</span>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-sm text-slate-700">
                                                                        {format(new Date(holiday.date), 'EEEE', { locale: id })}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400">
                                                                        {format(new Date(holiday.date), 'dd MMMM yyyy', { locale: id })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="font-bold text-sm text-slate-800">{holiday.name}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-xs text-slate-600">{holiday.description || '-'}</span>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {holiday.is_recurring ? (
                                                                <Badge className="bg-purple-100 text-purple-700 border-none px-3 py-1 text-[10px] shadow-none">
                                                                    Tahunan
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 px-3 py-1 text-[10px] shadow-none">
                                                                    Sekali
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(holiday)} className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <DeleteAlertDialog
                        isDeleteDialogOpen={isDeleteDialogOpen} setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                        selectedHoliday={selectedHoliday} confirmDelete={confirmDelete} deleting={deleting} id={id}
                    />
                </div>
            </DashboardLayout>
        );
    }

    // ----------------------------------------------------------------------
    // DESKTOP VIEW (PREMIUM)
    // ----------------------------------------------------------------------
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-6 py-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-8 shrink-0">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Hari Libur Nasional
                        </h1>
                        <p className="text-slate-500 font-medium text-sm mt-1">Kelola daftar libur & cuti bersama.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Select value={yearFilter} onValueChange={setYearFilter}>
                            <SelectTrigger className="w-[120px] bg-white border-slate-200 rounded-xl font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua</SelectItem>
                                {Array.from({ length: 3 }).map((_, i) => {
                                    const y = new Date().getFullYear() - 1 + i;
                                    return <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                })}
                            </SelectContent>
                        </Select>
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200">
                                    <Plus className="mr-2 h-5 w-5" />
                                    Tambah Libur
                                </Button>
                            </DialogTrigger>
                            <HolidayFormDialog
                                selectedDate={selectedDate} setSelectedDate={setSelectedDate}
                                holidayName={holidayName} setHolidayName={setHolidayName}
                                holidayDescription={holidayDescription} setHolidayDescription={setHolidayDescription}
                                isRecurring={isRecurring} setIsRecurring={setIsRecurring}
                                handleSubmit={handleSubmit} saving={saving} id={id}
                            />
                        </Dialog>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT PANEL: HERO */}
                    <div className="space-y-6">
                        {/* Next Holiday Card */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-6 opacity-80">
                                    <CalendarDays className="h-5 w-5" />
                                    <span className="text-sm font-bold tracking-widest uppercase">Hari Libur Berikutnya</span>
                                </div>
                                {nextHoliday ? (
                                    <>
                                        <h2 className="text-3xl font-black mb-2 leading-tight">{nextHoliday.name}</h2>
                                        <div className="flex items-center gap-3 mb-6">
                                            <Badge className="bg-white/20 hover:bg-white/30 text-white border-0">
                                                {format(new Date(nextHoliday.date), 'd MMMM yyyy', { locale: id })}
                                            </Badge>
                                            <span className="text-sm font-medium text-blue-100">
                                                {differenceInDays(new Date(nextHoliday.date), new Date())} hari lagi
                                            </span>
                                        </div>
                                        <p className="text-sm text-blue-50 opacity-90 line-clamp-2">
                                            {nextHoliday.description || "Siapkan rencana liburan anda!"}
                                        </p>
                                    </>
                                ) : (
                                    <div className="py-8 text-center text-blue-100">
                                        <p className="font-medium">Tidak ada hari libur mendatang.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <Card className="border-none shadow-lg shadow-slate-100 rounded-3xl bg-white overflow-hidden flex flex-col">
                            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
                                <CardTitle className="text-sm font-black text-slate-500 uppercase tracking-wider">Statistik Tahun {yearFilter}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="flex items-end justify-between">
                                    <div className="space-y-1">
                                        <p className="text-4xl font-black text-slate-900">{filteredHolidays.length}</p>
                                        <p className="text-sm font-bold text-slate-400">Total Hari Libur</p>
                                    </div>
                                    <div className="h-12 w-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                                        <Globe className="h-6 w-6" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT PANEL: LIST */}
                    <div className="lg:col-span-2 overflow-y-auto custom-scrollbar pb-12 pr-2">
                        {filteredHolidays.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-3xl">
                                <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                    <Calendar className="h-10 w-10 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Belum Ada Data</h3>
                                <p className="text-slate-500 mt-2 max-w-sm">Tidak ada hari libur ditemukan untuk filter yang dipilih.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredHolidays.map((holiday) => {
                                    const holidayDate = new Date(holiday.date);
                                    const isPassed = isPast(holidayDate) && !isSameDay(holidayDate, new Date());

                                    return (
                                        <div
                                            key={holiday.id}
                                            className={cn(
                                                "group relative p-5 bg-white rounded-2xl border transition-all hover:shadow-lg",
                                                isPassed ? "opacity-60 grayscale bg-slate-50 border-slate-100" : "border-slate-100 shadow-sm hover:border-blue-200"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={cn(
                                                    "h-14 w-14 rounded-2xl flex flex-col items-center justify-center text-white shadow-xl shadow-slate-200",
                                                    isPassed ? "bg-slate-400" : "bg-gradient-to-br from-rose-500 to-pink-500"
                                                )}>
                                                    <span className="text-[10px] font-bold uppercase opacity-90">{format(holidayDate, 'MMM', { locale: id })}</span>
                                                    <span className="text-xl font-black leading-none">{format(holidayDate, 'd')}</span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(holiday)}
                                                    className="h-8 w-8 text-slate-300 hover:text-red-500 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            <div className="space-y-1">
                                                <h3 className={cn("font-bold text-lg leading-tight", isPassed ? "text-slate-600" : "text-slate-900")}>{holiday.name}</h3>
                                                <p className="text-sm font-bold text-slate-400 is-uppercase">
                                                    {format(holidayDate, 'EEEE, yyyy', { locale: id })}
                                                </p>
                                            </div>

                                            {holiday.description && (
                                                <div className="mt-4 pt-4 border-t border-slate-50">
                                                    <p className="text-xs text-slate-500 line-clamp-2">{holiday.description}</p>
                                                </div>
                                            )}

                                            {holiday.is_recurring && (
                                                <div className="absolute top-5 right-5">
                                                    <Badge variant="secondary" className="bg-purple-50 text-purple-600 text-[10px] hover:bg-purple-100">Tahunan</Badge>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <DeleteAlertDialog
                    isDeleteDialogOpen={isDeleteDialogOpen} setIsDeleteDialogOpen={setIsDeleteDialogOpen}
                    selectedHoliday={selectedHoliday} confirmDelete={confirmDelete} deleting={deleting} id={id}
                />
            </div>
        </DashboardLayout>
    );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTS
// ----------------------------------------------------------------------

function HolidayFormDialog({ selectedDate, setSelectedDate, holidayName, setHolidayName, holidayDescription, setHolidayDescription, isRecurring, setIsRecurring, handleSubmit, saving, id }: any) {
    return (
        <DialogContent className="rounded-2xl max-w-lg">
            <DialogHeader>
                <DialogTitle>Tambah Hari Libur Baru</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label>Tanggal Libur *</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("justify-start text-left font-normal h-12 rounded-xl", !selectedDate && "text-muted-foreground")}>
                                <Calendar className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP", { locale: id }) : <span>Pilih tanggal</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                            <CalendarComponent mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus className="rounded-xl" />
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="grid gap-2">
                    <Label>Nama Hari Libur *</Label>
                    <Input
                        placeholder="Contoh: Hari Kemerdekaan RI"
                        value={holidayName}
                        onChange={(e) => setHolidayName(e.target.value)}
                        className="rounded-xl h-12"
                    />
                </div>

                <div className="grid gap-2">
                    <Label>Keterangan (Opsional)</Label>
                    <Input
                        placeholder="Deskripsi tambahan..."
                        value={holidayDescription}
                        onChange={(e) => setHolidayDescription(e.target.value)}
                        className="rounded-xl h-12"
                    />
                </div>

                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setIsRecurring(!isRecurring)}>
                    <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm", isRecurring ? "bg-purple-600 border-purple-600" : "bg-white border-slate-300")}>
                        {isRecurring && <Calendar className="h-3 w-3 text-white" />}
                    </div>
                    <Label className="cursor-pointer text-sm font-bold text-slate-700">
                        Libur Tahunan (Berulang)
                    </Label>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleSubmit} disabled={saving} className="w-full md:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 h-10 px-6">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}

function DeleteAlertDialog({ isDeleteDialogOpen, setIsDeleteDialogOpen, selectedHoliday, confirmDelete, deleting, id }: any) {
    return (
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent className="rounded-2xl max-w-sm">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-bold">Hapus Hari Libur?</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-500">
                        Apakah Anda yakin ingin menghapus hari libur <span className="text-slate-900 font-bold">"{selectedHoliday?.name}"</span> pada tanggal{' '}
                        <span className="text-slate-900 font-bold">{selectedHoliday && format(new Date(selectedHoliday.date), 'dd MMMM yyyy', { locale: id })}</span>?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl mt-0 border-slate-200 hover:bg-slate-50">Batal</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={confirmDelete}
                        className="rounded-xl bg-red-600 hover:bg-red-700 shadow-md shadow-red-100"
                        disabled={deleting}
                    >
                        {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Hapus
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

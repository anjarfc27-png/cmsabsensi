import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Plus,
    ArrowLeft,
    Download,
    Trash2,
    Image as ImageIcon,
    Video,
    Play,
    X,
    Maximize2,
    Calendar,
    Users,
    Globe,
    Loader2,
    FileUp,
    ExternalLink,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Album, AlbumItem } from '@/types';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function AlbumDetailPage() {
    const { id: albumId } = useParams();
    const { profile, activeRole } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [album, setAlbum] = useState<Album | null>(null);
    const [items, setItems] = useState<AlbumItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'photo' | 'video'>('all');

    // Lightbox State
    const [selectedItem, setSelectedItem] = useState<{ item: AlbumItem, index: number } | null>(null);

    const canManage = activeRole === 'admin_hr' || activeRole === 'manager';

    useEffect(() => {
        if (albumId) {
            fetchAlbumDetail();
        }
    }, [albumId]);

    const fetchAlbumDetail = async () => {
        try {
            setLoading(true);

            // 1. Fetch Album Info
            const { data: albumData, error: albumError } = await supabase
                .from('albums')
                .select('*, department:department_id(name)')
                .eq('id', albumId)
                .single();

            if (albumError) throw albumError;
            setAlbum(albumData as Album);

            // 2. Fetch Items
            const { data: itemsData, error: itemsError } = await supabase
                .from('album_items')
                .select('*')
                .eq('album_id', albumId)
                .order('created_at', { ascending: false });

            if (itemsError) throw itemsError;
            setItems(itemsData || []);

        } catch (error) {
            console.error('Error fetching detail:', error);
            toast({
                title: 'Error',
                description: 'Gagal memuat detail album.',
                variant: 'destructive',
            });
            navigate('/albums');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0 || !albumId) return;

        try {
            setUploading(true);
            const uploadPromises = Array.from(files).map(async (file) => {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                const filePath = `${albumId}/${fileName}`;
                const fileType = file.type.startsWith('video') ? 'video' : 'photo';

                // 1. Upload to Supabase Storage
                const { error: storageError, data: storageData } = await supabase.storage
                    .from('albums')
                    .upload(filePath, file);

                if (storageError) throw storageError;

                // 2. Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('albums')
                    .getPublicUrl(filePath);

                // 3. Save to database
                const { error: dbError } = await supabase
                    .from('album_items')
                    .insert({
                        album_id: albumId,
                        file_url: publicUrl,
                        file_type: fileType,
                        file_name: file.name,
                        file_size: file.size
                    });

                if (dbError) throw dbError;
                return true;
            });

            await Promise.all(uploadPromises);

            toast({
                title: 'Berhasil',
                description: `${files.length} file berhasil diunggah.`,
            });

            fetchAlbumDetail();
        } catch (error) {
            console.error('Upload error:', error);
            toast({
                title: 'Gagal mengunggah',
                description: 'Terjadi kesalahan saat upload file.',
                variant: 'destructive',
            });
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteItem = async (e: React.MouseEvent, item: AlbumItem) => {
        e.stopPropagation();
        if (!confirm('Hapus file ini?')) return;

        try {
            // 1. Delete from storage (Extract file path from URL)
            // URL format: .../storage/v1/object/public/albums/ALBUM_ID/FILE_NAME
            const pathParts = item.file_url.split('/albums/');
            if (pathParts.length > 1) {
                const filePath = pathParts[1];
                await supabase.storage.from('albums').remove([filePath]);
            }

            // 2. Delete from DB
            const { error } = await supabase
                .from('album_items')
                .delete()
                .eq('id', item.id);

            if (error) throw error;

            setItems(items.filter(i => i.id !== item.id));
            toast({ title: 'Berhasil', description: 'File telah dihapus.' });

            if (selectedItem?.item.id === item.id) setSelectedItem(null);
        } catch (error) {
            toast({ title: 'Gagal', description: 'Gagal menghapus file.', variant: 'destructive' });
        }
    };

    const handleDownload = async (item: AlbumItem) => {
        try {
            const response = await fetch(item.file_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = item.file_name || `media-${item.id}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({ title: 'Gagal', description: 'Gagal mengunduh file.', variant: 'destructive' });
        }
    };

    const filteredItems = items.filter(item =>
        filterType === 'all' ? true : item.file_type === filterType
    );

    const navigateLightbox = (direction: 'next' | 'prev') => {
        if (!selectedItem) return;
        const itemsToShow = filteredItems;
        let newIndex = direction === 'next' ? selectedItem.index + 1 : selectedItem.index - 1;

        if (newIndex >= 0 && newIndex < itemsToShow.length) {
            setSelectedItem({ item: itemsToShow[newIndex], index: newIndex });
        }
    };

    if (loading) return <DashboardLayout><div className="flex flex-col items-center justify-center py-40 gap-4"><Loader2 className="h-10 w-10 animate-spin text-blue-500" /><p className="font-bold text-slate-400">Memuat konten album...</p></div></DashboardLayout>;
    if (!album) return null;

    return (
        <DashboardLayout>
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
                {/* Navigation & Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-4">
                        <Button
                            variant="ghost"
                            onClick={() => navigate('/albums')}
                            className="rounded-xl font-bold -ml-2 text-slate-500 hover:text-blue-600 gap-2"
                        >
                            <ArrowLeft className="h-5 w-5" /> Kembali ke Daftar Album
                        </Button>

                        <div className="space-y-2">
                            <div className="flex items-center gap-4 flex-wrap">
                                <h1 className="text-4xl font-black tracking-tight text-slate-900">{album.title}</h1>
                                <Badge className={cn(
                                    "rounded-full px-4 py-1 text-[10px] font-black tracking-widest uppercase border-none",
                                    album.visibility === 'public' ? "bg-blue-600 text-white" : "bg-amber-500 text-white"
                                )}>
                                    {album.visibility === 'public' ? 'Publik' : 'Internal Tim'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-6 text-slate-500 font-bold text-sm">
                                <span className="flex items-center gap-2"><Calendar className="h-4 w-4" /> {format(new Date(album.created_at), 'd MMMM yyyy', { locale: idLocale })}</span>
                                {album.department && <span className="flex items-center gap-2"><Users className="h-4 w-4" /> {album.department.name}</span>}
                                <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> {items.length} Media</span>
                            </div>
                            {album.description && <p className="text-slate-600 font-medium max-w-3xl leading-relaxed text-lg pt-2">{album.description}</p>}
                        </div>
                    </div>

                    {canManage && (
                        <div className="flex items-center gap-3 shrink-0">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                multiple
                                accept="image/*,video/*"
                                onChange={handleFileUpload}
                            />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 font-black text-lg gap-3 transition-all hover:scale-105 active:scale-95"
                            >
                                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
                                Unggah Media
                            </Button>
                        </div>
                    )}
                </div>

                {/* Filter Bar */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setFilterType('all')}
                            className={cn(
                                "pb-4 px-2 font-black text-sm relative transition-all uppercase tracking-widest",
                                filterType === 'all' ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Semua
                            {filterType === 'all' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full" />}
                        </button>
                        <button
                            onClick={() => setFilterType('photo')}
                            className={cn(
                                "pb-4 px-2 font-black text-sm relative transition-all uppercase tracking-widest",
                                filterType === 'photo' ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Foto
                            {filterType === 'photo' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full" />}
                        </button>
                        <button
                            onClick={() => setFilterType('video')}
                            className={cn(
                                "pb-4 px-2 font-black text-sm relative transition-all uppercase tracking-widest",
                                filterType === 'video' ? "text-blue-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Video
                            {filterType === 'video' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-full" />}
                        </button>
                    </div>

                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Resolusi Asli (HD/4K) Didukung
                    </div>
                </div>

                {/* Media Grid */}
                {filteredItems.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                        {filteredItems.map((item, index) => (
                            <div
                                key={item.id}
                                className="group relative aspect-square bg-slate-100 rounded-3xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1"
                                onClick={() => setSelectedItem({ item, index })}
                            >
                                {item.file_type === 'photo' ? (
                                    <img src={item.file_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full relative">
                                        <video src={item.file_url} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                            <div className="h-12 w-12 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white scale-110 group-hover:scale-125 transition-transform duration-500">
                                                <Play className="h-6 w-6 fill-white" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Hover Overlays */}
                                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full bg-white/20 text-white hover:bg-white/40 backdrop-blur-md"
                                            onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        {canManage && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full bg-red-500/80 text-white hover:bg-red-600 backdrop-blur-md"
                                                onClick={(e) => handleDeleteItem(e, item)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/20 text-white backdrop-blur-md">
                                        {item.file_type === 'photo' ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-slate-200 rounded-[48px] bg-slate-50/50">
                        <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-6">
                            <ImageIcon className="h-10 w-10 text-slate-300" />
                        </div>
                        <p className="text-xl font-bold text-slate-400">Belum ada media di album ini</p>
                        {canManage && <p className="text-sm font-medium text-slate-400 mt-2">Gunakan tombol "Unggah Media" untuk menambahkan konten.</p>}
                    </div>
                )}
            </div>

            {/* Lightbox Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300 overflow-hidden">
                    {/* Controls Header */}
                    <div className="absolute top-0 inset-x-0 p-6 flex items-center justify-between z-[110]">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-xl">
                                {selectedItem.item.file_type === 'photo' ? <ImageIcon className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                            </div>
                            <div>
                                <p className="text-white font-black text-lg">{selectedItem.item.file_name || 'Media Item'}</p>
                                <p className="text-white/50 font-bold text-xs uppercase tracking-[0.2em]">{selectedItem.index + 1} of {filteredItems.length}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 rounded-2xl bg-white/10 border-white/10 text-white hover:bg-white/20 transition-all"
                                onClick={() => handleDownload(selectedItem.item)}
                            >
                                <Download className="h-5 w-5" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-12 w-12 rounded-2xl bg-white/10 border-white/10 text-white hover:bg-white/20 transition-all font-black"
                                onClick={() => setSelectedItem(null)}
                            >
                                <X className="h-7 w-7" />
                            </Button>
                        </div>
                    </div>

                    {/* Navigation Arrows */}
                    {selectedItem.index > 0 && (
                        <button
                            onClick={() => navigateLightbox('prev')}
                            className="absolute left-6 top-1/2 -translate-y-1/2 h-20 w-20 rounded-full bg-white/5 text-white hover:bg-white/10 flex items-center justify-center transition-all z-[110] active:scale-90"
                        >
                            <ChevronLeft className="h-10 w-10" />
                        </button>
                    )}
                    {selectedItem.index < filteredItems.length - 1 && (
                        <button
                            onClick={() => navigateLightbox('next')}
                            className="absolute right-6 top-1/2 -translate-y-1/2 h-20 w-20 rounded-full bg-white/5 text-white hover:bg-white/10 flex items-center justify-center transition-all z-[110] active:scale-90"
                        >
                            <ChevronRight className="h-10 w-10" />
                        </button>
                    )}

                    {/* Main Media Display */}
                    <div className="w-full h-full flex items-center justify-center p-12 md:p-32 relative">
                        {selectedItem.item.file_type === 'photo' ? (
                            <img
                                src={selectedItem.item.file_url}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500"
                            />
                        ) : (
                            <video
                                src={selectedItem.item.file_url}
                                controls
                                autoPlay
                                className="max-w-full max-h-full aspect-video rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-500"
                            />
                        )}

                        {/* Info Floating Label */}
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 px-8 py-4 bg-white/10 backdrop-blur-3xl rounded-3xl border border-white/10 flex items-center gap-6">
                            <div className="flex flex-col">
                                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Tgl Upload</span>
                                <span className="text-white font-bold text-sm tracking-tight">{format(new Date(selectedItem.item.created_at), 'd MMM yyyy, HH:mm', { locale: idLocale })}</span>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="flex flex-col">
                                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Tipe Video</span>
                                <span className="text-white font-bold text-sm tracking-tight uppercase">{selectedItem.item.file_type} High Definition</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, MapPin } from 'lucide-react';
import { OfficeLocation } from '@/types';

export default function LocationsPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', latitude: '', longitude: '', radius_meters: '100' });

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    const { data } = await supabase.from('office_locations').select('*').order('name');
    setLocations((data as OfficeLocation[]) || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.latitude || !formData.longitude) {
      toast({ title: 'Error', description: 'Lengkapi data', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await supabase.from('office_locations').insert({
        name: formData.name,
        address: formData.address || null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius_meters: parseInt(formData.radius_meters) || 100,
      });
      toast({ title: 'Berhasil', description: 'Lokasi ditambahkan' });
      setDialogOpen(false);
      setFormData({ name: '', address: '', latitude: '', longitude: '', radius_meters: '100' });
      fetchLocations();
    } catch (e) {
      toast({ title: 'Error', description: 'Gagal menyimpan', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  if (role !== 'admin_hr') return <DashboardLayout><div className="text-center py-12 text-muted-foreground">Tidak ada akses</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Lokasi Kantor</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Tambah Lokasi</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tambah Lokasi</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2"><Label>Nama</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Alamat</Label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Latitude</Label><Input value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} placeholder="-6.2088" /></div>
                  <div className="space-y-2"><Label>Longitude</Label><Input value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} placeholder="106.8456" /></div>
                </div>
                <div className="space-y-2"><Label>Radius (meter)</Label><Input type="number" value={formData.radius_meters} onChange={e => setFormData({...formData, radius_meters: e.target.value})} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
                <Button onClick={handleSubmit} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <Card>
          <CardContent className="p-0">
            {loading ? <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div> :
            locations.length === 0 ? <div className="py-12 text-center text-muted-foreground">Belum ada lokasi</div> :
            <Table>
              <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Alamat</TableHead><TableHead>Koordinat</TableHead><TableHead>Radius</TableHead></TableRow></TableHeader>
              <TableBody>
                {locations.map(loc => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium"><div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{loc.name}</div></TableCell>
                    <TableCell>{loc.address || '-'}</TableCell>
                    <TableCell>{loc.latitude}, {loc.longitude}</TableCell>
                    <TableCell>{loc.radius_meters}m</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCamera } from '@/hooks/useCamera';
import { Loader2, Camera, MapPin, Clock, CheckCircle2, AlertCircle, LogIn, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Attendance, OfficeLocation, WorkMode } from '@/types';

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { latitude, longitude, error: geoError, loading: geoLoading, getLocation } = useGeolocation();
  const { stream, error: camError, isActive, videoRef, startCamera, stopCamera, capturePhoto } = useCamera();
  
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [officeLocations, setOfficeLocations] = useState<OfficeLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [workMode, setWorkMode] = useState<WorkMode>('wfo');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [step, setStep] = useState<'info' | 'camera' | 'confirm'>('info');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  const fetchData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Fetch today's attendance
      const { data: attendanceData } = await supabase
        .from('attendances')
        .select('*')
        .eq('date', today)
        .maybeSingle();
      
      setTodayAttendance(attendanceData as Attendance | null);

      // Fetch office locations
      const { data: locationData } = await supabase
        .from('office_locations')
        .select('*')
        .eq('is_active', true);
      
      setOfficeLocations((locationData as OfficeLocation[]) || []);
      if (locationData && locationData.length > 0) {
        setSelectedLocation(locationData[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAttendance = async () => {
    try {
      await getLocation();
      await startCamera();
      setStep('camera');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memulai absensi',
        variant: 'destructive',
      });
    }
  };

  const handleCapturePhoto = async () => {
    try {
      const photo = await capturePhoto();
      setCapturedPhoto(photo);
      setPhotoPreview(URL.createObjectURL(photo));
      stopCamera();
      setStep('confirm');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal mengambil foto',
        variant: 'destructive',
      });
    }
  };

  const handleRetakePhoto = async () => {
    setCapturedPhoto(null);
    setPhotoPreview(null);
    try {
      await startCamera();
      setStep('camera');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal membuka kamera',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitAttendance = async (type: 'clock_in' | 'clock_out') => {
    if (!user || !latitude || !longitude || !capturedPhoto) {
      toast({
        title: 'Error',
        description: 'Data tidak lengkap. Pastikan lokasi dan foto sudah tersedia.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Upload photo
      const fileName = `${user.id}/${format(new Date(), 'yyyy-MM-dd')}_${type}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, capturedPhoto, {
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(fileName);

      // Check if within office radius
      const selectedOffice = officeLocations.find(loc => loc.id === selectedLocation);
      let isWithinRadius = true;
      
      if (selectedOffice && workMode === 'wfo') {
        const distance = calculateDistance(
          latitude,
          longitude,
          selectedOffice.latitude,
          selectedOffice.longitude
        );
        isWithinRadius = distance <= selectedOffice.radius_meters;
      }

      const now = new Date();
      const today = format(now, 'yyyy-MM-dd');

      if (type === 'clock_in') {
        // Check if late (after 08:15)
        const scheduleStart = new Date();
        scheduleStart.setHours(8, 15, 0, 0);
        const isLate = now > scheduleStart;
        const lateMinutes = isLate ? Math.floor((now.getTime() - scheduleStart.getTime()) / 60000) : 0;

        const { error: insertError } = await supabase
          .from('attendances')
          .insert({
            user_id: user.id,
            date: today,
            clock_in: now.toISOString(),
            clock_in_latitude: latitude,
            clock_in_longitude: longitude,
            clock_in_photo_url: publicUrl,
            clock_in_location_id: selectedLocation || null,
            work_mode: workMode,
            status: 'present',
            is_late: isLate,
            late_minutes: lateMinutes,
          });

        if (insertError) throw insertError;

        toast({
          title: 'Clock In Berhasil',
          description: `Tercatat pada ${format(now, 'HH:mm')}${isLate ? ' (Terlambat)' : ''}`,
        });
      } else {
        // Clock out
        const clockOutTime = now.toISOString();
        let workHoursMinutes = 0;

        if (todayAttendance?.clock_in) {
          const clockInTime = new Date(todayAttendance.clock_in);
          workHoursMinutes = Math.floor((now.getTime() - clockInTime.getTime()) / 60000);
        }

        const { error: updateError } = await supabase
          .from('attendances')
          .update({
            clock_out: clockOutTime,
            clock_out_latitude: latitude,
            clock_out_longitude: longitude,
            clock_out_photo_url: publicUrl,
            clock_out_location_id: selectedLocation || null,
            work_hours_minutes: workHoursMinutes,
          })
          .eq('id', todayAttendance?.id);

        if (updateError) throw updateError;

        toast({
          title: 'Clock Out Berhasil',
          description: `Tercatat pada ${format(now, 'HH:mm')}. Total kerja: ${formatMinutes(workHoursMinutes)}`,
        });
      }

      // Reset state
      setCapturedPhoto(null);
      setPhotoPreview(null);
      setStep('info');
      fetchData();
    } catch (error) {
      console.error('Error submitting attendance:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan absensi. Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours} jam ${mins} menit`;
  };

  const handleCancel = () => {
    stopCamera();
    setCapturedPhoto(null);
    setPhotoPreview(null);
    setStep('info');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Absensi</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM yyyy", { locale: id })}
          </p>
        </div>

        {/* Current Status */}
        {todayAttendance && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Status Hari Ini</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1 text-center p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground mb-1">Clock In</p>
                  <p className="text-lg font-semibold">
                    {todayAttendance.clock_in 
                      ? format(new Date(todayAttendance.clock_in), 'HH:mm')
                      : '-'
                    }
                  </p>
                </div>
                <div className="flex-1 text-center p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground mb-1">Clock Out</p>
                  <p className="text-lg font-semibold">
                    {todayAttendance.clock_out 
                      ? format(new Date(todayAttendance.clock_out), 'HH:mm')
                      : '-'
                    }
                  </p>
                </div>
                <Badge 
                  variant={todayAttendance.is_late ? 'destructive' : 'default'}
                  className="self-start"
                >
                  {todayAttendance.is_late ? 'Terlambat' : 'Tepat Waktu'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendance Form */}
        <Card>
          <CardHeader>
            <CardTitle>
              {!todayAttendance ? 'Clock In' : !todayAttendance.clock_out ? 'Clock Out' : 'Absensi Selesai'}
            </CardTitle>
            <CardDescription>
              {!todayAttendance 
                ? 'Lakukan clock in untuk memulai hari kerja Anda'
                : !todayAttendance.clock_out 
                  ? 'Lakukan clock out untuk mengakhiri hari kerja Anda'
                  : 'Anda sudah menyelesaikan absensi hari ini'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todayAttendance?.clock_out ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
                <p className="text-lg font-medium">Absensi Selesai</p>
                <p className="text-sm text-muted-foreground">
                  Total jam kerja: {todayAttendance.work_hours_minutes ? formatMinutes(todayAttendance.work_hours_minutes) : '-'}
                </p>
              </div>
            ) : step === 'info' ? (
              <div className="space-y-4">
                {/* Work Mode Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mode Kerja</label>
                  <Select value={workMode} onValueChange={(v) => setWorkMode(v as WorkMode)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wfo">WFO (Work From Office)</SelectItem>
                      <SelectItem value="wfh">WFH (Work From Home)</SelectItem>
                      <SelectItem value="field">Dinas Luar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location Selection */}
                {workMode === 'wfo' && officeLocations.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Lokasi Kantor</label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih lokasi" />
                      </SelectTrigger>
                      <SelectContent>
                        {officeLocations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button onClick={handleStartAttendance} className="w-full" size="lg">
                  {!todayAttendance ? (
                    <>
                      <LogIn className="mr-2 h-5 w-5" />
                      Mulai Clock In
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-5 w-5" />
                      Mulai Clock Out
                    </>
                  )}
                </Button>
              </div>
            ) : step === 'camera' ? (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <div className="absolute inset-0 border-4 border-dashed border-primary/30 m-8 rounded-full pointer-events-none" />
                </div>
                
                {/* Location Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {latitude && longitude 
                      ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                      : 'Mengambil lokasi...'
                    }
                  </span>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleCancel} className="flex-1">
                    Batal
                  </Button>
                  <Button onClick={handleCapturePhoto} className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    Ambil Foto
                  </Button>
                </div>
              </div>
            ) : step === 'confirm' ? (
              <div className="space-y-4">
                <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                  {photoPreview && (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  )}
                </div>

                {/* Location Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {latitude && longitude 
                      ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                      : 'Lokasi tidak tersedia'
                    }
                  </span>
                </div>

                {/* Time */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{format(new Date(), 'HH:mm:ss')}</span>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleRetakePhoto} className="flex-1">
                    Ambil Ulang
                  </Button>
                  <Button 
                    onClick={() => handleSubmitAttendance(!todayAttendance ? 'clock_in' : 'clock_out')} 
                    className="flex-1"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Konfirmasi
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

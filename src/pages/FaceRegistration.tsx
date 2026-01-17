import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SimpleFaceRegistration } from '@/components/face-registration/SimpleFaceRegistration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, User, CheckCircle, AlertCircle, Camera, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function FaceRegistrationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasFaceEnrollment, setHasFaceEnrollment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkFaceEnrollment();
  }, [user]);

  const checkFaceEnrollment = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Check if user has face enrollment
      const { data } = await supabase
        .rpc('has_face_enrollment', { p_user_id: user.id });

      setHasFaceEnrollment(data || false);

    } catch (error) {
      console.error('Error checking face enrollment:', error);
      setError('Gagal memuat status pendaftaran wajah');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistrationComplete = (success: boolean, data?: any) => {
    if (success) {
      setRegistrationComplete(true);
      setHasFaceEnrollment(true);
      setError('');
    } else {
      setError(data?.message || 'Registrasi wajah gagal');
    }
  };

  const handleGoToSettings = () => {
    navigate('/settings?tab=face-recognition');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Memuat status registrasi...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pt-[calc(1rem+env(safe-area-inset-top))] md:pt-0 pb-10 px-4 md:px-0">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registrasi Wajah</h1>
            <p className="text-muted-foreground">
              Daftarkan wajah Anda untuk otentikasi biometrik
            </p>
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Status Pendaftaran
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${hasFaceEnrollment ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <div>
                  <div className="font-medium">
                    {hasFaceEnrollment ? 'Wajah Terdaftar' : 'Belum Terdaftar'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {hasFaceEnrollment
                      ? 'Wajah Anda sudah terdaftar untuk otentikasi biometrik.'
                      : 'Daftarkan wajah Anda untuk mengaktifkan fitur pengenalan wajah.'
                    }
                  </div>
                </div>
              </div>
              <Badge variant={hasFaceEnrollment ? 'default' : 'secondary'}>
                {hasFaceEnrollment ? '✅ Selesai' : '⏳ Pending'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Face Registration Component */}
        {!hasFaceEnrollment && !registrationComplete && (
          <SimpleFaceRegistration onComplete={handleRegistrationComplete} />
        )}

        {/* Registration Complete */}
        {registrationComplete && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-green-800">Registrasi Berhasil!</h3>
                  <p className="text-green-600 mt-1">
                    Wajah Anda telah berhasil didaftarkan untuk otentikasi.
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sekarang Anda dapat menggunakan fitur:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <Badge variant="outline">Absen Masuk</Badge>
                    <Badge variant="outline">Absen Pulang</Badge>
                    <Badge variant="outline">Login Aman</Badge>
                    <Badge variant="outline">Verifikasi Cepat</Badge>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button onClick={handleGoToSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Pengaturan
                  </Button>
                  <Button variant="outline" onClick={handleGoToDashboard}>
                    Ke Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already Registered */}
        {hasFaceEnrollment && !registrationComplete && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-blue-800">Wajah Sudah Terdaftar</h3>
                  <p className="text-blue-600 mt-1">
                    Anda sudah melakukan perekaman data wajah sebelumnya.
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-center text-muted-foreground w-full">
                    Anda sudah bisa menggunakan fitur absensi wajah tanpa perlu mendaftar ulang.
                  </p>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={handleGoToSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Pengaturan
                  </Button>
                  <Button onClick={handleGoToDashboard}>
                    Ke Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Keuntungan Face Recognition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Cepat & Praktis
                </h4>
                <p className="text-sm text-muted-foreground">
                  Absen masuk/pulang instan hanya dengan memindai wajah.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Keamanan Tinggi
                </h4>
                <p className="text-sm text-muted-foreground">
                  Otentikasi biometrik dengan tingkat akurasi tinggi.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Opsi Cadangan
                </h4>
                <p className="text-sm text-muted-foreground">
                  Tersedia opsi PIN/Password jika pemindaian wajah terkendala.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Jejak Audit
                </h4>
                <p className="text-sm text-muted-foreground">
                  Pencatatan lengkap untuk setiap percobaan otentikasi.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

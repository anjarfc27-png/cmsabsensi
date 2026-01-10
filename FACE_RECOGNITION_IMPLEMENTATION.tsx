// ========================================
// FACE RECOGNITION IMPLEMENTATION
// File: src/pages/Attendance.tsx
// Add these functions after fetchData() function (around line 200)
// ========================================

// Check face match before allowing attendance
const checkFaceMatch = async (): Promise<boolean> => {
    if (!videoRef.current || !modelsLoaded) {
        toast({
            title: 'Sistem Belum Siap',
            description: 'Model face recognition sedang dimuat',
            variant: 'destructive'
        });
        return false;
    }

    setCheckingFace(true);

    try {
        // Get current face descriptor from video
        const currentDescriptor = await getFaceDescriptor(videoRef.current);

        if (!currentDescriptor) {
            setFaceDetected(false);
            toast({
                title: 'Wajah Tidak Terdeteksi',
                description: 'Pastikan wajah Anda terlihat jelas di kamera',
                variant: 'destructive'
            });
            return false;
        }

        setFaceDetected(true);

        // Get registered face from database
        const { data: faceData, error } = await supabase
            .from('face_encodings')
            .select('encoding')
            .eq('user_id', user.id)
            .single();

        if (error || !faceData) {
            toast({
                title: 'Belum Registrasi Wajah',
                description: 'Silakan daftar wajah Anda terlebih dahulu di menu Profile',
                variant: 'destructive'
            });
            return false;
        }

        // Compare faces
        const registeredDescriptor = new Float32Array(faceData.encoding);
        const similarity = compareFaces(currentDescriptor, registeredDescriptor);

        setFaceMatch(similarity);

        // Threshold: 0.6 = 60% match
        if (similarity < 0.6) {
            toast({
                title: 'Wajah Tidak Cocok',
                description: `Tingkat kemiripan: ${(similarity * 100).toFixed(0)}% (minimum 60%)`,
                variant: 'destructive'
            });
            return false;
        }

        // Success!
        toast({
            title: 'Wajah Terverifikasi ✓',
            description: `Tingkat kemiripan: ${(similarity * 100).toFixed(0)}%`,
            className: 'bg-green-600 text-white border-none'
        });

        return true;

    } catch (error) {
        console.error('Face matching error:', error);
        toast({
            title: 'Error',
            description: 'Gagal memverifikasi wajah',
            variant: 'destructive'
        });
        return false;
    } finally {
        setCheckingFace(false);
    }
};

// REPLACE existing openCamera function with this:
const openCamera = async () => {
    try {
        setCameraOpen(true);
        await getLocation();
        await startCamera();

        // Auto-check face every 2 seconds
        const interval = setInterval(async () => {
            if (videoRef.current && modelsLoaded && !checkingFace) {
                try {
                    const descriptor = await getFaceDescriptor(videoRef.current);
                    setFaceDetected(descriptor !== null);

                    // Auto-match if face detected
                    if (descriptor && user) {
                        const { data: faceData } = await supabase
                            .from('face_encodings')
                            .select('encoding')
                            .eq('user_id', user.id)
                            .single();

                        if (faceData) {
                            const registeredDescriptor = new Float32Array(faceData.encoding);
                            const similarity = compareFaces(descriptor, registeredDescriptor);
                            setFaceMatch(similarity);
                        }
                    }
                } catch (error) {
                    console.error('Auto face check error:', error);
                }
            }
        }, 2000);

        // Store interval ID to clear later
        (window as any).faceCheckInterval = interval;

    } catch (error) {
        setCameraOpen(false);
        const errorMessage = error instanceof Error ? error.message : 'Gagal mengakses kamera';
        toast({
            title: 'Gagal Membuka Kamera',
            description: errorMessage,
            variant: 'destructive',
        });
    }
};

// ADD this new function (if not exists):
const handleCapturePhoto = async () => {
    try {
        // FIRST: Check face match
        const isMatch = await checkFaceMatch();
        if (!isMatch) {
            return; // Block if no match
        }

        // THEN: Capture photo
        const photo = await capturePhoto();
        setCapturedPhoto(photo);
        setPhotoPreview(URL.createObjectURL(photo));

        // Clear interval
        if ((window as any).faceCheckInterval) {
            clearInterval((window as any).faceCheckInterval);
        }

        stopCamera();
        setCameraOpen(false);
    } catch (error) {
        toast({ title: 'Gagal', description: 'Gagal mengambil foto', variant: 'destructive' });
    }
};

// ========================================
// UI UPDATES
// Add this inside the camera dialog (around line 660-700)
// Add after the video element
// ========================================

{/* Face Detection Indicator - ADD THIS */ }
{
    modelsLoaded && (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            <Badge
                variant={faceDetected ? "default" : "destructive"}
                className={cn(
                    "gap-2 px-3 py-1.5",
                    faceDetected ? "bg-green-600" : "bg-yellow-600"
                )}
            >
                <Scan className="h-3 w-3" />
                {faceDetected ? 'Wajah Terdeteksi' : 'Mencari Wajah...'}
            </Badge>

            {faceMatch !== null && (
                <Badge
                    variant={faceMatch >= 0.6 ? "default" : "destructive"}
                    className={cn(
                        "px-3 py-1.5 font-bold",
                        faceMatch >= 0.8 ? "bg-green-600" :
                            faceMatch >= 0.7 ? "bg-blue-600" :
                                faceMatch >= 0.6 ? "bg-yellow-600" :
                                    "bg-red-600"
                    )}
                >
                    Match: {(faceMatch * 100).toFixed(0)}%
                </Badge>
            )}
        </div>
    )
}

{/* Loading indicator when checking face */ }
{
    checkingFace && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
            <div className="bg-white rounded-lg p-4 flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="font-medium">Memverifikasi wajah...</span>
            </div>
        </div>
    )
}

// ========================================
// VIDEO ELEMENT UPDATE
// Find the video element and add mirror effect:
// ========================================

<video
  ref={videoRef}
  autoPlay
  playsInline
  muted
  style={{ transform: 'scaleX(-1)' }}  // ADD THIS for mirror effect
  className="w-full h-full object-cover"
/>

// ========================================
// CAPTURE BUTTON UPDATE
// Update the capture button to show checking state:
// ========================================

<button
  onClick={handleCapturePhoto}
  disabled={!stream || checkingFace || !faceDetected || (faceMatch !== null && faceMatch < 0.6)}
  className={cn(
    "h-24 w-24 rounded-full border-4 border-white flex items-center justify-center p-1.5 bg-transparent group transition-transform",
    (!stream || checkingFace || !faceDetected || (faceMatch !== null && faceMatch < 0.6)) 
      ? "opacity-50 cursor-not-allowed" 
      : "active:scale-90"
  )}
>
  <div className={cn(
    "h-full w-full rounded-full group-hover:bg-slate-200",
    faceMatch !== null && faceMatch >= 0.6 ? "bg-green-500" : "bg-white"
  )} />
</button>

// ========================================
// CLEANUP ON UNMOUNT
// Add useEffect to cleanup interval:
// ========================================

useEffect(() => {
    return () => {
        // Cleanup interval on unmount
        if ((window as any).faceCheckInterval) {
            clearInterval((window as any).faceCheckInterval);
        }
    };
}, []);

# MIGRATION: Face Recognition → Fingerprint Biometric

**Status:** In Progress  
**Date:** 2026-01-20  
**Reason:** Face recognition tensor errors - migrating to device biometric authentication

---

## Overview

Sistem absensi sementara diubah dari **Face Recognition** menjadi **Fingerprint/Biometric Authentication** menggunakan Web Authentication API (WebAuthn).

### Changes Summary

| Component | Status | Changes Required |
|-----------|--------|------------------|
| FaceRegistration.tsx | ✅ DONE | Replaced with "Coming Soon" page |
| biometricAuth.ts | ✅ DONE | New utility created |
| Attendance.tsx | ⏳ PENDING | Replace face check with biometric |
| QuickAttendance.tsx | ⏳ PENDING | Replace face check with biometric |
| GPS Validation | ⏳ PENDING | Tighten radius + accuracy checks |

---

## Implementation Guide

### 1. Face Registration Page (✅ Completed)
File: `src/pages/FaceRegistration.tsx`
- Replaced entire page with "Coming Soon" UI
- Original code preserved in comments
- Users directed to use fingerprint biometric

### 2. Biometric Utility (✅ Completed)
File: `src/utils/biometricAuth.ts`
- Created WebAuthn-based biometric authentication
- Functions:
  - `isBiometricAvailable()` - Check device support
  - `authenticateBiometric()` - Verify user identity
  - `promptBiometricForAttendance()` - Quick attendance prompt

### 3. Attendance Page (⏳ To Do)
File: `src/pages/Attendance.tsx`

**Current Face-Based Flow:**
```typescript
// Lines 239-333: checkFaceMatch()
// Lines 335-415: openCamera() with face enrollment check
// Lines 425-457: runDetection() loop for face detection
// Lines 466-518: handleCapturePhoto() with face verification
```

**New Biometric Flow:**
```typescript
import { promptBiometricForAttendance } from '@/utils/biometricAuth';

// COMMENT OUT: Lines 239-333 (checkFaceMatch function)
// COMMENT OUT: Lines 83-84 (MediaPipe & FaceSystem imports)
// COMMENT OUT: Lines 107-111 (face recognition states)

// REPLACE openCamera() with openCameraForPhoto()
const openCameraForPhoto = async () => {
  try {
    if (!user) {
      toast({
        title: 'Error',
        description: 'User tidak ditemukan',
        variant: 'destructive'
      });
      return;
    }

    setCameraOpen(true);
    await startCamera();
    
    // Start location in background if not already available
    if (!latitude || !longitude) {
      getLocation();
    }
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

// REPLACE handleCapturePhoto()
const handleCapturePhoto = async () => {
  try {
    // BIOMETRIC CHECK FIRST
    toast({
      title: 'Verifikasi Identitas',
      description: 'Silakan gunakan sidik jari untuk verifikasi',
    });

    const bio

metricResult = await promptBiometricForAttendance();
    
    if (!biometricResult.success) {
      toast({
        title: 'Verifikasi Gagal',
        description: biometricResult.error || 'Sidik jari tidak cocok',
        variant: 'destructive'
      });
      return;
    }

    // SUCCESS - Capture photo
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip to correct mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedPhoto(blob);
        setPhotoPreview(URL.createObjectURL(blob));
      }
    }, 'image/jpeg', 0.95);

    stopCamera();
    setCameraOpen(false);

    toast({
      title: '✓ Verifikasi Berhasil',
      description: 'Identitas terverifikasi dengan aman',
      className: 'bg-green-600 text-white',
    });

  } catch (error) {
    console.error('Capture error:', error);
    toast({ 
      title: 'Gagal', 
      description: 'Gagal mengambil foto', 
      variant: 'destructive' 
    });
  }
};

// REMOVE: Lines 417-464 (runDetection useEffect - no longer needed)
```

**UI Changes:**
```typescript
// Change button text from "Ambil Foto & Verifikasi Wajah" to:
<Button onClick={handleCapturePhoto}>
  <Scan className="mr-2 h-4 w-4" />
  Ambil Foto & Verifikasi Sidik Jari
</Button>
```

### 4. Quick Attendance Page (⏳ To Do)
File: `src/pages/QuickAttendance.tsx`

**Similar changes as Attendance.tsx, but simplified:**
- Remove MediaPipe and FaceSystem imports
- Remove `checkFaceMatch()` function (lines 120-185)
- Remove face detection loop (lines 269-301)
- Replace face check in `handleCapture()` with biometric prompt

**Key difference:** Quick Attendance is for WFO only, so GPS validation should be STRICTER.

### 5. Tighten GPS Validation (⏳ To Do)

**Current Settings:**
```typescript
const MAX_RADIUS_M = 100; // 100 meters
```

**New Stricter Settings:**
```typescript
// In Attendance.tsx
const MAX_RADIUS_M = 50; // Reduced to 50 meters for WFO
const MIN_GPS_ACCURACY = 20; // Require accuracy better than 20 meters

// In QuickAttendance.tsx (even stricter)
const MAX_RADIUS = 30; // Only 30 meters for quick attendance
const MIN_GPS_ACCURACY = 15; // Require accuracy better than 15 meters
```

**Add Accuracy Check:**
```typescript
// In useGeolocation hook or validation logic
if (accuracy && accuracy > MIN_GPS_ACCURACY) {
  setIsLocationValid(false);
  setLocationErrorMsg(`Akurasi GPS tidak cukup (${Math.round(accuracy)}m). Diperlukan < ${MIN_GPS_ACCURACY}m.`);
  return;
}
```

**Anti-Mock GPS Enhancement:**
```typescript
// Existing check in Attendance.tsx line 536
if (isMocked) {
  toast({
    title: 'Fake GPS Terdeteksi!',
    description: 'Sistem mendeteksi manipulasi lokasi. Mohon gunakan GPS asli.',
    variant: 'destructive'
  });
  
  // LOG TO SECURITY TABLE
  await supabase.from('security_violations').insert({
    user_id: user.id,
    violation_type: 'fake_gps_detected',
    timestamp: new Date().toISOString(),
    latitude,
    longitude
  });
  
  return;
}
```

---

## Testing Checklist

### Biometric Authentication
- [ ] Test on Android device (Fingerprint)
- [ ] Test on iOS device (Touch ID/Face ID)
- [ ] Test on desktop (Windows Hello / Touch ID)
- [ ] Test biometric cancellation flow
- [ ] Test with biometric not enrolled

### GPS Validation
- [ ] Test within radius (should work)
- [ ] Test outside radius (should fail)
- [ ] Test with poor GPS accuracy (should fail)
- [ ] Test with mock GPS app (should detect and fail)
- [ ] Test WFH mode (should allow any location)

### Attendance Flow
- [ ] Clock in with biometric
- [ ] Clock out with biometric
- [ ] Photo capture works correctly
- [ ] Camera mirror is corrected
- [ ] Error messages are clear

---

## Rollback Plan

If biometric authentication has issues:

1. Uncomment face recognition code in `FaceRegistration.tsx` (lines are preserved)
2. Revert `Attendance.tsx` and `QuickAttendance.tsx` to Git history
3. Run: `git checkout HEAD -- src/pages/Attendance.tsx src/pages/QuickAttendance.tsx src/pages/FaceRegistration.tsx`

---

## Notes for Developer

### Why WebAuthn?
- **Native biometric**: Uses device's built-in fingerprint/face scanner
- **No ML models**: No tensor errors, smaller bundle size
- **Secure**: Private key never leaves device
- **Cross platform**: Works on Android, iOS, Windows, macOS

### Limitations
- **HTTPS required**: Won't work on HTTP (localhost is exception)
- **Browser support**: Requires modern browser (Chrome 67+, Safari 14+)
- **Enrollment**: Users must have biometric enrolled on their device
- **Fallback**: May need PIN/password fallback for devices without biometric

### Future Enhancements
1. Re-enable face recognition when tensor issues are resolved
2. Implement hybrid mode: biometric OR face (user's choice)
3. Add QR code attendance as backup option
4. Implement voice biometric for hands-free attendance

---

**Last Updated:** 2026-01-20 15:20 WIB  
**Updated By:** Antigravity AI Assistant  
**Status:** Implementation in progress...

import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  isMocked: boolean;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    isMocked: false,
    error: null,
    loading: false,
  });

  const getLocation = useCallback(async (retryCount = 0) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Check for permissions explicitly
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') {
            throw new Error('Akses Lokasi Ditolak. Mohon aktifkan izin lokasi di pengaturan HP Anda.');
          }
        }
      }

      // Get Position using Native Capacitor Geolocation
      // We increase timeout and use ForceRefresh if we can
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 20000, // Increase to 20s
        maximumAge: 0   // Force fresh location
      });

      const { latitude, longitude, accuracy } = position.coords;

      // Anti-Fake GPS Logic
      // @ts-ignore
      const isMocked = position.coords.isMocked || (position as any).extra?.isMocked || (position as any).mocked || false;

      setState({
        latitude,
        longitude,
        accuracy,
        isMocked,
        error: null,
        loading: false,
      });

      return { latitude, longitude, accuracy, isMocked };
    } catch (err: any) {
      console.error('GPS Fetch Error:', err);

      // Auto-retry once if it was a timeout
      if (retryCount < 1) {
        return getLocation(retryCount + 1);
      }

      let errorMessage = 'GPS tidak terkunci. Pastikan GPS HP Aktif dan Anda berada di area terbuka.';
      if (err.code === 1 || err.message?.includes('denied')) {
        errorMessage = 'Izin lokasi ditolak. Cek pengaturan aplikasi.';
      } else if (err.code === 3 || err.message?.includes('timeout')) {
        errorMessage = 'GPS Timeout. Sinyal GPS lemah, coba refresh kembali atau berpindah ke area terbuka.';
      }

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
      throw new Error(errorMessage);
    }
  }, []);

  return { ...state, getLocation };
}

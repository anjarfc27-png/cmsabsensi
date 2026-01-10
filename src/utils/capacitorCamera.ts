import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export async function takePhoto(): Promise<string> {
    try {
        // Check if running on native platform
        if (!Capacitor.isNativePlatform()) {
            throw new Error('Camera only works on native platforms');
        }

        const image = await Camera.getPhoto({
            quality: 90,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
            saveToGallery: false,
            correctOrientation: true,
            width: 640,
            height: 480,
        });

        if (!image.dataUrl) {
            throw new Error('Gagal mengambil foto');
        }

        return image.dataUrl;
    } catch (error: any) {
        console.error('Camera error:', error);

        if (error.message === 'User cancelled photos app') {
            throw new Error('Foto dibatalkan');
        }

        throw new Error(error.message || 'Gagal mengakses kamera');
    }
}

// Helper to convert dataUrl to Blob
export function dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }

    return new Blob([u8arr], { type: mime });
}

/**
 * BIOMETRIC FINGERPRINT AUTHENTICATION UTILITY
 * 
 * Uses Web Authentication API (WebAuthn) for fingerprint/biometric authentication
 * This provides device-level security using the platform's built-in authenticator
 * 
 * Supported platforms:
 * - Android (Fingerprint, Face, Pattern)
 * - iOS (Touch ID, Face ID)
 * - Windows (Windows Hello)
 * - macOS (Touch ID)
 */

import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

interface BiometricResult {
    success: boolean;
    error?: string;
    credential?: PublicKeyCredential;
}

/**
 * Check if biometric authentication is available on this device/browser
 */
export async function isBiometricAvailable(): Promise<boolean> {
    // Check for Native Platform (APK)
    if (Capacitor.isNativePlatform()) {
        try {
            const result = await NativeBiometric.isAvailable();
            return result.isAvailable;
        } catch {
            return false;
        }
    }

    // Fallback for Web/Browser
    if (!window.PublicKeyCredential) {
        return false;
    }

    try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
    } catch (error) {
        console.error('Error checking biometric availability:', error);
        return false;
    }
}

/**
 * Register/enroll a new biometric credential for the user
 * This should be done once during setup or when the user wants to enable biometric auth
 */
export async function registerBiometric(userId: string, userName: string): Promise<BiometricResult> {
    try {
        const available = await isBiometricAvailable();
        if (!available) {
            return {
                success: false,
                error: 'Biometric authentication not available on this device'
            };
        }

        // Generate a challenge (in production, this should come from your server)
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
                name: "CMS Absensi",
                id: window.location.hostname,
            },
            user: {
                id: new TextEncoder().encode(userId),
                name: userName,
                displayName: userName,
            },
            pubKeyCredParams: [
                { alg: -7, type: "public-key" },  // ES256
                { alg: -257, type: "public-key" } // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform", // Require built-in authenticator
                userVerification: "required",        // Require biometric verification
                requireResidentKey: false,
            },
            timeout: 60000,
            attestation: "none"
        };

        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
        }) as PublicKeyCredential;

        return {
            success: true,
            credential
        };

    } catch (error: any) {
        console.error('Biometric registration error:', error);
        return {
            success: false,
            error: error.message || 'Failed to register biometric'
        };
    }
}

/**
 * Authenticate using biometric (fingerprint/face/etc)
 * This is the main function used for attendance verification
 */
export async function authenticateBiometric(userId: string): Promise<BiometricResult> {
    try {
        const available = await isBiometricAvailable();
        if (!available) {
            return {
                success: false,
                error: 'Biometric authentication tidak tersedia di perangkat ini'
            };
        }

        // --- NATIVE PLATFORM (APK) LOGIC ---
        if (Capacitor.isNativePlatform()) {
            try {
                await NativeBiometric.verifyIdentity({
                    reason: "Verifikasi Kehadiran Anda",
                    title: "Konfirmasi Absensi",
                    subtitle: "Gunakan Sidik Jari (Fingerprint) untuk melanjutkan",
                    description: "Tempelkan jari anda pada sensor",
                    negativeButtonText: "Batal"
                });
                return { success: true };
            } catch (nativeError: any) {
                return {
                    success: false,
                    error: nativeError.message || 'Verifikasi biometrik dibatalkan'
                };
            }
        }

        // --- WEB BROWSER LOGIC (WebAuthn) ---
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
            challenge,
            timeout: 60000,
            userVerification: "required",
            rpId: window.location.hostname,
        };

        const credential = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions
        }) as PublicKeyCredential;

        if (!credential) {
            return {
                success: false,
                error: 'Authentication cancelled'
            };
        }

        return {
            success: true,
            credential
        };

    } catch (error: any) {
        console.error('Biometric authentication error:', error);
        let errorMessage = 'Verifikasi sidik jari gagal';

        if (error.name === 'NotAllowedError') {
            errorMessage = 'Autentikasi dibatalkan atau tidak diizinkan';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Biometric tidak didukung di perangkat ini';
        } else if (error.message) {
            errorMessage = error.message;
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Quick biometric prompt with user-friendly messaging
 * Use this for attendance check-in/check-out
 */
export async function promptBiometricForAttendance(): Promise<BiometricResult> {
    const result = await authenticateBiometric('attendance-check');

    if (!result.success) {
        // Fallback: If WebAuthn not available, try to prompt native biometric via Capacitor
        // This requires @capacitor/biometric or similar plugin
        // For now, we return the error
        return result;
    }

    return result;
}

/**
 * Get the type of biometric authenticator available
 * Returns: "fingerprint", "face", "iris", "voice", "unknown"
 */
export async function getBiometricType(): Promise<string> {
    // Note: WebAuthn API doesn't expose the exact biometric type
    // We can only know that "platform authenticator" is available
    // The actual method (fingerprint vs face) is abstracted by the browser/OS

    const available = await isBiometricAvailable();
    if (!available) return "none";

    // On mobile, it's usually fingerprint or face
    // We can make an educated guess based on user agent
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('android')) {
        return "fingerprint"; // Most Android devices use fingerprint primarily
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
        // iPhone X and newer use Face ID, older use Touch ID
        // But we can't determine this precisely without native code
        return "biometric"; // Generic term
    }

    return "biometric";
}

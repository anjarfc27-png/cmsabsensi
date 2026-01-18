/**
 * Blink Detection Utility
 * Detects eye blinks from face landmarks to prevent photo/video spoofing
 */

import * as faceapi from 'face-api.js';

// Eye Aspect Ratio threshold for blink detection
const EAR_THRESHOLD = 0.21; // Below this = eyes closed

/**
 * Calculate Eye Aspect Ratio (EAR)
 * Lower value = eyes more closed
 */
function calculateEAR(eye: faceapi.Point[]): number {
    // Vertical distances
    const ver1 = euclideanDistance(eye[1], eye[5]);
    const ver2 = euclideanDistance(eye[2], eye[4]);

    // Horizontal distance
    const hor = euclideanDistance(eye[0], eye[3]);

    // EAR formula
    const ear = (ver1 + ver2) / (2.0 * hor);
    return ear;
}

function euclideanDistance(p1: faceapi.Point, p2: faceapi.Point): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Detect if eyes are closed based on landmarks
 */
export function detectEyesClosed(landmarks: faceapi.FaceLandmarks68): boolean {
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const leftEAR = calculateEAR(leftEye);
    const rightEAR = calculateEAR(rightEye);

    const avgEAR = (leftEAR + rightEAR) / 2.0;

    return avgEAR < EAR_THRESHOLD;
}

/**
 * Blink Detection State Manager
 */
export class BlinkDetector {
    private eyesClosedFrames = 0;
    private eyesOpenFrames = 0;
    private blinkCount = 0;
    private readonly CLOSED_FRAMES_THRESHOLD = 2; // Must be closed for 2 frames
    private readonly OPEN_FRAMES_THRESHOLD = 2; // Must be open for 2 frames

    /**
     * Process new frame and update blink count
     */
    public processFrame(landmarks: faceapi.FaceLandmarks68): void {
        const eyesClosed = detectEyesClosed(landmarks);

        if (eyesClosed) {
            this.eyesClosedFrames++;
            this.eyesOpenFrames = 0;
        } else {
            this.eyesOpenFrames++;

            // If eyes were closed and now open = blink completed
            if (this.eyesClosedFrames >= this.CLOSED_FRAMES_THRESHOLD) {
                this.blinkCount++;
                console.log('👁️ Blink detected! Total:', this.blinkCount);
            }

            this.eyesClosedFrames = 0;
        }
    }

    /**
     * Get current blink count
     */
    public getBlinkCount(): number {
        return this.blinkCount;
    }

    /**
     * Reset detector
     */
    public reset(): void {
        this.eyesClosedFrames = 0;
        this.eyesOpenFrames = 0;
        this.blinkCount = 0;
    }

    /**
     * Check if eyes are currently closed
     */
    public areEyesClosed(): boolean {
        return this.eyesClosedFrames >= this.CLOSED_FRAMES_THRESHOLD;
    }
}

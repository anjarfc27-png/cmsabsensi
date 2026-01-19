import { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export class MediaPipeBlinkDetector {
    private blinkCount = 0;
    private wasBlinking = false;
    private readonly blinkThreshold = 0.3;
    private readonly cooldownFrames = 5;
    private currentCooldown = 0;

    reset() {
        this.blinkCount = 0;
        this.wasBlinking = false;
        this.currentCooldown = 0;
    }

    processFrame(result: FaceLandmarkerResult): void {
        if (!result.faceBlendshapes || result.faceBlendshapes.length === 0) {
            return;
        }

        const blendshapes = result.faceBlendshapes[0].categories;

        const leftEyeBlink = blendshapes.find(cat => cat.categoryName === 'eyeBlinkLeft');
        const rightEyeBlink = blendshapes.find(cat => cat.categoryName === 'eyeBlinkRight');

        const leftScore = leftEyeBlink?.score || 0;
        const rightScore = rightEyeBlink?.score || 0;

        // Average of both eyes
        const blinkScore = (leftScore + rightScore) / 2;

        const isBlinking = blinkScore > this.blinkThreshold;

        // Cooldown to prevent counting rapid fluctuations as multiple blinks
        if (this.currentCooldown > 0) {
            this.currentCooldown--;
            return;
        }

        // Detect blink transition (closed -> open)
        if (this.wasBlinking && !isBlinking) {
            this.blinkCount++;
            this.currentCooldown = this.cooldownFrames;
            console.log(`👁️ Blink detected! Total: ${this.blinkCount}`);
        }

        this.wasBlinking = isBlinking;
    }

    getBlinkCount(): number {
        return this.blinkCount;
    }

    areEyesClosed(result: FaceLandmarkerResult): boolean {
        if (!result.faceBlendshapes || result.faceBlendshapes.length === 0) {
            return false;
        }

        const blendshapes = result.faceBlendshapes[0].categories;

        const leftEyeBlink = blendshapes.find(cat => cat.categoryName === 'eyeBlinkLeft');
        const rightEyeBlink = blendshapes.find(cat => cat.categoryName === 'eyeBlinkRight');

        const leftScore = leftEyeBlink?.score || 0;
        const rightScore = rightEyeBlink?.score || 0;

        const blinkScore = (leftScore + rightScore) / 2;

        return blinkScore > this.blinkThreshold;
    }

    getBlinkScore(result: FaceLandmarkerResult): number {
        if (!result.faceBlendshapes || result.faceBlendshapes.length === 0) {
            return 0;
        }

        const blendshapes = result.faceBlendshapes[0].categories;

        const leftEyeBlink = blendshapes.find(cat => cat.categoryName === 'eyeBlinkLeft');
        const rightEyeBlink = blendshapes.find(cat => cat.categoryName === 'eyeBlinkRight');

        const leftScore = leftEyeBlink?.score || 0;
        const rightScore = rightEyeBlink?.score || 0;

        return (leftScore + rightScore) / 2;
    }
}

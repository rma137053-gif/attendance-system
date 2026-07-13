import { useRef, useCallback, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string>('');
  const [isNative, _] = useState(isCapacitor);
  const [streamReady, setStreamReady] = useState(false);

  const startCamera = useCallback(async () => {
    if (isNative) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStreamReady(true);
    } catch {
      // getUserMedia failed — will use <input capture> fallback
      setStreamReady(false);
    }
  }, [isNative]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(async (): Promise<File | null> => {
    if (isNative) {
      try {
        const image = await Camera.getPhoto({
          quality: 85,
          allowEditing: false,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
        });
        const byteChars = atob(image.base64String!);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNums[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/jpeg' });
        return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      } catch (err: any) {
        if (!err.message?.includes('cancel')) {
          setError('拍照失败，请重试');
        }
        return null;
      }
    }

    // Browser: try getUserMedia canvas capture first
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        return new Promise<File | null>((resolve) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
            } else {
              resolve(null);
            }
          }, 'image/jpeg', 0.85);
        });
      }
    }

    // Fallback: use <input type="file" capture> for mobile browsers
    return new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      inputRef.current = input;
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          resolve(file);
        } else {
          resolve(null);
        }
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  }, [isNative]);

  return { videoRef, inputRef, error, isNative, streamReady, startCamera, stopCamera, capturePhoto };
}

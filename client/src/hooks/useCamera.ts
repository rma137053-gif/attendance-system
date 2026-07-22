import { useRef, useCallback, useState, useEffect } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const isCapacitor = typeof (window as any).Capacitor !== 'undefined';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingResolve = useRef<((file: File | null) => void) | null>(null);
  const [error, setError] = useState<string>('');
  const [isNative, _] = useState(isCapacitor);
  const [streamReady, setStreamReady] = useState(false);

  // Assign the stream to the video element once it renders
  useEffect(() => {
    if (streamReady && streamRef.current && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [streamReady]);

  const startCamera = useCallback(async () => {
    if (isNative) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setStreamReady(true);
    } catch {
      setStreamReady(false);
    }
  }, [isNative]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Called by the file input's onChange — resolves the pending capturePhoto promise
  const handleFileInputChange = useCallback(() => {
    const input = fileInputRef.current;
    const file = input?.files?.[0] ?? null;
    if (pendingResolve.current) {
      pendingResolve.current(file);
      pendingResolve.current = null;
    }
    if (input) input.value = '';
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

    // Fallback: trigger the DOM-rendered file input synchronously
    return new Promise<File | null>((resolve) => {
      pendingResolve.current = resolve;
      fileInputRef.current?.click();
    });
  }, [isNative]);

  return {
    videoRef,
    fileInputRef,
    error,
    isNative,
    streamReady,
    startCamera,
    stopCamera,
    capturePhoto,
    handleFileInputChange,
  };
}

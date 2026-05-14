import { useRef, useCallback, useState } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  const startCamera = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('无法访问摄像头，请检查权限设置');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(async (): Promise<File | null> => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
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
  }, []);

  return { videoRef, error, startCamera, stopCamera, capturePhoto };
}

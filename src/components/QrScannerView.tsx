import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, CameraOff, Loader2 } from 'lucide-react';

type CameraState = 'requesting' | 'active' | 'denied' | 'error';

interface QrScannerViewProps {
  onScan: (decodedText: string) => void;
  paused?: boolean;
}

export default function QrScannerView({ onScan, paused }: QrScannerViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (paused) return;

    const containerId = 'qr-scanner-region';
    let mounted = true;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.333,
          },
          (decodedText) => {
            if (mounted) {
              onScanRef.current(decodedText);
            }
          },
          () => {} // ignore scan failures (continuous scanning)
        );

        if (mounted) setCameraState('active');
      } catch (err: any) {
        if (!mounted) return;
        const msg = String(err?.message || err || '');
        if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setCameraState('denied');
        } else {
          setCameraState('error');
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            scanner.stop().catch(() => {});
          }
        } catch {
          // ignore
        }
        scannerRef.current = null;
      }
    };
  }, [paused]);

  if (paused) {
    return (
      <div className="relative bg-muted aspect-[4/3] flex items-center justify-center rounded-lg">
        <Camera className="h-10 w-10 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden bg-black">
      {/* Camera feed renders here */}
      <div id="qr-scanner-region" className="w-full" />

      {/* Overlay states */}
      {cameraState === 'requesting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Uruchamiam kamerę...</p>
        </div>
      )}

      {(cameraState === 'denied' || cameraState === 'error') && (
        <div className="aspect-[4/3] flex flex-col items-center justify-center bg-muted gap-3 p-6">
          <CameraOff className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-muted-foreground">
            {cameraState === 'denied' ? 'Brak dostępu do kamery' : 'Nie można uruchomić kamery'}
          </p>
          <p className="text-xs text-muted-foreground/70 text-center">
            Użyj wyszukiwania ręcznego powyżej
          </p>
        </div>
      )}

      {/* Corner markers overlay when active */}
      {cameraState === 'active' && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-4">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
          </div>
        </div>
      )}
    </div>
  );
}

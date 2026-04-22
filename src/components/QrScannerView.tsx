import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, CameraOff, Loader2 } from 'lucide-react';

type CameraState = 'requesting' | 'active' | 'denied' | 'error';

interface QrScannerViewProps {
  onScan: (decodedText: string) => void;
  paused?: boolean;
}

const SCANNER_REGION_ID = 'qr-scanner-region';

function computeQrBox(viewfinderWidth: number, viewfinderHeight: number) {
  const shortestEdge = Math.min(viewfinderWidth, viewfinderHeight);
  const boxSize = Math.max(180, Math.min(Math.floor(shortestEdge * 0.72), 280));

  return { width: boxSize, height: boxSize };
}

async function ensureVideoPlayback(container: HTMLDivElement | null) {
  const video = container?.querySelector('video');
  if (!(video instanceof HTMLVideoElement)) {
    return;
  }

  video.setAttribute('playsinline', 'true');
  video.setAttribute('muted', 'true');
  video.setAttribute('autoplay', 'true');
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.style.backgroundColor = '#000';

  try {
    await video.play();
  } catch {
    // Some browsers reject a redundant play() call even when the stream is valid.
  }
}

export default function QrScannerView({ onScan, paused }: QrScannerViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (paused) return;

    let mounted = true;

    setCameraState('requesting');

    const startScanner = async () => {
      const onScanSuccess = (decodedText: string) => {
        if (mounted) {
          onScanRef.current(decodedText);
        }
      };

      const startAttempts: Array<() => Promise<Html5Qrcode>> = [
        async () => {
          const scanner = new Html5Qrcode(SCANNER_REGION_ID);
          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              disableFlip: false,
              qrbox: computeQrBox,
              videoConstraints: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            },
            onScanSuccess,
            () => {},
          );
          return scanner;
        },
        async () => {
          const scanner = new Html5Qrcode(SCANNER_REGION_ID);
          await scanner.start(
            { facingMode: 'environment' },
            {
              fps: 10,
              disableFlip: false,
              qrbox: computeQrBox,
            },
            onScanSuccess,
            () => {},
          );
          return scanner;
        },
        async () => {
          const cameras = await Html5Qrcode.getCameras();
          const preferredCamera = cameras.find(camera => /back|rear|environment/i.test(camera.label)) ?? cameras.at(-1);
          if (!preferredCamera) {
            throw new Error('No camera devices available.');
          }

          const scanner = new Html5Qrcode(SCANNER_REGION_ID);
          await scanner.start(
            preferredCamera.id,
            {
              fps: 10,
              disableFlip: false,
              qrbox: computeQrBox,
            },
            onScanSuccess,
            () => {},
          );
          return scanner;
        },
      ];

      try {
        let lastError: unknown = null;

        for (const startAttempt of startAttempts) {
          if (!mounted) {
            return;
          }

          try {
            const scanner = await startAttempt();
            scannerRef.current = scanner;
            await ensureVideoPlayback(containerRef.current);

            if (mounted) {
              setCameraState('active');
            }
            return;
          } catch (error) {
            lastError = error;
            scannerRef.current = null;
          }
        }

        throw lastError ?? new Error('Unable to start the QR scanner.');
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
      scannerRef.current = null;
      if (scanner) {
        try {
          const state = scanner.getState();
          if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
            scanner.stop()
              .catch(() => {})
              .finally(() => {
                try {
                  scanner.clear();
                } catch {
                  // ignore
                }
              });
          } else {
            scanner.clear();
          }
        } catch {
          // ignore
        }
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
    <div className="relative rounded-lg bg-black">
      {/* Camera feed renders here */}
      <div ref={containerRef} id={SCANNER_REGION_ID} className="qr-scanner-region w-full" />

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

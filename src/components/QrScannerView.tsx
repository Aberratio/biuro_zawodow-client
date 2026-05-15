import { useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeCameraScanConfig,
} from 'html5-qrcode';
import { Camera, CameraOff, Loader2 } from 'lucide-react';

type CameraState = 'requesting' | 'active' | 'denied' | 'error';

interface QrScannerViewProps {
  onScan: (decodedText: string) => void | Promise<void>;
  paused?: boolean;
}

const SCANNER_REGION_ID = 'qr-scanner-region';
const START_RECOVERY_DELAY_MS = 700;
const START_TIMEOUT_MS = 6500;
const SCAN_LOCK_RELEASE_DELAY_MS = 250;

const scannerConfig = {
  formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
  verbose: false,
};

const baseScanConfig: Html5QrcodeCameraScanConfig = {
  fps: 10,
  disableFlip: true,
  qrbox: computeQrBox,
};

function isRearCameraLabel(label: string) {
  return /back|rear|environment/i.test(label);
}

function computeQrBox(viewfinderWidth: number, viewfinderHeight: number) {
  const shortestEdge = Math.min(viewfinderWidth, viewfinderHeight);
  const boxSize = Math.max(180, Math.min(Math.floor(shortestEdge * 0.72), 280));

  return { width: boxSize, height: boxSize };
}

function prepareVideoElement(video: HTMLVideoElement) {
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('muted', 'true');
  video.setAttribute('autoplay', 'true');
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.objectFit = 'cover';
  video.style.backgroundColor = '#000';
}

async function ensureVideoPlayback(container: HTMLDivElement | null) {
  const video = container?.querySelector('video');
  if (!(video instanceof HTMLVideoElement)) {
    return;
  }

  prepareVideoElement(video);

  try {
    await video.play();
  } catch {
    // Some browsers reject a redundant play() call even when the stream is valid.
  }
}

function stopContainerVideoTracks(container: HTMLDivElement | null) {
  const videos = container?.querySelectorAll('video') ?? [];
  videos.forEach(video => {
    const stream = video.srcObject;
    if (typeof MediaStream !== 'undefined' && stream instanceof MediaStream) {
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  });
}

async function cleanupScanner(scanner: Html5Qrcode, container: HTMLDivElement | null) {
  try {
    const state = scanner.getState();
    if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
      await scanner.stop();
    } else {
      stopContainerVideoTracks(container);
    }
  } catch {
    stopContainerVideoTracks(container);
  }

  try {
    scanner.clear();
  } catch {
    // ignore
  }
}

async function startWithVideoRecovery(
  scanner: Html5Qrcode,
  cameraIdOrConfig: string | MediaTrackConstraints,
  configuration: Html5QrcodeCameraScanConfig,
  onScanSuccess: (decodedText: string) => void,
  container: HTMLDivElement | null,
) {
  const recoveryTimer = window.setTimeout(() => {
    void ensureVideoPlayback(container);
  }, START_RECOVERY_DELAY_MS);

  let startTimeout: number | undefined;

  try {
    await Promise.race([
      scanner.start(cameraIdOrConfig, configuration, onScanSuccess, () => {}),
      new Promise<never>((_, reject) => {
        startTimeout = window.setTimeout(() => {
          stopContainerVideoTracks(container);
          reject(new Error('QR scanner camera start timed out.'));
        }, START_TIMEOUT_MS);
      }),
    ]);
  } finally {
    window.clearTimeout(recoveryTimer);
    if (startTimeout !== undefined) {
      window.clearTimeout(startTimeout);
    }
  }
}

export default function QrScannerView({ onScan, paused }: QrScannerViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const onScanRef = useRef(onScan);
  const scanInProgressRef = useRef(false);
  onScanRef.current = onScan;

  useEffect(() => {
    if (paused) return;

    let mounted = true;
    const scannerContainer = containerRef.current;

    setCameraState('requesting');

    const startScanner = async () => {
      const onScanSuccess = (decodedText: string) => {
        if (!mounted || scanInProgressRef.current) {
          return;
        }

        scanInProgressRef.current = true;
        Promise.resolve(onScanRef.current(decodedText))
          .catch(() => {})
          .finally(() => {
            window.setTimeout(() => {
              scanInProgressRef.current = false;
            }, SCAN_LOCK_RELEASE_DELAY_MS);
          });
      };

      const startAttempts: Array<() => Promise<void>> = [
        async () => {
          const scanner = new Html5Qrcode(SCANNER_REGION_ID, scannerConfig);
          scannerRef.current = scanner;
          await startWithVideoRecovery(
            scanner,
            { facingMode: 'environment' },
            {
              ...baseScanConfig,
              videoConstraints: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 15, max: 30 },
              },
            },
            onScanSuccess,
            scannerContainer,
          );
        },
        async () => {
          const scanner = new Html5Qrcode(SCANNER_REGION_ID, scannerConfig);
          scannerRef.current = scanner;
          await startWithVideoRecovery(
            scanner,
            { facingMode: 'environment' },
            baseScanConfig,
            onScanSuccess,
            scannerContainer,
          );
        },
        async () => {
          const cameras = await Html5Qrcode.getCameras();
          const preferredCamera = cameras.find(camera => isRearCameraLabel(camera.label)) ?? cameras[cameras.length - 1];
          if (!preferredCamera) {
            throw new Error('No camera devices available.');
          }

          const scanConfig = isRearCameraLabel(preferredCamera.label)
            ? baseScanConfig
            : { ...baseScanConfig, disableFlip: false };

          const scanner = new Html5Qrcode(SCANNER_REGION_ID, scannerConfig);
          scannerRef.current = scanner;
          await startWithVideoRecovery(
            scanner,
            preferredCamera.id,
            scanConfig,
            onScanSuccess,
            scannerContainer,
          );
        },
      ];

      try {
        let lastError: unknown = null;

        for (const startAttempt of startAttempts) {
          if (!mounted) {
            return;
          }

          try {
            await startAttempt();
            await ensureVideoPlayback(scannerContainer);

            if (mounted) {
              setCameraState('active');
            }
            return;
          } catch (error) {
            lastError = error;
            const scanner = scannerRef.current;
            scannerRef.current = null;
            if (scanner) {
              await cleanupScanner(scanner, scannerContainer);
            } else {
              stopContainerVideoTracks(scannerContainer);
            }
          }
        }

        throw lastError ?? new Error('Unable to start the QR scanner.');
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : String(err || '');
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
        void cleanupScanner(scanner, scannerContainer);
      } else {
        stopContainerVideoTracks(scannerContainer);
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

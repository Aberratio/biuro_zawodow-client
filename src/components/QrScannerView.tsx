import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeScannerState,
  Html5QrcodeSupportedFormats,
  type Html5QrcodeCameraScanConfig,
  type Html5QrcodeFullConfig,
} from 'html5-qrcode';
import { Camera, CameraOff, Loader2, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

type CameraState = 'requesting' | 'active' | 'denied' | 'error';
type QrScannerScanResult = string | { data: string };
type QrScannerOptions = {
  preferredCamera?: 'environment' | 'user';
  maxScansPerSecond?: number;
  returnDetailedScanResult?: boolean;
  onDecodeError?: (error: unknown) => void;
  calculateScanRegion?: (video: HTMLVideoElement) => {
    x: number;
    y: number;
    width: number;
    height: number;
    downScaledWidth: number;
    downScaledHeight: number;
  };
};
type QrScannerInstance = {
  start: () => Promise<void>;
  stop: () => void;
  destroy: () => void;
  setInversionMode: (mode: 'original' | 'invert' | 'both') => void;
};
type QrScannerConstructor = {
  new (
    video: HTMLVideoElement,
    onDecode: (result: QrScannerScanResult) => void,
    options?: QrScannerOptions,
  ): QrScannerInstance;
  scanImage: (
    image: File | Blob | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | string,
    options?: {
      alsoTryWithoutScanRegion?: boolean;
      returnDetailedScanResult?: boolean;
    },
  ) => Promise<QrScannerScanResult>;
};

interface QrScannerViewProps {
  onScan: (decodedText: string) => void | Promise<void>;
  paused?: boolean;
}

const SCANNER_REGION_ID_PREFIX = 'qr-scanner-region';
const QR_SCANNER_MODULE_PATH = '/vendor/qr-scanner/qr-scanner.min.js';
const START_RECOVERY_DELAY_MS = 700;
const START_TIMEOUT_MS = 6500;
const SCAN_LOCK_RELEASE_DELAY_MS = 250;
const TARGET_CAMERA_ASPECT_RATIO = 4 / 3;

let scannerRegionSequence = 0;

class ScannerStartTimeoutError extends Error {
  constructor() {
    super('QR scanner camera start timed out.');
    this.name = 'ScannerStartTimeoutError';
  }
}

function isRearCameraLabel(label: string) {
  return /back|rear|environment/i.test(label);
}

function isAppleMobileBrowser() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isCameraPermissionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes('NotAllowedError') || message.includes('Permission') || message.includes('permission denied');
}

function canUseNativeBarcodeDetector() {
  return typeof window !== 'undefined'
    && !isAppleMobileBrowser()
    && 'BarcodeDetector' in window;
}

function createScannerConfig(): Html5QrcodeFullConfig {
  return {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    useBarCodeDetectorIfSupported: canUseNativeBarcodeDetector(),
    verbose: false,
  };
}

function createBaseScanConfig(): Html5QrcodeCameraScanConfig {
  const isAppleMobile = isAppleMobileBrowser();
  const useNativeDetector = canUseNativeBarcodeDetector();

  return {
    fps: isAppleMobile ? 8 : useNativeDetector ? 18 : 10,
    aspectRatio: TARGET_CAMERA_ASPECT_RATIO,
    disableFlip: !isAppleMobile,
    ...(isAppleMobile ? {} : { qrbox: computeQrBox }),
  };
}

function createPreferredVideoConstraints(): MediaTrackConstraints {
  const isAppleMobile = isAppleMobileBrowser();
  const useNativeDetector = canUseNativeBarcodeDetector();

  return {
    facingMode: 'environment',
    width: { ideal: useNativeDetector ? 960 : 1280 },
    height: { ideal: useNativeDetector ? 720 : 960 },
    aspectRatio: { ideal: TARGET_CAMERA_ASPECT_RATIO },
    frameRate: isAppleMobile ? { ideal: 10, max: 24 } : { ideal: useNativeDetector ? 30 : 15, max: 30 },
    advanced: [
      {
        focusMode: 'continuous',
        exposureMode: 'continuous',
      } as MediaTrackConstraintSet,
    ],
  };
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

function createScannerRegion(container: HTMLDivElement | null) {
  if (!container) {
    throw new Error('QR scanner container is not available.');
  }

  stopContainerVideoTracks(container);
  container.replaceChildren();

  const region = document.createElement('div');
  scannerRegionSequence += 1;
  region.id = `${SCANNER_REGION_ID_PREFIX}-${scannerRegionSequence}`;
  container.appendChild(region);

  return region;
}

function removeScannerRegion(region: HTMLDivElement | null) {
  if (!region) {
    return;
  }

  stopContainerVideoTracks(region);
  region.remove();
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
  const startPromise = scanner.start(cameraIdOrConfig, configuration, onScanSuccess, () => {});

  try {
    await Promise.race([
      startPromise,
      new Promise<never>((_, reject) => {
        startTimeout = window.setTimeout(() => {
          stopContainerVideoTracks(container);
          reject(new ScannerStartTimeoutError());
        }, START_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    if (error instanceof ScannerStartTimeoutError) {
      void startPromise
        .then(() => cleanupScanner(scanner, container))
        .catch(() => stopContainerVideoTracks(container));
    }

    throw error;
  } finally {
    window.clearTimeout(recoveryTimer);
    if (startTimeout !== undefined) {
      window.clearTimeout(startTimeout);
    }
  }
}

async function loadQrScanner() {
  const scannerModulePath = QR_SCANNER_MODULE_PATH;
  const scannerModule = await import(/* @vite-ignore */ scannerModulePath) as { default: QrScannerConstructor };

  return scannerModule.default;
}

function getQrScannerResultText(result: QrScannerScanResult) {
  return typeof result === 'string' ? result : result.data;
}

function CameraProblemOverlay({
  cameraState,
  onRetry,
}: {
  cameraState: Exclude<CameraState, 'requesting' | 'active'>;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-3 p-6">
      <CameraOff className="h-10 w-10 text-muted-foreground/50" />
      <p className="text-sm font-semibold text-muted-foreground">
        {cameraState === 'denied' ? 'Brak dostępu do kamery' : 'Nie można uruchomić kamery'}
      </p>
      <p className="max-w-xs text-center text-xs leading-5 text-muted-foreground/75">
        {cameraState === 'denied'
          ? 'Zezwól na kamerę w ustawieniach strony lub aplikacji, a potem sprawdź ponownie.'
          : 'Sprawdź, czy kamera nie jest używana przez inną aplikację, albo zeskanuj kod ze zdjęcia.'}
      </p>
      <Button type="button" size="sm" variant="outline" className="bg-background/95" onClick={onRetry}>
        <RotateCcw className="mr-2 h-4 w-4" />
        Sprawdź ponownie
      </Button>
    </div>
  );
}

function createAppleScanRegion(video: HTMLVideoElement) {
  const videoWidth = video.videoWidth || 1000;
  const videoHeight = video.videoHeight || 750;
  const shortestEdge = Math.min(videoWidth, videoHeight);
  const size = Math.round(shortestEdge * 0.86);

  return {
    x: Math.round((videoWidth - size) / 2),
    y: Math.round((videoHeight - size) / 2),
    width: size,
    height: size,
    downScaledWidth: 700,
    downScaledHeight: 700,
  };
}

function AppleQrScannerView({ onScan, paused }: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<QrScannerInstance | null>(null);
  const scannerClassRef = useRef<QrScannerConstructor | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const onScanRef = useRef(onScan);
  const scanInProgressRef = useRef(false);
  onScanRef.current = onScan;

  const emitScan = useCallback((decodedText: string) => {
    if (scanInProgressRef.current) {
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
  }, []);

  const handleFileScan = useCallback(async (file: File | undefined) => {
    if (!file || scanInProgressRef.current) {
      return;
    }

    setIsFileScanning(true);
    scanInProgressRef.current = true;

    try {
      const QrScanner = scannerClassRef.current ?? await loadQrScanner();
      scannerClassRef.current = QrScanner;
      const result = await QrScanner.scanImage(file, {
        alsoTryWithoutScanRegion: true,
        returnDetailedScanResult: true,
      });
      await Promise.resolve(onScanRef.current(getQrScannerResultText(result)));
    } catch {
      setCameraState(previousState => (previousState === 'active' ? previousState : 'error'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      window.setTimeout(() => {
        scanInProgressRef.current = false;
      }, SCAN_LOCK_RELEASE_DELAY_MS);
      setIsFileScanning(false);
    }
  }, []);

  useEffect(() => {
    if (paused) return;

    let mounted = true;
    const video = videoRef.current;

    if (!video) {
      setCameraState('error');
      return;
    }

    prepareVideoElement(video);
    setCameraState('requesting');

    const startScanner = async () => {
      try {
        const QrScanner = await loadQrScanner();
        if (!mounted) {
          return;
        }

        scannerClassRef.current = QrScanner;
        const scanner = new QrScanner(
          video,
          result => {
            if (!mounted) {
              return;
            }

            emitScan(getQrScannerResultText(result));
          },
          {
            preferredCamera: 'environment',
            maxScansPerSecond: 12,
            returnDetailedScanResult: true,
            calculateScanRegion: createAppleScanRegion,
            onDecodeError: () => {},
          },
        );

        scannerRef.current = scanner;
        scanner.setInversionMode('both');
        await scanner.start();

        if (mounted) {
          setCameraState('active');
        }
      } catch (err: unknown) {
        if (!mounted) return;
        if (isCameraPermissionError(err)) {
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
        scanner.destroy();
      } else {
        stopContainerVideoTracks(video.parentElement instanceof HTMLDivElement ? video.parentElement : null);
      }
    };
  }, [emitScan, paused, retryNonce]);

  if (paused) {
    return (
      <div className="relative bg-muted aspect-[4/3] flex items-center justify-center rounded-lg">
        <Camera className="h-10 w-10 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      <div className="qr-scanner-region w-full">
        <video ref={videoRef} className="h-full w-full bg-black object-cover" />
      </div>

      {cameraState === 'requesting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Uruchamiam kamerę...</p>
        </div>
      )}

      {(cameraState === 'denied' || cameraState === 'error') && (
        <CameraProblemOverlay cameraState={cameraState} onRetry={() => setRetryNonce(previous => previous + 1)} />
      )}

      <div className="absolute inset-x-3 bottom-3 z-10 flex justify-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={event => void handleFileScan(event.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="bg-background/95 shadow"
          onClick={() => fileInputRef.current?.click()}
          disabled={isFileScanning}
        >
          {isFileScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Skanuj ze zdjęcia
        </Button>
      </div>

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

function Html5QrcodeScannerView({ onScan, paused }: QrScannerViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRegionRef = useRef<HTMLDivElement | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('requesting');
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const onScanRef = useRef(onScan);
  const scanInProgressRef = useRef(false);
  onScanRef.current = onScan;

  const handleFileScan = useCallback(async (file: File | undefined) => {
    if (!file || scanInProgressRef.current) {
      return;
    }

    setIsFileScanning(true);
    scanInProgressRef.current = true;

    try {
      const QrScanner = await loadQrScanner();
      const result = await QrScanner.scanImage(file, {
        alsoTryWithoutScanRegion: true,
        returnDetailedScanResult: true,
      });
      await Promise.resolve(onScanRef.current(getQrScannerResultText(result)));
    } catch {
      setCameraState(previousState => (previousState === 'active' ? previousState : 'error'));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      window.setTimeout(() => {
        scanInProgressRef.current = false;
      }, SCAN_LOCK_RELEASE_DELAY_MS);
      setIsFileScanning(false);
    }
  }, []);

  useEffect(() => {
    if (paused) return;

    let mounted = true;
    const scannerContainer = containerRef.current;

    setCameraState('requesting');

    const startScanner = async () => {
      const baseScanConfig = createBaseScanConfig();
      const currentScannerConfig = createScannerConfig();

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
          const scannerRegion = createScannerRegion(scannerContainer);
          scannerRegionRef.current = scannerRegion;
          const scanner = new Html5Qrcode(scannerRegion.id, currentScannerConfig);
          scannerRef.current = scanner;
          await startWithVideoRecovery(
            scanner,
            { facingMode: 'environment' },
            {
              ...baseScanConfig,
              videoConstraints: createPreferredVideoConstraints(),
            },
            onScanSuccess,
            scannerRegion,
          );
        },
        async () => {
          const scannerRegion = createScannerRegion(scannerContainer);
          scannerRegionRef.current = scannerRegion;
          const scanner = new Html5Qrcode(scannerRegion.id, currentScannerConfig);
          scannerRef.current = scanner;
          await startWithVideoRecovery(
            scanner,
            { facingMode: 'environment' },
            baseScanConfig,
            onScanSuccess,
            scannerRegion,
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

          const scannerRegion = createScannerRegion(scannerContainer);
          scannerRegionRef.current = scannerRegion;
          const scanner = new Html5Qrcode(scannerRegion.id, currentScannerConfig);
          scannerRef.current = scanner;
          await startWithVideoRecovery(
            scanner,
            preferredCamera.id,
            scanConfig,
            onScanSuccess,
            scannerRegion,
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
            await ensureVideoPlayback(scannerRegionRef.current);

            if (mounted) {
              setCameraState('active');
            }
            return;
          } catch (error) {
            lastError = error;
            const scanner = scannerRef.current;
            const scannerRegion = scannerRegionRef.current;
            scannerRef.current = null;
            scannerRegionRef.current = null;
            if (scanner) {
              await cleanupScanner(scanner, scannerRegion);
            } else {
              stopContainerVideoTracks(scannerRegion);
            }
            removeScannerRegion(scannerRegion);
          }
        }

        throw lastError ?? new Error('Unable to start the QR scanner.');
      } catch (err: unknown) {
        if (!mounted) return;
        if (isCameraPermissionError(err)) {
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
      const scannerRegion = scannerRegionRef.current;
      scannerRef.current = null;
      scannerRegionRef.current = null;
      if (scanner) {
        void cleanupScanner(scanner, scannerRegion);
      } else {
        stopContainerVideoTracks(scannerRegion);
      }
      removeScannerRegion(scannerRegion);
    };
  }, [paused, retryNonce]);

  if (paused) {
    return (
      <div className="relative bg-muted aspect-[4/3] flex items-center justify-center rounded-lg">
        <Camera className="h-10 w-10 text-muted-foreground/30" />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-black">
      {/* Camera feed renders here */}
      <div ref={containerRef} className="qr-scanner-region w-full" />

      {/* Overlay states */}
      {cameraState === 'requesting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Uruchamiam kamerę...</p>
        </div>
      )}

      {(cameraState === 'denied' || cameraState === 'error') && (
        <CameraProblemOverlay cameraState={cameraState} onRetry={() => setRetryNonce(previous => previous + 1)} />
      )}

      <div className="absolute inset-x-3 bottom-3 z-10 flex justify-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={event => void handleFileScan(event.target.files?.[0])}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="bg-background/95 shadow"
          onClick={() => fileInputRef.current?.click()}
          disabled={isFileScanning}
        >
          {isFileScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Skanuj ze zdjęcia
        </Button>
      </div>

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

export default function QrScannerView(props: QrScannerViewProps) {
  if (isAppleMobileBrowser()) {
    return <AppleQrScannerView {...props} />;
  }

  return <Html5QrcodeScannerView {...props} />;
}

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import QrScannerView from '@/components/QrScannerView';

const scannerMock = vi.hoisted(() => ({
  startCalls: [] as Array<{
    element: HTMLElement | null;
    resolve: () => void;
  }>,
}));

vi.mock('html5-qrcode', () => {
  const scannerState = {
    SCANNING: 2,
    PAUSED: 3,
  };

  class Html5Qrcode {
    private readonly element: HTMLElement | null;
    private state = 1;

    constructor(id: string) {
      this.element = document.getElementById(id);
    }

    start() {
      const appendVideo = () => {
        const video = document.createElement('video');
        this.element?.appendChild(video);
        this.state = scannerState.SCANNING;
      };

      const call = {
        element: this.element,
        resolve: () => {},
      };
      scannerMock.startCalls.push(call);

      if (scannerMock.startCalls.length === 1) {
        return new Promise<void>(resolve => {
          call.resolve = () => {
            appendVideo();
            resolve();
          };
        });
      }

      appendVideo();
      return Promise.resolve();
    }

    stop() {
      this.state = 1;
      return Promise.resolve();
    }

    clear() {
      this.element?.replaceChildren();
    }

    getState() {
      return this.state;
    }

    static getCameras() {
      return Promise.resolve([{ id: 'back-camera', label: 'Back Camera' }]);
    }
  }

  return {
    Html5Qrcode,
    Html5QrcodeScannerState: scannerState,
    Html5QrcodeSupportedFormats: {
      QR_CODE: 0,
    },
  };
});

describe('QrScannerView', () => {
  beforeEach(() => {
    scannerMock.startCalls.length = 0;
    vi.useFakeTimers();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps a timed-out scanner from rendering beside a successful fallback scanner', async () => {
    render(<QrScannerView onScan={vi.fn()} />);

    expect(scannerMock.startCalls).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(6500);
    });
    await act(async () => {});

    expect(scannerMock.startCalls).toHaveLength(2);
    expect(document.querySelectorAll('.qr-scanner-region video')).toHaveLength(1);
    expect(scannerMock.startCalls[0].element?.isConnected).toBe(false);

    await act(async () => {
      scannerMock.startCalls[0].resolve();
    });
    await act(async () => {});

    expect(document.querySelectorAll('.qr-scanner-region video')).toHaveLength(1);
  });
});

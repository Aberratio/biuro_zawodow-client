import { useEffect, useRef } from 'react';
import { isSecureQrToken } from '@/lib/qr-tokens';

// Czytnik sprzetowy pracuje jako klawiatura (HID keyboard wedge): wystukuje
// zawartosc kodu znak po znaku, zwykle konczac Enterem. Czlowiek pisze wolniej
// niz 60 ms/znak, czytnik szybciej niz 20 ms/znak, wiec przerwa miedzy
// klawiszami wystarcza, zeby rozdzielic jedno od drugiego.
const INTER_KEY_TIMEOUT_MS = 60;
// Czesc czytnikow jest fabrycznie skonfigurowana bez sufiksu CR - wtedy skan
// odpalamy po chwili ciszy, o ile bufor juz wyglada jak poprawny token.
const IDLE_FLUSH_DELAY_MS = 80;
const MAX_BUFFER_LENGTH = 128;

interface UseHardwareScannerOptions {
  onScan: (code: string) => void;
  enabled?: boolean;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

export function useHardwareScanner({ onScan, enabled = true }: UseHardwareScannerOptions) {
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let buffer = '';
    let lastKeyTime = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
      }
    };

    const flush = () => {
      const candidate = buffer;
      buffer = '';
      clearIdleTimer();

      if (!isSecureQrToken(candidate)) {
        return false;
      }

      onScanRef.current(candidate.trim());
      return true;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) {
        buffer = '';
        clearIdleTimer();
        return;
      }

      if (event.key === 'Enter') {
        if (flush()) {
          event.preventDefault();
        }
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      const now = Date.now();
      buffer = now - lastKeyTime > INTER_KEY_TIMEOUT_MS ? event.key : buffer + event.key;
      lastKeyTime = now;

      if (buffer.length > MAX_BUFFER_LENGTH) {
        buffer = buffer.slice(-MAX_BUFFER_LENGTH);
      }

      clearIdleTimer();
      idleTimer = setTimeout(flush, IDLE_FLUSH_DELAY_MS);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearIdleTimer();
    };
  }, [enabled]);
}

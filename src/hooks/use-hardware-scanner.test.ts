import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHardwareScanner } from '@/hooks/use-hardware-scanner';

const TOKEN = `pqr_${'ab12cd34'.repeat(6)}`;

function typeCharacters(value: string, gapMs: number, target: EventTarget = document.body) {
  for (const character of value) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: character, bubbles: true }));
    vi.advanceTimersByTime(gapMs);
  }
}

function pressEnter(target: EventTarget = document.body) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

describe('useHardwareScanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('reports a token typed at scanner speed and terminated with Enter', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner({ onScan }));

    typeCharacters(TOKEN, 10);
    pressEnter();

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith(TOKEN);
  });

  it('reports a token even when the scanner sends no Enter suffix', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner({ onScan }));

    typeCharacters(TOKEN, 10);
    expect(onScan).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith(TOKEN);
  });

  it('ignores the same characters typed at human speed', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner({ onScan }));

    typeCharacters(TOKEN, 150);
    pressEnter();

    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores keystrokes aimed at an editable field', () => {
    const onScan = vi.fn();
    const input = document.createElement('input');
    document.body.appendChild(input);
    renderHook(() => useHardwareScanner({ onScan }));

    typeCharacters(TOKEN, 10, input);
    pressEnter(input);
    vi.advanceTimersByTime(100);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores fast input that is not a valid token', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner({ onScan }));

    typeCharacters('pqr_niepoprawny-kod', 10);
    pressEnter();
    vi.advanceTimersByTime(100);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('does not listen while disabled', () => {
    const onScan = vi.fn();
    renderHook(() => useHardwareScanner({ onScan, enabled: false }));

    typeCharacters(TOKEN, 10);
    pressEnter();
    vi.advanceTimersByTime(100);

    expect(onScan).not.toHaveBeenCalled();
  });

  it('stops listening after unmount', () => {
    const onScan = vi.fn();
    const { unmount } = renderHook(() => useHardwareScanner({ onScan }));

    unmount();
    typeCharacters(TOKEN, 10);
    pressEnter();
    vi.advanceTimersByTime(100);

    expect(onScan).not.toHaveBeenCalled();
  });
});

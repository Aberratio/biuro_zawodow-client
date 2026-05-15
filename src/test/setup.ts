import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

Object.defineProperty(window.URL, "createObjectURL", {
  writable: true,
  value: vi.fn(() => "blob:biuro-zawodow-test"),
});

Object.defineProperty(window.URL, "revokeObjectURL", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: vi.fn(),
});

afterEach(() => {
  cleanup();
});

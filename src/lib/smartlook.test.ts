import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SmartlookTestWindow = Window & {
  smartlook?: {
    (...args: unknown[]): void;
    api?: unknown[];
  };
  __biuroZawodowSmartlookLoaded?: boolean;
};

async function importSmartlookModule() {
  vi.resetModules();
  return import("./smartlook");
}

describe("smartlook helpers", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    delete (window as SmartlookTestWindow).smartlook;
    delete (window as SmartlookTestWindow).__biuroZawodowSmartlookLoaded;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("masks sensitive elements using Smartlook privacy attributes", async () => {
    document.body.innerHTML = `
      <input name="email" />
      <div data-sensitive="true">private note</div>
    `;

    const { maskSmartlookSensitiveElements } = await importSmartlookModule();

    maskSmartlookSensitiveElements();

    expect(document.querySelector("input")).toHaveAttribute("data-sl", "mask");
    expect(document.querySelector("[data-sensitive='true']")).toHaveAttribute(
      "data-sl",
      "mask",
    );
  });

  it("loads Smartlook only when enabled and configured", async () => {
    vi.stubEnv("VITE_SMARTLOOK_ENABLED", "true");
    vi.stubEnv("VITE_SMARTLOOK_PROJECT_KEY", "project-key");

    const { loadSmartlookAfterConsent } = await importSmartlookModule();

    expect(loadSmartlookAfterConsent()).toBe(true);
    expect(document.querySelector("script")?.getAttribute("src")).toBe(
      "https://web-sdk.smartlook.com/recorder.js",
    );
    expect((window as SmartlookTestWindow).smartlook?.api).toEqual([
      ["init", "project-key", { region: "eu" }],
      ["record", { forms: false, emails: false, numbers: false }],
    ]);
  });
});

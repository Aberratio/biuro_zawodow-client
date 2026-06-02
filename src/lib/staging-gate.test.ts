import { describe, expect, it } from "vitest";

import { getStagingGatePassword, isStagingGateEnabled } from "@/lib/staging-gate";

describe("isStagingGateEnabled", () => {
  it("enables the gate for staging environments with a configured password", () => {
    expect(isStagingGateEnabled({ VITE_APP_ENV: "staging", VITE_STAGING_GATE_PASSWORD: "test" })).toBe(true);
  });

  it("does not enable the gate for non-staging environments", () => {
    expect(isStagingGateEnabled({ VITE_APP_ENV: "production", VITE_STAGING_GATE_PASSWORD: "test" })).toBe(false);
    expect(isStagingGateEnabled({ VITE_APP_ENV: "development", VITE_STAGING_GATE_PASSWORD: "test" })).toBe(false);
    expect(isStagingGateEnabled({})).toBe(false);
  });

  it("does not enable the gate when the password is missing", () => {
    expect(isStagingGateEnabled({ VITE_APP_ENV: "staging" })).toBe(false);
    expect(isStagingGateEnabled({ VITE_APP_ENV: "staging", VITE_STAGING_GATE_PASSWORD: "" })).toBe(false);
  });
});

describe("getStagingGatePassword", () => {
  it("reads the configured password", () => {
    expect(getStagingGatePassword({ VITE_STAGING_GATE_PASSWORD: "test" })).toBe("test");
    expect(getStagingGatePassword({})).toBe("");
  });
});

import { describe, expect, it } from "vitest";

import { isStagingGateEnabled } from "@/lib/staging-gate";

describe("isStagingGateEnabled", () => {
  it("enables the gate for staging environments", () => {
    expect(isStagingGateEnabled({ VITE_APP_ENV: "staging" })).toBe(true);
  });

  it("does not enable the gate for non-staging environments", () => {
    expect(isStagingGateEnabled({ VITE_APP_ENV: "production" })).toBe(false);
    expect(isStagingGateEnabled({ VITE_APP_ENV: "development" })).toBe(false);
    expect(isStagingGateEnabled({})).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { resolveAppVersion } from "./app-version";

const SHA = "6d9302e4c1b0a7f3e2d1c0b9a8f7e6d5c4b3a291";

describe("resolveAppVersion", () => {
  it("shows the release version with its commit for a tagged build", () => {
    expect(resolveAppVersion("2026.10.0", SHA)).toEqual({
      label: "v2026.10.0",
      title: "Wersja 2026.10.0 (commit 6d9302e)",
    });
  });

  it("accepts the tag name with its v prefix", () => {
    expect(resolveAppVersion("v2026.10.1", SHA)?.label).toBe("v2026.10.1");
  });

  it("shows the short commit for an untagged deploy", () => {
    expect(resolveAppVersion("", SHA)).toEqual({
      label: "6d9302e",
      title: "Wersja niewydana (commit 6d9302e)",
    });
  });

  it("shows nothing for a local build", () => {
    // Empty strings, not undefined: undefined would fall back to import.meta.env.
    expect(resolveAppVersion("", "")).toBeNull();
    expect(resolveAppVersion("", "unknown")).toBeNull();
  });
});

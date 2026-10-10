import { describe, expect, it } from "vitest";
import {
  PLATFORM_WITHDRAWN_LABEL,
  PLATFORM_WITHDRAWN_SCAN_WARNING,
  describePlatformWithdrawal,
  isWithdrawnOnPlatform,
} from "@/lib/platform-withdrawal";

describe("platform withdrawal helpers", () => {
  it("flags only participants that carry a withdrawal time", () => {
    expect(
      isWithdrawnOnPlatform({ platform_removed_at: "2026-10-09 10:00:00" })
    ).toBe(true);
    expect(isWithdrawnOnPlatform({ platform_removed_at: null })).toBe(false);
    expect(isWithdrawnOnPlatform({ platform_removed_at: "" })).toBe(false);
    expect(isWithdrawnOnPlatform({})).toBe(false);
  });

  it("uses the agreed Polish texts", () => {
    expect(PLATFORM_WITHDRAWN_LABEL).toBe("Wycofany na platformie");
    expect(PLATFORM_WITHDRAWN_SCAN_WARNING).toBe(
      "Uwaga: zapis tego uczestnika został anulowany na platformie Zmierzymy Czas (rezygnacja, zwrot lub usunięcie przez organizatora). Sprawdź to przed wydaniem pakietu."
    );
  });

  it("describes the withdrawal with the local date, treating the server time as UTC", () => {
    expect(describePlatformWithdrawal("2026-10-09 10:00:00")).toBe(
      `Zapis anulowany lub usunięty na platformie Zmierzymy Czas ${new Date("2026-10-09T10:00:00Z").toLocaleDateString("pl-PL")}`
    );
    expect(describePlatformWithdrawal("garbage")).toBe(
      "Zapis anulowany lub usunięty na platformie Zmierzymy Czas"
    );
    expect(describePlatformWithdrawal(null)).toBe(
      "Zapis anulowany lub usunięty na platformie Zmierzymy Czas"
    );
  });
});

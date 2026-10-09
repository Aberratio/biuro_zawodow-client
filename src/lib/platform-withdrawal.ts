import type { Participant } from "@/types";

export const PLATFORM_WITHDRAWN_LABEL = "Wycofany na platformie";

export const PLATFORM_WITHDRAWN_SCAN_WARNING =
  "Uwaga: zapis tego uczestnika został anulowany na platformie Zmierzymy Czas (rezygnacja, zwrot lub usunięcie przez organizatora). Sprawdź to przed wydaniem pakietu.";

const WITHDRAWN_TITLE =
  "Zapis anulowany lub usunięty na platformie Zmierzymy Czas";

/** The participant was cancelled or removed on the platform (the Biuro keeps the row and its check-in state). */
export function isWithdrawnOnPlatform(
  participant: Pick<Participant, "platform_removed_at">
): boolean {
  return (
    typeof participant.platform_removed_at === "string" &&
    participant.platform_removed_at !== ""
  );
}

/** Tooltip text of the badge. The server sends a UTC time as "Y-m-d H:i:s". */
export function describePlatformWithdrawal(
  removedAt: string | null | undefined
): string {
  if (!removedAt) return WITHDRAWN_TITLE;

  const date = new Date(removedAt.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return WITHDRAWN_TITLE;

  return `${WITHDRAWN_TITLE} ${date.toLocaleDateString("pl-PL")}`;
}

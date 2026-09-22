import type { Event } from "@/types";

export function buildExportFallbackName(
  events: Event[],
  archivedEvents: Event[],
  eventId: string,
  type: "uczestnicy" | "logi" | "zmiany"
): string {
  const event =
    events.find((entry) => entry.id === eventId) ??
    archivedEvents.find((entry) => entry.id === eventId);
  const eventName = event?.name ?? "wydarzenie";
  const slug =
    eventName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/g, "") || "wydarzenie";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return `bz-${type}-${slug}-${date}.csv`;
}

export async function downloadCsvResponse(
  response: Response,
  fallbackName: string
): Promise<void> {
  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const utf8FileNameMatch = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i
  );
  const quotedFileNameMatch = contentDisposition.match(
    /filename="?([^";]+)"?/i
  );
  const fileName = utf8FileNameMatch?.[1]
    ? decodeURIComponent(utf8FileNameMatch[1])
    : (quotedFileNameMatch?.[1] ?? fallbackName);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

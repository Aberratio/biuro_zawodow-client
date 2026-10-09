import {
  describePlatformPushStatus,
  type PlatformConnection,
} from "@/lib/platform-connection";

/** Queue counters and the last platform change in the event's platform section. Renders nothing without data. */
export function PlatformPushStatus({
  connection,
}: {
  connection: PlatformConnection | null;
}) {
  const lines = describePlatformPushStatus(connection);
  if (lines.length === 0) return null;

  return (
    <div className="space-y-1 text-muted-foreground">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

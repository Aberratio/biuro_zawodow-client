import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParticipantBibNumberConflictDialog } from "@/components/ParticipantBibNumberConflictDialog";
import { createTestParticipant } from "@/test/factories";

describe("ParticipantBibNumberConflictDialog", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("builds profile links that keep the hash router document path", () => {
    window.history.pushState({}, "", "/office/#/scanner");

    render(
      <ParticipantBibNumberConflictDialog
        open
        onOpenChange={vi.fn()}
        bibNumber="101"
        conflictingParticipants={[
          createTestParticipant({
            id: "p-2",
            event_id: "event-1",
            name: "Jan Nowak",
            email: "jan@example.com",
          }),
        ]}
        allowDeleteConflicts
        isSaving={false}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: /profil/i })).toHaveAttribute(
      "href",
      "/office/#/events/event-1/participants/p-2",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  countProductionEventsByOrganization,
  matchesEventTestFilter,
} from "@/lib/event-sandbox";

describe("event sandbox helpers", () => {
  it("filters sandbox and production events separately", () => {
    expect(matchesEventTestFilter({ is_test: true }, "all")).toBe(true);
    expect(matchesEventTestFilter({ is_test: false }, "all")).toBe(true);
    expect(matchesEventTestFilter({ is_test: true }, "test")).toBe(true);
    expect(matchesEventTestFilter({ is_test: false }, "test")).toBe(false);
    expect(matchesEventTestFilter({ is_test: true }, "production")).toBe(false);
    expect(matchesEventTestFilter({ is_test: false }, "production")).toBe(true);
  });

  it("does not count sandbox events toward organization production limits", () => {
    expect(countProductionEventsByOrganization([
      { organization_id: "org-1", is_test: false },
      { organization_id: "org-1", is_test: true },
      { organization_id: "org-2", is_test: true },
      { organization_id: "org-2", is_test: false },
      { organization_id: "org-2", is_test: false },
    ])).toEqual({
      "org-1": 1,
      "org-2": 2,
    });
  });
});

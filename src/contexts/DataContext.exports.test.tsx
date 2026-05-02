import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider, useData } from "@/contexts/DataContext";
import { clearOfflineData } from "@/lib/offline-store";
import {
  createTestEvent,
  createTestOrganization,
  createTestUser,
} from "@/test/factories";
import type { User } from "@/types";

const authState: {
  user: User | null;
  token: string | null;
  clearSession: ReturnType<typeof vi.fn>;
  getAuthHeaders: ReturnType<typeof vi.fn>;
} = {
  user: null,
  token: "token",
  clearSession: vi.fn(),
  getAuthHeaders: vi.fn(() => ({ Authorization: "Bearer token" })),
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function createJsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => name.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => payload,
  };
}

function createCsvResponse() {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => name.toLowerCase() === "content-disposition"
        ? 'attachment; filename="participants.csv"'
        : null,
    },
    blob: async () => new Blob(["name\nAnna"], { type: "text/csv" }),
  };
}

function ExportConsumer() {
  const { exportEventCsv, isLoading } = useData();

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={() => {
        void exportEventCsv("event-1");
      }}
    >
      export-participants
    </button>
  );
}

describe("DataProvider CSV exports", () => {
  beforeEach(async () => {
    const user = createTestUser({ id: "admin-1" });
    authState.user = user;
    authState.token = "token";
    authState.clearSession.mockReset();
    authState.getAuthHeaders.mockReset();
    authState.getAuthHeaders.mockReturnValue({ Authorization: "Bearer token" });
    window.localStorage.clear();
    window.sessionStorage.clear();
    await clearOfflineData("http://localhost:8080", "admin-1");
    vi.mocked(window.URL.createObjectURL).mockClear();
    vi.mocked(window.URL.revokeObjectURL).mockClear();
  });

  it("downloads participant CSV with the filename returned by the API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/bootstrap")) {
        return createJsonResponse(200, {
          generated_at: "2099-04-12T08:00:00.000Z",
          snapshot_version: "snapshot-export",
          data: {
            organizations: [createTestOrganization()],
            events: [createTestEvent()],
            archivedEvents: [],
            users: [authState.user],
            participants: [],
            activityLog: [],
          },
        });
      }

      if (url.endsWith("/events/event-1/export.csv")) {
        return createCsvResponse();
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DataProvider>
        <ExportConsumer />
      </DataProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "export-participants" })).not.toBeDisabled());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "export-participants" }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8080/events/event-1/export.csv",
        expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
      );
    });
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:biuro-zawodow-test");

    clickSpy.mockRestore();
  });
});

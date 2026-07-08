import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SuperAdmin from "@/pages/SuperAdmin";
import {
  createTestActivityLog,
  createTestEvent,
  createTestOrganization,
  createTestParticipant,
  createTestUser,
} from "@/test/factories";

const mocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  useData: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    getAuthHeaders: () => ({ Authorization: "Bearer token" }),
  }),
}));

vi.mock("@/contexts/DataContext", () => ({
  useData: () => mocks.useData(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  API_BASE_URL: "http://api.test",
  fetchJson: (...args: unknown[]) => mocks.fetchJson(...args),
}));

function emptyOperationsPayload() {
  return {
    generated_at: "2099-04-12T10:00:00Z",
    summary: {
      critical_alerts: 0,
      warning_alerts: 0,
      quality_issues: 0,
      sync_conflicts: 0,
      active_rate_limit_blocks: 0,
    },
    alerts: [],
    sync_events: [],
    quality_issues: [],
  };
}

function renderPage() {
  mocks.useData.mockReturnValue({
    users: [createTestUser({ role: "superadmin" })],
    organizations: [createTestOrganization()],
    events: [createTestEvent()],
    archivedEvents: [],
    participants: [createTestParticipant()],
    activityLog: [createTestActivityLog()],
    addUser: vi.fn(),
    updateUser: vi.fn(),
    removeUser: vi.fn(),
    triggerUserPasswordReset: vi.fn(),
    setUserPassword: vi.fn(),
    changeRole: vi.fn(),
    refreshData: vi.fn(),
    isLoading: false,
    connectionState: "online",
  });

  return render(
    <MemoryRouter>
      <SuperAdmin />
    </MemoryRouter>,
  );
}

function activateTab(name: string) {
  const tab = screen.getByRole("tab", { name });
  fireEvent.pointerDown(tab, { button: 0 });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.mouseUp(tab, { button: 0 });
  fireEvent.click(tab);
}

describe("SuperAdmin page", () => {
  beforeEach(() => {
    mocks.fetchJson.mockReset();
    mocks.useData.mockReset();
  });

  it("loads and renders operational alerts, synchronization and data quality", async () => {
    mocks.fetchJson.mockResolvedValue({
      payload: {
        generated_at: "2099-04-12T10:00:00Z",
        summary: {
          critical_alerts: 1,
          warning_alerts: 1,
          quality_issues: 1,
          sync_conflicts: 2,
          active_rate_limit_blocks: 0,
        },
        alerts: [{
          id: "event-no-operators-event-1",
          severity: "critical",
          category: "event_no_operators",
          title: "Wydarzenie bez operatorów",
          description: "Bieg Miejski nie ma przypisanych operatorów.",
          count: 1,
          event_id: "event-1",
          event_name: "Bieg Miejski",
          organization_id: "org-1",
          organization_name: "Organizacja Testowa",
        }],
        sync_events: [{
          event_id: "event-1",
          event_name: "Bieg Miejski",
          organization_id: "org-1",
          organization_name: "Organizacja Testowa",
          sync_mode: "local_authoritative",
          sync_status: "conflict",
          conflicts_count: 2,
          last_synced_at: "2099-04-12T09:00:00Z",
          pending_count: 1,
          outbox_conflict_count: 0,
          error_count: 0,
          last_error: null,
        }],
        quality_issues: [{
          id: "duplicate-email-event-1",
          severity: "warning",
          category: "duplicate_emails",
          title: "Powtarzające się adresy e-mail",
          description: "Bieg Miejski ma powtarzające się adresy e-mail.",
          count: 2,
          event_id: "event-1",
          event_name: "Bieg Miejski",
          organization_id: "org-1",
          organization_name: "Organizacja Testowa",
        }],
      },
    });

    renderPage();

    await waitFor(() => {
      expect(mocks.fetchJson).toHaveBeenCalledWith(
        "http://api.test/superadmin/operations",
        expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
      );
    });

    expect(screen.getByText("Wydarzenie bez operatorów")).toBeInTheDocument();
    expect(screen.getByText("Konsola synchronizacji")).toBeInTheDocument();
    expect(screen.getByText("Powtarzające się adresy e-mail")).toBeInTheDocument();
    expect(screen.getByText("Konflikty synchronizacji")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Centrum" })).toHaveAttribute("data-state", "active");
  });

  it("loads and renders redacted server logs with logging status", async () => {
    mocks.fetchJson
      .mockResolvedValueOnce({
        payload: emptyOperationsPayload(),
      })
      .mockResolvedValueOnce({
        payload: {
          data: [{
            id: "srv-1",
            timestamp: "2099-04-12T10:00:00Z",
            level: "error",
            event_code: "database.exception",
            message: "Database error",
            request_id: "req-12345678",
            method: "GET",
            path: "/superadmin/server-logs",
            context: { status: 500 },
          }],
          meta: { page: 1, per_page: 50, total: 1, total_pages: 1 },
        },
      })
      .mockResolvedValueOnce({
        payload: {
          data: {
            writable: true,
            retention_days: 30,
            level: "info",
            last_entry_at: "2099-04-12T10:00:00Z",
            sentry_configured: true,
          },
        },
      });

    renderPage();
    activateTab("Logi");

    await waitFor(() => expect(screen.getByText("/superadmin/server-logs")).toBeInTheDocument());
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("GET")).toBeInTheDocument();
    expect(screen.getByText("Sentry aktywne")).toBeInTheDocument();
  });

  it("sends date and sorting parameters when searching audit logs", async () => {
    mocks.fetchJson
      .mockResolvedValueOnce({ payload: emptyOperationsPayload() })
      .mockResolvedValue({
        payload: {
          data: [],
          meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
        },
      });

    const view = renderPage();
    activateTab("Audyt");
    await waitFor(() => expect(view.container.querySelector("#superadmin-audit-from")).not.toBeNull());
    fireEvent.change(view.container.querySelector("#superadmin-audit-from") as HTMLInputElement, {
      target: { value: "2099-04-12T08:00" },
    });
    fireEvent.change(view.container.querySelector("#superadmin-audit-to") as HTMLInputElement, {
      target: { value: "2099-04-12T12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Szukaj/ }));

    await waitFor(() => {
      expect(mocks.fetchJson.mock.calls.some(([url]) => (
        typeof url === "string"
        && url.includes("/superadmin/audit?")
        && url.includes("from=2099-04-12T08%3A00")
        && url.includes("to=2099-04-12T12%3A00")
        && url.includes("sort=time")
        && url.includes("direction=desc")
      ))).toBe(true);
    });
  });

  it("sends request id, event code, date range and sorting parameters for server logs", async () => {
    mocks.fetchJson
      .mockResolvedValueOnce({ payload: emptyOperationsPayload() })
      .mockResolvedValue({
        payload: {
          data: [],
          meta: { page: 1, per_page: 50, total: 0, total_pages: 1 },
        },
      });

    const view = renderPage();
    activateTab("Logi");
    await waitFor(() => expect(view.container.querySelector("#superadmin-server-request-id")).not.toBeNull());
    fireEvent.change(view.container.querySelector("#superadmin-server-request-id") as HTMLInputElement, {
      target: { value: "req-12345678" },
    });
    fireEvent.change(view.container.querySelector("#superadmin-server-event-code") as HTMLInputElement, {
      target: { value: "database.exception" },
    });
    fireEvent.change(view.container.querySelector("#superadmin-server-from") as HTMLInputElement, {
      target: { value: "2099-04-12T08:00" },
    });
    fireEvent.change(view.container.querySelector("#superadmin-server-to") as HTMLInputElement, {
      target: { value: "2099-04-12T12:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Szukaj/ }));

    await waitFor(() => {
      expect(mocks.fetchJson.mock.calls.some(([url]) => (
        typeof url === "string"
        && url.includes("/superadmin/server-logs?")
        && url.includes("request_id=req-12345678")
        && url.includes("event_code=database.exception")
        && url.includes("from=2099-04-12T08%3A00")
        && url.includes("to=2099-04-12T12%3A00")
        && url.includes("sort=time")
        && url.includes("direction=desc")
      ))).toBe(true);
    });
  });
});

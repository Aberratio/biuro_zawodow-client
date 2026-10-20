import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformIntegrationSwitch } from "@/components/PlatformIntegrationSwitch";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    getAuthHeaders: (json = false) => ({
      Authorization: "Bearer test-token",
      ...(json ? { "Content-Type": "application/json" } : {}),
    }),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

function installFetch(initialMode: string) {
  let mode = initialMode;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      expect(String(input)).toMatch(/\/superadmin\/platform-integration$/);
      if (init.method === "PUT") {
        mode = JSON.parse(String(init.body)).mode;
      }
      return new Response(JSON.stringify({ data: { mode } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("PlatformIntegrationSwitch", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the current mode and saves a new one", async () => {
    const fetchMock = installFetch("superadmin");
    render(<PlatformIntegrationSwitch />);

    expect(await screen.findByLabelText("Tylko superadmin")).toBeChecked();

    fireEvent.click(screen.getByLabelText("Włączona dla wszystkich"));

    await waitFor(() =>
      expect(screen.getByLabelText("Włączona dla wszystkich")).toBeChecked()
    );
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ mode: "on" });
  });
});

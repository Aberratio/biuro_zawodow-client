import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { User } from "@/types";

const useDataMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("@/contexts/DataContext", () => ({
  useData: () => useDataMock(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: logoutMock,
  }),
}));

function createUser(role: User["role"] = "scanner"): User {
  return {
    id: `${role}-1`,
    name: "Operator",
    email: "operator@example.com",
    password: "",
    role,
    assigned_events: [],
  };
}

describe("AppSidebar", () => {
  it("shows event workspace skeleton for scanner while data is loading", () => {
    useDataMock.mockReturnValue({
      currentRole: "scanner",
      currentUser: createUser(),
      organizations: [],
      visibleEvents: [],
      isLoading: true,
      selectedOrganizationId: "",
      setSelectedOrganizationId: vi.fn(),
      selectedEventId: "",
      selectEventContext: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Praca na wydarzeniu")).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-sidebar="menu-skeleton"]').length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/Brak dostępnych wydarzeń w tym kontekście/i),
    ).not.toBeInTheDocument();
  });
});

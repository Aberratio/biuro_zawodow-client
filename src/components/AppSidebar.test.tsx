import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { Event, Organization, User } from "@/types";

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

function createOrganization(id: string, name: string): Organization {
  return {
    id,
    name,
    event_limit: 5,
  };
}

function createEvent(id: string, name: string, organizationId: string): Event {
  return {
    id,
    name,
    location: "Warsaw",
    organization_id: organizationId,
    office_open_at: "2099-04-12T07:00:00",
    office_close_at: "2099-04-12T15:00:00",
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

  it("scopes the superadmin event workspace to the selected organization", () => {
    useDataMock.mockReturnValue({
      currentRole: "superadmin",
      currentUser: createUser("superadmin"),
      organizations: [
        createOrganization("org-1", "Run Poland"),
        createOrganization("org-2", "Sport Events"),
      ],
      visibleEvents: [
        createEvent("event-1", "Bieg Miejski", "org-1"),
        createEvent("event-2", "Triathlon", "org-2"),
      ],
      isLoading: false,
      selectedOrganizationId: "org-1",
      setSelectedOrganizationId: vi.fn(),
      selectedEventId: "event-1",
      selectEventContext: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText("Wybrana organizacja")).toBeInTheDocument();
    expect(screen.getByText("Run Poland")).toBeInTheDocument();
    expect(screen.getByText("Bieg Miejski")).toBeInTheDocument();
    expect(screen.queryByText("Triathlon")).not.toBeInTheDocument();
  });
});

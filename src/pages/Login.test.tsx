import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "@/pages/Login";
import { toast } from "@/hooks/use-toast";
import { checkBrowserStorage } from "@/lib/browser-storage";

const loginMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: loginMock,
  }),
}));

vi.mock("@/components/BrandWordmark", () => ({
  BrandWordmark: () => <div data-testid="brand-wordmark" />,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/browser-storage", () => ({
  checkBrowserStorage: vi.fn(),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

function mockNavigator({
  maxTouchPoints = 0,
  platform = "Win32",
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
}: {
  maxTouchPoints?: number;
  platform?: string;
  userAgent?: string;
} = {}) {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    configurable: true,
    value: maxTouchPoints,
  });
}

describe("Login page", () => {
  beforeEach(() => {
    loginMock.mockReset();
    vi.mocked(toast).mockReset();
    vi.mocked(checkBrowserStorage).mockResolvedValue({
      canPersistSession: true,
      sessionStorageAvailable: true,
      localStorageAvailable: true,
      indexedDbAvailable: true,
      warnings: [],
    });
    mockNavigator();
  });

  it("validates required credentials before calling auth", () => {
    const { container } = renderLogin();
    const emailInput = container.querySelector("#login-desktop-email");
    const form = emailInput?.closest("form");

    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(loginMock).not.toHaveBeenCalled();
    expect(screen.getAllByText(/Podaj has/i).length).toBeGreaterThan(0);
  });

  it("shows a form error and destructive toast when credentials are rejected", async () => {
    loginMock.mockResolvedValue({ ok: false, error: "Nieprawidłowy e-mail lub hasło." });
    const { container } = renderLogin();
    const emailInput = container.querySelector("#login-desktop-email") as HTMLInputElement;
    const passwordInput = container.querySelector("#login-desktop-password") as HTMLInputElement;
    const form = emailInput.closest("form");

    fireEvent.change(emailInput, { target: { value: "admin@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrong-password" } });
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith(
        "admin@example.com",
        "wrong-password",
        expect.objectContaining({
          can_persist_session: true,
          session_storage_available: true,
          local_storage_available: true,
          indexed_db_available: true,
        }),
      );
    });

    expect(screen.getAllByText(/Nieprawid/i).length).toBeGreaterThan(0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/logowania/i),
      variant: "destructive",
    }));
  });

  it("disables login with a countdown when auth is rate limited", async () => {
    loginMock.mockResolvedValue({
      ok: false,
      status: 429,
      retryAfter: 30,
      error: "Zbyt wiele prób logowania. Spróbuj ponownie później.",
    });
    const { container } = renderLogin();
    const emailInput = container.querySelector("#login-desktop-email") as HTMLInputElement;
    const passwordInput = container.querySelector("#login-desktop-password") as HTMLInputElement;
    const form = emailInput.closest("form");

    fireEvent.change(emailInput, { target: { value: "admin@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrong-password" } });
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /Spróbuj za 30s/i });
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every(button => button.hasAttribute("disabled"))).toBe(true);
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Zbyt wiele prób",
      variant: "destructive",
    }));
  });

  it("shows an active install button on iOS and opens Safari instructions on click", async () => {
    mockNavigator({
      maxTouchPoints: 5,
      platform: "iPhone",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    });

    renderLogin();

    const installButtons = await screen.findAllByRole("button", {
      name: /Pobierz aplikacj/i,
    });

    expect(installButtons.length).toBeGreaterThan(0);
    expect(installButtons[0]).toBeEnabled();
    expect(screen.queryByText(/Udost/i)).not.toBeInTheDocument();

    fireEvent.click(installButtons[0]);

    expect(
      await screen.findByRole("dialog", { name: /Instalacja na iPhonie/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Dodaj do ekranu/i)).toBeInTheDocument();
  });
});

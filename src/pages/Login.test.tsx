import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Login from "@/pages/Login";
import { toast } from "@/hooks/use-toast";

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

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
}

describe("Login page", () => {
  beforeEach(() => {
    loginMock.mockReset();
    vi.mocked(toast).mockReset();
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
      expect(loginMock).toHaveBeenCalledWith("admin@example.com", "wrong-password");
    });

    expect(screen.getAllByText(/Nieprawid/i).length).toBeGreaterThan(0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringMatching(/logowania/i),
      variant: "destructive",
    }));
  });
});

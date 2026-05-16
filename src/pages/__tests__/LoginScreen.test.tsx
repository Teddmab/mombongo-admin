import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "@/pages/LoginScreen";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const mockedUseAuth = vi.mocked(useAuth);

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to /admin after a successful sign-in", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue(undefined);

    mockedUseAuth.mockReturnValue({
      signIn,
      signOut: vi.fn(),
      user: null,
      role: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/admin" element={<div>Admin landing</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("Adresse email"));
    await user.type(screen.getByLabelText("Adresse email"), "ops@mombongo.coop");
    await user.clear(screen.getByLabelText("Mot de passe"));
    await user.type(screen.getByLabelText("Mot de passe"), "secret-pass");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("ops@mombongo.coop", "secret-pass");
    });

    expect(await screen.findByText("Admin landing")).toBeInTheDocument();
  });

  it("shows the authentication error when sign-in fails", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockRejectedValue(new Error("Connexion refusée"));

    mockedUseAuth.mockReturnValue({
      signIn,
      signOut: vi.fn(),
      user: null,
      role: null,
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(await screen.findByText("Connexion refusée")).toBeInTheDocument();
  });
});
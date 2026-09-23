import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccessDeniedScreen } from "@/pages/AccessDeniedScreen";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe("AccessDeniedScreen", () => {
  it("shows the required French title and message, with no technical details", () => {
    const refreshAuthorization = vi.fn().mockResolvedValue(undefined);
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut,
      resetPassword: vi.fn(),
      refreshAuthorization,
      user: { uid: "u1", email: "user@test.com", displayName: "User" },
      role: "investor",
      loading: false,
      status: "unauthorized",
      authSource: null,
      authError: null,
    });

    render(<AccessDeniedScreen />);

    expect(screen.getByText("Accès administrateur requis")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Votre compte est connecté, mais il ne dispose pas des autorisations nécessaires pour accéder à Mombongo Admin.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Actualiser mes autorisations")).toBeInTheDocument();
    expect(screen.getByText("Se déconnecter")).toBeInTheDocument();
    // Nothing technical (claim values, uids, error text) should leak into the page.
    expect(screen.queryByText(/role/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/claim/i)).not.toBeInTheDocument();
  });

  it("calls refreshAuthorization when 'Actualiser mes autorisations' is clicked", async () => {
    const refreshAuthorization = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      refreshAuthorization,
      user: { uid: "u1", email: "user@test.com", displayName: "User" },
      role: "investor",
      loading: false,
      status: "unauthorized",
      authSource: null,
      authError: null,
    });

    const user = userEvent.setup();
    render(<AccessDeniedScreen />);

    await user.click(screen.getByText("Actualiser mes autorisations"));

    await waitFor(() => expect(refreshAuthorization).toHaveBeenCalledTimes(1));
  });

  it("calls signOut when 'Se déconnecter' is clicked", async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signOut,
      resetPassword: vi.fn(),
      refreshAuthorization: vi.fn(),
      user: { uid: "u1", email: "user@test.com", displayName: "User" },
      role: "investor",
      loading: false,
      status: "unauthorized",
      authSource: null,
      authError: null,
    });

    const user = userEvent.setup();
    render(<AccessDeniedScreen />);

    await user.click(screen.getByText("Se déconnecter"));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
  });
});

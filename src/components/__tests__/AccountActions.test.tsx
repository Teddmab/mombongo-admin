import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpsCallable } from "firebase/functions";
import { AccountActions } from "@/components/AccountActions";

// firebase/functions is already mocked globally in src/test/setup.unit.ts
// (httpsCallable: vi.fn(() => vi.fn())) — reconfigure that same mock here
// so setUserRole/disableUser resolve to distinct, assertable fns.
const mockedHttpsCallable = vi.mocked(httpsCallable);

function renderActions(props: Partial<React.ComponentProps<typeof AccountActions>> = {}) {
  const qc = new QueryClient();
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  render(
    <QueryClientProvider client={qc}>
      <AccountActions userId="u1" currentRole="farmer" disabled={false} invalidateKeys={[["admin-farmers"]]} {...props} />
    </QueryClientProvider>,
  );
  return { invalidateSpy };
}

describe("AccountActions", () => {
  const setUserRoleMock = vi.fn();
  const disableUserMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setUserRoleMock.mockResolvedValue({ data: { success: true } });
    disableUserMock.mockResolvedValue({ data: { success: true } });
    mockedHttpsCallable.mockImplementation((_fn, name: unknown) => {
      if (name === "setUserRole") return setUserRoleMock as never;
      if (name === "disableUser") return disableUserMock as never;
      throw new Error(`unexpected callable ${name}`);
    });
  });

  it("disables Appliquer until a different role is picked, then calls setUserRole", async () => {
    const { invalidateSpy } = renderActions();
    expect(screen.getByText("Appliquer")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Rôle"), { target: { value: "merchant" } });
    expect(screen.getByText("Appliquer")).not.toBeDisabled();
    fireEvent.click(screen.getByText("Appliquer"));

    await waitFor(() => expect(setUserRoleMock).toHaveBeenCalledWith({ userId: "u1", role: "merchant" }));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-farmers"] }));
  });

  it("calls disableUser with the inverse of the current disabled state", async () => {
    renderActions({ disabled: false });
    fireEvent.click(screen.getByText("Désactiver le compte"));
    await waitFor(() => expect(disableUserMock).toHaveBeenCalledWith({ userId: "u1", disabled: true }));
  });

  it("shows Réactiver le compte when the account is already disabled", () => {
    renderActions({ disabled: true });
    expect(screen.getByText("Réactiver le compte")).toBeInTheDocument();
  });

  it("shows a server error message without pretending it succeeded", async () => {
    setUserRoleMock.mockRejectedValue(new Error("Admin only"));
    renderActions();
    fireEvent.change(screen.getByLabelText("Rôle"), { target: { value: "merchant" } });
    fireEvent.click(screen.getByText("Appliquer"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Admin only"));
  });
});

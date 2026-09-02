import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/Modal";

function Harness({ onClose }: { onClose: () => void }) {
  return (
    <div>
      <button>Trigger</button>
      <Modal title="Titre du dialogue" onClose={onClose}>
        <button>Premier</button>
        <button>Dernier</button>
      </Modal>
    </div>
  );
}

describe("Modal", () => {
  it("has real dialog semantics labeled by its title", () => {
    render(<Harness onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Titre du dialogue" })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("moves focus into the dialog on open", () => {
    render(<Harness onClose={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByLabelText("Fermer"));
  });

  it("traps Tab focus within the dialog — Tab from the last element wraps to the first", () => {
    render(<Harness onClose={vi.fn()} />);
    const last = screen.getByText("Dernier");
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByLabelText("Fermer"));
  });

  it("traps Shift+Tab from the first element back to the last", () => {
    render(<Harness onClose={vi.fn()} />);
    const close = screen.getByLabelText("Fermer");
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText("Dernier"));
  });

  it("restores focus to the trigger element on unmount", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    function ToggleHarness() {
      return <Modal title="T" onClose={() => {}}><button>x</button></Modal>;
    }
    const { unmount } = render(<ToggleHarness />);
    unmount();
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useQueryClient } from "@tanstack/react-query";

type Role = "investor" | "farmer" | "agent" | "merchant" | "admin";

const ROLE_LABEL: Record<Role, string> = {
  investor: "Investisseur", farmer: "Agriculteur", agent: "Agent terrain", merchant: "Commerçant", admin: "Administrateur",
};

/**
 * Role-change + enable/disable account actions, shared across the
 * per-role admin pages (Investisseurs, Agents terrain, Commerçants).
 * Ported from the old AdminUsers.tsx drawer — same setUserRole/disableUser
 * CFs, just embedded in a role-specific detail page instead of a single
 * generic "all users" tab.
 */
export function AccountActions({ userId, currentRole, disabled, invalidateKeys, onChanged }: {
  userId: string;
  currentRole: Role;
  disabled?: boolean;
  /** Query keys to invalidate after a successful change (the caller's list + detail queries). */
  invalidateKeys: unknown[][];
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role>(currentRole);
  const [savingRole, setSavingRole] = useState(false);
  const [savingDisable, setSavingDisable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    onChanged?.();
  }

  async function handleSetRole() {
    if (selectedRole === currentRole) return;
    setSavingRole(true);
    setError(null);
    try {
      const fn = httpsCallable<{ userId: string; role: string }, { success: boolean }>(functions, "setUserRole");
      await fn({ userId, role: selectedRole });
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du changement de rôle.");
    } finally {
      setSavingRole(false);
    }
  }

  async function handleDisable() {
    setSavingDisable(true);
    setError(null);
    try {
      const fn = httpsCallable<{ userId: string; disabled: boolean }, { success: boolean }>(functions, "disableUser");
      await fn({ userId, disabled: !disabled });
      invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la mise à jour du compte.");
    } finally {
      setSavingDisable(false);
    }
  }

  return (
    <article className="panel">
      <div className="section-header"><h3>Compte</h3></div>
      <div style={{ padding: "0 20px 20px" }}>
        <label className="form-label" htmlFor="account-role">Rôle</label>
        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          <select
            id="account-role"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as Role)}
            className="form-input"
            style={{ flex: 1 }}
          >
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSetRole}
            disabled={savingRole || selectedRole === currentRole}
            className="btn-primary"
            style={{ height: 40 }}
          >
            {savingRole ? "…" : "Appliquer"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleDisable}
          disabled={savingDisable}
          className={`button-outline ${disabled ? "" : "danger"}`}
          style={{ height: 40, width: "100%", justifyContent: "center" }}
        >
          {savingDisable ? "…" : disabled ? "Réactiver le compte" : "Désactiver le compte"}
        </button>

        {error && <p role="alert" className="error-text text-sm" style={{ marginTop: 12 }}>{error}</p>}
      </div>
    </article>
  );
}

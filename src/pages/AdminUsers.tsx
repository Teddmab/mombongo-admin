import {
  collection, getDocs, query, orderBy, limit, doc, updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Search, X, ChevronRight, ShieldCheck, CreditCard, Smartphone } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, functions } from "@/lib/firebase";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type Role = "investor" | "farmer" | "agent" | "merchant" | "admin";
type KycStatus = "none" | "pending" | "verified" | "rejected";

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  kycStatus: KycStatus;
  walletUsd: number;
  walletCdf: number;
  disabled?: boolean;
  createdAt?: { seconds: number };
}

interface TxRow { id: string; type: string; amountUsd: number; status: string; createdAt?: { seconds: number } }
interface InvRow { id: string; productTitle: string; amountUsd: number; status: string }

/* ─── Callables ─────────────────────────────────────────────────────────── */

const setUserRoleFn = httpsCallable<{ userId: string; role: string }, { success: boolean }>(functions, "setUserRole");
const disableUserFn = httpsCallable<{ userId: string; disabled: boolean }, { success: boolean }>(functions, "disableUser");

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function useToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = (text: string, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000); };
  return { msg, success: (t: string) => show(t, true), error: (t: string) => show(t, false) };
}

const fmtUsd = (n: number) => `$${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (ts?: { seconds: number }) => ts ? new Date(ts.seconds * 1000).toLocaleDateString("fr-FR") : "—";

const ROLE_COLORS: Record<Role, string> = {
  investor: "badge-blue", farmer: "badge-green", agent: "badge-amber",
  merchant: "badge-purple", admin: "badge-red",
};
const KYC_COLORS: Record<KycStatus, string> = {
  verified: "pill status-active", pending: "pill status-pending",
  rejected: "pill status-blocked", none: "pill",
};

/* ─── User drawer ────────────────────────────────────────────────────────── */

function UserDrawer({ user, onClose, onRefetch }: {
  user: UserRow; onClose: () => void; onRefetch: () => void;
}) {
  const toast = useToast();
  const [savingRole, setSavingRole] = useState(false);
  const [savingDisable, setSavingDisable] = useState(false);
  const [savingKyc, setSavingKyc] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>(user.role);

  const { data: investments = [] } = useQuery<InvRow[]>({
    queryKey: ["user-investments", user.id],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, "investments"),
        orderBy("investedAt", "desc"),
        limit(20),
      ));
      return snap.docs
        .filter(d => d.data().investorId === user.id)
        .map(d => ({ id: d.id, ...d.data() } as InvRow));
    },
  });

  const { data: transactions = [] } = useQuery<TxRow[]>({
    queryKey: ["user-transactions", user.id],
    queryFn: async () => {
      const snap = await getDocs(query(
        collection(db, "transactions"),
        orderBy("createdAt", "desc"),
        limit(20),
      ));
      return snap.docs
        .filter(d => d.data().userId === user.id)
        .map(d => ({ id: d.id, ...d.data() } as TxRow));
    },
  });

  async function handleSetRole() {
    if (selectedRole === user.role) return;
    setSavingRole(true);
    try {
      await setUserRoleFn({ userId: user.id, role: selectedRole });
      toast.success(`Rôle mis à jour → ${selectedRole}`);
      onRefetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSavingRole(false); }
  }

  async function handleDisable() {
    setSavingDisable(true);
    try {
      await disableUserFn({ userId: user.id, disabled: !user.disabled });
      toast.success(user.disabled ? "Compte réactivé" : "Compte désactivé");
      onRefetch(); onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSavingDisable(false); }
  }

  async function handleKycUpdate(kycStatus: KycStatus) {
    setSavingKyc(true);
    try {
      await updateDoc(doc(db, "users", user.id), { kycStatus });
      toast.success(`KYC → ${kycStatus}`);
      onRefetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSavingKyc(false); }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Toast */}
        {toast.msg && (
          <div className={`fixed top-4 right-4 z-[60] px-4 py-2 rounded-lg text-sm font-semibold shadow-lg ${toast.msg.ok ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}>
            {toast.msg.text}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <p className="font-bold text-gray-900">{user.fullName || "—"}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Wallet */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Wallet USD</p>
              <p className="font-display font-black text-lg text-gray-900">{fmtUsd(user.walletUsd)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Wallet CDF</p>
              <p className="font-display font-black text-lg text-gray-900">{(user.walletCdf ?? 0).toLocaleString("fr-FR")} FC</p>
            </div>
          </div>

          {/* Role */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Rôle</p>
            <div className="flex gap-2 items-center">
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as Role)}
                className="flex-1 h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              >
                {(["investor","farmer","agent","merchant","admin"] as Role[]).map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                onClick={handleSetRole}
                disabled={savingRole || selectedRole === user.role}
                className="h-9 px-4 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 transition"
              >
                {savingRole ? "…" : "Appliquer"}
              </button>
            </div>
          </div>

          {/* KYC */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <ShieldCheck size={13} className="inline mr-1" />KYC
            </p>
            <div className="flex gap-2 flex-wrap">
              {(["none","pending","verified","rejected"] as KycStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => handleKycUpdate(s)}
                  disabled={savingKyc || user.kycStatus === s}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition disabled:opacity-50 ${
                    user.kycStatus === s
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Investments */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <CreditCard size={13} className="inline mr-1" />Investissements ({investments.length})
            </p>
            {investments.length === 0
              ? <p className="text-sm text-gray-400">Aucun investissement</p>
              : (
                <ul className="space-y-1">
                  {investments.map(inv => (
                    <li key={inv.id} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-700 truncate flex-1">{inv.productTitle || inv.id.slice(0,8)}</span>
                      <span className="font-semibold text-gray-900 ml-4">{fmtUsd(inv.amountUsd)}</span>
                      <span className={`ml-3 text-xs ${inv.status === "active" ? "text-green-600" : "text-gray-400"}`}>{inv.status}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </div>

          {/* Transactions */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              <Smartphone size={13} className="inline mr-1" />Transactions ({transactions.length})
            </p>
            {transactions.length === 0
              ? <p className="text-sm text-gray-400">Aucune transaction</p>
              : (
                <ul className="space-y-1">
                  {transactions.map(tx => (
                    <li key={tx.id} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                      <span className="text-gray-600 capitalize">{tx.type?.replace(/_/g, " ")}</span>
                      <span className="text-gray-400 text-xs mx-2">{fmtDate(tx.createdAt)}</span>
                      <span className="font-semibold text-gray-900">{fmtUsd(tx.amountUsd)}</span>
                    </li>
                  ))}
                </ul>
              )
            }
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t">
          <button
            onClick={handleDisable}
            disabled={savingDisable}
            className={`w-full h-10 rounded-lg font-semibold text-sm transition disabled:opacity-50 ${
              user.disabled
                ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
            }`}
          >
            {savingDisable ? "…" : user.disabled ? "Réactiver le compte" : "Désactiver le compte"}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ─── Main screen ────────────────────────────────────────────────────────── */

export function AdminUsers() {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const dq = useDeferredValue(search);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const { data: users = [], refetch } = useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(100)));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRow));
    },
  });

  const rows = users.filter(u => {
    if (!dq) return true;
    const v = dq.toLowerCase();
    return u.fullName?.toLowerCase().includes(v) || u.email?.toLowerCase().includes(v);
  });

  function handleRefetch() {
    refetch();
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    if (selected) setSelected(u => users.find(x => x.id === u?.id) ?? u);
  }

  return (
    <section className="page">
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-2 rounded-lg text-sm font-semibold shadow-lg ${toast.msg.ok ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}>
          {toast.msg.text}
        </div>
      )}

      <div className="section-header">
        <div>
          <div className="section-kicker">Utilisateurs</div>
          <h1 className="page-title">Comptes, rôles et conformité</h1>
        </div>
        <div className="user-chip">
          <Search size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            style={{ border: 0, background: "transparent", outline: "none" }}
          />
        </div>
      </div>

      <article className="panel">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>KYC</th>
                <th>Wallet USD</th>
                <th>Inscrit</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id} style={{ opacity: u.disabled ? 0.5 : 1 }}>
                  <td>{u.fullName || "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--color-muted)" }}>{u.email}</td>
                  <td><span className={`badge ${ROLE_COLORS[u.role] ?? "badge"}`}>{u.role}</span></td>
                  <td><span className={KYC_COLORS[u.kycStatus ?? "none"]}>{u.kycStatus ?? "none"}</span></td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmtUsd(u.walletUsd ?? 0)}</td>
                  <td style={{ fontSize: 12, color: "var(--color-muted)" }}>{fmtDate(u.createdAt)}</td>
                  <td>
                    {u.disabled
                      ? <span className="pill status-blocked">désactivé</span>
                      : <span className="pill status-active">actif</span>}
                  </td>
                  <td>
                    <button
                      onClick={() => setSelected(u)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      Détails <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--color-muted)", padding: "32px" }}>Aucun utilisateur trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      {selected && (
        <UserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onRefetch={handleRefetch}
        />
      )}
    </section>
  );
}

/* ─── Transaction display normalization ──────────────────────────────────
   French display labels derived from the real `type` enum values written
   by mombongo-functions (see grep across src/payments, src/bourse,
   src/financing, src/investments, src/partners — every .set() onto
   `transactions`). This is a display-only mapping; it never mutates the
   stored `type` string. Types not in this table (future additions) fall
   back to a humanized version of the raw value rather than crashing. */

export type TxDirection = "in" | "out" | "transfer";

interface TxTypeMeta {
  label: string;
  direction: TxDirection;
}

const TYPE_META: Record<string, TxTypeMeta> = {
  deposit: { label: "Dépôt", direction: "in" },
  deposit_refund: { label: "Remboursement de dépôt", direction: "in" },
  withdrawal: { label: "Retrait", direction: "out" },
  withdrawal_refund: { label: "Retrait remboursé", direction: "in" },
  investment: { label: "Investissement", direction: "out" },
  bourse_investment: { label: "Investissement bourse", direction: "out" },
  bourse_sale: { label: "Vente bourse", direction: "transfer" },
  financing: { label: "Financement décaissé", direction: "out" },
  external_invoice_payment: { label: "Paiement de facture", direction: "in" },
};

export function txTypeMeta(type: string | undefined): TxTypeMeta {
  if (type && TYPE_META[type]) return TYPE_META[type];
  return { label: (type ?? "—").replace(/_/g, " "), direction: "transfer" };
}

/** Real transaction docs use amountUsd for most types and amountCdf for bourse_investment/bourse_sale — never both, and `currency` is often absent. This picks whichever is present rather than assuming USD. */
export function txAmount(data: { amountUsd?: number; amountCdf?: number; currency?: string }): { amount: number; currency: string } {
  if (data.amountUsd != null) return { amount: data.amountUsd, currency: data.currency ?? "USD" };
  if (data.amountCdf != null) return { amount: data.amountCdf, currency: data.currency ?? "CDF" };
  return { amount: 0, currency: data.currency ?? "USD" };
}

export function formatAmount(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(amount));
  return currency === "USD" ? `${formatted} $` : `${formatted} FC`;
}

/** Picks whichever provider reference the write site actually stamped — these field names are mutually exclusive per type, never more than one present on a given doc. */
export function txProviderRef(id: string, data: Record<string, unknown>): string {
  return (
    (data.pawapayDepositId as string) ??
    (data.pawapayPayoutId as string) ??
    (data.pawapayRefundId as string) ??
    (data.externalInvoiceDocId as string) ??
    (data.contractId as string) ??
    id
  );
}

export const STATUS_LABEL: Record<string, string> = {
  completed: "Réussi",
  pending: "En cours",
  processing: "En cours",
  failed: "Échoué",
  refunded: "Remboursé",
};

export const STATUS_PILL: Record<string, string> = {
  completed: "status-active",
  pending: "status-pending",
  processing: "status-pending",
  failed: "status-blocked",
  refunded: "status-pending",
};

/* ─── Status filter translation layer ─────────────────────────────────────
   The "Statut" filter must offer real backend states, but `pending` and
   `processing` mean the same thing to an administrator ("en cours") and
   splitting them into two dropdown options would just be internal
   plumbing leaking into the UI. This groups real status values behind
   one French-facing filter option each, per row so filtering never
   mutates or hides the underlying stored value shown elsewhere. */
export interface StatusFilterGroup {
  key: string;
  label: string;
  matches: (status: string) => boolean;
}

export const STATUS_FILTER_GROUPS: StatusFilterGroup[] = [
  { key: "completed", label: "Réussi", matches: (s) => s === "completed" },
  { key: "pending", label: "En cours", matches: (s) => s === "pending" || s === "processing" },
  { key: "failed", label: "Échoué", matches: (s) => s === "failed" },
  { key: "refunded", label: "Remboursé", matches: (s) => s === "refunded" },
];

/** Masks the middle digits of an MSISDN for display — e.g. "+243812345678" → "+243 81 *** ** 78".
 * Always masks (no granular per-admin permission tiers exist yet in this codebase to condition on). */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone;
  const country = digits.length > 9 ? digits.slice(0, digits.length - 9) : "243";
  const local = digits.slice(-9);
  return `+${country} ${local.slice(0, 2)} *** ** ${local.slice(-2)}`;
}

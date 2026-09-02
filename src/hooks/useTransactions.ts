import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import {
  collection, doc, getDoc, getDocs, orderBy, query, limit, where, Timestamp,
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { txTypeMeta, txAmount, txProviderRef, type TxDirection } from "@/lib/transactionDisplay";

/** Ledger page grows by this increment each "Charger plus" click. */
export const LEDGER_PAGE_SIZE = 40;
/** Deposits/withdrawals are inherently short-lived while pending — a fixed recent window
 * is enough to surface every in-flight/failed attempt without an unbounded fetch or a
 * cursor of its own. */
const ATTEMPT_WINDOW = 60;

export type ReconciliationStatus = "matched" | "exception" | "not_applicable" | "resolved_manually" | "unchecked";

/** `ledger` = a completed/refunded row from `transactions` (the money-movement ledger).
 * `deposit_attempt` / `withdrawal_attempt` = a still-pending/processing/failed row read
 * directly from `deposits`/`withdrawals` — these never get a `transactions` doc until
 * (if ever) they complete, so without this second source pending/failed payments would
 * be invisible to admins. */
export type TxSource = "ledger" | "deposit_attempt" | "withdrawal_attempt";

export interface TransactionRow {
  id: string;
  source: TxSource;
  type: string;
  label: string;
  direction: TxDirection;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  operator: string | null;
  participantName: string;
  secondaryParticipantName: string | null;
  /** Raw MSISDN, e.g. "+243812345678" — never rendered raw, see maskPhone(). */
  phone: string | null;
  reference: string;
  createdAt: Timestamp | null;
  /** Only set for external_invoice_payment rows — used to route the resend-notification action. */
  externalInvoiceDocId: string | null;
  /** "unchecked" (not "not_applicable") when reconcileTransactions hasn't processed this row yet — those are two different things and must not be conflated. "not_applicable" for attempt rows: there is no ledger entry yet to reconcile against. */
  reconciliationStatus: ReconciliationStatus;
  /** null means "not communicated by the operator," never zero — see extractPawapayFee's own doc comment on why this can't be assumed present. Only ever set on ledger deposit/withdrawal/refund rows. */
  feeUsd: number | null;
}

async function resolveUserNames(uids: (string | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(uids.filter((v): v is string => !!v)));
  const entries = await Promise.all(
    unique.map(async (uid) => {
      const snap = await getDoc(doc(db, "users", uid));
      const name = snap.exists() ? ((snap.data().fullName as string) || (snap.data().displayName as string)) : null;
      return [uid, name || uid] as const;
    }),
  );
  return new Map(entries);
}

interface DepositWithdrawalExtra {
  operator: string | null;
  phone: string | null;
}

/** deposits/{pawapayDepositId} and withdrawals/{pawapayPayoutId} are the only two collections that actually store a mobile-money operator and the payer/recipient phone — ledger `transactions` docs themselves store neither. */
async function resolveLedgerExtras(rows: { type: string; data: Record<string, unknown> }[]): Promise<Map<string, DepositWithdrawalExtra>> {
  const lookups = rows
    .map(({ type, data }) => {
      if ((type === "deposit" || type === "deposit_refund") && data.pawapayDepositId)
        return { collection: "deposits", id: data.pawapayDepositId as string };
      if ((type === "withdrawal" || type === "withdrawal_refund") && data.pawapayPayoutId)
        return { collection: "withdrawals", id: data.pawapayPayoutId as string };
      return null;
    })
    .filter((v): v is { collection: string; id: string } => v !== null);

  const uniqueKeys = Array.from(new Map(lookups.map((l) => [`${l.collection}/${l.id}`, l])).values());
  const entries = await Promise.all(
    uniqueKeys.map(async (l) => {
      const snap = await getDoc(doc(db, l.collection, l.id));
      const data = snap.data();
      return [`${l.collection}/${l.id}`, { operator: (data?.operator as string) ?? null, phone: (data?.phone as string) ?? null }] as const;
    }),
  );
  return new Map(entries);
}

export interface TransactionsPage {
  rows: TransactionRow[];
  /** true when the ledger query returned a full page — there may be older ledger rows not yet loaded. */
  hasMore: boolean;
}

export function useTransactions(pageSize: number = LEDGER_PAGE_SIZE) {
  return useQuery<TransactionsPage>({
    queryKey: ["admin-transactions-v3", pageSize],
    queryFn: async () => {
      const [ledgerSnap, depositsSnap, withdrawalsSnap] = await Promise.all([
        getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(pageSize))),
        getDocs(query(collection(db, "deposits"), orderBy("createdAt", "desc"), limit(ATTEMPT_WINDOW))),
        getDocs(query(collection(db, "withdrawals"), orderBy("createdAt", "desc"), limit(ATTEMPT_WINDOW))),
      ]);

      const ledgerDocs = ledgerSnap.docs.map((d) => ({ id: d.id, data: d.data() }));
      const depositAttempts = depositsSnap.docs
        .map((d) => ({ id: d.id, data: d.data() }))
        .filter(({ data }) => ["pending", "failed"].includes(data.status as string));
      const withdrawalAttempts = withdrawalsSnap.docs
        .map((d) => ({ id: d.id, data: d.data() }))
        .filter(({ data }) => ["pending", "processing", "failed"].includes(data.status as string));

      const allUids = [
        ...ledgerDocs.flatMap(({ data }) => [data.userId, data.fromUid, data.toUid] as (string | undefined)[]),
        ...depositAttempts.map(({ data }) => data.userId as string | undefined),
        ...withdrawalAttempts.map(({ data }) => data.userId as string | undefined),
      ];

      const [names, extras] = await Promise.all([
        resolveUserNames(allUids),
        resolveLedgerExtras(ledgerDocs.map(({ data }) => ({ type: data.type as string, data }))),
      ]);

      const ledgerRows: TransactionRow[] = ledgerDocs.map(({ id, data }) => {
        const meta = txTypeMeta(data.type as string);
        const { amount, currency } = txAmount(data as { amountUsd?: number; amountCdf?: number; currency?: string });
        const extraKey = data.pawapayDepositId ? `deposits/${data.pawapayDepositId}` : data.pawapayPayoutId ? `withdrawals/${data.pawapayPayoutId}` : null;
        const extra = extraKey ? extras.get(extraKey) : null;

        return {
          id,
          source: "ledger",
          type: (data.type as string) ?? "—",
          label: meta.label,
          direction: meta.direction,
          amount,
          currency,
          status: (data.status as string) ?? "completed",
          method: (data.method as string) ?? null,
          operator: extra?.operator ?? null,
          phone: extra?.phone ?? null,
          participantName: names.get(data.userId as string) ?? names.get(data.fromUid as string) ?? "—",
          secondaryParticipantName: data.toUid ? (names.get(data.toUid as string) ?? null) : null,
          reference: txProviderRef(id, data),
          createdAt: (data.createdAt as Timestamp) ?? null,
          externalInvoiceDocId: (data.externalInvoiceDocId as string) ?? null,
          reconciliationStatus: (data.reconciliationStatus as ReconciliationStatus) ?? "unchecked",
          feeUsd: (data.feeUsd as number) ?? null,
        };
      });

      const attemptRows: TransactionRow[] = [
        ...depositAttempts.map(({ id, data }) => ({
          id: `attempt:deposit:${id}`,
          source: "deposit_attempt" as const,
          type: "deposit",
          label: "Dépôt",
          direction: "in" as const,
          amount: (data.amountUsd as number) ?? 0,
          currency: "USD",
          status: (data.status as string) ?? "pending",
          method: "mobile_money",
          operator: (data.operator as string) ?? null,
          phone: (data.phone as string) ?? null,
          participantName: names.get(data.userId as string) ?? "—",
          secondaryParticipantName: null,
          reference: id,
          createdAt: (data.createdAt as Timestamp) ?? null,
          externalInvoiceDocId: null,
          reconciliationStatus: "not_applicable" as const,
          feeUsd: null,
        })),
        ...withdrawalAttempts.map(({ id, data }) => ({
          id: `attempt:withdrawal:${id}`,
          source: "withdrawal_attempt" as const,
          type: "withdrawal",
          label: "Retrait",
          direction: "out" as const,
          amount: (data.amountUsd as number) ?? 0,
          currency: "USD",
          status: (data.status as string) ?? "pending",
          method: "mobile_money",
          operator: (data.operator as string) ?? null,
          phone: (data.phone as string) ?? null,
          participantName: names.get(data.userId as string) ?? "—",
          secondaryParticipantName: null,
          reference: id,
          createdAt: (data.createdAt as Timestamp) ?? null,
          externalInvoiceDocId: null,
          reconciliationStatus: "not_applicable" as const,
          feeUsd: null,
        })),
      ];

      const rows = [...ledgerRows, ...attemptRows].sort(
        (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0),
      );

      return { rows, hasMore: ledgerSnap.docs.length === pageSize };
    },
    staleTime: 30_000,
  });
}

export interface TransactionTimelineStep {
  label: string;
  at: Timestamp;
}

export interface TransactionDetail extends TransactionRow {
  timeline: TransactionTimelineStep[];
  notificationStatus: "sent" | "failed" | "not_applicable";
  notificationFailureReason: string | null;
  reconciliationNote: string | null;
  reconciliationResolvedByName: string | null;
  reconciliationResolutionNote: string | null;
}

async function fetchAttemptDetail(source: "deposit" | "withdrawal", id: string): Promise<TransactionDetail | null> {
  const col = source === "deposit" ? "deposits" : "withdrawals";
  const snap = await getDoc(doc(db, col, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  const names = await resolveUserNames([data.userId as string]);

  const timeline: TransactionTimelineStep[] = [];
  if (data.createdAt) timeline.push({ label: "Paiement initié", at: data.createdAt as Timestamp });
  if (data.status === "processing") timeline.push({ label: "Envoyé à l'opérateur", at: (data.updatedAt as Timestamp) ?? (data.createdAt as Timestamp) });
  if (data.status === "failed" && data.failedAt) timeline.push({ label: "Échec signalé par l'opérateur", at: data.failedAt as Timestamp });

  return {
    id: `attempt:${source}:${id}`,
    source: source === "deposit" ? "deposit_attempt" : "withdrawal_attempt",
    type: source,
    label: source === "deposit" ? "Dépôt" : "Retrait",
    direction: source === "deposit" ? "in" : "out",
    amount: (data.amountUsd as number) ?? 0,
    currency: "USD",
    status: (data.status as string) ?? "pending",
    method: "mobile_money",
    operator: (data.operator as string) ?? null,
    phone: (data.phone as string) ?? null,
    participantName: names.get(data.userId as string) ?? "—",
    secondaryParticipantName: null,
    reference: id,
    createdAt: (data.createdAt as Timestamp) ?? null,
    externalInvoiceDocId: null,
    reconciliationStatus: "not_applicable",
    feeUsd: null,
    timeline,
    notificationStatus: "not_applicable",
    notificationFailureReason: null,
    reconciliationNote: null,
    reconciliationResolvedByName: null,
    reconciliationResolutionNote: null,
  };
}

async function fetchLedgerDetail(id: string): Promise<TransactionDetail | null> {
  const snap = await getDoc(doc(db, "transactions", id));
  if (!snap.exists()) return null;
  const data = snap.data();

  const names = await resolveUserNames([data.userId, data.fromUid, data.toUid, data.reconciliationResolvedBy] as (string | undefined)[]);

  const meta = txTypeMeta(data.type as string);
  const { amount, currency } = txAmount(data as { amountUsd?: number; amountCdf?: number; currency?: string });

  const timeline: TransactionTimelineStep[] = [];
  let operator: string | null = null;
  let phone: string | null = null;

  if ((data.type === "deposit" || data.type === "withdrawal") && (data.pawapayDepositId || data.pawapayPayoutId)) {
    const col = data.type === "deposit" ? "deposits" : "withdrawals";
    const refId = (data.pawapayDepositId ?? data.pawapayPayoutId) as string;
    const subSnap = await getDoc(doc(db, col, refId));
    const sub = subSnap.data();
    if (sub) {
      operator = (sub.operator as string) ?? null;
      phone = (sub.phone as string) ?? null;
      if (sub.createdAt) timeline.push({ label: "Demande envoyée à l'opérateur", at: sub.createdAt as Timestamp });
      if (sub.completedAt) timeline.push({ label: "Confirmé par l'opérateur", at: sub.completedAt as Timestamp });
    }
  } else if (data.createdAt) {
    timeline.push({ label: "Transaction enregistrée", at: data.createdAt as Timestamp });
  }

  let notificationStatus: TransactionDetail["notificationStatus"] = "not_applicable";
  let notificationFailureReason: string | null = null;

  if (data.type === "external_invoice_payment" && data.externalInvoiceDocId) {
    const invoiceSnap = await getDoc(doc(db, "external_invoices", data.externalInvoiceDocId as string));
    const invoice = invoiceSnap.data();
    if (invoice?.paidAt) timeline.push({ label: "Facture marquée payée", at: invoice.paidAt as Timestamp });

    const failuresSnap = await getDocs(
      query(collection(db, "outbound_notification_failures"), where("invoiceId", "==", data.externalInvoiceDocId), limit(1)),
    );
    if (!failuresSnap.empty) {
      notificationStatus = "failed";
      notificationFailureReason = (failuresSnap.docs[0].data().error as string) ?? null;
    } else if (invoice?.status === "paid" || invoice?.status === "failed") {
      // No failure record recorded for this invoice — inferred success.
      // There is no explicit "notification sent" timestamp stored anywhere,
      // so this is a pass/fail inference, not a precise event time.
      notificationStatus = "sent";
    }
  }

  return {
    id,
    source: "ledger",
    type: (data.type as string) ?? "—",
    label: meta.label,
    direction: meta.direction,
    amount,
    currency,
    status: (data.status as string) ?? "completed",
    method: (data.method as string) ?? null,
    operator,
    phone,
    participantName: names.get(data.userId as string) ?? names.get(data.fromUid as string) ?? "—",
    secondaryParticipantName: data.toUid ? (names.get(data.toUid as string) ?? null) : null,
    reference: txProviderRef(id, data),
    createdAt: (data.createdAt as Timestamp) ?? null,
    externalInvoiceDocId: (data.externalInvoiceDocId as string) ?? null,
    reconciliationStatus: (data.reconciliationStatus as ReconciliationStatus) ?? "unchecked",
    feeUsd: (data.feeUsd as number) ?? null,
    timeline,
    notificationStatus,
    notificationFailureReason,
    reconciliationNote: (data.reconciliationNote as string) ?? null,
    reconciliationResolvedByName: data.reconciliationResolvedBy ? (names.get(data.reconciliationResolvedBy as string) ?? null) : null,
    reconciliationResolutionNote: (data.reconciliationResolutionNote as string) ?? null,
  };
}

export function useTransactionDetail(id: string | undefined) {
  return useQuery<TransactionDetail | null>({
    queryKey: ["admin-transaction-detail", id],
    queryFn: async () => {
      if (!id) return null;
      if (id.startsWith("attempt:deposit:")) return fetchAttemptDetail("deposit", id.slice("attempt:deposit:".length));
      if (id.startsWith("attempt:withdrawal:")) return fetchAttemptDetail("withdrawal", id.slice("attempt:withdrawal:".length));
      return fetchLedgerDetail(id);
    },
    enabled: !!id,
  });
}

export function useResendPartnerNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const fn = httpsCallable<{ invoiceId: string }, { success: boolean }>(functions, "adminRetryPartnerNotification");
      return (await fn({ invoiceId })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-transaction-detail"] });
    },
  });
}

export function useResolveReconciliationException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { transactionId: string; note: string }) => {
      const fn = httpsCallable<typeof payload, { success: boolean }>(functions, "resolveReconciliationException");
      return (await fn(payload)).data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-transactions-v3"] });
      qc.invalidateQueries({ queryKey: ["admin-transaction-detail", variables.transactionId] });
    },
  });
}

export function useRunReconciliationCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const fn = httpsCallable<Record<string, never>, { checked: number; exceptions: number }>(functions, "runReconciliationCheck");
      return (await fn({})).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-transactions-v3"] });
    },
  });
}

export interface SupportTicket {
  id: string;
  description: string;
  createdByName: string;
  createdAt: Timestamp | null;
}

export function useSupportTickets(transactionId: string | undefined) {
  return useQuery<SupportTicket[]>({
    queryKey: ["admin-support-tickets", transactionId],
    queryFn: async () => {
      // No orderBy here deliberately — where(...) + orderBy on a different
      // field needs a composite index that doesn't exist yet; sort
      // client-side instead (same pattern as admin.service.ts's merchant query).
      const snap = await getDocs(query(collection(db, "support_tickets"), where("transactionId", "==", transactionId)));
      const names = await resolveUserNames(snap.docs.map((d) => d.data().createdBy as string));
      return snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            description: (data.description as string) ?? "",
            createdByName: names.get(data.createdBy as string) ?? (data.createdBy as string),
            createdAt: (data.createdAt as Timestamp) ?? null,
          } satisfies SupportTicket;
        })
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    },
    enabled: !!transactionId,
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { transactionId: string; description: string }) => {
      const fn = httpsCallable<typeof payload, { ticketId: string }>(functions, "createSupportTicket");
      return (await fn(payload)).data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets", variables.transactionId] });
    },
  });
}

/** Mombongo-generated payment confirmation — never a provider-issued receipt image, since no such thing exists for any provider integrated here. Uses only real fields already shown in the detail view. */
export function downloadReceipt(tx: TransactionDetail) {
  const lines = [
    "MOMBONGO — Confirmation de paiement",
    "(Document généré par Mombongo — pas un reçu émis par l'opérateur)",
    "",
    `Référence : ${tx.reference}`,
    `Type : ${tx.label}`,
    `Participant : ${tx.participantName}${tx.secondaryParticipantName ? ` → ${tx.secondaryParticipantName}` : ""}`,
    `Montant : ${tx.amount} ${tx.currency}`,
    `Méthode : ${tx.method ?? "—"}${tx.operator ? ` · ${tx.operator}` : ""}`,
    `Statut : ${tx.status}`,
    `Date : ${tx.createdAt ? new Date(tx.createdAt.seconds * 1000).toLocaleString("fr-FR") : "—"}`,
    `Frais opérateur : ${tx.feeUsd != null ? `${tx.feeUsd} ${tx.currency}` : "non communiqué"}`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mombongo-confirmation-${tx.reference}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

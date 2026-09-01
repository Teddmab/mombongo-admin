import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import {
  collection, doc, getDoc, getDocs, orderBy, query, limit, where, Timestamp,
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { txTypeMeta, txAmount, txProviderRef, type TxDirection } from "@/lib/transactionDisplay";

const TX_LIST_CAP = 150;

export type ReconciliationStatus = "matched" | "exception" | "not_applicable" | "resolved_manually" | "unchecked";

export interface TransactionRow {
  id: string;
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
  reference: string;
  createdAt: Timestamp | null;
  /** Only set for external_invoice_payment rows — used to route the resend-notification action. */
  externalInvoiceDocId: string | null;
  /** "unchecked" (not "not_applicable") when reconcileTransactions hasn't processed this row yet — those are two different things and must not be conflated. */
  reconciliationStatus: ReconciliationStatus;
}

async function resolveUserNames(uids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  const entries = await Promise.all(
    unique.map(async (uid) => {
      const snap = await getDoc(doc(db, "users", uid));
      const name = snap.exists() ? ((snap.data().fullName as string) || (snap.data().displayName as string)) : null;
      return [uid, name || uid] as const;
    }),
  );
  return new Map(entries);
}

/** deposits/{pawapayDepositId} and withdrawals/{pawapayPayoutId} are the only two collections that actually store a mobile-money operator — transactions themselves don't. */
async function resolveOperators(rows: { type: string; data: Record<string, unknown> }[]): Promise<Map<string, string>> {
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
      return [`${l.collection}/${l.id}`, (snap.data()?.operator as string) ?? null] as const;
    }),
  );
  return new Map(entries.filter(([, v]) => v !== null) as [string, string][]);
}

export function useTransactions() {
  return useQuery<TransactionRow[]>({
    queryKey: ["admin-transactions-v2"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(TX_LIST_CAP)));
      const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));

      const allUids = docs.flatMap(({ data }) => [data.userId, data.fromUid, data.toUid].filter(Boolean) as string[]);
      const [names, operators] = await Promise.all([
        resolveUserNames(allUids),
        resolveOperators(docs.map(({ data }) => ({ type: data.type as string, data }))),
      ]);

      return docs.map(({ id, data }) => {
        const meta = txTypeMeta(data.type as string);
        const { amount, currency } = txAmount(data as { amountUsd?: number; amountCdf?: number; currency?: string });
        const operatorKey = data.pawapayDepositId ? `deposits/${data.pawapayDepositId}` : data.pawapayPayoutId ? `withdrawals/${data.pawapayPayoutId}` : null;

        return {
          id,
          type: (data.type as string) ?? "—",
          label: meta.label,
          direction: meta.direction,
          amount,
          currency,
          status: (data.status as string) ?? "pending",
          method: (data.method as string) ?? null,
          operator: operatorKey ? (operators.get(operatorKey) ?? null) : null,
          participantName: names.get(data.userId as string) ?? names.get(data.fromUid as string) ?? "—",
          secondaryParticipantName: data.toUid ? (names.get(data.toUid as string) ?? null) : null,
          reference: txProviderRef(id, data),
          createdAt: (data.createdAt as Timestamp) ?? null,
          externalInvoiceDocId: (data.externalInvoiceDocId as string) ?? null,
          reconciliationStatus: (data.reconciliationStatus as ReconciliationStatus) ?? "unchecked",
        } satisfies TransactionRow;
      });
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
  /** null means "not communicated by the operator," never zero — see extractPawapayFee's own doc comment on why this can't be assumed present. */
  feeUsd: number | null;
  reconciliationNote: string | null;
  reconciliationResolvedByName: string | null;
  reconciliationResolutionNote: string | null;
}

export function useTransactionDetail(id: string | undefined) {
  return useQuery<TransactionDetail | null>({
    queryKey: ["admin-transaction-detail", id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "transactions", id!));
      if (!snap.exists()) return null;
      const data = snap.data();

      const [names] = await Promise.all([
        resolveUserNames([data.userId, data.fromUid, data.toUid, data.reconciliationResolvedBy].filter(Boolean) as string[]),
      ]);

      const meta = txTypeMeta(data.type as string);
      const { amount, currency } = txAmount(data as { amountUsd?: number; amountCdf?: number; currency?: string });

      const timeline: TransactionTimelineStep[] = [];
      let operator: string | null = null;

      if ((data.type === "deposit" || data.type === "withdrawal") && (data.pawapayDepositId || data.pawapayPayoutId)) {
        const col = data.type === "deposit" ? "deposits" : "withdrawals";
        const refId = (data.pawapayDepositId ?? data.pawapayPayoutId) as string;
        const subSnap = await getDoc(doc(db, col, refId));
        const sub = subSnap.data();
        if (sub) {
          operator = (sub.operator as string) ?? null;
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
        id: id!,
        type: (data.type as string) ?? "—",
        label: meta.label,
        direction: meta.direction,
        amount,
        currency,
        status: (data.status as string) ?? "pending",
        method: (data.method as string) ?? null,
        operator,
        participantName: names.get(data.userId as string) ?? names.get(data.fromUid as string) ?? "—",
        secondaryParticipantName: data.toUid ? (names.get(data.toUid as string) ?? null) : null,
        reference: txProviderRef(id!, data),
        createdAt: (data.createdAt as Timestamp) ?? null,
        externalInvoiceDocId: (data.externalInvoiceDocId as string) ?? null,
        reconciliationStatus: (data.reconciliationStatus as ReconciliationStatus) ?? "unchecked",
        timeline,
        notificationStatus,
        notificationFailureReason,
        feeUsd: (data.feeUsd as number) ?? null,
        reconciliationNote: (data.reconciliationNote as string) ?? null,
        reconciliationResolvedByName: data.reconciliationResolvedBy ? (names.get(data.reconciliationResolvedBy as string) ?? null) : null,
        reconciliationResolutionNote: (data.reconciliationResolutionNote as string) ?? null,
      } satisfies TransactionDetail;
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
      qc.invalidateQueries({ queryKey: ["admin-transactions-v2"] });
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
      qc.invalidateQueries({ queryKey: ["admin-transactions-v2"] });
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

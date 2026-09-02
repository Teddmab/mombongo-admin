import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { collection, doc, getDoc, getDocs, orderBy, query, limit, Timestamp } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";

export type InvoiceOrigin = "partner_api" | "harvest_sale" | "admin_assisted";

export interface PartnerInvoiceRow {
  id: string;
  origin: InvoiceOrigin;
  partnerId: string | null;
  farmerName: string | null;
  /** All issuers — a single farmer's name, or every member of a cooperative when isCooperative is true. */
  farmerNames: string[];
  isCooperative: boolean;
  merchantName: string | null;
  amountUsd: number;
  method: string | null;
  status: string;
  createdAt: Timestamp | null;
}

/** farmers[] entries are {farmerId, contributedKg} — resolves each to a "Name (Xkg)" label for cooperative invoices. */
function resolveFarmerNames(
  data: Record<string, unknown>,
  names: Map<string, string>,
): string[] {
  const farmers = data.farmers as { farmerId: string; contributedKg: number }[] | undefined;
  if (Array.isArray(farmers) && farmers.length > 0) {
    return farmers.map((f) => `${names.get(f.farmerId) ?? f.farmerId} (${f.contributedKg} kg)`);
  }
  const farmerId = data.farmerId as string | undefined;
  return farmerId ? [names.get(farmerId) ?? farmerId] : [];
}

export const ORIGIN_LABEL: Record<InvoiceOrigin, string> = {
  partner_api: "API partenaire",
  harvest_sale: "Créée par l'agriculteur",
  admin_assisted: "Créée avec assistance admin",
};

async function resolveNames(uids: (string | undefined)[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(uids.filter((u): u is string => !!u)));
  const entries = await Promise.all(
    unique.map(async (uid) => {
      const snap = await getDoc(doc(db, "users", uid));
      const name = snap.exists() ? ((snap.data().fullName as string) || (snap.data().displayName as string)) : null;
      return [uid, name || uid] as const;
    }),
  );
  return new Map(entries);
}

export function usePartnerInvoices() {
  return useQuery<PartnerInvoiceRow[]>({
    queryKey: ["admin-partner-invoices-v2"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "external_invoices"), orderBy("createdAt", "desc"), limit(100)));
      const docs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
      const allFarmerIds = docs.flatMap(({ data }) =>
        Array.isArray(data.farmers) ? (data.farmers as { farmerId: string }[]).map((f) => f.farmerId) : [data.farmerId as string | undefined]);
      const names = await resolveNames([...allFarmerIds, ...docs.map(({ data }) => data.merchantId as string | undefined)]);

      return docs.map(({ id, data }) => ({
        id,
        origin: (data.origin as InvoiceOrigin) ?? "partner_api",
        partnerId: (data.partnerId as string) ?? null,
        farmerName: data.farmerId ? (names.get(data.farmerId as string) ?? null) : null,
        farmerNames: resolveFarmerNames(data, names),
        isCooperative: !!data.isCooperative,
        merchantName: data.merchantId ? (names.get(data.merchantId as string) ?? null) : null,
        amountUsd: (data.amountUsd as number) ?? 0,
        method: (data.method as string) ?? null,
        status: (data.status as string) ?? "pending",
        createdAt: (data.createdAt as Timestamp) ?? null,
      } satisfies PartnerInvoiceRow));
    },
    staleTime: 30_000,
  });
}

export interface PartnerInvoiceDetail extends PartnerInvoiceRow {
  externalInvoiceId: string;
  reference: string | null;
  currency: string;
  testMode: boolean;
  providerRef: string | null;
  paidAt: Timestamp | null;
  failedAt: Timestamp | null;
  adminAssisted: { actorName: string; consentMethod: string; consentAt: Timestamp; note: string | null } | null;
}

export const CONSENT_LABEL: Record<string, string> = { phone: "Appel téléphonique", in_person: "Présent avec l'agriculteur", field_agent: "Agent terrain" };

export function usePartnerInvoiceDetail(id: string | undefined) {
  return useQuery<PartnerInvoiceDetail | null>({
    queryKey: ["admin-partner-invoice-v2", id],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "external_invoices", id!));
      if (!snap.exists()) return null;
      const data = snap.data();

      const farmerIds = Array.isArray(data.farmers) ? (data.farmers as { farmerId: string }[]).map((f) => f.farmerId) : [data.farmerId];
      const names = await resolveNames([...farmerIds, data.merchantId, data.adminAssisted?.actorUid]);

      return {
        id: id!,
        origin: (data.origin as InvoiceOrigin) ?? "partner_api",
        partnerId: (data.partnerId as string) ?? null,
        farmerName: data.farmerId ? (names.get(data.farmerId as string) ?? null) : null,
        farmerNames: resolveFarmerNames(data, names),
        isCooperative: !!data.isCooperative,
        merchantName: data.merchantId ? (names.get(data.merchantId as string) ?? null) : null,
        amountUsd: (data.amountUsd as number) ?? 0,
        method: (data.method as string) ?? null,
        status: (data.status as string) ?? "pending",
        createdAt: (data.createdAt as Timestamp) ?? null,
        externalInvoiceId: (data.externalInvoiceId as string) ?? id!,
        reference: (data.reference as string) ?? null,
        currency: (data.currency as string) ?? "USD",
        testMode: !!data.testMode,
        providerRef: (data.providerRef as string) ?? null,
        paidAt: (data.paidAt as Timestamp) ?? null,
        failedAt: (data.failedAt as Timestamp) ?? null,
        adminAssisted: data.adminAssisted
          ? {
              actorName: names.get(data.adminAssisted.actorUid as string) ?? data.adminAssisted.actorUid,
              consentMethod: data.adminAssisted.consentMethod as string,
              consentAt: data.adminAssisted.consentAt as Timestamp,
              note: (data.adminAssisted.note as string) ?? null,
            }
          : null,
      } satisfies PartnerInvoiceDetail;
    },
    enabled: !!id,
  });
}

export interface FailedNotificationRow {
  id: string;
  invoiceId: string;
  partnerId: string;
  error: string;
  failedAt?: { seconds: number };
}

export function useFailedNotifications() {
  return useQuery<FailedNotificationRow[]>({
    queryKey: ["admin-partner-notification-failures"],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, "outbound_notification_failures"), orderBy("failedAt", "desc"), limit(50)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FailedNotificationRow);
    },
  });
}

export function useRetryPartnerNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const fn = httpsCallable(functions, "adminRetryPartnerNotification");
      return (await fn({ invoiceId })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-partner-notification-failures"] });
      qc.invalidateQueries({ queryKey: ["admin-partner-invoices-v2"] });
    },
  });
}

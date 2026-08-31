import { useQuery } from "@tanstack/react-query";
import {
  collection, query, where, getDocs, getCountFromServer, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ─── Partner invoices awaiting payment ──────────────────────────────────
   Real counts from external_invoices — a "pending" invoice is awaiting
   payment; "overdue" is the subset older than 7 days, same collection
   AdminPartnerInvoices.tsx already reads (SAI-01/SAI-05). No SLA field
   exists yet, so "7 days" is computed from createdAt, not a stored value. */

export interface InvoiceSummary {
  pendingCount: number;
  overdueCount: number;
}

export function useInvoiceSummary() {
  return useQuery<InvoiceSummary>({
    queryKey: ["admin-command-center", "invoices"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "external_invoices"), where("status", "==", "pending")),
      );
      const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
      let overdueCount = 0;
      snap.docs.forEach((d) => {
        const createdAt = d.data().createdAt as Timestamp | undefined;
        if (createdAt && createdAt.toMillis() <= sevenDaysAgo.toMillis()) overdueCount += 1;
      });
      return { pendingCount: snap.size, overdueCount };
    },
    staleTime: 60_000,
    refetchInterval: 60_000, // matches useAdminKpis' cadence so the whole dashboard refreshes together
  });
}

/* ─── Active partners ─────────────────────────────────────────────────── */

export function usePartnerSummary() {
  return useQuery<{ activeCount: number }>({
    queryKey: ["admin-command-center", "partners"],
    queryFn: async () => {
      const snap = await getCountFromServer(
        query(collection(db, "partners"), where("active", "==", true)),
      );
      return { activeCount: snap.data().count };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/* ─── Alerts requiring attention ──────────────────────────────────────────
   Deliberately excludes pendingKyc — that already has its own priority
   card — to avoid double-counting the same dossiers in two places. */

export function useOperationalAlertCount() {
  return useQuery<{ count: number }>({
    queryKey: ["admin-command-center", "alerts"],
    queryFn: async () => {
      const [farmersSnap, txSnap] = await Promise.all([
        getCountFromServer(query(collection(db, "farmers"), where("status", "==", "pending"))),
        getCountFromServer(query(collection(db, "transactions"), where("status", "==", "failed"))),
      ]);
      return { count: farmersSnap.data().count + txSnap.data().count };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

/* ─── Payment activity, daily-bucketed over a selectable window ─────────
   Same transactions/amountUsd/createdAt fields useMonthlyVolume and
   getDashboardKpis already rely on, just bucketed by day instead of
   by month so the period control (7/30/90j) has real granularity. */

export type PaymentActivityPeriod = 7 | 30 | 90;

export interface DayPoint { day: string; volumeUsd: number }

export function usePaymentActivity(days: PaymentActivityPeriod) {
  return useQuery<DayPoint[]>({
    queryKey: ["admin-command-center", "payment-activity", days],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      start.setHours(0, 0, 0, 0);
      const startTs = Timestamp.fromDate(start);

      const snap = await getDocs(
        query(collection(db, "transactions"), where("createdAt", ">=", startTs)),
      );

      const buckets = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        buckets.set(d.toISOString().slice(0, 10), 0);
      }

      snap.docs.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt as Timestamp | undefined;
        if (!createdAt) return;
        const key = createdAt.toDate().toISOString().slice(0, 10);
        if (buckets.has(key)) {
          buckets.set(key, (buckets.get(key) ?? 0) + ((data.amountUsd as number) ?? 0));
        }
      });

      return Array.from(buckets.entries()).map(([iso, volumeUsd]) => ({
        day: new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        volumeUsd,
      }));
    },
    staleTime: 120_000,
  });
}

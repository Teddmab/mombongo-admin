import { useQuery } from "@tanstack/react-query";
import {
  collection, query, where, orderBy, limit, getDocs, getDoc, doc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ─── Real data model ────────────────────────────────────────────────────
   Investor identity/wallet: users/{uid} (role: 'investor'). Investments:
   investments/{id} (investorId == uid). Transactions: transactions/{id}
   (userId == uid) — deposits, withdrawals, investment purchases, etc. */

export interface InvestorListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  walletUsd: number;
  walletCdf: number;
  totalInvestedUsd: number;
  totalEarnedUsd: number;
  kycStatus: "pending" | "verified" | "rejected" | "correction_requested" | "none";
  isActive: boolean;
  createdAt: Timestamp | null;
}

const INVESTOR_LIST_CAP = 100;

function toListItem(id: string, user: Record<string, unknown>): InvestorListItem {
  return {
    id,
    fullName: (user.fullName as string) || (user.displayName as string) || "—",
    phone: (user.phone as string) || "",
    email: (user.email as string) || "",
    walletUsd: (user.walletUsd as number) ?? 0,
    walletCdf: (user.walletCdf as number) ?? 0,
    totalInvestedUsd: (user.totalInvestedUsd as number) ?? 0,
    totalEarnedUsd: (user.totalEarnedUsd as number) ?? 0,
    kycStatus: (user.kycStatus as InvestorListItem["kycStatus"]) ?? "none",
    isActive: user.isActive !== false,
    createdAt: (user.createdAt as Timestamp) ?? null,
  };
}

export function useInvestors() {
  return useQuery<InvestorListItem[]>({
    queryKey: ["admin-investors"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "==", "investor"), orderBy("createdAt", "desc"), limit(INVESTOR_LIST_CAP)),
      );
      return snap.docs.map((d) => toListItem(d.id, d.data()));
    },
    staleTime: 30_000,
  });
}

export interface InvestmentRow { id: string; productTitle: string; amountUsd: number; status: string }
export interface InvestorTxRow { id: string; type: string; amountUsd: number; status: string; createdAt: Timestamp | null }

export interface InvestorDetail extends InvestorListItem {
  investments: InvestmentRow[];
  transactions: InvestorTxRow[];
}

export function useInvestorDetail(uid: string | undefined) {
  return useQuery<InvestorDetail | null>({
    queryKey: ["admin-investor-detail", uid],
    queryFn: async () => {
      const userSnap = await getDoc(doc(db, "users", uid!));
      if (!userSnap.exists()) return null;

      const [investmentsSnap, txSnap] = await Promise.all([
        getDocs(query(collection(db, "investments"), where("investorId", "==", uid), orderBy("investedAt", "desc"), limit(20))),
        getDocs(query(collection(db, "transactions"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(20))),
      ]);

      return {
        ...toListItem(uid!, userSnap.data()),
        investments: investmentsSnap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, productTitle: (data.productTitle as string) ?? "—", amountUsd: (data.amountUsd as number) ?? 0, status: (data.status as string) ?? "—" };
        }),
        transactions: txSnap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, type: (data.type as string) ?? "—", amountUsd: (data.amountUsd as number) ?? 0, status: (data.status as string) ?? "—", createdAt: (data.createdAt as Timestamp) ?? null };
        }),
      } satisfies InvestorDetail;
    },
    enabled: !!uid,
  });
}

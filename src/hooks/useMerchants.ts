import { useQuery } from "@tanstack/react-query";
import {
  collection, query, where, orderBy, limit, getDocs, getDoc, doc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ─── Real data model ────────────────────────────────────────────────────
   Merchant identity: users/{uid} (role: 'merchant'). Offers made on
   farmers' listings: harvest_offers/{id} (merchantId == uid) — the
   merchantId+createdAt composite index already exists (it backs the
   getMyHarvestOffers CF's identical query). Invoices as buyer:
   external_invoices/{id} (merchantId == uid) — no composite index for
   this one, so this fetches by equality only and sorts client-side
   rather than deploying an index for a page this size doesn't need. */

export interface MerchantListItem {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  businessType: string | null;
  walletUsd: number;
  offersCount: number;
  kycStatus: "pending" | "verified" | "rejected" | "correction_requested" | "none";
  isActive: boolean;
  createdAt: Timestamp | null;
}

const MERCHANT_LIST_CAP = 100;

function toListItem(id: string, user: Record<string, unknown>, offersCount: number): MerchantListItem {
  return {
    id,
    fullName: (user.fullName as string) || (user.displayName as string) || "—",
    phone: (user.phone as string) || "",
    email: (user.email as string) || "",
    businessType: (user.businessType as string) ?? null,
    walletUsd: (user.walletUsd as number) ?? 0,
    offersCount,
    kycStatus: (user.kycStatus as MerchantListItem["kycStatus"]) ?? "none",
    isActive: user.isActive !== false,
    createdAt: (user.createdAt as Timestamp) ?? null,
  };
}

async function countOffers(merchantUid: string): Promise<number> {
  const snap = await getDocs(query(collection(db, "harvest_offers"), where("merchantId", "==", merchantUid)));
  return snap.size;
}

export function useMerchants() {
  return useQuery<MerchantListItem[]>({
    queryKey: ["admin-merchants"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "==", "merchant"), orderBy("createdAt", "desc"), limit(MERCHANT_LIST_CAP)),
      );
      return Promise.all(snap.docs.map(async (d) => toListItem(d.id, d.data(), await countOffers(d.id))));
    },
    staleTime: 30_000,
  });
}

export interface MerchantOfferRow {
  id: string; farmerName: string; offerQuantityKg: number; offerPricePerKgCdf: number; status: string; createdAt: Timestamp | null;
}
export interface MerchantInvoiceRow { id: string; amountUsd: number; status: string; origin: string; createdAt: Timestamp | null }

export interface MerchantDetail extends MerchantListItem {
  recentOffers: MerchantOfferRow[];
  recentInvoices: MerchantInvoiceRow[];
}

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

export function useMerchantDetail(uid: string | undefined) {
  return useQuery<MerchantDetail | null>({
    queryKey: ["admin-merchant-detail", uid],
    queryFn: async () => {
      const userSnap = await getDoc(doc(db, "users", uid!));
      if (!userSnap.exists()) return null;

      const [offersSnap, invoicesSnap, offersCount] = await Promise.all([
        getDocs(query(collection(db, "harvest_offers"), where("merchantId", "==", uid), orderBy("createdAt", "desc"), limit(20))),
        getDocs(query(collection(db, "external_invoices"), where("merchantId", "==", uid), limit(50))),
        countOffers(uid!),
      ]);

      const names = await resolveNames(offersSnap.docs.map((d) => d.data().farmerId as string | undefined));

      const recentOffers = offersSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          farmerName: data.farmerId ? (names.get(data.farmerId as string) ?? data.farmerId as string) : "—",
          offerQuantityKg: (data.offerQuantityKg as number) ?? 0,
          offerPricePerKgCdf: (data.offerPricePerKgCdf as number) ?? 0,
          status: (data.status as string) ?? "—",
          createdAt: (data.createdAt as Timestamp) ?? null,
        } satisfies MerchantOfferRow;
      });

      const recentInvoices = invoicesSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            amountUsd: (data.amountUsd as number) ?? 0,
            status: (data.status as string) ?? "—",
            origin: (data.origin as string) ?? "—",
            createdAt: (data.createdAt as Timestamp) ?? null,
          } satisfies MerchantInvoiceRow;
        })
        .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
        .slice(0, 20);

      return {
        ...toListItem(uid!, userSnap.data(), offersCount),
        recentOffers,
        recentInvoices,
      } satisfies MerchantDetail;
    },
    enabled: !!uid,
  });
}

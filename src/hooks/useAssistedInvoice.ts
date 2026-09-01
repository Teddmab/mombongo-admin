import { useMutation, useQuery } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db, functions } from "@/lib/firebase";

/* ─── Real data model ──────────────────────────────────────────────────────
   Farmer/merchant: users (role: 'farmer'|'merchant'), kycStatus === 'approved'
   is the real verification gate everywhere else in the app reads. Listings:
   product_listings (sellerId, quantityKg, pricePerKgCdf, status). There is
   no "delivery/reception" record for this flow — the mockup's "Livraison"
   step and AROM-reception comparison don't correspond to anything real for
   an in-app assisted sale, so this only asks for a listing + quantity. */

export interface EligiblePerson {
  uid: string;
  fullName: string;
  phone: string;
  province: string | null;
  kycApproved: boolean;
}

async function fetchApprovedUsersByRole(role: "farmer" | "merchant"): Promise<EligiblePerson[]> {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", role), limit(200)));
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        fullName: (data.fullName as string) || (data.displayName as string) || "—",
        phone: (data.phone as string) || "",
        province: (data.province as string) ?? null,
        kycApproved: data.kycStatus === "approved",
      } satisfies EligiblePerson;
    })
    .filter((p) => p.kycApproved); // ineligible people are simply not offered — the CF re-checks this server-side regardless
}

export function useEligibleFarmers() {
  return useQuery({ queryKey: ["assisted-invoice-farmers"], queryFn: () => fetchApprovedUsersByRole("farmer"), staleTime: 30_000 });
}

export function useEligibleMerchants() {
  return useQuery({ queryKey: ["assisted-invoice-merchants"], queryFn: () => fetchApprovedUsersByRole("merchant"), staleTime: 30_000 });
}

export interface FarmerListing {
  id: string;
  commodity: string;
  quantityKg: number;
  pricePerKgCdf: number;
  province: string | null;
}

export function useFarmerListings(farmerId: string | undefined) {
  return useQuery<FarmerListing[]>({
    queryKey: ["assisted-invoice-listings", farmerId],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "product_listings"), where("sellerId", "==", farmerId), where("status", "==", "active")),
      );
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          commodity: (data.commodity as string) ?? "—",
          quantityKg: (data.quantityKg as number) ?? 0,
          pricePerKgCdf: (data.pricePerKgCdf as number) ?? 0,
          province: (data.province as string) ?? null,
        } satisfies FarmerListing;
      });
    },
    enabled: !!farmerId,
  });
}

/** Preview only — the server recomputes this authoritatively from the live rate at creation time, so this is just for showing the admin a realistic total before they submit. */
export function useExchangeRatePreview() {
  return useQuery({
    queryKey: ["assisted-invoice-exchange-rate"],
    queryFn: async () => {
      const fn = httpsCallable<Record<string, never>, { rate: number; updatedAt: string }>(functions, "getExchangeRate");
      return (await fn({})).data.rate;
    },
    staleTime: 5 * 60_000,
  });
}

export type ConsentMethod = "phone" | "in_person" | "field_agent";

export interface CreateAssistedInvoiceInput {
  clientRequestId: string;
  farmerId: string;
  merchantId: string;
  listingId: string;
  quantityKg: number;
  consentMethod: ConsentMethod;
  consentAt: string;
  note?: string;
}

export function useCreateAssistedInvoice() {
  return useMutation({
    mutationFn: async (payload: CreateAssistedInvoiceInput) => {
      const fn = httpsCallable<CreateAssistedInvoiceInput, { invoiceId: string; amountUsd: number }>(
        functions, "adminCreateAssistedInvoice",
      );
      return (await fn(payload)).data;
    },
  });
}

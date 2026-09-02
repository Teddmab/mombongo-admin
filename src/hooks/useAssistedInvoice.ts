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
  avatarUrl: string | null;
  isActive: boolean;
  kycApproved: boolean;
}

export interface EligiblePeopleResult {
  eligible: EligiblePerson[];
  /** Every user with this role, before the KYC-approved filter — lets the picker explain an empty/short list ("3 commerçants, aucun avec KYC approuvé") instead of looking broken. */
  totalCount: number;
}

async function fetchApprovedUsersByRole(role: "farmer" | "merchant"): Promise<EligiblePeopleResult> {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", role), limit(200)));
  const all = snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      fullName: (data.fullName as string) || (data.displayName as string) || "—",
      phone: (data.phone as string) || "",
      province: (data.province as string) ?? null,
      avatarUrl: (data.avatarUrl as string) ?? null,
      isActive: data.isActive !== false,
      kycApproved: data.kycStatus === "approved",
    } satisfies EligiblePerson;
  });
  // Ineligible people are simply not offered — the CF re-checks this server-side regardless.
  return { eligible: all.filter((p) => p.kycApproved), totalCount: all.length };
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

export interface FarmerContribution {
  farmerId: string;
  contributedKg: number;
}

export interface CreateAssistedInvoiceInput {
  clientRequestId: string;
  farmers: FarmerContribution[];
  merchantId: string;
  /** Only valid with a single farmer — omit for a cooperative, or a listing-less sale, and supply commodity/pricePerKgCdf instead. */
  listingId?: string;
  commodity?: string;
  pricePerKgCdf?: number;
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

export interface AdminCreatePersonInput {
  role: "farmer" | "merchant";
  fullName: string;
  phone: string;
  province?: string;
  businessType?: string;
  consentMethod: ConsentMethod;
  consentAt: string;
  note?: string;
}

export interface AdminCreatePersonResult {
  uid: string;
  isNew: boolean;
  fullName: string;
}

/** For the "pas encore sur la plateforme" case in the assisted-invoice wizard — creates a real, admin-attested farmer or merchant account, usable immediately (Teddy's call: no second KYC step nobody would complete for them). */
export function useAdminCreatePerson() {
  return useMutation({
    mutationFn: async (payload: AdminCreatePersonInput) => {
      const fn = httpsCallable<AdminCreatePersonInput, AdminCreatePersonResult>(functions, "adminCreatePerson");
      return (await fn(payload)).data;
    },
  });
}

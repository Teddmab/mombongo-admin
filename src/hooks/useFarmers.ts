import { useQuery } from "@tanstack/react-query";
import {
  collection, query, where, orderBy, limit, getDocs, getDoc, doc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ─── Real data model (verified against mombongo-functions source, not the
   mockup) ─────────────────────────────────────────────────────────────────
   Farmer identity/contact/status: users/{uid} (role: 'farmer'). Farm size,
   province and cultures: exploitations/{id} (farmerId == uid) +
   exploitations/{id}/cultures subcollection — NOT the legacy top-level
   `farmers` collection, which nothing in the current onboarding flow
   (completeOnboarding CF) ever writes to; it only holds old seed/demo data.
   Score: users.momBongoScore, written by the getMomBongoScore CF. KYC:
   users.kycStatus, mirrored from kyc_submissions/{uid} by submitKycDocuments
   and reviewKycSubmission. */

export interface FarmerListItem {
  id: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  province: string | null;
  primaryCommodity: string | null;
  totalHectares: number | null;
  /** Real checklist %: name + phone + avatar + exploitation set up + primary crop set, each worth 20. Not a backend field — there is no canonical "profile completion" value server-side. */
  completionPercent: number;
  momBongoScore: number | null;
  kycStatus: "pending" | "verified" | "rejected" | "correction_requested" | "none";
  isActive: boolean;
  updatedAt: Timestamp | null;
  createdAt: Timestamp | null;
}

export type FarmerSegment = "all" | "incomplete" | "active" | "suspended";

const FARMER_LIST_CAP = 60; // matches this platform's current real farmer count order of magnitude — see note in AdminFarmers.tsx if this needs to grow

async function loadFarmerExploitation(uid: string): Promise<{ province: string | null; totalHectares: number | null; primaryCommodity: string | null }> {
  const explSnap = await getDocs(
    query(collection(db, "exploitations"), where("farmerId", "==", uid), limit(3)),
  );
  if (explSnap.empty) return { province: null, totalHectares: null, primaryCommodity: null };

  // Primary = the largest exploitation by hectares (most farmers have exactly one)
  const primary = explSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as { id: string; province?: string; totalHectares?: number }))
    .sort((a, b) => (b.totalHectares ?? 0) - (a.totalHectares ?? 0))[0];

  const culturesSnap = await getDocs(
    query(collection(db, "exploitations", primary.id, "cultures"), where("status", "==", "active"), limit(5)),
  );
  const primaryCommodity = culturesSnap.empty
    ? null
    : culturesSnap.docs
        .map((d) => d.data() as { commodity?: string; surfaceHa?: number })
        .sort((a, b) => (b.surfaceHa ?? 0) - (a.surfaceHa ?? 0))[0]?.commodity ?? null;

  return {
    province: primary.province ?? null,
    totalHectares: primary.totalHectares ?? null,
    primaryCommodity,
  };
}

function completionPercentFor(user: Record<string, unknown>, hasExploitation: boolean, hasPrimaryCommodity: boolean): number {
  const checks = [
    !!(user.fullName || user.displayName),
    !!user.phone,
    !!user.avatarUrl,
    hasExploitation,
    hasPrimaryCommodity,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function useFarmers() {
  return useQuery<FarmerListItem[]>({
    queryKey: ["admin-farmers-v2"],
    queryFn: async () => {
      const usersSnap = await getDocs(
        query(collection(db, "users"), where("role", "==", "farmer"), orderBy("createdAt", "desc"), limit(FARMER_LIST_CAP)),
      );

      return Promise.all(
        usersSnap.docs.map(async (d) => {
          const user = d.data();
          const { province, totalHectares, primaryCommodity } = await loadFarmerExploitation(d.id);
          return {
            id: d.id,
            fullName: (user.fullName as string) || (user.displayName as string) || "—",
            phone: (user.phone as string) || "",
            avatarUrl: (user.avatarUrl as string) ?? null,
            province,
            primaryCommodity,
            totalHectares,
            completionPercent: completionPercentFor(user, province !== null, primaryCommodity !== null),
            momBongoScore: (user.momBongoScore as number) ?? null,
            kycStatus: (user.kycStatus as FarmerListItem["kycStatus"]) ?? "none",
            isActive: user.isActive !== false,
            updatedAt: (user.updatedAt as Timestamp) ?? null,
            createdAt: (user.createdAt as Timestamp) ?? null,
          } satisfies FarmerListItem;
        }),
      );
    },
    staleTime: 30_000,
  });
}

export interface FarmerDetail extends FarmerListItem {
  email: string;
  exploitationName: string | null;
  territory: string | null;
  cultures: { commodity: string; surfaceHa: number; status: string }[];
}

export function useFarmerDetail(uid: string | undefined) {
  return useQuery<FarmerDetail | null>({
    queryKey: ["admin-farmer-detail", uid],
    queryFn: async () => {
      const userSnap = await getDoc(doc(db, "users", uid!));
      if (!userSnap.exists()) return null;
      const user = userSnap.data();

      const explSnap = await getDocs(
        query(collection(db, "exploitations"), where("farmerId", "==", uid), limit(3)),
      );
      const primary = explSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .sort((a, b) => ((b.totalHectares as number) ?? 0) - ((a.totalHectares as number) ?? 0))[0];

      let cultures: FarmerDetail["cultures"] = [];
      if (primary) {
        const culturesSnap = await getDocs(collection(db, "exploitations", primary.id, "cultures"));
        cultures = culturesSnap.docs.map((c) => {
          const data = c.data();
          return { commodity: (data.commodity as string) ?? "—", surfaceHa: (data.surfaceHa as number) ?? 0, status: (data.status as string) ?? "active" };
        });
      }

      return {
        id: uid!,
        fullName: (user.fullName as string) || (user.displayName as string) || "—",
        phone: (user.phone as string) || "",
        email: (user.email as string) || "",
        avatarUrl: (user.avatarUrl as string) ?? null,
        province: (primary?.province as string) ?? null,
        territory: (primary?.territory as string) ?? null,
        exploitationName: (primary?.name as string) ?? null,
        totalHectares: (primary?.totalHectares as number) ?? null,
        primaryCommodity: cultures.sort((a, b) => b.surfaceHa - a.surfaceHa)[0]?.commodity ?? null,
        cultures,
        completionPercent: completionPercentFor(user, !!primary, cultures.length > 0),
        momBongoScore: (user.momBongoScore as number) ?? null,
        kycStatus: (user.kycStatus as FarmerListItem["kycStatus"]) ?? "none",
        isActive: user.isActive !== false,
        updatedAt: (user.updatedAt as Timestamp) ?? null,
        createdAt: (user.createdAt as Timestamp) ?? null,
      } satisfies FarmerDetail;
    },
    enabled: !!uid,
  });
}

export function segmentFilter(f: FarmerListItem, segment: FarmerSegment): boolean {
  if (segment === "all") return true;
  if (segment === "incomplete") return f.completionPercent < 100;
  if (segment === "suspended") return !f.isActive;
  if (segment === "active") return f.isActive && f.completionPercent === 100;
  return true;
}

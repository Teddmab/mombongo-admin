import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Farmer identity lives in `users` (role: 'farmer'). Crop/surface data does
 * NOT — it lives in `exploitations` (farmerId field) + `cultures` (a
 * top-level collection with an exploitationId field, confirmed from
 * getMomBongoScore.ts, not a subcollection). The previous admin.service.ts
 * read cropType/farmSizeHa/requestedAmountUsd/disbursedAmountUsd as if they
 * were flat `users` fields — they never were, so every farmer row's
 * Province/Culture/Surface columns were silently blank in production. This
 * replaces that with the real joins.
 *
 * Mombongo Score is deliberately NOT included: getMomBongoScore is a
 * self-service CF (context.auth.uid only), there is no admin-callable
 * variant to compute another user's score. Documented gap, not invented.
 */

export interface AdminFarmerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  province: string;
  primaryCrop: string | null;
  exploitationHectares: number | null;
  hasExploitation: boolean;
  profileCompletePct: number;
  kycStatus: string; // none | pending | approved | rejected
  isActive: boolean;
  lastActivityAt: number | null;
  createdAt: number | null;
}

interface RawExploitation { id: string; farmerId: string; totalHectares?: number; province?: string }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchExploitationsByFarmer(farmerIds: string[]): Promise<Map<string, RawExploitation>> {
  const byFarmer = new Map<string, RawExploitation>();
  if (farmerIds.length === 0) return byFarmer;
  // Firestore 'in' queries cap at 30 values per query.
  for (const ids of chunk(farmerIds, 30)) {
    const snap = await getDocs(query(collection(db, "exploitations"), where("farmerId", "in", ids)));
    for (const d of snap.docs) {
      const data = d.data() as Omit<RawExploitation, "id">;
      if (!byFarmer.has(data.farmerId)) byFarmer.set(data.farmerId, { id: d.id, ...data });
    }
  }
  return byFarmer;
}

async function fetchPrimaryCropByExploitation(exploitationIds: string[]): Promise<Map<string, string>> {
  const byExploitation = new Map<string, string>();
  if (exploitationIds.length === 0) return byExploitation;
  for (const ids of chunk(exploitationIds, 30)) {
    // Deliberately no status filter here (e.g. excluding archived cultures)
    // — combining it with the 'in' filter risks a missing-composite-index
    // runtime error, and this only needs *a* representative crop name, not
    // a precisely-current one.
    const snap = await getDocs(
      query(collection(db, "cultures"), where("exploitationId", "in", ids)),
    );
    for (const d of snap.docs) {
      const data = d.data() as { exploitationId: string; commodity?: string };
      if (!byExploitation.has(data.exploitationId)) byExploitation.set(data.exploitationId, data.commodity ?? "");
    }
  }
  return byExploitation;
}

export function useAdminFarmers() {
  return useQuery<AdminFarmerRow[]>({
    queryKey: ["admin-farmers"],
    queryFn: async () => {
      // No composite index for role=='farmer' + orderBy(createdAt) — same
      // documented workaround used elsewhere in this app: fetch a bounded
      // window ordered by createdAt, filter role in memory. Real limit at
      // scale — flagged, not solved here (matches existing precedent).
      const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(200)));
      const farmerDocs = snap.docs.filter((d) => {
        const data = d.data();
        return data.role === "farmer" || (data.roles as string[] | undefined)?.includes("farmer");
      });

      const farmerIds = farmerDocs.map((d) => d.id);
      const exploByFarmer = await fetchExploitationsByFarmer(farmerIds);
      const cropByExploitation = await fetchPrimaryCropByExploitation(
        [...exploByFarmer.values()].map((e) => e.id),
      );

      return farmerDocs.map((d) => {
        const data = d.data();
        const expl = exploByFarmer.get(d.id);
        const name = (data.fullName ?? data.displayName ?? "") as string;
        const phone = (data.phone ?? "") as string;
        const province = (expl?.province ?? data.province ?? "") as string;
        const completed = [!!name, !!phone, !!province, !!expl].filter(Boolean).length;

        return {
          id: d.id,
          name,
          phone,
          email: (data.email ?? "") as string,
          province,
          primaryCrop: expl ? (cropByExploitation.get(expl.id) ?? null) : null,
          exploitationHectares: expl?.totalHectares ?? null,
          hasExploitation: !!expl,
          profileCompletePct: Math.round((completed / 4) * 100),
          kycStatus: (data.kycStatus ?? "none") as string,
          isActive: data.isActive !== false,
          lastActivityAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : null,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : null,
        };
      });
    },
    staleTime: 60_000,
  });
}

export function useAdminFarmerExploitation(farmerId: string | undefined) {
  return useQuery({
    queryKey: ["admin-farmer-exploitation", farmerId],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "exploitations"), where("farmerId", "==", farmerId), limit(1)),
      );
      if (snap.empty) return null;
      const exploDoc = snap.docs[0];
      const culturesSnap = await getDocs(
        query(collection(db, "cultures"), where("exploitationId", "==", exploDoc.id)),
      );
      return {
        id: exploDoc.id,
        ...exploDoc.data(),
        cultures: culturesSnap.docs.map((c) => ({ id: c.id, ...c.data() })),
      } as Record<string, unknown> & { cultures: Record<string, unknown>[] };
    },
    enabled: !!farmerId,
  });
}

export function useAdminFarmerByUid(uid: string | undefined) {
  return useQuery({
    queryKey: ["admin-farmer-user", uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, "users", uid!));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Record<string, unknown>;
    },
    enabled: !!uid,
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import {
  collection, getDoc, getDocs, doc, orderBy, query, limit, Timestamp,
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase";

/* ─── Real data model ──────────────────────────────────────────────────────
   kyc_submissions/{uid}: documentType, photoUrls (private Storage paths —
   never rendered directly, see useKycDocumentUrls), status, submittedAt,
   reviewedAt, reviewedBy, rejectionReason. users/{uid} carries name/phone/
   role/province for the queue row. There is no automated document
   verification or face-match in this codebase today — the "Correspondance
   confirmée" / risk-percentage elements in the design reference have no
   backend source and are intentionally not implemented here (see PR notes). */

export type KycStatus = "pending" | "verified" | "rejected" | "correction_requested";
export type KycQueueTab = "pending" | "correction_requested" | "done";

export interface KycQueueItem {
  uid: string;
  fullName: string;
  phone: string;
  role: string;
  province: string | null;
  status: KycStatus;
  submittedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
}

/** Fetches every submission once; tabs and monthly stats are derived from this in the component, so switching tabs doesn't refetch. */
export function useKycSubmissions() {
  return useQuery<KycQueueItem[]>({
    queryKey: ["admin-kyc-submissions"],
    queryFn: async () => {
      const submissionsSnap = await getDocs(
        query(collection(db, "kyc_submissions"), orderBy("submittedAt", "desc"), limit(200)),
      );

      return Promise.all(
        submissionsSnap.docs.map(async (d) => {
          const sub = d.data();
          const userSnap = await getDoc(doc(db, "users", d.id));
          const user = userSnap.data() ?? {};
          return {
            uid: d.id,
            fullName: (user.fullName as string) || (user.displayName as string) || "—",
            phone: (user.phone as string) || "",
            role: (user.role as string) || "—",
            province: (user.province as string) ?? null,
            status: (sub.status as KycStatus) ?? "pending",
            submittedAt: (sub.submittedAt as Timestamp) ?? null,
            reviewedAt: (sub.reviewedAt as Timestamp) ?? null,
          } satisfies KycQueueItem;
        }),
      );
    },
    staleTime: 15_000,
  });
}

export function queueTabFilter(row: KycQueueItem, tab: KycQueueTab): boolean {
  if (tab === "done") return row.status === "verified" || row.status === "rejected";
  return row.status === tab;
}

export function isThisMonth(ts: Timestamp | null): boolean {
  if (!ts) return false;
  const d = ts.toDate();
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export interface KycSubmissionDetail {
  uid: string;
  fullName: string;
  phone: string;
  role: string;
  province: string | null;
  documentType: string;
  /** submitKycDocuments accepts 1 or 2 photos for any document type — real count, not a guess at "recto+verso". */
  documentPhotoCount: number;
  status: KycStatus;
  submittedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  reviewedBy: string | null;
  reviewerName: string | null;
  rejectionReason: string | null;
}

export function useKycSubmissionDetail(uid: string | undefined) {
  return useQuery<KycSubmissionDetail | null>({
    queryKey: ["admin-kyc-detail", uid],
    queryFn: async () => {
      const [subSnap, userSnap] = await Promise.all([
        getDoc(doc(db, "kyc_submissions", uid!)),
        getDoc(doc(db, "users", uid!)),
      ]);
      if (!subSnap.exists()) return null;
      const sub = subSnap.data();
      const user = userSnap.data() ?? {};
      const reviewedBy = (sub.reviewedBy as string) ?? null;
      const reviewerSnap = reviewedBy ? await getDoc(doc(db, "users", reviewedBy)) : null;
      const reviewerData = reviewerSnap?.data();
      return {
        uid: uid!,
        fullName: (user.fullName as string) || (user.displayName as string) || "—",
        phone: (user.phone as string) || "",
        role: (user.role as string) || "—",
        province: (user.province as string) ?? null,
        documentType: (sub.documentType as string) ?? "—",
        documentPhotoCount: Array.isArray(sub.photoUrls) ? sub.photoUrls.length : 0,
        status: (sub.status as KycStatus) ?? "pending",
        submittedAt: (sub.submittedAt as Timestamp) ?? null,
        reviewedAt: (sub.reviewedAt as Timestamp) ?? null,
        reviewedBy,
        reviewerName: reviewerData ? ((reviewerData.fullName as string) || (reviewerData.displayName as string) || reviewedBy) : null,
        rejectionReason: (sub.rejectionReason as string) ?? null,
      } satisfies KycSubmissionDetail;
    },
    enabled: !!uid,
  });
}

/** Short-lived signed URLs, fetched on demand — never cached beyond this session's query lifetime, never logged. */
export function useKycDocumentUrls(uid: string | undefined) {
  return useQuery<{ documentType: string; urls: string[] }>({
    queryKey: ["admin-kyc-document-urls", uid],
    queryFn: async () => {
      const fn = httpsCallable<{ uid: string }, { documentType: string; urls: string[] }>(functions, "getKycDocumentViewUrl");
      const result = await fn({ uid: uid! });
      return result.data;
    },
    enabled: !!uid,
    staleTime: 5 * 60_000, // matches the CF's 10-minute signed URL expiry with margin
  });
}

export function useReviewKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { uid: string; decision: KycStatus; reason?: string }) => {
      const fn = httpsCallable<typeof payload, { success: boolean }>(functions, "reviewKycSubmission");
      return (await fn(payload)).data;
    },
    onSuccess: (_data, variables) => {
      // Was "admin-kyc-queue" — no query anywhere uses that key, so the
      // queue never actually refreshed after a decision (it just sat until
      // its own 15s staleTime happened to expire).
      qc.invalidateQueries({ queryKey: ["admin-kyc-submissions"] });
      qc.invalidateQueries({ queryKey: ["admin-kyc-detail", variables.uid] });
      qc.invalidateQueries({ queryKey: ["admin-farmers-v2"] });
    },
  });
}

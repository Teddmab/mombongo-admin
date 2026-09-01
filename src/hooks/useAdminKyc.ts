import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import {
  collection, getDocs, query, where, orderBy, getCountFromServer, Timestamp, doc, getDoc,
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase";

/**
 * kyc_submissions.status carries 4 real values written by adminReviewKyc
 * (mombongo-functions): pending | correction_requested | approved | rejected.
 * There is no "risk score", no selfie/face-match, and no "source" field
 * anywhere in this schema — submitKycDocuments.ts only ever writes
 * {uid, documentType, photoUrls, status, submittedAt, reviewedAt,
 * reviewedBy, rejectionReason}. The 03-kyc-review.png reference shows all
 * three; none of the three are real, so none of the three are implemented
 * here — see the ADM-UI-02 evidence summary.
 */

export type KycQueueTab = "pending" | "correction_requested" | "done";

export interface KycQueueRow {
  uid: string;
  name: string;
  phone: string;
  province: string;
  role: string;
  status: string;
  submittedAt: number | null;
  completePct: number;
}

function completenessFor(user: Record<string, unknown> | undefined): number {
  if (!user) return 0;
  const checks = [!!user.fullName || !!user.displayName, !!user.phone, !!user.province];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function useAdminKycQueue(tab: KycQueueTab) {
  return useQuery<KycQueueRow[]>({
    queryKey: ["admin-kyc-queue", tab],
    queryFn: async () => {
      const statuses = tab === "done" ? ["approved", "rejected"] : [tab];
      const snap = await getDocs(
        query(collection(db, "kyc_submissions"), where("status", "in", statuses), orderBy("submittedAt", "desc")),
      );
      const submissions = snap.docs.map((d) => ({ uid: d.id, ...d.data() }) as Record<string, unknown> & { uid: string });

      const userDocs = await Promise.all(
        submissions.map((s) => getDoc(doc(db, "users", s.uid))),
      );
      const userByUid = new Map(userDocs.map((u) => [u.id, u.exists() ? u.data() : undefined]));

      return submissions.map((s) => {
        const user = userByUid.get(s.uid);
        const submittedAt = s.submittedAt as Timestamp | undefined;
        return {
          uid: s.uid,
          name: ((user?.fullName ?? user?.displayName ?? "") as string) || "—",
          phone: (user?.phone ?? "") as string,
          province: (user?.province ?? "") as string,
          role: (user?.role ?? "") as string,
          status: s.status as string,
          submittedAt: submittedAt?.toMillis?.() ?? null,
          completePct: completenessFor(user),
        };
      });
    },
    staleTime: 30_000,
  });
}

export interface KycSummary {
  pending: number;
  correctionRequested: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
}

export function useAdminKycSummary() {
  return useQuery<KycSummary>({
    queryKey: ["admin-kyc-summary"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startTs = Timestamp.fromDate(startOfMonth);

      const [pendingSnap, correctionSnap, approvedSnap, rejectedSnap] = await Promise.all([
        getCountFromServer(query(collection(db, "kyc_submissions"), where("status", "==", "pending"))),
        getCountFromServer(query(collection(db, "kyc_submissions"), where("status", "==", "correction_requested"))),
        getCountFromServer(query(
          collection(db, "kyc_submissions"), where("status", "==", "approved"), where("reviewedAt", ">=", startTs),
        )),
        getCountFromServer(query(
          collection(db, "kyc_submissions"), where("status", "==", "rejected"), where("reviewedAt", ">=", startTs),
        )),
      ]);

      return {
        pending: pendingSnap.data().count,
        correctionRequested: correctionSnap.data().count,
        approvedThisMonth: approvedSnap.data().count,
        rejectedThisMonth: rejectedSnap.data().count,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export interface KycDocumentDetail {
  documentType: string | null;
  status: string;
  submittedAt: { seconds: number } | null;
  reviewedAt: { seconds: number } | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  photoUrls: string[];
}

const adminGetKycDocumentUrlsFn = httpsCallable<{ uid: string }, KycDocumentDetail>(functions, "adminGetKycDocumentUrls");

export function useAdminKycDocumentUrls(uid: string | undefined) {
  return useQuery({
    queryKey: ["admin-kyc-documents", uid],
    queryFn: async () => (await adminGetKycDocumentUrlsFn({ uid: uid! })).data,
    enabled: !!uid,
    staleTime: 8 * 60 * 1000, // signed URLs expire server-side at 10 min — don't refetch sooner than that
  });
}

type ReviewDecision = "approve" | "reject" | "request_correction";
const adminReviewKycFn = httpsCallable<
  { uid: string; decision: ReviewDecision; reason?: string },
  { success: boolean; status: string }
>(functions, "adminReviewKyc");

export function useAdminReviewKyc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { uid: string; decision: ReviewDecision; reason?: string }) =>
      adminReviewKycFn(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-kyc-queue"] });
      qc.invalidateQueries({ queryKey: ["admin-kyc-summary"] });
      qc.invalidateQueries({ queryKey: ["admin-farmers"] });
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import {
  collection, query, where, orderBy, limit, getDocs, getDoc, doc, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ─── Real data model ────────────────────────────────────────────────────
   Agent identity: users/{uid} (role: 'agent'). Assignment: users/{farmerUid}
   .agentId == uid (set from AdminFarmerDetail's agent picker). Visit
   history: agent_reports/{id} (agentId == uid), written by submitAgentReport. */

export interface AgentListItem {
  id: string;
  fullName: string;
  phone: string;
  province: string | null;
  assignedFarmerCount: number;
  kycStatus: "pending" | "verified" | "rejected" | "correction_requested" | "none";
  isActive: boolean;
  createdAt: Timestamp | null;
}

const AGENT_LIST_CAP = 100;

function toListItem(id: string, user: Record<string, unknown>, assignedFarmerCount: number): AgentListItem {
  return {
    id,
    fullName: (user.fullName as string) || (user.displayName as string) || "—",
    phone: (user.phone as string) || "",
    province: (user.province as string) ?? null,
    assignedFarmerCount,
    kycStatus: (user.kycStatus as AgentListItem["kycStatus"]) ?? "none",
    isActive: user.isActive !== false,
    createdAt: (user.createdAt as Timestamp) ?? null,
  };
}

async function countAssignedFarmers(agentUid: string): Promise<number> {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "farmer"), where("agentId", "==", agentUid)));
  return snap.size;
}

export function useAgents() {
  return useQuery<AgentListItem[]>({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const snap = await getDocs(
        query(collection(db, "users"), where("role", "==", "agent"), orderBy("createdAt", "desc"), limit(AGENT_LIST_CAP)),
      );
      return Promise.all(snap.docs.map(async (d) => toListItem(d.id, d.data(), await countAssignedFarmers(d.id))));
    },
    staleTime: 30_000,
  });
}

export interface AssignedFarmerRow { id: string; fullName: string; province: string | null; kycStatus: string }
export interface AgentReportRow {
  id: string; farmerName: string; cropType: string; status: string; disbursedUsd: number;
  visitDate: Timestamp | null; createdAt: Timestamp | null;
}

export interface AgentDetail extends AgentListItem {
  email: string;
  assignedFarmers: AssignedFarmerRow[];
  recentReports: AgentReportRow[];
}

export function useAgentDetail(uid: string | undefined) {
  return useQuery<AgentDetail | null>({
    queryKey: ["admin-agent-detail", uid],
    queryFn: async () => {
      const userSnap = await getDoc(doc(db, "users", uid!));
      if (!userSnap.exists()) return null;

      const [farmersSnap, reportsSnap] = await Promise.all([
        getDocs(query(collection(db, "users"), where("role", "==", "farmer"), where("agentId", "==", uid))),
        getDocs(query(collection(db, "agent_reports"), where("agentId", "==", uid), orderBy("createdAt", "desc"), limit(20))),
      ]);

      const assignedFarmers = farmersSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          fullName: (data.fullName as string) || (data.displayName as string) || "—",
          province: (data.province as string) ?? null,
          kycStatus: (data.kycStatus as string) ?? "none",
        } satisfies AssignedFarmerRow;
      });

      const recentReports = reportsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          farmerName: (data.farmerName as string) ?? "—",
          cropType: (data.cropType as string) ?? "—",
          status: (data.status as string) ?? "—",
          disbursedUsd: (data.disbursedUsd as number) ?? 0,
          visitDate: (data.visitDate as Timestamp) ?? null,
          createdAt: (data.createdAt as Timestamp) ?? null,
        } satisfies AgentReportRow;
      });

      return {
        ...toListItem(uid!, userSnap.data(), assignedFarmers.length),
        email: (userSnap.data().email as string) || "",
        assignedFarmers,
        recentReports,
      } satisfies AgentDetail;
    },
    enabled: !!uid,
  });
}

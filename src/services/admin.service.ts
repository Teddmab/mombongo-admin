import type { UserRole } from "@/types";
import {
  collection,
  getDocs,
  query,
  where,
  getCountFromServer,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface DashboardKpis {
  activeUsers: number;
  pendingKyc: number;
  monthlyVolumeUsd: number;
  financingOpen: number;
}

export interface ActivityPoint {
  name: string;
  volume: number;
  approvals: number;
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "pending" | "suspended";
}

export interface AdminTransactionRow {
  id: string;
  description: string;
  amountUsd: number;
  status: "completed" | "pending" | "blocked";
  createdAt: string;
}

export interface FinancingRow {
  id: string;
  farmer: string;
  crop: string;
  requestedUsd: number;
  status: "review" | "open" | "blocked";
}

export interface BourseRow {
  id: string;
  route: string;
  commodity: string;
  targetCdf: number;
  status: "open" | "review" | "completed";
}

export class AdminService {
  async getDashboardKpis(): Promise<DashboardKpis> {
    const [usersSnap, kycSnap, investSnap, financingSnap] = await Promise.all([
      getCountFromServer(query(collection(db, "users"), where("isActive", "==", true))),
      getCountFromServer(query(collection(db, "users"), where("kycStatus", "==", "pending"))),
      getDocs(query(collection(db, "investments"), where("paymentStatus", "==", "completed"))),
      getCountFromServer(query(collection(db, "farmer_financing"), where("status", "==", "review"))),
    ]);
    const monthlyVolumeUsd = investSnap.docs.reduce(
      (sum, d) => sum + (d.data().amountUsd ?? 0),
      0
    );
    return {
      activeUsers: usersSnap.data().count,
      pendingKyc: kycSnap.data().count,
      monthlyVolumeUsd,
      financingOpen: financingSnap.data().count,
    };
  }

  async getActivity(): Promise<ActivityPoint[]> {
    return [
      { name: "Mon", volume: 18, approvals: 5 },
      { name: "Tue", volume: 24, approvals: 8 },
      { name: "Wed", volume: 21, approvals: 7 },
      { name: "Thu", volume: 31, approvals: 10 },
      { name: "Fri", volume: 29, approvals: 9 },
    ];
  }

  async getUsers(): Promise<AdminUserRow[]> {
    const snap = await getDocs(
      query(collection(db, "users"), orderBy("createdAt", "desc"), limit(50))
    );
    return snap.docs.map(
      (d) =>
        ({
          id: d.id,
          name: d.data().fullName ?? "",
          email: d.data().email ?? "",
          role: d.data().role,
          status: d.data().isActive ? "active" : "suspended",
        } as AdminUserRow)
    );
  }

  async getTransactions(): Promise<AdminTransactionRow[]> {
    const snap = await getDocs(
      query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(50))
    );
    return snap.docs.map(
      (d) =>
        ({
          id: d.id,
          description: d.data().description ?? "",
          amountUsd: d.data().amountUsd ?? 0,
          status: d.data().status ?? "pending",
          createdAt: d.data().createdAt?.toDate?.()?.toISOString() ?? "",
        } as AdminTransactionRow)
    );
  }

  async getFinancingPipeline(): Promise<FinancingRow[]> {
    const snap = await getDocs(
      query(collection(db, "farmer_financing"), orderBy("createdAt", "desc"), limit(50))
    );
    return snap.docs.map(
      (d) =>
        ({
          id: d.id,
          farmer: d.data().farmerName ?? "",
          crop: d.data().crop ?? "",
          requestedUsd: d.data().requestedUsd ?? 0,
          status: d.data().status ?? "review",
        } as FinancingRow)
    );
  }

  async getBoursePipeline(): Promise<BourseRow[]> {
    const snap = await getDocs(
      query(collection(db, "bourse_opportunities"), orderBy("createdAt", "desc"), limit(50))
    );
    return snap.docs.map(
      (d) =>
        ({
          id: d.id,
          route: d.data().route ?? "",
          commodity: d.data().commodity ?? "",
          targetCdf: d.data().targetCdf ?? 0,
          status: d.data().status ?? "open",
        } as BourseRow)
    );
  }
}

export const adminService = new AdminService();

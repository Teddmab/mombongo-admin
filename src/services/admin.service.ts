import type { UserRole } from "@/types";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  getCountFromServer,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  addDoc,
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

export interface BourseOpportunityRow {
  id: string;
  title: string;
  type: string;
  origin: string;
  destination: string;
  spotsLeft: number;
  spotsTotal: number;
  targetCdf: number;
  filledKg: number;
  capacityKg: number;
  status: "open" | "review" | "completed";
  departureDate?: { seconds: number };
}

export interface BoursePriceRow {
  id: string;
  symbol: string;
  productName: string;
  price: string;
  change: number;
  recordedAt?: { seconds: number };
}

export interface FarmerRow {
  id: string;
  name: string;
  region: string;
  cropType: string;
  farmSizeHa: number;
  requestedAmountUsd: number;
  disbursedAmountUsd: number;
  status: "pending" | "approved" | "active" | "completed";
  agentId: string | null;
}

export interface FinancingApplicationRow {
  id: string;
  farmerId: string;
  farmerName?: string;
  investorId: string;
  amountUsd: number;
  cropType: string;
  status: "active" | "completed" | "cancelled";
  tranches: { amountUsd: number; status: string; disbursedAt: unknown }[];
  createdAt?: { seconds: number };
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

  async getBourseOpportunities(): Promise<BourseOpportunityRow[]> {
    const snap = await getDocs(
      query(collection(db, "bourse_opportunities"), orderBy("createdAt", "desc"), limit(50))
    );
    return snap.docs.map((d) => ({
      id: d.id,
      title: d.data().title ?? "",
      type: d.data().type ?? "transport",
      origin: d.data().origin ?? "",
      destination: d.data().destination ?? "",
      spotsLeft: d.data().spotsLeft ?? 0,
      spotsTotal: d.data().spotsTotal ?? 0,
      targetCdf: d.data().targetCdf ?? 0,
      filledKg: d.data().filledKg ?? 0,
      capacityKg: d.data().capacityKg ?? 0,
      status: d.data().status ?? "open",
      departureDate: d.data().departureDate,
    } as BourseOpportunityRow));
  }

  async updateBourseStatus(id: string, status: string): Promise<void> {
    await updateDoc(doc(db, "bourse_opportunities", id), { status });
  }

  async getBoursePrices(): Promise<BoursePriceRow[]> {
    const snap = await getDocs(
      query(collection(db, "bourse_prices"), orderBy("recordedAt", "desc"), limit(50))
    );
    return snap.docs.map((d) => ({
      id: d.id,
      symbol: d.data().symbol ?? "",
      productName: d.data().productName ?? "",
      price: d.data().price ?? "",
      change: d.data().change ?? 0,
      recordedAt: d.data().recordedAt,
    } as BoursePriceRow));
  }

  async addBoursePrice(row: Omit<BoursePriceRow, "id">): Promise<void> {
    await addDoc(collection(db, "bourse_prices"), { ...row, recordedAt: serverTimestamp() });
  }

  async getFarmers(filters?: { status?: string }): Promise<FarmerRow[]> {
    let q = query(collection(db, "farmers"), orderBy("createdAt", "desc"), limit(50));
    if (filters?.status) {
      q = query(collection(db, "farmers"), where("status", "==", filters.status), orderBy("createdAt", "desc"), limit(50));
    }
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      name: d.data().name ?? "",
      region: d.data().region ?? "",
      cropType: d.data().cropType ?? "",
      farmSizeHa: d.data().farmSizeHa ?? 0,
      requestedAmountUsd: d.data().requestedAmountUsd ?? 0,
      disbursedAmountUsd: d.data().disbursedAmountUsd ?? 0,
      status: d.data().status ?? "pending",
      agentId: d.data().agentId ?? null,
    } as FarmerRow));
  }

  async approveFarmer(id: string): Promise<void> {
    await updateDoc(doc(db, "farmers", id), { status: "approved" });
  }

  async getFinancingApplications(): Promise<FinancingApplicationRow[]> {
    const snap = await getDocs(
      query(collection(db, "financing_applications"), orderBy("createdAt", "desc"), limit(100))
    );
    return snap.docs.map((d) => ({
      id: d.id,
      farmerId: d.data().farmerId ?? "",
      investorId: d.data().investorId ?? "",
      amountUsd: d.data().amountUsd ?? 0,
      cropType: d.data().cropType ?? "",
      status: d.data().status ?? "active",
      tranches: d.data().tranches ?? [],
      createdAt: d.data().createdAt,
    } as FinancingApplicationRow));
  }

  async disburseTranche(appId: string, farmerId: string, trancheIndex: number, amount: number): Promise<void> {
    const appRef = doc(db, "financing_applications", appId);
    const farmerRef = doc(db, "farmers", farmerId);
    const snap = await getDocs(query(collection(db, "financing_applications"), where("__name__", "==", appId), limit(1)));
    if (snap.empty) throw new Error("Application not found");
    const appDoc = snap.docs[0];
    const tranches = [...(appDoc.data().tranches ?? [])];
    tranches[trancheIndex] = { ...tranches[trancheIndex], status: "disbursed", disbursedAt: serverTimestamp() };
    await updateDoc(appRef, { tranches });
    await updateDoc(farmerRef, { disbursedAmountUsd: increment(amount) });
  }
}

export const adminService = new AdminService();

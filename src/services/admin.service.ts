import type { UserRole } from "@/types";

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

const dashboardKpis: DashboardKpis = {
  activeUsers: 1842,
  pendingKyc: 27,
  monthlyVolumeUsd: 124500,
  financingOpen: 14,
};

const activity: ActivityPoint[] = [
  { name: "Mon", volume: 18, approvals: 5 },
  { name: "Tue", volume: 24, approvals: 8 },
  { name: "Wed", volume: 21, approvals: 7 },
  { name: "Thu", volume: 31, approvals: 10 },
  { name: "Fri", volume: 29, approvals: 9 },
  { name: "Sat", volume: 17, approvals: 4 },
];

const users: AdminUserRow[] = [
  {
    id: "USR-102",
    name: "Djuna Sambil",
    email: "djuna@mombongo.coop",
    role: "admin",
    status: "active",
  },
  {
    id: "USR-144",
    name: "Patrick Mbala",
    email: "patrick@mombongo.coop",
    role: "admin",
    status: "active",
  },
  {
    id: "USR-201",
    name: "Aline Kanku",
    email: "aline@example.com",
    role: "investor",
    status: "pending",
  },
  {
    id: "USR-310",
    name: "Moise Lokondo",
    email: "moise@example.com",
    role: "farmer",
    status: "suspended",
  },
];

const transactions: AdminTransactionRow[] = [
  {
    id: "TX-441",
    description: "Top-up wallet investor",
    amountUsd: 1240,
    status: "completed",
    createdAt: "2026-01-12",
  },
  {
    id: "TX-442",
    description: "Retrait commerçant",
    amountUsd: 320,
    status: "pending",
    createdAt: "2026-01-12",
  },
  {
    id: "TX-443",
    description: "Commission transport",
    amountUsd: 88,
    status: "blocked",
    createdAt: "2026-01-11",
  },
];

const financing: FinancingRow[] = [
  {
    id: "FIN-08",
    farmer: "Grâce Mputu",
    crop: "Maïs",
    requestedUsd: 8400,
    status: "review",
  },
  {
    id: "FIN-12",
    farmer: "Blaise Kiala",
    crop: "Manioc",
    requestedUsd: 12600,
    status: "open",
  },
  {
    id: "FIN-15",
    farmer: "Mado Kinkela",
    crop: "Piment",
    requestedUsd: 5100,
    status: "blocked",
  },
];

const bourse: BourseRow[] = [
  {
    id: "BOR-01",
    route: "Kisangani → Kinshasa",
    commodity: "Cacao",
    targetCdf: 9800000,
    status: "open",
  },
  {
    id: "BOR-03",
    route: "Mbandaka → Matadi",
    commodity: "Maïs",
    targetCdf: 5400000,
    status: "review",
  },
  {
    id: "BOR-04",
    route: "Lubumbashi → Kolwezi",
    commodity: "Haricots",
    targetCdf: 3100000,
    status: "completed",
  },
];

export class AdminService {
  async getDashboardKpis() {
    return dashboardKpis;
  }

  async getActivity() {
    return activity;
  }

  async getUsers() {
    return users;
  }

  async getTransactions() {
    return transactions;
  }

  async getFinancingPipeline() {
    return financing;
  }

  async getBoursePipeline() {
    return bourse;
  }
}

export const adminService = new AdminService();

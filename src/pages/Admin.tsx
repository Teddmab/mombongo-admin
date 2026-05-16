import {
  Link,
  NavLink,
  Outlet,
  useParams,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Sprout,
  Receipt,
  FileBarChart,
  ArrowLeft,
  Search,
  TrendingUp,
  Wallet,
  ShieldCheck,
  Bell,
  Settings,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Activity,
  Package,
  Edit,
  Ban,
  ChevronRight,
  Plus,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { useState } from "react";

const INVESTOR_APP_URL = "https://app.mombongo.coop";

/* =========================================================
 * MOCK DATA (rich)
 * ======================================================= */

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "Investisseur" | "Commerçant" | "Agent" | "Agriculteur" | "Admin";
  status: "Actif" | "KYC" | "Suspendu";
  invested: number;
  joined: string;
  city: string;
  avatar: string;
  kycLevel: 1 | 2 | 3;
  lastLogin: string;
}

export const adminUsers: AdminUser[] = [
  {
    id: "u1",
    name: "Alain Kabasele",
    email: "alain@mombongo.cd",
    phone: "+243 81 234 5678",
    role: "Investisseur",
    status: "Actif",
    invested: 4850,
    joined: "12 jan. 2026",
    city: "Kinshasa",
    avatar: "🧑🏾",
    kycLevel: 3,
    lastLogin: "il y a 2h",
  },
  {
    id: "u2",
    name: "Sarah Mbuyi",
    email: "sarah.m@gmail.com",
    phone: "+243 82 555 9012",
    role: "Investisseur",
    status: "Actif",
    invested: 2200,
    joined: "3 fév. 2026",
    city: "Lubumbashi",
    avatar: "👩🏾",
    kycLevel: 2,
    lastLogin: "Hier",
  },
  {
    id: "u3",
    name: "Olivier Tshilumba",
    email: "olivier.t@yahoo.fr",
    phone: "+243 85 111 2222",
    role: "Commerçant",
    status: "KYC",
    invested: 1100,
    joined: "21 fév. 2026",
    city: "Matadi",
    avatar: "👨🏾",
    kycLevel: 1,
    lastLogin: "il y a 5j",
  },
  {
    id: "u4",
    name: "Grace Nkongolo",
    email: "grace.n@mombongo.cd",
    phone: "+243 89 333 4444",
    role: "Agent",
    status: "Actif",
    invested: 0,
    joined: "1 nov. 2025",
    city: "Songololo",
    avatar: "👩🏾‍💼",
    kycLevel: 3,
    lastLogin: "il y a 30min",
  },
  {
    id: "u5",
    name: "Patrick Lemba",
    email: "p.lemba@gmail.com",
    phone: "+243 81 777 8888",
    role: "Investisseur",
    status: "Actif",
    invested: 680,
    joined: "9 mars 2026",
    city: "Goma",
    avatar: "🧑🏾‍💼",
    kycLevel: 2,
    lastLogin: "il y a 3h",
  },
  {
    id: "u6",
    name: "Diane Mukendi",
    email: "diane.m@gmail.com",
    phone: "+243 82 999 0001",
    role: "Investisseur",
    status: "Actif",
    invested: 3200,
    joined: "15 déc. 2025",
    city: "Kinshasa",
    avatar: "👩🏾‍🦱",
    kycLevel: 3,
    lastLogin: "il y a 1h",
  },
  {
    id: "u7",
    name: "Jonas Kalala",
    email: "jonas.k@mombongo.cd",
    phone: "+243 85 222 3333",
    role: "Agent",
    status: "Actif",
    invested: 0,
    joined: "20 oct. 2025",
    city: "Matadi",
    avatar: "👨🏾‍🔧",
    kycLevel: 3,
    lastLogin: "Hier",
  },
  {
    id: "u8",
    name: "Esther Kazadi",
    email: "esther.k@yahoo.fr",
    phone: "+243 89 444 5555",
    role: "Commerçant",
    status: "Suspendu",
    invested: 200,
    joined: "5 jan. 2026",
    city: "Boma",
    avatar: "👩🏾‍🦰",
    kycLevel: 1,
    lastLogin: "il y a 18j",
  },
];

export interface AdminFarmer {
  id: string;
  name: string;
  loc: string;
  surface: number;
  trust: number;
  raised: number;
  needed: number;
  crops: string[];
  experience: number;
  phone: string;
  avatar: string;
  status: "Actif" | "En attente" | "Vérifié";
  agent: string;
  joined: string;
}
export const adminFarmers: AdminFarmer[] = [
  {
    id: "f1",
    name: "Jean-Baptiste Mwamba",
    loc: "Songololo, Kongo Central",
    surface: 5,
    trust: 92,
    raised: 2280,
    needed: 3500,
    crops: ["Pastèques", "Aubergines"],
    experience: 12,
    phone: "+243 81 555 0001",
    avatar: "🧑🏾‍🌾",
    status: "Vérifié",
    agent: "Grace Nkongolo",
    joined: "Mars 2024",
  },
  {
    id: "f2",
    name: "Marie Lutumba",
    loc: "Matadi, Kongo Central",
    surface: 3,
    trust: 88,
    raised: 1540,
    needed: 2200,
    crops: ["Tomates", "Concombres"],
    experience: 8,
    phone: "+243 82 555 0002",
    avatar: "👩🏾‍🌾",
    status: "Vérifié",
    agent: "Jonas Kalala",
    joined: "Juin 2024",
  },
  {
    id: "f3",
    name: "Pierre Nzuzi",
    loc: "Boma, Kongo Central",
    surface: 4,
    trust: 95,
    raised: 3600,
    needed: 4000,
    crops: ["Concombres", "Aubergines"],
    experience: 15,
    phone: "+243 85 555 0003",
    avatar: "👨🏾‍🌾",
    status: "Vérifié",
    agent: "Jonas Kalala",
    joined: "Janv. 2024",
  },
  {
    id: "f4",
    name: "Coopérative Maluku",
    loc: "Maluku, Kinshasa",
    surface: 25,
    trust: 90,
    raised: 4200,
    needed: 8500,
    crops: ["Manioc", "Oignons"],
    experience: 20,
    phone: "+243 89 555 0004",
    avatar: "👥",
    status: "Actif",
    agent: "Grace Nkongolo",
    joined: "Sept. 2023",
  },
  {
    id: "f5",
    name: "Coop. Kivu Arabica",
    loc: "Goma, Nord-Kivu",
    surface: 40,
    trust: 96,
    raised: 9800,
    needed: 12000,
    crops: ["Café Arabica"],
    experience: 25,
    phone: "+243 81 555 0005",
    avatar: "☕",
    status: "Vérifié",
    agent: "Grace Nkongolo",
    joined: "Mai 2023",
  },
  {
    id: "f6",
    name: "Coop. Mayombe Cacao",
    loc: "Mayombe, Bas-Congo",
    surface: 35,
    trust: 91,
    raised: 6400,
    needed: 9000,
    crops: ["Cacao bio"],
    experience: 18,
    phone: "+243 82 555 0006",
    avatar: "🍫",
    status: "En attente",
    agent: "Jonas Kalala",
    joined: "Fév. 2026",
  },
];

export interface AdminTx {
  id: string;
  date: string;
  fromId: string;
  from: string;
  to: string;
  toId?: string;
  amt: number;
  currency: "USD" | "FC";
  status: "Confirmé" | "Versé" | "En attente" | "Échoué";
  kind: "Investissement" | "Profit" | "Retrait" | "Frais";
  ref: string;
}
export const adminTx: AdminTx[] = [
  {
    id: "t1",
    date: "27 avr. 2026 14:32",
    fromId: "u1",
    from: "Alain Kabasele",
    to: "Pastèques Songololo",
    toId: "f1",
    amt: 1200,
    currency: "USD",
    status: "Confirmé",
    kind: "Investissement",
    ref: "MB-2604-A12",
  },
  {
    id: "t2",
    date: "26 avr. 2026 11:08",
    fromId: "u2",
    from: "Sarah Mbuyi",
    to: "Café Kivu",
    toId: "f5",
    amt: 500,
    currency: "USD",
    status: "Confirmé",
    kind: "Investissement",
    ref: "MB-2604-B07",
  },
  {
    id: "t3",
    date: "26 avr. 2026 09:14",
    fromId: "sys",
    from: "Mombongo",
    to: "Alain Kabasele",
    toId: "u1",
    amt: 145,
    currency: "USD",
    status: "Versé",
    kind: "Profit",
    ref: "MB-PRF-9981",
  },
  {
    id: "t4",
    date: "25 avr. 2026 17:42",
    fromId: "u5",
    from: "Patrick Lemba",
    to: "Tomates Matadi",
    toId: "f2",
    amt: 300,
    currency: "USD",
    status: "En attente",
    kind: "Investissement",
    ref: "MB-2504-C44",
  },
  {
    id: "t5",
    date: "24 avr. 2026 13:20",
    fromId: "u3",
    from: "Olivier Tshilumba",
    to: "Bourse #041",
    amt: 50000,
    currency: "FC",
    status: "Confirmé",
    kind: "Investissement",
    ref: "MB-BRS-041",
  },
  {
    id: "t6",
    date: "24 avr. 2026 10:02",
    fromId: "u6",
    from: "Diane Mukendi",
    to: "Cacao Mayombe",
    toId: "f6",
    amt: 800,
    currency: "USD",
    status: "Confirmé",
    kind: "Investissement",
    ref: "MB-2404-D11",
  },
  {
    id: "t7",
    date: "23 avr. 2026 16:50",
    fromId: "u1",
    from: "Alain Kabasele",
    to: "Retrait M-Pesa",
    amt: 200,
    currency: "USD",
    status: "Versé",
    kind: "Retrait",
    ref: "MB-WD-7710",
  },
  {
    id: "t8",
    date: "22 avr. 2026 08:30",
    fromId: "u8",
    from: "Esther Kazadi",
    to: "Manioc Maluku",
    toId: "f4",
    amt: 200,
    currency: "USD",
    status: "Échoué",
    kind: "Investissement",
    ref: "MB-2204-E03",
  },
];

export interface AdminReport {
  id: string;
  title: string;
  type: "PDF" | "CSV" | "Excel";
  size: string;
  category: "Comptabilité" | "Conformité" | "Impact" | "Audit";
  date: string;
  author: string;
}
export const adminReports: AdminReport[] = [
  {
    id: "r1",
    title: "Bilan trimestriel Q2 2026",
    type: "PDF",
    size: "2.4 MB",
    category: "Comptabilité",
    date: "1 avr. 2026",
    author: "Service Finance",
  },
  {
    id: "r2",
    title: "Liste investisseurs KYC",
    type: "CSV",
    size: "184 KB",
    category: "Conformité",
    date: "15 avr. 2026",
    author: "Compliance",
  },
  {
    id: "r3",
    title: "Performance par culture",
    type: "Excel",
    size: "920 KB",
    category: "Comptabilité",
    date: "20 avr. 2026",
    author: "Service Finance",
  },
  {
    id: "r4",
    title: "Conformité BCC (Banque Centrale)",
    type: "PDF",
    size: "1.1 MB",
    category: "Conformité",
    date: "10 avr. 2026",
    author: "Direction",
  },
  {
    id: "r5",
    title: "Impact social — Trimestre",
    type: "PDF",
    size: "3.8 MB",
    category: "Impact",
    date: "5 avr. 2026",
    author: "ESG",
  },
  {
    id: "r6",
    title: "Audit agents terrain",
    type: "PDF",
    size: "760 KB",
    category: "Audit",
    date: "18 avr. 2026",
    author: "Audit interne",
  },
];

export interface AdminAlert {
  id: string;
  level: "info" | "warning" | "danger";
  title: string;
  body: string;
  time: string;
}
export const adminAlerts: AdminAlert[] = [
  {
    id: "a1",
    level: "danger",
    title: "Transaction échouée",
    body: "MB-2204-E03 · Esther Kazadi · $200",
    time: "il y a 18h",
  },
  {
    id: "a2",
    level: "warning",
    title: "KYC en attente > 7 jours",
    body: "3 utilisateurs à valider",
    time: "il y a 2j",
  },
  {
    id: "a3",
    level: "info",
    title: "Nouveau partenaire",
    body: "Coop. Mayombe Cacao a rejoint la plateforme",
    time: "il y a 4j",
  },
  {
    id: "a4",
    level: "warning",
    title: "Retard rapport agent",
    body: "Jonas Kalala — Matadi, retard 3j",
    time: "il y a 1j",
  },
];

/* =========================================================
 * LAYOUT
 * ======================================================= */

const NAV = [
  { to: "/admin", icon: LayoutDashboard, label: "Vue d'ensemble", end: true },
  { to: "/admin/users", icon: Users, label: "Utilisateurs" },
  { to: "/admin/farmers", icon: Sprout, label: "Agriculteurs" },
  { to: "/admin/transactions", icon: Receipt, label: "Transactions" },
  { to: "/admin/opportunities", icon: Briefcase, label: "Opportunités" },
  { to: "/admin/kyc", icon: ShieldCheck, label: "KYC & Conformité" },
  { to: "/admin/reports", icon: FileBarChart, label: "Rapports" },
  { to: "/admin/alerts", icon: Bell, label: "Alertes" },
  { to: "/admin/settings", icon: Settings, label: "Paramètres" },
];

export function AdminLayout() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-60 bg-green-900 text-white p-4 hidden md:flex flex-col">
        <a
          href={INVESTOR_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 mb-8"
        >
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">
            🌿
          </div>
          <div>
            <p className="font-display font-black text-[15px]">Mombongo</p>
            <p className="text-[10px] text-amber-400 uppercase tracking-wider font-bold">
              Admin
            </p>
          </div>
        </a>
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition ${
                  isActive
                    ? "bg-green-700 text-white"
                    : "text-white/70 hover:bg-white/10"
                }`
              }
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <a
          href={INVESTOR_APP_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-[12px] text-white/60 hover:text-white mt-4 pt-4 border-t border-white/10"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'app
        </a>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="md:hidden bg-green-900 text-white p-3 flex items-center justify-between">
          <a
            href={INVESTOR_APP_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-[13px] font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> App
          </a>
          <p className="font-display font-black">Mombongo Admin</p>
        </div>
        <div className="p-4 md:p-8 max-w-[1280px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* =========================================================
 * DASHBOARD
 * ======================================================= */

const monthlyData = [
  { m: "Jan", v: 8200 },
  { m: "Fév", v: 9400 },
  { m: "Mar", v: 11200 },
  { m: "Avr", v: 13800 },
  { m: "Mai", v: 16400 },
  { m: "Juin", v: 19200 },
  { m: "Juil", v: 22100 },
  { m: "Août", v: 24820 },
];
const distData = [
  { name: "Agriculture", value: 58, color: "hsl(142 56% 27%)" },
  { name: "Export", value: 28, color: "hsl(38 90% 53%)" },
  { name: "Logistique", value: 14, color: "hsl(217 91% 60%)" },
];

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-[28px]">
            Vue d'ensemble
          </h1>
          <p className="text-gray-500 text-[14px]">
            Performance de la coopérative · 30 derniers jours
          </p>
        </div>
        <div className="flex gap-2">
          <button className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Exporter
          </button>
          <button className="h-9 px-3 bg-green-700 text-white rounded-lg text-[12px] font-semibold flex items-center gap-1.5 hover:bg-green-800">
            <Plus className="w-3.5 h-3.5" /> Nouvelle opportunité
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI
          label="Investisseurs actifs"
          value="1,284"
          change="+12%"
          icon={Users}
        />
        <KPI
          label="Capital engagé"
          value="$248,200"
          change="+18%"
          icon={Wallet}
        />
        <KPI label="Agriculteurs" value="186" change="+9" icon={Sprout} />
        <KPI
          label="Taux remboursement"
          value="96.4%"
          change="+0.8%"
          icon={TrendingUp}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-[16px]">
              Capital levé · Évolution
            </h3>
            <span className="text-[11px] text-gray-500">USD</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="hsl(142 56% 27%)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(142 56% 27%)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(220 13% 95%)" vertical={false} />
                <XAxis
                  dataKey="m"
                  tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(220 9% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="hsl(142 56% 27%)"
                  strokeWidth={3}
                  fill="url(#gv)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-display font-bold text-[16px] mb-3">
            Répartition
          </h3>
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={distData}
                  dataKey="value"
                  innerRadius={42}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {distData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5">
            {distData.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-[12px]">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: d.color }}
                />
                <span className="flex-1">{d.name}</span>
                <span className="font-bold">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-display font-bold text-[16px] mb-4">
            Volumes par catégorie (USD)
          </h3>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart
                data={[
                  { c: "Maraîchage", v: 9800 },
                  { c: "Café", v: 14200 },
                  { c: "Cacao", v: 11400 },
                  { c: "Manioc", v: 4200 },
                  { c: "Transport", v: 6800 },
                  { c: "Pêche", v: 3200 },
                ]}
              >
                <CartesianGrid stroke="hsl(220 13% 95%)" vertical={false} />
                <XAxis
                  dataKey="c"
                  tick={{ fontSize: 10, fill: "hsl(220 9% 46%)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="v" fill="hsl(38 90% 53%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-[16px]">Alertes</h3>
            <Link
              to="/admin/alerts"
              className="text-[11px] font-bold text-green-700"
            >
              Voir tout →
            </Link>
          </div>
          <div className="space-y-2">
            {adminAlerts.slice(0, 4).map((a) => (
              <div
                key={a.id}
                className="flex gap-2 p-2 rounded-lg hover:bg-gray-50"
              >
                <AlertDot level={a.level} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold truncate">{a.title}</p>
                  <p className="text-[11px] text-gray-500 truncate">{a.body}</p>
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  {a.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-[16px]">
            Activité récente
          </h3>
          <Link
            to="/admin/transactions"
            className="text-[11px] font-bold text-green-700"
          >
            Toutes les transactions →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {adminTx.slice(0, 5).map((t) => (
            <div
              key={t.id}
              className="py-2.5 flex items-center gap-3 text-[12px]"
            >
              <div className="w-8 h-8 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {t.from} → {t.to}
                </p>
                <p className="text-gray-500 text-[11px]">
                  {t.date} · {t.ref}
                </p>
              </div>
              <span className="font-display font-extrabold tabular">
                {t.currency === "USD" ? "$" : ""}
                {t.amt.toLocaleString()}
                {t.currency === "FC" ? " FC" : ""}
              </span>
              <StatusTag status={t.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  change,
  icon: Icon,
}: {
  label: string;
  value: string;
  change: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const up = change.startsWith("+");
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start justify-between">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider font-bold">
          {label}
        </p>
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <p className="font-display font-black text-[22px] tabular mt-1">
        {value}
      </p>
      <p
        className={`text-[11px] font-bold mt-1 ${up ? "text-green-700" : "text-red-600"}`}
      >
        {change}
      </p>
    </div>
  );
}

/* =========================================================
 * USERS list + detail
 * ======================================================= */

export function AdminUsers() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string>("Tous");
  const filtered = adminUsers.filter(
    (u) =>
      (role === "Tous" || u.role === role) &&
      (u.name.toLowerCase().includes(q.toLowerCase()) ||
        u.email.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <Section
      title="Utilisateurs"
      subtitle={`${adminUsers.length} membres listés · 1,284 au total`}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Actifs" value="1,201" tone="green" />
        <MiniStat label="KYC en attente" value="43" tone="amber" />
        <MiniStat label="Suspendus" value="12" tone="red" />
        <MiniStat label="Nouveaux (7j)" value="+58" tone="blue" />
      </div>

      <Toolbar q={q} setQ={setQ} placeholder="Rechercher nom ou email...">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-[12px] font-semibold"
        >
          {["Tous", "Investisseur", "Commerçant", "Agent", "Agriculteur"].map(
            (r) => (
              <option key={r}>{r}</option>
            ),
          )}
        </select>
        <button className="h-9 px-3 bg-green-700 text-white rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Inviter
        </button>
      </Toolbar>

      <Table
        headers={[
          "Utilisateur",
          "Rôle",
          "Ville",
          "KYC",
          "Statut",
          "Investi",
          "",
        ]}
      >
        {filtered.map((u) => (
          <ClickRow key={u.id} to={`/admin/users/${u.id}`}>
            <td className="py-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-lg">
                  {u.avatar}
                </span>
                <div>
                  <p className="font-semibold">{u.name}</p>
                  <p className="text-gray-500 text-[11px]">{u.email}</p>
                </div>
              </div>
            </td>
            <td>
              <Tag tone="green">{u.role}</Tag>
            </td>
            <td className="text-gray-500">{u.city}</td>
            <td>
              <KycBadge level={u.kycLevel} />
            </td>
            <td>
              <StatusTag status={u.status} />
            </td>
            <td className="font-display font-extrabold tabular">
              {u.invested ? `$${u.invested.toLocaleString()}` : "—"}
            </td>
            <td>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </td>
          </ClickRow>
        ))}
      </Table>
    </Section>
  );
}

export function AdminUserDetail() {
  const { id } = useParams();
  const u = adminUsers.find((x) => x.id === id);
  if (!u) return <NotFoundDetail label="Utilisateur" />;
  const txs = adminTx.filter((t) => t.fromId === u.id || t.toId === u.id);
  const invested = txs
    .filter((t) => t.kind === "Investissement" && t.fromId === u.id)
    .reduce((s, t) => s + (t.currency === "USD" ? t.amt : 0), 0);
  const earned = txs
    .filter((t) => t.kind === "Profit" && t.toId === u.id)
    .reduce((s, t) => s + t.amt, 0);

  return (
    <DetailShell back="/admin/users" backLabel="Utilisateurs">
      <ProfileHeader
        avatar={u.avatar}
        title={u.name}
        subtitle={`${u.role} · Membre depuis ${u.joined}`}
        meta={[
          { icon: Mail, value: u.email },
          { icon: Phone, value: u.phone },
          { icon: MapPin, value: u.city },
          { icon: Clock, value: `Vu ${u.lastLogin}` },
        ]}
        actions={
          <>
            <button className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Éditer
            </button>
            <button className="h-9 px-3 bg-red-50 text-red-700 rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" /> Suspendre
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat
          label="Capital investi"
          value={`$${invested.toLocaleString()}`}
          tone="green"
        />
        <MiniStat
          label="Profits versés"
          value={`$${earned.toLocaleString()}`}
          tone="amber"
        />
        <MiniStat label="Transactions" value={String(txs.length)} tone="blue" />
        <MiniStat
          label="Niveau KYC"
          value={`Niveau ${u.kycLevel}`}
          tone={u.kycLevel === 3 ? "green" : "amber"}
        />
      </div>

      <Tabs
        tabs={[
          "Transactions",
          "Investissements actifs",
          "Documents KYC",
          "Notes",
        ]}
      >
        {(active) => (
          <>
            {active === 0 && (
              <Table
                headers={[
                  "Date",
                  "Type",
                  "Contrepartie",
                  "Montant",
                  "Statut",
                  "Ref",
                ]}
              >
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="py-3 text-gray-500 text-[12px]">{t.date}</td>
                    <td>
                      <Tag tone="green">{t.kind}</Tag>
                    </td>
                    <td className="font-semibold">
                      {t.fromId === u.id ? t.to : t.from}
                    </td>
                    <td className="font-display font-extrabold tabular">
                      {t.currency === "USD" ? "$" : ""}
                      {t.amt.toLocaleString()}
                      {t.currency === "FC" ? " FC" : ""}
                    </td>
                    <td>
                      <StatusTag status={t.status} />
                    </td>
                    <td className="text-gray-400 text-[11px] font-mono">
                      {t.ref}
                    </td>
                  </tr>
                ))}
                {txs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center text-gray-400 py-6 text-[12px]"
                    >
                      Aucune transaction
                    </td>
                  </tr>
                )}
              </Table>
            )}
            {active === 1 && (
              <EmptyOrList
                items={[
                  {
                    t: "Pastèques Songololo",
                    s: "ROI 22% · Récolte 15 mai",
                    v: "$1,200",
                  },
                ]}
              />
            )}
            {active === 2 && (
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  "Pièce d'identité",
                  "Justificatif domicile",
                  "Selfie vérification",
                ].map((d) => (
                  <div
                    key={d}
                    className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3"
                  >
                    <ShieldCheck className="w-5 h-5 text-green-700" />
                    <p className="flex-1 text-[13px] font-semibold">{d}</p>
                    <CheckCircle2 className="w-4 h-4 text-green-700" />
                  </div>
                ))}
              </div>
            )}
            {active === 3 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 text-[13px] text-gray-600">
                <p>
                  Aucune note interne.{" "}
                  <button className="text-green-700 font-bold">
                    Ajouter une note →
                  </button>
                </p>
              </div>
            )}
          </>
        )}
      </Tabs>
    </DetailShell>
  );
}

/* =========================================================
 * FARMERS list + detail
 * ======================================================= */

export function AdminFarmers() {
  const [q, setQ] = useState("");
  const filtered = adminFarmers.filter(
    (f) =>
      f.name.toLowerCase().includes(q.toLowerCase()) ||
      f.loc.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <Section
      title="Agriculteurs"
      subtitle={`${adminFarmers.length} partenaires affichés · 186 au total`}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Vérifiés" value="142" tone="green" />
        <MiniStat label="En attente" value="11" tone="amber" />
        <MiniStat label="Surface totale" value="3,840 ha" tone="blue" />
        <MiniStat label="Trust moyen" value="91" tone="green" />
      </div>
      <Toolbar
        q={q}
        setQ={setQ}
        placeholder="Rechercher nom ou localisation..."
      >
        <button className="h-9 px-3 bg-green-700 text-white rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </Toolbar>
      <Table
        headers={[
          "Agriculteur",
          "Localisation",
          "Surface",
          "Cultures",
          "Trust",
          "Levé / Objectif",
          "Statut",
          "",
        ]}
      >
        {filtered.map((f) => (
          <ClickRow key={f.id} to={`/admin/farmers/${f.id}`}>
            <td className="py-3">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-lg">
                  {f.avatar}
                </span>
                <div>
                  <p className="font-semibold">{f.name}</p>
                  <p className="text-gray-500 text-[11px]">Agent : {f.agent}</p>
                </div>
              </div>
            </td>
            <td className="text-gray-500">{f.loc}</td>
            <td>{f.surface} ha</td>
            <td className="text-gray-500 text-[11px]">{f.crops.join(", ")}</td>
            <td>
              <Tag tone="green">{f.trust}</Tag>
            </td>
            <td>
              <div className="w-32">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="font-bold">
                    ${f.raised.toLocaleString()}
                  </span>
                  <span className="text-gray-400">
                    ${f.needed.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-700"
                    style={{ width: `${(f.raised / f.needed) * 100}%` }}
                  />
                </div>
              </div>
            </td>
            <td>
              <StatusTag status={f.status} />
            </td>
            <td>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </td>
          </ClickRow>
        ))}
      </Table>
    </Section>
  );
}

export function AdminFarmerDetail() {
  const { id } = useParams();
  const f = adminFarmers.find((x) => x.id === id);
  if (!f) return <NotFoundDetail label="Agriculteur" />;
  const txs = adminTx.filter((t) => t.toId === f.id);
  return (
    <DetailShell back="/admin/farmers" backLabel="Agriculteurs">
      <ProfileHeader
        avatar={f.avatar}
        title={f.name}
        subtitle={`${f.experience} ans d'expérience · ${f.surface} ha · ${f.status}`}
        meta={[
          { icon: MapPin, value: f.loc },
          { icon: Phone, value: f.phone },
          { icon: Calendar, value: `Depuis ${f.joined}` },
          { icon: Users, value: `Agent : ${f.agent}` },
        ]}
        actions={
          <>
            <button className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
              <Edit className="w-3.5 h-3.5" /> Éditer
            </button>
            <button className="h-9 px-3 bg-green-700 text-white rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Vérifier
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="Trust score" value={String(f.trust)} tone="green" />
        <MiniStat
          label="Capital levé"
          value={`$${f.raised.toLocaleString()}`}
          tone="green"
        />
        <MiniStat
          label="Objectif"
          value={`$${f.needed.toLocaleString()}`}
          tone="amber"
        />
        <MiniStat label="Cultures" value={String(f.crops.length)} tone="blue" />
      </div>

      <Tabs
        tabs={["Investisseurs", "Récoltes", "Rapports terrain", "Documents"]}
      >
        {(active) => (
          <>
            {active === 0 && (
              <Table headers={["Investisseur", "Montant", "Date", "Statut"]}>
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="py-3 font-semibold">{t.from}</td>
                    <td className="font-display font-extrabold tabular">
                      {t.currency === "USD" ? "$" : ""}
                      {t.amt.toLocaleString()}
                      {t.currency === "FC" ? " FC" : ""}
                    </td>
                    <td className="text-gray-500 text-[12px]">{t.date}</td>
                    <td>
                      <StatusTag status={t.status} />
                    </td>
                  </tr>
                ))}
                {txs.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center text-gray-400 py-6 text-[12px]"
                    >
                      Aucun investisseur
                    </td>
                  </tr>
                )}
              </Table>
            )}
            {active === 1 && (
              <EmptyOrList
                items={f.crops.map((c) => ({
                  t: c,
                  s: "Saison en cours · Songololo",
                  v: "—",
                }))}
              />
            )}
            {active === 2 && (
              <div className="space-y-2">
                {[
                  {
                    d: "22 avr. 2026",
                    a: f.agent,
                    t: "Visite hebdomadaire — cultures en bonne santé, irrigation OK.",
                  },
                  {
                    d: "14 avr. 2026",
                    a: f.agent,
                    t: "Livraison engrais bio · 200 kg.",
                  },
                  {
                    d: "5 avr. 2026",
                    a: f.agent,
                    t: "Photos parcelle nord — croissance normale.",
                  },
                ].map((r, i) => (
                  <div
                    key={i}
                    className="bg-white border border-gray-200 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-bold text-[13px]">{r.a}</p>
                      <span className="text-[11px] text-gray-400">{r.d}</span>
                    </div>
                    <p className="text-[12px] text-gray-600">{r.t}</p>
                  </div>
                ))}
              </div>
            )}
            {active === 3 && (
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  "Titre foncier",
                  "Contrat coopérative",
                  "Attestation phytosanitaire",
                ].map((d) => (
                  <div
                    key={d}
                    className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3"
                  >
                    <FileBarChart className="w-5 h-5 text-green-700" />
                    <p className="flex-1 text-[13px] font-semibold">{d}</p>
                    <button className="text-[11px] font-bold text-green-700">
                      Voir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Tabs>
    </DetailShell>
  );
}

/* =========================================================
 * TRANSACTIONS list + detail
 * ======================================================= */

export function AdminTransactions() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("Tous");
  const filtered = adminTx.filter(
    (t) =>
      (kind === "Tous" || t.kind === kind) &&
      (t.from.toLowerCase().includes(q.toLowerCase()) ||
        t.to.toLowerCase().includes(q.toLowerCase()) ||
        t.ref.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <Section title="Transactions" subtitle="Volume du jour : 12.4M FC + $4,820">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Confirmées (7j)" value="312" tone="green" />
        <MiniStat label="En attente" value="14" tone="amber" />
        <MiniStat label="Échouées" value="3" tone="red" />
        <MiniStat label="Volume USD" value="$48,200" tone="blue" />
      </div>
      <Toolbar
        q={q}
        setQ={setQ}
        placeholder="Rechercher par nom ou référence..."
      >
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-[12px] font-semibold"
        >
          {["Tous", "Investissement", "Profit", "Retrait", "Frais"].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <button className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </Toolbar>
      <Table
        headers={["Date", "Type", "De", "Vers", "Montant", "Statut", "Ref", ""]}
      >
        {filtered.map((t) => (
          <ClickRow key={t.id} to={`/admin/transactions/${t.id}`}>
            <td className="py-3 text-gray-500 text-[12px]">{t.date}</td>
            <td>
              <Tag tone="green">{t.kind}</Tag>
            </td>
            <td className="font-semibold">{t.from}</td>
            <td className="text-gray-500">{t.to}</td>
            <td className="font-display font-extrabold tabular">
              {t.currency === "USD" ? "$" : ""}
              {t.amt.toLocaleString()}
              {t.currency === "FC" ? " FC" : ""}
            </td>
            <td>
              <StatusTag status={t.status} />
            </td>
            <td className="text-gray-400 text-[11px] font-mono">{t.ref}</td>
            <td>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </td>
          </ClickRow>
        ))}
      </Table>
    </Section>
  );
}

export function AdminTransactionDetail() {
  const { id } = useParams();
  const t = adminTx.find((x) => x.id === id);
  if (!t) return <NotFoundDetail label="Transaction" />;
  return (
    <DetailShell back="/admin/transactions" backLabel="Transactions">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500">
              {t.kind}
            </p>
            <h2 className="font-display font-black text-[28px] tabular mt-1">
              {t.currency === "USD" ? "$" : ""}
              {t.amt.toLocaleString()}
              {t.currency === "FC" ? " FC" : ""}
            </h2>
            <p className="text-[12px] text-gray-500 font-mono mt-1">{t.ref}</p>
          </div>
          <StatusTag status={t.status} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="De" value={t.from} />
          <Field label="Vers" value={t.to} />
          <Field label="Date" value={t.date} />
          <Field label="Devise" value={t.currency} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="font-display font-bold text-[16px] mb-3">Historique</h3>
        <ol className="space-y-3">
          {[
            { t: "Création", d: t.date, ok: true },
            { t: "Validation système", d: "auto", ok: true },
            {
              t: "Confirmation banque",
              d: t.status === "En attente" ? "—" : "OK",
              ok: t.status !== "En attente" && t.status !== "Échoué",
            },
            {
              t: "Finalisation",
              d: t.status === "Confirmé" || t.status === "Versé" ? "OK" : "—",
              ok: t.status === "Confirmé" || t.status === "Versé",
            },
          ].map((s, i) => (
            <li key={i} className="flex items-center gap-3 text-[13px]">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center ${s.ok ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
              >
                {s.ok ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <p className="flex-1 font-semibold">{s.t}</p>
              <span className="text-gray-500 text-[12px]">{s.d}</span>
            </li>
          ))}
        </ol>
      </div>
    </DetailShell>
  );
}

/* =========================================================
 * OPPORTUNITIES
 * ======================================================= */

export function AdminOpportunities() {
  const opps = [
    {
      id: "o1",
      t: "Pastèques Songololo 5ha",
      roi: 22,
      raised: 2280,
      target: 3500,
      status: "Ouverte",
    },
    {
      id: "o2",
      t: "Tomates Matadi 3ha",
      roi: 18,
      raised: 1540,
      target: 2200,
      status: "Ouverte",
    },
    {
      id: "o3",
      t: "Café Kivu — export Chine",
      roi: 28,
      raised: 9800,
      target: 12000,
      status: "Bientôt clôturée",
    },
    {
      id: "o4",
      t: "Cacao Mayombe bio",
      roi: 32,
      raised: 6400,
      target: 9000,
      status: "Ouverte",
    },
    {
      id: "o5",
      t: "Transport bourse #041",
      roi: 20,
      raised: 50,
      target: 50,
      status: "Clôturée",
    },
  ];
  return (
    <Section
      title="Opportunités"
      subtitle="Pipeline d'investissement de la coopérative"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniStat label="Ouvertes" value="14" tone="green" />
        <MiniStat label="Clôturées (mois)" value="9" tone="blue" />
        <MiniStat label="ROI moyen" value="22%" tone="amber" />
        <MiniStat label="Capital ciblé" value="$84,200" tone="green" />
      </div>
      <Table
        headers={["Opportunité", "ROI", "Progression", "Statut", "Action"]}
      >
        {opps.map((o) => (
          <tr key={o.id} className="border-t border-gray-100">
            <td className="py-3 font-semibold">{o.t}</td>
            <td className="font-display font-extrabold tabular text-green-700">
              {o.roi}%
            </td>
            <td>
              <div className="w-40">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="font-bold">
                    ${o.raised.toLocaleString()}
                  </span>
                  <span className="text-gray-400">
                    ${o.target.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-700"
                    style={{
                      width: `${Math.min(100, (o.raised / o.target) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </td>
            <td>
              <Tag
                tone={
                  o.status === "Ouverte"
                    ? "green"
                    : o.status === "Clôturée"
                      ? "gray"
                      : "amber"
                }
              >
                {o.status}
              </Tag>
            </td>
            <td>
              <button className="text-[12px] font-bold text-green-700">
                Gérer →
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* =========================================================
 * KYC
 * ======================================================= */

export function AdminKyc() {
  const queue = adminUsers.filter((u) => u.kycLevel < 3);
  return (
    <Section
      title="KYC & Conformité"
      subtitle="Validation des identités et conformité réglementaire"
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MiniStat
          label="En attente"
          value={String(queue.length)}
          tone="amber"
        />
        <MiniStat label="Validés (mois)" value="124" tone="green" />
        <MiniStat label="Rejetés (mois)" value="8" tone="red" />
        <MiniStat label="Score conformité" value="98%" tone="green" />
      </div>
      <Table
        headers={[
          "Utilisateur",
          "Niveau actuel",
          "Documents",
          "Soumis",
          "Action",
        ]}
      >
        {queue.map((u) => (
          <tr key={u.id} className="border-t border-gray-100">
            <td className="py-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                  {u.avatar}
                </span>
                <p className="font-semibold">{u.name}</p>
              </div>
            </td>
            <td>
              <KycBadge level={u.kycLevel} />
            </td>
            <td className="text-[12px] text-gray-500">ID · Justif · Selfie</td>
            <td className="text-[12px] text-gray-500">{u.joined}</td>
            <td>
              <div className="flex gap-1.5">
                <button className="h-7 px-2 bg-green-700 text-white text-[11px] font-bold rounded">
                  Valider
                </button>
                <button className="h-7 px-2 bg-red-50 text-red-700 text-[11px] font-bold rounded">
                  Rejeter
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </Section>
  );
}

/* =========================================================
 * REPORTS
 * ======================================================= */

export function AdminReports() {
  const [cat, setCat] = useState("Tous");
  const filtered =
    cat === "Tous"
      ? adminReports
      : adminReports.filter((r) => r.category === cat);
  return (
    <Section
      title="Rapports"
      subtitle="Exports comptables, conformité et impact"
    >
      <Toolbar q="" setQ={() => {}} placeholder="">
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="h-9 px-3 bg-white border border-gray-200 rounded-lg text-[12px] font-semibold"
        >
          {["Tous", "Comptabilité", "Conformité", "Impact", "Audit"].map(
            (c) => (
              <option key={c}>{c}</option>
            ),
          )}
        </select>
        <button className="h-9 px-3 bg-green-700 text-white rounded-lg text-[12px] font-semibold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Générer
        </button>
      </Toolbar>
      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((r) => (
          <Link
            key={r.id}
            to={`/admin/reports/${r.id}`}
            className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-3 hover:border-green-700 transition"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${r.category === "Conformité" ? "bg-amber-50 text-amber-700" : r.category === "Audit" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
            >
              <FileBarChart className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[13px] truncate">{r.title}</p>
              <p className="text-[11px] text-gray-500">
                {r.type} · {r.size} · {r.date}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        ))}
      </div>
    </Section>
  );
}

export function AdminReportDetail() {
  const { id } = useParams();
  const r = adminReports.find((x) => x.id === id);
  if (!r) return <NotFoundDetail label="Rapport" />;
  return (
    <DetailShell back="/admin/reports" backLabel="Rapports">
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center">
            <FileBarChart className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-black text-[22px]">{r.title}</h2>
            <p className="text-[12px] text-gray-500 mt-1">
              {r.category} · {r.type} · {r.size}
            </p>
          </div>
          <button className="h-10 px-4 bg-green-700 text-white rounded-lg text-[13px] font-bold flex items-center gap-2">
            <Download className="w-4 h-4" /> Télécharger
          </button>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <Field label="Auteur" value={r.author} />
          <Field label="Date de génération" value={r.date} />
          <Field label="Catégorie" value={r.category} />
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="font-display font-bold text-[16px] mb-3">Aperçu</h3>
        <div className="aspect-[16/9] bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 text-[12px]">
          Aperçu indisponible · Téléchargez le fichier
        </div>
      </div>
    </DetailShell>
  );
}

/* =========================================================
 * ALERTS & SETTINGS
 * ======================================================= */

export function AdminAlerts() {
  return (
    <Section title="Alertes" subtitle="Notifications système et incidents">
      <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
        {adminAlerts.map((a) => (
          <div
            key={a.id}
            className="p-4 flex items-start gap-3 hover:bg-gray-50"
          >
            <AlertDot level={a.level} />
            <div className="flex-1">
              <p className="font-bold text-[14px]">{a.title}</p>
              <p className="text-[12px] text-gray-500">{a.body}</p>
            </div>
            <span className="text-[11px] text-gray-400 whitespace-nowrap">
              {a.time}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function AdminSettings() {
  return (
    <Section title="Paramètres" subtitle="Configuration de la plateforme">
      <div className="grid md:grid-cols-2 gap-4">
        {[
          {
            t: "Frais de plateforme",
            v: "2.5%",
            d: "Commission sur chaque investissement",
          },
          {
            t: "Taux de change USD/FC",
            v: "2,750",
            d: "Mis à jour quotidiennement",
          },
          {
            t: "Investissement minimum",
            v: "$50",
            d: "Seuil de participation",
          },
          { t: "Durée KYC", v: "48h", d: "Délai cible de validation" },
          {
            t: "Langues supportées",
            v: "FR · EN · LN",
            d: "Français, Anglais, Lingala",
          },
          {
            t: "Mode maintenance",
            v: "Désactivé",
            d: "Activer pour bloquer les opérations",
          },
        ].map((s) => (
          <div
            key={s.t}
            className="bg-white border border-gray-200 rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-[13px]">{s.t}</p>
              <button className="text-[11px] font-bold text-green-700">
                Modifier
              </button>
            </div>
            <p className="font-display font-black text-[18px]">{s.v}</p>
            <p className="text-[11px] text-gray-500 mt-1">{s.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* =========================================================
 * SHARED UI
 * ======================================================= */

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display font-black text-[26px]">{title}</h1>
        <p className="text-gray-500 text-[13px]">{subtitle}</p>
      </header>
      {children}
    </div>
  );
}

function Tag({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "gray" | "blue";
  children: React.ReactNode;
}) {
  const map = {
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-700",
  };
  return (
    <span
      className={`inline-block text-[10px] font-bold rounded-full px-2 py-0.5 ${map[tone]}`}
    >
      {children}
    </span>
  );
}

function StatusTag({ status }: { status: string }) {
  const tone: "green" | "amber" | "red" | "gray" =
    status === "Confirmé" ||
    status === "Versé" ||
    status === "Actif" ||
    status === "Vérifié"
      ? "green"
      : status === "En attente" || status === "KYC"
        ? "amber"
        : status === "Échoué" || status === "Suspendu"
          ? "red"
          : "gray";
  return <Tag tone={tone}>{status}</Tag>;
}

function KycBadge({ level }: { level: 1 | 2 | 3 }) {
  const tone = level === 3 ? "green" : level === 2 ? "amber" : "red";
  return <Tag tone={tone as "green" | "amber" | "red"}>Niveau {level}</Tag>;
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-x-auto">
      <table className="w-full text-[13px] text-left">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-gray-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        <style>{`tbody tr td { padding-left: 1rem; padding-right: 1rem; }`}</style>
      </table>
    </div>
  );
}

function ClickRow({ to, children }: { to: string; children: React.ReactNode }) {
  const nav = useNavigate();
  return (
    <tr
      onClick={() => nav(to)}
      className="border-t border-gray-100 cursor-pointer hover:bg-green-50/40 transition"
    >
      {children}
    </tr>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "red" | "blue";
}) {
  const map = {
    green: "text-green-700 bg-green-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
    blue: "text-blue-700 bg-blue-50",
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-3.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
        {label}
      </p>
      <p className="font-display font-black text-[20px] tabular mt-0.5">
        {value}
      </p>
      <span
        className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${map[tone]}`}
      >
        ● live
      </span>
    </div>
  );
}

function Toolbar({
  q,
  setQ,
  placeholder,
  children,
}: {
  q: string;
  setQ: (v: string) => void;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {placeholder && (
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 pl-9 pr-3 bg-white border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-green-700"
          />
        </div>
      )}
      {children}
    </div>
  );
}

function AlertDot({ level }: { level: "info" | "warning" | "danger" }) {
  const map = {
    info: "bg-blue-50 text-blue-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  };
  const Icon =
    level === "danger" ? AlertTriangle : level === "warning" ? Clock : Bell;
  return (
    <div
      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${map[level]}`}
    >
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}

function DetailShell({
  back,
  backLabel,
  children,
}: {
  back: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <Link
        to={back}
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-gray-500 hover:text-green-700"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
      </Link>
      {children}
    </div>
  );
}

function ProfileHeader({
  avatar,
  title,
  subtitle,
  meta,
  actions,
}: {
  avatar: string;
  title: string;
  subtitle: string;
  meta: { icon: React.ComponentType<{ className?: string }>; value: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-br from-green-900 to-green-700 text-white rounded-2xl p-6">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-3xl">
          {avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-black text-[24px]">{title}</h2>
          <p className="text-white/70 text-[13px]">{subtitle}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {meta.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-[12px] text-white/85"
              >
                <m.icon className="w-3.5 h-3.5" /> {m.value}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">{actions}</div>
      </div>
    </div>
  );
}

function Tabs({
  tabs,
  children,
}: {
  tabs: string[];
  children: (active: number) => React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setActive(i)}
            className={`px-4 py-2.5 text-[13px] font-bold whitespace-nowrap border-b-2 transition ${
              active === i
                ? "border-green-700 text-green-700"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div>{children(active)}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
        {label}
      </p>
      <p className="font-semibold text-[14px] mt-1">{value}</p>
    </div>
  );
}

function EmptyOrList({
  items,
}: {
  items: { t: string; s: string; v: string }[];
}) {
  if (!items.length)
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-[13px]">
        Aucun élément
      </div>
    );
  return (
    <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
      {items.map((it, i) => (
        <div key={i} className="p-4 flex items-center gap-3">
          <Package className="w-5 h-5 text-green-700" />
          <div className="flex-1">
            <p className="font-bold text-[13px]">{it.t}</p>
            <p className="text-[11px] text-gray-500">{it.s}</p>
          </div>
          <span className="font-display font-extrabold tabular text-[14px]">
            {it.v}
          </span>
        </div>
      ))}
    </div>
  );
}

function NotFoundDetail({ label }: { label: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
      <p className="text-gray-500">{label} introuvable.</p>
    </div>
  );
}

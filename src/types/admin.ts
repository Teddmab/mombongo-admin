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

export interface AdminReport {
  id: string;
  title: string;
  type: "PDF" | "CSV" | "Excel";
  size: string;
  category: "Comptabilité" | "Conformité" | "Impact" | "Audit";
  date: string;
  author: string;
}

export interface AdminAlert {
  id: string;
  level: "info" | "warning" | "danger";
  title: string;
  body: string;
  time: string;
}

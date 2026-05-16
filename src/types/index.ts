import { Timestamp } from "firebase/firestore";

export type UserRole = "investor" | "farmer" | "merchant" | "agent" | "admin";
export type PaymentMethod = "mpesa" | "airtel" | "orange" | "equity" | "stripe";
export type PaymentStatus = "pending" | "confirmed" | "failed" | "refunded";
export type ProductStatus =
  | "draft"
  | "open"
  | "funded"
  | "active"
  | "harvesting"
  | "completed"
  | "cancelled";

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  preferredLanguage: "fr" | "en" | "ln";
  avatarUrl: string | null;
  kycStatus: "pending" | "verified" | "rejected";
  kycVerifiedAt: Timestamp | null;
  mobileMoneyNumber: string | null;
  mobileMoneyProvider: PaymentMethod | null;
  fcmTokens: string[];
  totalInvestedUsd: number;
  totalEarnedUsd: number;
  referralCode: string;
  referredBy: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Product {
  id: string;
  name: string;
  nameEn: string;
  nameLn: string;
  description: string;
  descriptionEn: string;
  category: "agriculture" | "logistique" | "export" | "peche" | "elevage";
  iconEmoji: string;
  imageUrl: string | null;
  supplierId: string;
  supplierName: string;
  location: string;
  region: string;
  minInvestmentUsd: number;
  targetAmountUsd: number;
  fundedAmountUsd: number;
  roiPercentage: number;
  durationDays: number;
  startDate: Timestamp;
  harvestDate: Timestamp;
  investorCount: number;
  unit: string;
  stockQuantity: number;
  status: ProductStatus;
  isFeatured: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Investment {
  id: string;
  investorId: string;
  productId: string;
  amountUsd: number;
  amountCdf: number;
  exchangeRate: number;
  roiPercentage: number;
  expectedReturnUsd: number;
  actualReturnUsd: number | null;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  paymentStatus: PaymentStatus;
  status: "pending" | "active" | "maturing" | "completed" | "cancelled";
  investedAt: Timestamp;
  maturesAt: Timestamp;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface BourseOpportunity {
  id: string;
  productName: string;
  productIcon: string;
  farmerId: string;
  farmerName: string;
  routeFrom: string;
  routeTo: string;
  quantity: number;
  unit: string;
  pricePerUnitCdf: number;
  totalTransportCdf: number;
  commissionPercent: number;
  minInvestmentCdf: number;
  departureDate: Timestamp;
  estimatedSaleDays: number;
  fundedPercent: number;
  totalInvestors: number;
  status:
    | "open"
    | "funded"
    | "in_transit"
    | "sold"
    | "distributed"
    | "cancelled";
  createdAt: Timestamp;
}

export interface BoursePrice {
  id: string;
  productName: string;
  priceCdf: number;
  unit: string;
  market: string;
  changePercent: number;
  recordedAt: Timestamp;
}

export interface Course {
  id: string;
  title: string;
  titleEn: string;
  titleLn: string;
  description: string;
  category:
    | "commerce"
    | "agriculture"
    | "finance"
    | "entrepreneuriat"
    | "export";
  level: "debutant" | "intermediaire" | "avance";
  iconEmoji: string;
  totalLessons: number;
  totalHours: number;
  languages: string[];
  enrolledCount: number;
  rating: number;
  isPremium: boolean;
  isPublished: boolean;
  instructorName: string;
  createdAt: Timestamp;
}

export interface Transaction {
  id: string;
  userId: string;
  type: "investment" | "bourse" | "withdrawal" | "profit" | "refund" | "fee";
  referenceId: string;
  amountUsd: number | null;
  amountCdf: number | null;
  paymentMethod: PaymentMethod;
  externalReference: string | null;
  status: PaymentStatus;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  titleEn: string;
  titleLn: string;
  message: string;
  messageEn: string;
  messageLn: string;
  actionUrl: string | null;
  isRead: boolean;
  pushSent: boolean;
  createdAt: Timestamp;
}

export interface Farmer {
  id: string;
  fullName: string;
  phone: string;
  location: string;
  region: string;
  totalHectares: number;
  mainCrop: string;
  agentId: string | null;
  mombongoRating: number;
  totalFinancedUsd: number;
  repaymentRate: number;
  isVerified: boolean;
  notes: string;
  createdAt: Timestamp;
}

export interface Enrollment {
  id: string;
  userId: string;
  courseId: string;
  progressPercent: number;
  lastModule: number;
  enrolledAt: Timestamp;
  completedAt: Timestamp | null;
  certificateIssued: boolean;
}

export interface UniversityClub {
  id: string;
  name: string;
  fullName: string;
  city: string;
  country: string;
  memberCount: number;
  isActive: boolean;
}

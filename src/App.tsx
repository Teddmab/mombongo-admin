import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminOpportunities } from "@/pages/AdminOpportunities";
import { AdminReports } from "@/pages/AdminReports";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminUsers } from "@/pages/AdminUsers";
import { AdminFarmers, AdminFarmerDetail } from "@/pages/AdminFarmers";
import { AdminTransactions, AdminTransactionDetail } from "@/pages/AdminTransactions";
import { AdminKyc } from "@/pages/AdminKyc";
import { AdminAlerts } from "@/pages/AdminAlerts";
import { AdminSettings } from "@/pages/AdminSettings";
import { AdminProducts } from "@/pages/AdminProducts";
import { AdminBourse } from "@/pages/AdminBourse";
import { AdminFinancing } from "@/pages/AdminFinancing";
import { AdminAcademia } from "@/pages/AdminAcademia";
import { AdminOffers, AdminOfferCourseConfig } from "@/pages/AdminOffers";
import { AdminAgroExchange } from "@/pages/AdminAgroExchange";
import { AdminInvestments } from "@/pages/AdminInvestments";
import AdminAgronomie from "@/pages/AdminAgronomie";
import { AdminNotifications } from "@/pages/AdminNotifications";
import { AdminVideos } from "@/pages/AdminVideos";
import { AdminRoles } from "@/pages/AdminRoles";
import { AdminDidYouKnow } from "@/pages/AdminDidYouKnow";
import { AdminPartnerInvoices, AdminPartnerInvoiceDetail } from "@/pages/AdminPartnerInvoices";
import { AdminPartners, AdminPartnerDetail } from "@/pages/AdminPartners";
import { AdminHarvestOffers } from "@/pages/AdminHarvestOffers";
import { AdminHarvestOfferQA } from "@/pages/AdminHarvestOfferQA";
import { LoginScreen } from "@/pages/LoginScreen";
import { JoinScreen } from "@/pages/JoinScreen";
import { AuthProvider } from "@/store/AuthContext";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/join"  element={<JoinScreen />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="farmers" element={<AdminFarmers />} />
                <Route path="farmers/:id" element={<AdminFarmerDetail />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="transactions" element={<AdminTransactions />} />
                <Route
                  path="transactions/:id"
                  element={<AdminTransactionDetail />}
                />
                <Route path="opportunities" element={<AdminOpportunities />} />
                <Route path="bourse" element={<AdminBourse />} />
                <Route path="financing" element={<AdminFinancing />} />
                <Route path="investments" element={<AdminInvestments />} />
                <Route path="academia" element={<AdminAcademia />} />
                <Route path="offers" element={<AdminOffers />} />
                <Route path="offers/:id/course" element={<AdminOfferCourseConfig />} />
                <Route path="agro-exchange" element={<AdminAgroExchange />} />
                <Route path="kyc" element={<AdminKyc />} />
                <Route path="partners" element={<AdminPartners />} />
                <Route path="partners/:id" element={<AdminPartnerDetail />} />
                <Route path="partner-invoices" element={<AdminPartnerInvoices />} />
                <Route path="partner-invoices/:id" element={<AdminPartnerInvoiceDetail />} />
                <Route path="harvest-offers" element={<AdminHarvestOffers />} />
                <Route path="qa/harvest-offers" element={<AdminHarvestOfferQA />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="alerts" element={<AdminAlerts />} />
                <Route path="agronomie" element={<AdminAgronomie />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="videos"        element={<AdminVideos />} />
                <Route path="roles"         element={<AdminRoles />} />
                <Route path="did-you-know" element={<AdminDidYouKnow />} />
                <Route path="settings"      element={<AdminSettings />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

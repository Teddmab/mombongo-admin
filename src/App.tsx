import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import {
  AdminAlerts,
  AdminDashboard,
  AdminFarmerDetail,
  AdminFarmers,
  AdminKyc,
  AdminLayout,
  AdminOpportunities,
  AdminReportDetail,
  AdminReports,
  AdminSettings,
  AdminTransactionDetail,
  AdminTransactions,
  AdminUserDetail,
  AdminUsers,
} from "@/pages/Admin";
import { AdminProducts } from "@/pages/AdminProducts";
import { AdminBourse } from "@/pages/AdminBourse";
import { AdminFinancing } from "@/pages/AdminFinancing";
import { AdminAcademia } from "@/pages/AdminAcademia";
import { AdminAgroExchange } from "@/pages/AdminAgroExchange";
import { LoginScreen } from "@/pages/LoginScreen";
import { AuthProvider } from "@/store/AuthContext";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:id" element={<AdminUserDetail />} />
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
                <Route path="academia" element={<AdminAcademia />} />
                <Route path="agro-exchange" element={<AdminAgroExchange />} />
                <Route path="kyc" element={<AdminKyc />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="reports/:id" element={<AdminReportDetail />} />
                <Route path="alerts" element={<AdminAlerts />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

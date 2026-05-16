import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AdminBourse } from "@/pages/AdminBourse";
import { AdminDashboard } from "@/pages/AdminDashboard";
import { AdminFinancing } from "@/pages/AdminFinancing";
import { AdminTransactions } from "@/pages/AdminTransactions";
import { AdminUsers } from "@/pages/AdminUsers";
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
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<AdminDashboard />} />
              <Route path="/users" element={<AdminUsers />} />
              <Route path="/transactions" element={<AdminTransactions />} />
              <Route path="/financing" element={<AdminFinancing />} />
              <Route path="/bourse" element={<AdminBourse />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

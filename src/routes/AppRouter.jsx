import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";

// Pages
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import UsersPage from "../pages/users/UsersPage";
import NotFoundPage from "../pages/notFound/NotFoundPage";
import SettingsPage from "../pages/settings/SettingsPage";
import AdminsPage from "../pages/Admins/AdminPage";
import DiscountPage from "../pages/Discounts/DiscountPage";
import TaxesPage from "../pages/Tax/Taxpage";
import PackagePage from "../pages/Packages/Packagespage";
import OrdersPage from "../pages/order/OrderPage";
import SubscribesPage from "../pages/Subscribes/Subscriberspage";
/**
 * Dedicated Router Navigation Component
 * Defines all public, authenticated, and fallback routes for Smartego Admin.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Protected Admin Routes */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          {/* Root redirect to Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admins" element={<AdminsPage />} />
          <Route path="/discount" element={<DiscountPage />} />
          <Route path="/tax" element={<TaxesPage />} />
          <Route path="/package" element={<PackagePage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/subscribes" element={<SubscribesPage />} />
        </Route>

        {/* 404 Catch-All Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

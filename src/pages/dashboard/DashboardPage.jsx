import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  Clock,
  Building2,
  Radio,
  ShoppingBag,
  ActivityIcon,
} from "lucide-react";
import useAuth from "../../hooks/useAuth";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import "./DashboardPage.css";

// Fallback shape matches the /admin/dashboard API contract exactly
const FALLBACK_DASHBOARD_STATS = {
  active_order: 0,
  used: 0,
  remaining: null,
  period: { from: null, to: null },
  overview: { total_restaurants: 0, active_restaurants: 0, total_orders: 0 },
};

export function DashboardPage() {
  const { user } = useAuth();

  const [dashboardStats, setDashboardStats] = useState(
    FALLBACK_DASHBOARD_STATS,
  );
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // /admin/dashboard returns a single object, so fetch it directly.
  const fetchDashboardStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const response = await axiosClient.get("/admin/dashboard");
      const payload = response.data?.data || response.data;
      setDashboardStats(payload || FALLBACK_DASHBOARD_STATS);
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch dashboard stats";
      setStatsError(errorMsg);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchDashboardStats);
  }, [fetchDashboardStats]);

  const { active_order, used, remaining, period, overview } = dashboardStats;

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatPeriod = (p) => {
    if (!p || (!p.from && !p.to)) return "All-time";
    if (p.from && p.to) return `${formatDate(p.from)} – ${formatDate(p.to)}`;
    return formatDate(p.from || p.to);
  };

  return (
    <div className="dashboard-container">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="welcome-content">
          <h2 className="welcome-heading">
            Welcome,{" "}
            {user?.name || user?.email?.split("@")[0] || "Administrator"}! 👋
          </h2>
          <p className="welcome-desc">Smartego Restaurant & Client Hub</p>
        </div>
        <div className="welcome-actions">
          <Button
            variant="outline"
            icon={RefreshCw}
            isLoading={statsLoading}
            onClick={fetchDashboardStats}
          >
            Refresh Feed
          </Button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Total Restaurants</span>
            <div className="stat-icon-wrapper stat-emerald">
              <Building2 size={20} />
            </div>
          </div>
          <div className="stat-value">{overview.total_restaurants}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Active Restaurants</span>
            <div className="stat-icon-wrapper stat-emerald">
              <ActivityIcon size={20} />
            </div>
          </div>
          <div className="stat-value">{overview.active_restaurants}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Orders</span>
            <div className="stat-icon-wrapper stat-purple">
              <ShoppingBag size={20} />
            </div>
          </div>
          <div className="stat-value">{overview.total_orders}</div>
        </div>
      </div>

      {/* Account Usage / Quota Stats - sourced from /admin/dashboard */}
      <div className="quota-section-header">
        <h3 className="card-title">Account Usage & Quota</h3>
        {statsError && (
          <span className="quota-error-text">Failed to load: {statsError}</span>
        )}
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Order Quota</span>
            <div className="stat-icon-wrapper stat-purple">
              <Radio size={20} />
            </div>
          </div>
          <div className="stat-value">
            {statsLoading ? "—" : (Number(active_order) || 0).toLocaleString()}
          </div>
          <div className="stat-footer">
            <span className="stat-trend">
              Total orders allotted this period
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Used</span>
            <div className="stat-icon-wrapper stat-cyan">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value">
            {statsLoading ? "—" : (Number(used) || 0).toLocaleString()}
          </div>
          <div className="stat-footer">
            <span className="stat-trend">{formatPeriod(period)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-title">Remaining</span>
            <div className="stat-icon-wrapper stat-emerald">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="stat-value">
            {statsLoading
              ? "—"
              : remaining === null || remaining === undefined
                ? "Unlimited"
                : Number(remaining).toLocaleString()}
          </div>
          <div className="stat-footer">
            <span className="stat-trend positive">
              {remaining === null || remaining === undefined
                ? "No cap on this plan"
                : "Left in current period"}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}

export default DashboardPage;

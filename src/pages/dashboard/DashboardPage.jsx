import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Users,
  MessageSquare,
  Smartphone,
  Bot,
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Filter,
  Eye,
  Check,
  Radio,
  ShoppingBag,
  ActivityIcon,
} from "lucide-react";
import useAuth from "../../hooks/useAuth";
import useCrud from "../../hooks/useCrud";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import "./DashboardPage.css";

// Schema-compliant sample data for fallback/demo
const FALLBACK_USERS = [
  {
    id: 1,
    name: "Tariq Al-Mansoor",
    email: "tariq@gourmetbistro.com",
    phone: "+971 50 123 4567",
    email_verified_at: "2026-01-14T10:20:00Z",
    restuarant_name: "Gourmet Bistro Dubai",
    ai_context:
      "Fine dining Mediterranean bistro. Handles real-time table reservations, chef special recommendations, and dietary inquiries in English and Arabic.",
    android_link:
      "https://play.google.com/store/apps/details?id=com.smartego.gourmetbistro",
    ios_link: "https://apps.apple.com/app/gourmet-bistro/id10293847",
    msg_number: 8450,
    access_token: "EAABwzL01...",
    phone_number_id: "109823471029",
    waba_id: "203948102938",
    phone_status: "verified",
    phone_verified_at: "2026-01-14T11:00:00Z",
    role: "restaurant_owner",
    created_at: "2026-01-14T10:15:00Z",
    updated_at: "2026-03-18T16:30:00Z",
  },
  {
    id: 2,
    name: "Sophia Laurent",
    email: "sophia@laurentbakery.com",
    phone: "+33 6 12 34 56 78",
    email_verified_at: "2026-02-01T08:15:00Z",
    restuarant_name: "Laurent Artisan Bakery",
    ai_context:
      "French bakery & breakfast patisserie. Handles daily pastry pre-orders, catering inquiries, and custom cake design consultations.",
    android_link:
      "https://play.google.com/store/apps/details?id=com.smartego.laurentbakery",
    ios_link: "https://apps.apple.com/app/laurent-bakery/id20394819",
    msg_number: 4210,
    access_token: "EAABwzL02...",
    phone_number_id: "109823471030",
    waba_id: "203948102939",
    phone_status: "verified",
    phone_verified_at: "2026-02-01T09:00:00Z",
    role: "restaurant_owner",
    created_at: "2026-02-01T08:00:00Z",
    updated_at: "2026-03-17T14:20:00Z",
  },
  {
    id: 3,
    name: "Kenji Takahashi",
    email: "kenji@sakuraramen.com",
    phone: "+81 90 1234 5678",
    email_verified_at: "2026-02-18T12:00:00Z",
    restuarant_name: "Sakura Ramen House",
    ai_context:
      "Authentic ramen bar. Answers broth origin questions, waitlist queue reservations, and takeout delivery tracking.",
    android_link:
      "https://play.google.com/store/apps/details?id=com.smartego.sakuraramen",
    ios_link: "",
    msg_number: 6300,
    access_token: "EAABwzL03...",
    phone_number_id: "109823471031",
    waba_id: "203948102940",
    phone_status: "verified",
    phone_verified_at: "2026-02-18T12:30:00Z",
    role: "restaurant_owner",
    created_at: "2026-02-18T11:45:00Z",
    updated_at: "2026-03-19T09:10:00Z",
  },
  {
    id: 4,
    name: "Mateo Rossi",
    email: "mateo@trattoriarossi.it",
    phone: "+39 06 698 1234",
    email_verified_at: "2026-03-05T14:00:00Z",
    restuarant_name: "Trattoria Rossi & Pizzeria",
    ai_context:
      "Neapolitan pizzeria. Manages wood-fired pizza orders, wine pairings, and private dining group reservations.",
    android_link: "",
    ios_link: "",
    msg_number: 1120,
    access_token: "EAABwzL04...",
    phone_number_id: "109823471032",
    waba_id: "203948102941",
    phone_status: "pending",
    phone_verified_at: null,
    role: "restaurant_owner",
    created_at: "2026-03-05T13:40:00Z",
    updated_at: "2026-03-19T11:00:00Z",
  },
];

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

  // Connect to the requested API endpoint: https://smartego.keeto.org/api/admin/user_lists
  const {
    items: userLists,
    loading,
    error,
    refetch,
  } = useCrud("/admin/user_lists", {
    initialData: FALLBACK_USERS,
    immediate: true,
  });

  // Connect to the requested API endpoint: https://smartego.keeto.org/api/admin/dashboard
  // NOTE: useCrud only unwraps array-shaped `data` payloads (it's built for lists),
  // and /admin/dashboard returns a single object, so it's fetched directly here
  // using the same axiosClient (same base URL + auth) that useCrud uses internally.
  const [dashboardStats, setDashboardStats] = useState(
    FALLBACK_DASHBOARD_STATS,
  );
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

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
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const { active_order, used, remaining, period, overview } = dashboardStats;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedUser, setSelectedUser] = useState(null);

  // Compute live aggregate stats from the retrieved user_lists
  const stats = useMemo(() => {
    const totalUsers = userLists.length;
    const totalMessages = userLists.reduce(
      (sum, u) => sum + (Number(u.msg_number) || 0),
      0,
    );
    const verifiedPhones = userLists.filter(
      (u) => u.phone_status === "verified" || Boolean(u.phone_verified_at),
    ).length;
    const aiConfigured = userLists.filter(
      (u) => u.ai_context && u.ai_context.trim().length > 0,
    ).length;

    return {
      totalUsers,
      totalMessages,
      verifiedPhones,
      aiConfigured,
    };
  }, [userLists]);

  // Filtered list
  const filteredUsers = useMemo(() => {
    return userLists.filter((item) => {
      const nameMatch = item.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const restaurantMatch = item.restuarant_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const emailMatch = item.email
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const phoneMatch = item.phone?.includes(searchTerm);
      const matchesSearch =
        nameMatch || restaurantMatch || emailMatch || phoneMatch;

      const isVerified =
        item.phone_status === "verified" || Boolean(item.phone_verified_at);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "VERIFIED" && isVerified) ||
        (statusFilter === "PENDING" && !isVerified);

      return matchesSearch && matchesStatus;
    });
  }, [userLists, searchTerm, statusFilter]);

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
            isLoading={loading || statsLoading}
            onClick={() => {
              refetch();
              fetchDashboardStats();
            }}
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

      {/* Main Table Section: user_lists */}
      <div className="dashboard-card user-lists-card">
        <div className="user-lists-header">
          <div>
            <h3 className="card-title">Client & Restaurant User Lists</h3>
          </div>

          <div className="user-lists-actions">
            {/* Search Input */}
            <div className="search-box">
              <Search size={16} className="search-box-icon" />
              <input
                type="text"
                placeholder="Search restaurant, owner, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-box-input"
              />
            </div>

            {/* Filter */}
            <div className="filter-group">
              <Filter size={16} className="filter-icon" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Statuses</option>
                <option value="VERIFIED">Verified Only</option>
                <option value="PENDING">Pending Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* User Lists Table */}
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Restaurant & Owner</th>
                <th>Contact</th>
                <th>WhatsApp WABA</th>
                <th>Messages</th>
                <th>AI Context</th>
                <th>Registered</th>
                <th className="th-actions">Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    <p>No client records matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => {
                  const isVerified =
                    item.phone_status === "verified" ||
                    Boolean(item.phone_verified_at);
                  return (
                    <tr key={item.id} className="table-row">
                      {/* Restaurant & Owner */}
                      <td>
                        <div className="restaurant-cell">
                          <div className="restaurant-avatar">
                            {(item.restuarant_name || item.name || "R")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div className="restaurant-meta">
                            <span className="restaurant-name">
                              {item.restuarant_name || "Unnamed Restaurant"}
                            </span>
                            <span className="owner-name">{item.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td>
                        <div className="contact-meta">
                          <span className="contact-phone">
                            <Phone size={12} className="inline-icon" />{" "}
                            {item.phone || "N/A"}
                          </span>
                          <span className="contact-email">
                            <Mail size={12} className="inline-icon" />{" "}
                            {item.email}
                          </span>
                        </div>
                      </td>

                      {/* WhatsApp / Phone Status */}
                      <td>
                        <div className="waba-meta">
                          <span
                            className={`status-pill ${
                              isVerified ? "status-active" : "status-pending"
                            }`}
                          >
                            <span className="status-dot"></span>
                            {isVerified ? "Verified" : "Pending"}
                          </span>
                          {item.waba_id && (
                            <span className="waba-id-tag">
                              ID: {item.waba_id}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Message Count */}
                      <td>
                        <div className="msg-count-pill">
                          <MessageSquare size={13} />
                          <span>
                            {(Number(item.msg_number) || 0).toLocaleString()}
                          </span>
                        </div>
                      </td>

                      {/* AI Context Snippet */}
                      <td>
                        <div
                          className="ai-context-snippet"
                          title={item.ai_context || "No AI context"}
                        >
                          <Bot size={13} className="bot-icon" />
                          <span>
                            {item.ai_context
                              ? item.ai_context.substring(0, 48) + "..."
                              : "Not configured"}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="cell-date">
                        {formatDate(item.created_at)}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="actions-cell">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => setSelectedUser(item)}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="table-footer-bar">
          <span>
            Showing {filteredUsers.length} of {userLists.length} restaurants
          </span>
          
        </div>
      </div>

      {/* DETAIL MODAL */}
      <Modal
        isOpen={Boolean(selectedUser)}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.restuarant_name || "Restaurant Details"}
        maxWidth="640px"
        footer={
          <Button variant="secondary" onClick={() => setSelectedUser(null)}>
            Close Details
          </Button>
        }
      >
        {selectedUser && (
          <div className="details-modal-content">
            {/* Header info */}
            <div className="details-banner">
              <div className="details-banner-avatar">
                {(selectedUser.restuarant_name || "R").charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="details-banner-title">
                  {selectedUser.restuarant_name}
                </h4>
                <p className="details-banner-sub">
                  Owner: <strong>{selectedUser.name}</strong> • Role:{" "}
                  {selectedUser.role || "Client"}
                </p>
              </div>
            </div>

            {/* Grid properties */}
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Email Address</span>
                <span className="detail-val">{selectedUser.email}</span>
                {selectedUser.email_verified_at && (
                  <span className="verified-badge">
                    <Check size={11} /> Verified on{" "}
                    {formatDate(selectedUser.email_verified_at)}
                  </span>
                )}
              </div>

              <div className="detail-item">
                <span className="detail-label">Phone Number</span>
                <span className="detail-val">
                  {selectedUser.phone || "Not provided"}
                </span>
                {selectedUser.phone_verified_at && (
                  <span className="verified-badge">
                    <Check size={11} /> Verified on{" "}
                    {formatDate(selectedUser.phone_verified_at)}
                  </span>
                )}
              </div>

              <div className="detail-item">
                <span className="detail-label">
                  WhatsApp Business Account (WABA ID)
                </span>
                <code className="detail-code">
                  {selectedUser.waba_id || "Not linked"}
                </code>
              </div>

              <div className="detail-item">
                <span className="detail-label">Phone Number ID</span>
                <code className="detail-code">
                  {selectedUser.phone_number_id || "Not linked"}
                </code>
              </div>

              <div className="detail-item">
                <span className="detail-label">Total Messages Count</span>
                <span className="detail-val">
                  {(Number(selectedUser.msg_number) || 0).toLocaleString()}{" "}
                  messages
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Phone Status</span>
                <span
                  className={`status-pill ${
                    selectedUser.phone_status === "verified"
                      ? "status-active"
                      : "status-pending"
                  }`}
                >
                  <span className="status-dot"></span>
                  {selectedUser.phone_status || "Pending"}
                </span>
              </div>
            </div>

            {/* Mobile App Links */}
            {(selectedUser.android_link || selectedUser.ios_link) && (
              <div className="app-links-section">
                <span className="detail-label">Mobile App Installations</span>
                <div className="app-links-row">
                  {selectedUser.android_link && (
                    <a
                      href={selectedUser.android_link}
                      target="_blank"
                      rel="noreferrer"
                      className="app-link-btn"
                    >
                      <ExternalLink size={14} /> Android Store Link
                    </a>
                  )}
                  {selectedUser.ios_link && (
                    <a
                      href={selectedUser.ios_link}
                      target="_blank"
                      rel="noreferrer"
                      className="app-link-btn"
                    >
                      <ExternalLink size={14} /> Apple iOS App Store Link
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* AI Context Section */}
            <div className="ai-context-box">
              <div className="ai-context-header">
                <Bot size={16} className="ai-bot-icon" />
                <span className="ai-context-title">
                  Configured AI Context & Behavior
                </span>
              </div>
              <p className="ai-context-body">
                {selectedUser.ai_context ||
                  "No specialized AI prompt/context has been configured for this restaurant yet."}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default DashboardPage;

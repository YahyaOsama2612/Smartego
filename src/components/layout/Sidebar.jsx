import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Layers,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Percent,
  ReceiptText,
  ShoppingBag,
  Mail,
  ChartBar,
  MessageSquare,
  WalletCards,
} from "lucide-react";
import useAuth from "../../hooks/useAuth";

export function Sidebar({ isCollapsed, isMobileOpen = false, onToggle, onNavigate }) {
  const { user, logout } = useAuth();
  const isCompact = isCollapsed && !isMobileOpen;

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Admins", path: "/admins", icon: Layers },
    { label: "Users ", path: "/users", icon: Users },
    { label: "Discounts", path: "/discount", icon: Percent },
    { label: "Settings", path: "/settings", icon: Settings },
    { label: "Tax", path: "/tax", icon: ReceiptText },
    { label: "Packages", path: "/package", icon: Layers },
    { label: "Orders", path: "/orders", icon: ShoppingBag },
    { label: "Subscribes", path: "/subscribes", icon: Users },
    { label: "Contact Us", path: "/contact-us", icon: Mail },
    { label: "Revenue Report", path: "/reports/revenue", icon: ChartBar },
    { label: "Message Consumption", path: "/reports/messages", icon: MessageSquare },
    { label: "Subscribers Spending", path: "/reports/subscribers-spending", icon: WalletCards }
  ];

  return (
    <aside
      id="admin-navigation"
      className={`admin-sidebar ${isCollapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}
    >
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo-glow">
          <ShieldCheck size={26} className="brand-icon" />
        </div>
        {!isCompact && (
          <div className="brand-meta">
            <span className="brand-title">Smartego</span>
            <span className="brand-badge">ADMIN</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">
          {!isCompact ? "NAVIGATION" : "•••"}
        </div>
        <ul className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => {
                    if (isMobileOpen) onNavigate?.();
                  }}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "active" : ""}`
                  }
                  title={isCompact ? item.label : undefined}
                >
                  <Icon size={20} className="nav-icon" />
                  {!isCompact && (
                    <span className="nav-label">{item.label}</span>
                  )}
                  {!isCompact && item.badge && (
                    <span className="nav-pill-badge">{item.badge}</span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Session & Collapse Controls */}
      <div className="sidebar-footer">
        {!isCompact && (
          <div className="sidebar-user-card">
            <div className="user-avatar-circle">
              {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.name || "Administrator"}</span>
              <span className="user-role">
                {user?.email || "admin@smartego.com"}
              </span>
            </div>
            <button
              type="button"
              className="user-logout-btn"
              onClick={logout}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}

        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={onToggle}
          title={isMobileOpen ? "Close navigation menu" : isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isMobileOpen ? <ChevronLeft size={18} /> : isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!isCompact && (
            <span style={{ fontSize: "12px" }}>Collapse Menu</span>
          )}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;

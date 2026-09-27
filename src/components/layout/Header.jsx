import { useLocation } from "react-router-dom";
import { Search, Bell, LogOut, CheckCircle2 } from "lucide-react";
import useAuth from "../../hooks/useAuth";

export function Header() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const getPageTitle = (pathname) => {
    if (pathname.includes("/users")) return "Users  Management";
    if (pathname.includes("/settings")) return "System Settings";
    if (pathname.includes("/admins")) return "Admins Management";
    if (pathname.includes("/discount")) return "Discounts";
    if (pathname.includes("/tax")) return "Tax";
    if (pathname.includes("/package")) return "Packages";
    if (pathname.includes("/orders")) return "Orders";
    return "Dashboard Overview";
  };

  return (
    <header className="admin-header">
      <div className="header-left">
        <h1 className="header-page-title">{getPageTitle(location.pathname)}</h1>
      </div>

      <div className="header-right">
        <div className="header-search">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Quick search (Ctrl + K)..."
            className="search-input"
          />
        </div>

        {/*  <button type="button" className="header-icon-btn" title="Notifications">
          <Bell size={18} />
          <span className="notif-badge">2</span>
        </button> */}

        <div className="header-divider"></div>

        <div className="header-user-menu">
          <div className="header-avatar">
            {(user?.name || user?.email || "A").charAt(0).toUpperCase()}
          </div>
          <div className="header-user-info">
            <span className="header-user-name">
              {user?.name || "Administrator"}
            </span>
            <span className="header-user-email">
              {user?.email || "admin@smartego.com"}
            </span>
          </div>
          <button
            type="button"
            className="header-logout-btn"
            onClick={logout}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;

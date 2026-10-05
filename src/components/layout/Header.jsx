import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, LogOut, X } from "lucide-react";
import useAuth from "../../hooks/useAuth";

const SEARCH_PAGES = [
  { label: "Dashboard", path: "/dashboard", keywords: "overview home" },
  { label: "Users", path: "/users", keywords: "clients customers" },
  { label: "Admins", path: "/admins", keywords: "administrators" },
  { label: "Discounts", path: "/discount", keywords: "promotions coupons" },
  { label: "Settings", path: "/settings", keywords: "configuration paymob ai" },
  { label: "Tax", path: "/tax", keywords: "taxes" },
  { label: "Packages", path: "/package", keywords: "plans subscriptions" },
  { label: "Orders", path: "/orders", keywords: "purchases" },
  { label: "Subscribes", path: "/subscribes", keywords: "subscribers" },
  { label: "Contact Us", path: "/contact-us", keywords: "messages inquiries" },
];

export function Header({ onMenuToggle, isMobileMenuOpen = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [search, setSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return SEARCH_PAGES.filter((page) =>
      `${page.label} ${page.keywords}`.toLowerCase().includes(query),
    );
  }, [search]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchRef.current?.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const goToPage = (page) => {
    navigate(page.path);
    setSearch("");
    setIsSearchOpen(false);
    setActiveResult(0);
    inputRef.current?.blur();
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      setSearch("");
      setIsSearchOpen(false);
      return;
    }
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      goToPage(results[activeResult] || results[0]);
    }
  };

  const getPageTitle = (pathname) => {
    if (pathname.includes("/users")) return "Users  Management";
    if (pathname.includes("/settings")) return "System Settings";
    if (pathname.includes("/admins")) return "Admins Management";
    if (pathname.includes("/discount")) return "Discounts";
    if (pathname.includes("/tax")) return "Tax";
    if (pathname.includes("/package")) return "Packages";
    if (pathname.includes("/orders")) return "Orders";
    if (pathname.includes("/subscribes")) return "Subscribes";
    if (pathname.includes("/contact-us")) return "Contact Us";
    return "Dashboard Overview";
  };

  return (
    <header className="admin-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onMenuToggle}
          aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="admin-navigation"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <h1 className="header-page-title">{getPageTitle(location.pathname)}</h1>
      </div>

      <div className="header-right">
        <div className="header-search" ref={searchRef}>
          <Search size={16} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActiveResult(0);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            role="combobox"
            aria-label="Search admin pages"
            aria-autocomplete="list"
            aria-expanded={isSearchOpen && Boolean(search.trim())}
            aria-controls="header-search-results"
            aria-activedescendant={
              isSearchOpen && results[activeResult]
                ? `header-search-result-${activeResult}`
                : undefined
            }
            autoComplete="off"
            placeholder="Search pages (Ctrl + K)..."
            className="search-input"
          />
          {isSearchOpen && search.trim() && (
            <div
              id="header-search-results"
              className="header-search-results"
              role="listbox"
              aria-label="Matching pages"
            >
              {results.length ? (
                results.map((page, index) => (
                  <button
                    key={page.path}
                    id={`header-search-result-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeResult}
                    className={`header-search-result ${index === activeResult ? "active" : ""}`}
                    onMouseEnter={() => setActiveResult(index)}
                    onClick={() => goToPage(page)}
                  >
                    <span>{page.label}</span>
                    <span className="header-search-result-path">{page.path}</span>
                  </button>
                ))
              ) : (
                <p className="header-search-empty">No matching pages.</p>
              )}
            </div>
          )}
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

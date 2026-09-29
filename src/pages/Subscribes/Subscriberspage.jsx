import { useState, useMemo, useEffect } from "react";
import {
    Search,
    RefreshCw,
    Filter,
    Users as UsersIcon,
    Database,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
} from "lucide-react";
import useCrud from "../../hooks/useCrud";
import Button from "../../components/common/Button";
import "./Subscriberspage.css";

// GET only. Uses the same host as axiosClient so the admin bearer token is
// accepted (a different host returns 401, which logs the admin out).
// Note the API's spelling: "subscripers".
const SUBSCRIBERS_ENDPOINT = "https://bcknd.smartego.org/api/admin/subscripers";

// Helper: render an ISO timestamp / date string as a short readable date
const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

// Helper: show "—" for empty values but keep 0
const orDash = (value) =>
    value === undefined || value === null || value === "" ? "—" : value;

// Helper: pick the connected account for the subscriber's channel.
//  - WhatsApp  -> whats_item.phone
//  - Messenger -> messengerAccount.page_name
// Falls back to whichever one exists if the channel name is unexpected.
const getAccount = (sub) => {
    const channel = String(sub.channel || "").toLowerCase();
    const phone = sub.whats_item?.phone;
    const pageName = sub.messengerAccount?.page_name;

    if (channel.includes("what")) {
        return { label: "Phone", value: phone || "—" };
    }
    if (channel.includes("mess")) {
        return { label: "Page", value: pageName || "—" };
    }
    if (phone) return { label: "Phone", value: phone };
    if (pageName) return { label: "Page", value: pageName };
    return { label: "", value: "—" };
};

const getAccountLabel = (sub) => getAccount(sub).value;

// Helper: pick a tag style based on the channel name
const channelTagClass = (channel) => {
    const c = String(channel || "").toLowerCase();
    if (c.includes("what")) return "type-percentage";
    if (c.includes("mess")) return "type-fixed";
    return "type-neutral";
};

export function SubscribersPage() {
    // Read-only: we only use the list + refetch parts of useCrud
    const { items: subscribers, loading, refetch } = useCrud(
        SUBSCRIBERS_ENDPOINT,
        {
            initialData: [],
            defaultParams: {},
        },
    );

    const [searchTerm, setSearchTerm] = useState("");
    const [channelFilter, setChannelFilter] = useState("ALL");
    const [perPage, setPerPage] = useState(10);
    const [page, setPage] = useState(1);

    // The API returns the full list, so search / filter / paging are client-side
    const channelOptions = useMemo(() => {
        const set = new Set();
        subscribers.forEach((s) => s.channel && set.add(s.channel));
        return Array.from(set);
    }, [subscribers]);

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return subscribers.filter((sub) => {
            if (channelFilter !== "ALL" && sub.channel !== channelFilter) {
                return false;
            }
            if (!q) return true;
            return [
                sub.user_name,
                sub.user_phone,
                sub.package_name,
                getAccountLabel(sub),
            ]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q));
        });
    }, [subscribers, searchTerm, channelFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));

    // Reset to the first page whenever the filters change
    useEffect(() => {
        setPage(1);
    }, [searchTerm, channelFilter, perPage]);

    const currentPage = Math.min(page, totalPages);
    const visible = filtered.slice(
        (currentPage - 1) * perPage,
        currentPage * perPage,
    );

    return (
        <div className="subscribers-page-container">
            {/* Header Actions */}
            <div className="subscribers-page-header">
                <div className="page-header-actions">
                    <Button
                        variant="outline"
                        icon={RefreshCw}
                        onClick={refetch}
                        isLoading={loading}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="subscribers-toolbar">
                <div className="search-box">
                    <Search size={16} className="search-box-icon" />
                    <input
                        type="text"
                        placeholder="Search by name, phone, package..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-box-input"
                    />
                </div>

                <div className="toolbar-filters">
                    <div className="filter-group">
                        <Filter size={16} className="filter-icon" />
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="ALL">All Channels</option>
                            {channelOptions.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <Filter size={16} className="filter-icon" />
                        <select
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value))}
                            className="filter-select"
                        >
                            <option value={10}>10 / page</option>
                            <option value={20}>20 / page</option>
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Subscribers Table Card */}
            <div className="subscribers-table-card">
                <div className="table-responsive">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>Subscriber</th>
                                <th>Package</th>
                                <th>Channel</th>
                                <th>Account</th>
                                <th>Period</th>
                                <th>Total Msgs</th>
                                <th>Sent</th>
                                <th>Available</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && visible.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="empty-state">
                                        <Database size={32} className="empty-icon" />
                                        <p>No subscribers found matching your query.</p>
                                    </td>
                                </tr>
                            ) : (
                                visible.map((sub) => (
                                    <tr key={sub.id} className="table-row">
                                        <td>
                                            <div className="subscriber-cell">
                                                <div className="subscriber-cell-icon">
                                                    <UsersIcon size={16} />
                                                </div>
                                                <div className="subscriber-cell-text">
                                                    <span className="subscriber-cell-name">
                                                        {orDash(sub.user_name)}
                                                    </span>
                                                    <span className="subscriber-cell-phone">
                                                        {orDash(sub.user_phone)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="type-tag type-neutral">
                                                {orDash(sub.package_name)}
                                            </span>
                                        </td>
                                        <td>
                                            <span
                                                className={`type-tag ${channelTagClass(sub.channel)}`}
                                            >
                                                {orDash(sub.channel)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="account-cell">
                                                {getAccount(sub).label && (
                                                    <span className="account-cell-label">
                                                        {getAccount(sub).label}
                                                    </span>
                                                )}
                                                <span className="cell-amount">
                                                    {getAccount(sub).value}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="cell-date">
                                            <span className="period-cell">
                                                {formatDate(sub.from)}
                                                <ArrowRight size={12} />
                                                {formatDate(sub.to)}
                                            </span>
                                        </td>
                                        <td className="cell-amount">{orDash(sub.msgs)}</td>
                                        <td className="cell-amount">{orDash(sub.send_msgs)}</td>
                                        <td className="cell-amount">
                                            {orDash(sub.available_msgs)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Summary */}
                <div className="table-footer-bar">
                    <span>
                        Showing {visible.length} of {filtered.length} total entries
                    </span>

                    <div className="pagination-controls">
                        <button
                            type="button"
                            className="action-icon-btn"
                            disabled={loading || currentPage <= 1}
                            onClick={() => setPage(currentPage - 1)}
                            title="Previous page"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span>
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            type="button"
                            className="action-icon-btn"
                            disabled={loading || currentPage >= totalPages}
                            onClick={() => setPage(currentPage + 1)}
                            title="Next page"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SubscribersPage;
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Database,
    RefreshCw,
    Search,
    UserRound,
    Users as UsersIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import "./Subscriberspage.css";

const SUBSCRIBERS_ENDPOINT = "/admin/subscripers";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const displayValue = (value) => {
    if (value === undefined || value === null || value === "") return "—";
    if (typeof value === "string" || typeof value === "number") return String(value);
    return "—";
};

const getSubscriberList = (responseData) => {
    if (responseData?.status === false) {
        throw new Error(responseData.message || "The server couldn't load subscribers.");
    }

    const payload = responseData?.data ?? responseData;
    if (Array.isArray(payload)) {
        return { subscribers: payload, pagination: responseData?.pagination ?? {} };
    }
    if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
        return { subscribers: payload.data, pagination: responseData?.pagination ?? payload };
    }

    throw new Error("The server returned an unexpected subscriber list response.");
};

const getErrorMessage = (error) => {
    const responseData = error.response?.data;
    if (typeof responseData?.message === "string") return responseData.message;
    if (typeof responseData?.error === "string") return responseData.error;
    if (typeof error.message === "string") return error.message;
    return "Couldn't load subscribers.";
};

export function SubscribersPage() {
    const navigate = useNavigate();
    const [subscribers, setSubscribers] = useState([]);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        lastPage: 1,
        total: 0,
        from: null,
        to: null,
        hasPrevious: false,
        hasNext: false,
    });
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const loadSubscribers = useCallback(async (signal) => {
        if (signal.aborted) return;
        setLoading(true);
        setError("");

        try {
            const response = await axiosClient.get(SUBSCRIBERS_ENDPOINT, {
                params: { page, per_page: perPage },
                signal,
            });
            const { subscribers: records, pagination: meta } = getSubscriberList(response.data);
            const currentPage = Math.max(1, Number(meta.current_page) || page);
            const lastPage = Math.max(1, Number(meta.last_page) || 1);

            setSubscribers(records);
            setPagination({
                currentPage,
                lastPage,
                total: Number(meta.total) || records.length,
                from: meta.from ?? null,
                to: meta.to ?? null,
                hasPrevious: Boolean(meta.prev_page_url) || currentPage > 1,
                hasNext: Boolean(meta.next_page_url) || currentPage < lastPage,
            });
        } catch (requestError) {
            if (!signal.aborted) setError(getErrorMessage(requestError));
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [page, perPage]);

    useEffect(() => {
        const controller = new AbortController();
        void Promise.resolve().then(() => loadSubscribers(controller.signal));
        return () => controller.abort();
    }, [loadSubscribers, refreshKey]);

    const visibleSubscribers = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return subscribers;
        return subscribers.filter((subscriber) =>
            [subscriber.name, subscriber.email, subscriber.phone]
                .some((value) => String(value ?? "").toLowerCase().includes(query)),
        );
    }, [subscribers, searchTerm]);

    const refresh = () => setRefreshKey((key) => key + 1);
    const changePageSize = (event) => {
        setPerPage(Number(event.target.value));
        setPage(1);
    };
    const goToPage = (nextPage) => {
        if (nextPage < 1 || nextPage > pagination.lastPage) return;
        setPage(nextPage);
    };

    return (
        <div className="subscribers-page-container">
            <div className="subscribers-page-header">
                <div>
                    <h1 className="subscribers-page-title">Subscribers</h1>
                    <p className="subscribers-page-description">
                        Select a subscriber to view their subscription details.
                    </p>
                </div>
                <div className="page-header-actions">
                    <Button
                        variant="outline"
                        icon={RefreshCw}
                        onClick={refresh}
                        isLoading={loading}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="subscribers-toolbar">
                <div className="search-box">
                    <Search size={16} className="search-box-icon" />
                    <input
                        type="search"
                        aria-label="Search subscribers on this page"
                        placeholder="Search this page by name, email, or phone..."
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        className="search-box-input"
                    />
                </div>
                <div className="toolbar-filters">
                    <select
                        aria-label="Subscribers per page"
                        value={perPage}
                        onChange={changePageSize}
                        className="filter-select"
                    >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>{size} / page</option>
                        ))}
                    </select>
                </div>
            </div>

            {error && (
                <div className="subscribers-error" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <Button variant="outline" onClick={refresh}>Try again</Button>
                </div>
            )}

            <div className="subscribers-table-card">
                <div className="table-responsive">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>Subscriber</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Available Messages</th>
                                <th aria-label="Details" />
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && visibleSubscribers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-state">
                                        <Database size={32} className="empty-icon" />
                                        <p>{error ? "Subscribers couldn't be loaded." : "No subscribers found."}</p>
                                    </td>
                                </tr>
                            ) : (
                                visibleSubscribers.map((subscriber) => (
                                    <tr
                                        key={subscriber.id}
                                        className="table-row subscriber-clickable-row"
                                        tabIndex={0}
                                        onClick={() => navigate(`/subscribes/${subscriber.id}`)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                navigate(`/subscribes/${subscriber.id}`);
                                            }
                                        }}
                                    >
                                        <td>
                                            <div className="subscriber-cell">
                                                <div className="subscriber-cell-icon">
                                                    <UsersIcon size={16} />
                                                </div>
                                                <div className="subscriber-cell-text">
                                                    <span className="subscriber-cell-name">
                                                        {displayValue(subscriber.name)}
                                                    </span>

                                                </div>
                                            </div>
                                        </td>
                                        <td>{displayValue(subscriber.email)}</td>
                                        <td>{displayValue(subscriber.phone)}</td>
                                        <td className="cell-amount">
                                            {displayValue(subscriber.available_msgs)}
                                        </td>
                                        <td>
                                            <span className="subscriber-details-hint">
                                                <UserRound size={15} />
                                                View details
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {loading && (
                                <tr>
                                    <td colSpan="5" className="empty-state">Loading subscribers...</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="table-footer-bar">
                    <span>
                        Showing {pagination.from ?? 0}–{pagination.to ?? 0} of {pagination.total} subscribers
                        {searchTerm.trim() ? ` · ${visibleSubscribers.length} on this page match` : ""}
                    </span>
                    <div className="pagination-controls">
                        <button
                            type="button"
                            className="action-icon-btn"
                            disabled={loading || !pagination.hasPrevious}
                            onClick={() => goToPage(pagination.currentPage - 1)}
                            aria-label="Previous page"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span>Page {pagination.currentPage} of {pagination.lastPage}</span>
                        <button
                            type="button"
                            className="action-icon-btn"
                            disabled={loading || !pagination.hasNext}
                            onClick={() => goToPage(pagination.currentPage + 1)}
                            aria-label="Next page"
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

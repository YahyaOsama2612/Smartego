import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Database,
    RefreshCw,
    Users,
    Wallet,
} from "lucide-react";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import "./SubscribersSpendingReportPage.css";

const REPORT_ENDPOINT = "/admin/reports/subscribers";
const INITIAL_FILTERS = {
    from: "",
    channel: "",
    paginate: "true",
    paid_only: false,
};
const CHANNELS = [
    { value: "whatsapp", label: "WhatsApp" },
    { value: "messenger", label: "Messenger" },
    { value: "instagram", label: "Instagram" },
];

const getErrorMessage = (error) => {
    const responseData = error.response?.data;
    if (typeof responseData?.message === "string") return responseData.message;
    if (typeof responseData?.error === "string") return responseData.error;
    if (typeof error.message === "string") return error.message;
    return "Couldn't load the subscribers spending report.";
};

const getReportData = (responseData) => {
    if (responseData?.status === false) {
        throw new Error(responseData.message || "The server couldn't load the subscribers spending report.");
    }

    const report = responseData?.data ?? responseData;
    if (Array.isArray(report)) {
        return {
            data: report,
            current_page: 1,
            last_page: 1,
            from: report.length ? 1 : 0,
            to: report.length,
            total: report.length,
        };
    }
    if (!report || typeof report !== "object" || Array.isArray(report)) {
        throw new Error("The server returned an unexpected subscribers spending report response.");
    }

    if (!Array.isArray(report.data)) {
        throw new Error("The server returned an unexpected subscribers list in the report.");
    }
    return report;
};

const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const formatNumber = (value) => toNumber(value).toLocaleString();

const formatLabel = (value) =>
    String(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatCellValue = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(formatCellValue).join(", ");
    if (typeof value === "object") {
        const localizedValue = value.en ?? value.ar;
        if (localizedValue !== undefined) return formatCellValue(localizedValue);
        return Object.entries(value)
            .map(([key, item]) => `${formatLabel(key)}: ${formatCellValue(item)}`)
            .join(", ");
    }
    return "—";
};

export function SubscribersSpendingReportPage() {
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
    const [page, setPage] = useState(1);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const loadReport = useCallback(async (signal) => {
        if (signal.aborted) return;
        setLoading(true);
        setError("");

        const params = {
            paginate: appliedFilters.paginate === "true" ? "1" : "0",
            paid_only: appliedFilters.paid_only ? "1" : "0",
        };
        if (appliedFilters.channel) params.channel = appliedFilters.channel;
        if (appliedFilters.from) params.from = appliedFilters.from;
        if (params.paginate) params.page = page;

        try {
            const response = await axiosClient.get(REPORT_ENDPOINT, { params, signal });
            setReport(getReportData(response.data));
        } catch (requestError) {
            if (!signal.aborted) setError(getErrorMessage(requestError));
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [appliedFilters, page]);

    useEffect(() => {
        const controller = new AbortController();
        void Promise.resolve().then(() => loadReport(controller.signal));
        return () => controller.abort();
    }, [loadReport, refreshKey]);

    const updateFilter = (event) => {
        const { name, value, checked, type } = event.target;
        setFilters((current) => ({
            ...current,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        setReport(null);
        setPage(1);
        setAppliedFilters({ ...filters });
    };

    const records = report?.data ?? [];
    const columns = useMemo(
        () => [...new Set((report?.data ?? []).flatMap((record) => Object.keys(record)))],
        [report],
    );
    const currentPage = Math.max(1, toNumber(report?.current_page) || page);
    const lastPage = Math.max(1, toNumber(report?.last_page) || 1);
    const total = Math.max(0, toNumber(report?.total));
    const start = report?.from ?? (records.length ? (currentPage - 1) * toNumber(report?.per_page) + 1 : 0);
    const end = report?.to ?? (records.length ? start + records.length - 1 : 0);
    const paginationEnabled = appliedFilters.paginate === "true";

    return (
        <main className="subscribers-spending-page">
            <header className="subscribers-spending-header">
                <div>
                    <span className="subscribers-spending-eyebrow">ANALYTICS</span>
                    <h1>Subscribers Spending Report</h1>
                    <p>Review subscriber spending by channel and payment status.</p>
                </div>
                <Button
                    variant="outline"
                    icon={RefreshCw}
                    isLoading={loading}
                    onClick={() => setRefreshKey((key) => key + 1)}
                >
                    Refresh report
                </Button>
            </header>

            <form className="subscribers-spending-filter-card" onSubmit={applyFilters}>
                <div className="subscribers-spending-filter-title">
                    <CalendarDays size={18} />
                    <div>
                        <h2>Report filters</h2>
                        <p>All filters are optional.</p>
                    </div>
                </div>
                <div className="subscribers-spending-filter-fields">
                    <label>
                        <span>From</span>
                        <input
                            type="date"
                            name="from"
                            value={filters.from}
                            onChange={updateFilter}
                            aria-label="Start date"
                        />
                    </label>
                    <label>
                        <span>Channel</span>
                        <select name="channel" value={filters.channel} onChange={updateFilter}>
                            <option value="">Not Set (all channels)</option>
                            {CHANNELS.map((channel) => (
                                <option value={channel.value} key={channel.value}>{channel.label}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Pagination</span>
                        <select name="paginate" value={filters.paginate} onChange={updateFilter}>
                            <option value="true">Paginated</option>
                            <option value="false">All records</option>
                        </select>
                    </label>
                    <label className="subscribers-spending-checkbox">
                        <input
                            type="checkbox"
                            name="paid_only"
                            checked={filters.paid_only}
                            onChange={updateFilter}
                        />
                        <span>Paid subscriptions only</span>
                    </label>
                    <Button type="submit" isLoading={loading}>Apply filters</Button>
                </div>
            </form>

            {error && (
                <div className="subscribers-spending-error" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <Button variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
                        Try again
                    </Button>
                </div>
            )}

            <section className="subscribers-spending-summary" aria-label="Subscriber spending summary">
                <article className="subscribers-spending-summary-card">
                    <div className="subscribers-spending-summary-icon"><Users size={20} /></div>
                    <span>Matching subscribers</span>
                    <strong>{report ? formatNumber(total) : "—"}</strong>
                    <small>{filters.paid_only ? "Paid subscriptions only" : "Subscribers in this report"}</small>
                </article>
                <article className="subscribers-spending-summary-card subscribers-spending-summary-context">
                    <div className="subscribers-spending-summary-icon subscribers-spending-icon-spending">
                        <Wallet size={20} />
                    </div>
                    <span>Applied channel</span>
                    <strong>
                        {CHANNELS.find((channel) => channel.value === appliedFilters.channel)?.label || "All channels"}
                    </strong>
                    <small>
                        {appliedFilters.from ? `From ${appliedFilters.from}` : "Any date"}
                    </small>
                </article>
            </section>

            <section className="subscribers-spending-table-card" aria-label="Subscriber spending records">
                <div className="subscribers-spending-table-heading">
                    <div>
                        <h2>Subscriber spending details</h2>
                        <p>
                            {report
                                ? `Showing ${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(total)} subscribers`
                                : "Subscriber records matching the selected filters"}
                        </p>
                    </div>
                </div>
                <div className="subscribers-spending-table-scroll">
                    <table>
                        {columns.length > 0 && (
                            <thead>
                                <tr>
                                    {columns.map((column) => <th key={column}>{formatLabel(column)}</th>)}
                                </tr>
                            </thead>
                        )}
                        <tbody>
                            {loading && (
                                <tr>
                                    <td className="subscribers-spending-empty" colSpan={Math.max(columns.length, 1)}>
                                        Loading spending records…
                                    </td>
                                </tr>
                            )}
                            {!loading && records.length === 0 && (
                                <tr>
                                    <td className="subscribers-spending-empty" colSpan={Math.max(columns.length, 1)}>
                                        <Database size={28} />
                                        <span>{error ? "Spending records couldn't be loaded." : "No spending records found."}</span>
                                    </td>
                                </tr>
                            )}
                            {!loading && records.map((record, index) => (
                                <tr key={record.id ?? `${currentPage}-${index}`}>
                                    {columns.map((column) => (
                                        <td key={column}>{formatCellValue(record[column])}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {paginationEnabled && report && (
                    <footer className="subscribers-spending-pagination">
                        <span>
                            Page {currentPage} of {lastPage} · {formatNumber(total)} total
                        </span>
                        <div>
                            <button
                                type="button"
                                aria-label="Previous page"
                                disabled={loading || currentPage <= 1}
                                onClick={() => setPage((current) => Math.max(1, current - 1))}
                            >
                                <ChevronLeft size={17} />
                            </button>
                            <button
                                type="button"
                                aria-label="Next page"
                                disabled={loading || currentPage >= lastPage}
                                onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                            >
                                <ChevronRight size={17} />
                            </button>
                        </div>
                    </footer>
                )}
            </section>
        </main>
    );
}

export default SubscribersSpendingReportPage;

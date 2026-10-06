import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    BarChart3,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Package,
    RefreshCw,
    ShoppingCart,
    Wallet,
} from "lucide-react";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import "./RevenueReportPage.css";

const REPORT_ENDPOINT = "/admin/reports/orders";
const INITIAL_FILTERS = { from: "", to: "", status: "all" };
const CHANNEL_LABELS = {
    whatsapp: "WhatsApp",
    messenger: "Messenger",
    instagram: "Instagram",
};
const CHANNEL_COLORS = {
    whatsapp: "revenue-bar-whatsapp",
    messenger: "revenue-bar-messenger",
    instagram: "revenue-bar-instagram",
};

const getErrorMessage = (error) => {
    const responseData = error.response?.data;
    if (typeof responseData?.message === "string") return responseData.message;
    if (typeof responseData?.error === "string") return responseData.error;
    if (typeof error.message === "string") return error.message;
    return "Couldn't load the revenue report.";
};

const getReportData = (responseData) => {
    if (responseData?.status === false) {
        throw new Error(responseData.message || "The server couldn't load the revenue report.");
    }

    const report = responseData?.data ?? responseData;
    if (!report || typeof report !== "object" || Array.isArray(report)) {
        throw new Error("The server returned an unexpected revenue report response.");
    }
    return report;
};

const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const formatNumber = (value) =>
    toNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

const formatCurrency = (value) => `${formatNumber(value)} EGP`;

const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
};

const getPackageLabel = (item) =>
    item.package_name ||
    item.package_name_raw?.en ||
    item.package_name_raw?.ar ||
    `Package ${item.package_id ?? ""}`.trim();

function RevenueBarChart({ title, subtitle, icon: Icon, items, valueKey, getLabel, colorForItem }) {
    const maximum = Math.max(...items.map((item) => toNumber(item[valueKey])), 0);

    return (
        <section className="revenue-chart-card">
            <div className="revenue-chart-heading">
                <span className="revenue-chart-icon"><Icon size={18} /></span>
                <div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
            </div>
            {items.length === 0 ? (
                <p className="revenue-chart-empty">No revenue data for this selection.</p>
            ) : (
                <div className="revenue-bars">
                    {items.map((item, index) => {
                        const amount = toNumber(item[valueKey]);
                        const width = maximum > 0 ? (amount / maximum) * 100 : 0;
                        return (
                            <div className="revenue-bar-row" key={`${getLabel(item)}-${index}`}>
                                <div className="revenue-bar-label">
                                    <span title={getLabel(item)}>{getLabel(item)}</span>
                                    <strong>{formatCurrency(amount)}</strong>
                                </div>
                                <div
                                    className="revenue-bar-track"
                                    role="img"
                                    aria-label={`${getLabel(item)}: ${formatCurrency(amount)}`}
                                >
                                    <span
                                        className={`revenue-bar-fill ${colorForItem(item, index)}`}
                                        style={{ width: `${width}%` }}
                                    />
                                </div>
                                {item.orders_count !== undefined && (
                                    <span className="revenue-bar-caption">
                                        {formatNumber(item.orders_count)} orders
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

export function RevenueReportPage() {
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState(INITIAL_FILTERS);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const loadReport = useCallback(async (signal) => {
        if (signal.aborted) return;
        setLoading(true);
        setError("");

        const params = { status: appliedFilters.status };
        if (appliedFilters.from) params.from = appliedFilters.from;
        if (appliedFilters.to) params.to = appliedFilters.to;

        try {
            const response = await axiosClient.get(REPORT_ENDPOINT, { params, signal });
            setReport(getReportData(response.data));
        } catch (requestError) {
            if (!signal.aborted) setError(getErrorMessage(requestError));
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [appliedFilters]);

    useEffect(() => {
        const controller = new AbortController();
        void Promise.resolve().then(() => loadReport(controller.signal));
        return () => controller.abort();
    }, [loadReport, refreshKey]);

    const updateFilter = (event) => {
        const { name, value } = event.target;
        setFilters((current) => ({ ...current, [name]: value }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        if (filters.from && filters.to && filters.from > filters.to) {
            setError("The start date must be on or before the end date.");
            return;
        }
        setReport(null);
        setAppliedFilters({ ...filters });
    };

    const channels = Object.entries(report?.channels || {}).map(([key, value]) => ({
        name: key,
        revenue: toNumber(value),
    }));
    const packages = Array.isArray(report?.packages) ? report.packages : [];
    const averageOrder = toNumber(report?.total_orders) > 0
        ? toNumber(report?.total_final_price) / toNumber(report?.total_orders)
        : 0;

    return (
        <main className="revenue-report-page">
            <header className="revenue-report-header">
                <div>
                    <span className="revenue-report-eyebrow">ANALYTICS</span>
                    <h1>Revenue Report</h1>
                    <p>Review order revenue by channel and package.</p>
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

            <form className="revenue-filter-card" onSubmit={applyFilters}>
                <div className="revenue-filter-title">
                    <CalendarDays size={18} />
                    <div>
                        <h2>Report filters</h2>
                        <p>Date and order status filters are optional.</p>
                    </div>
                </div>
                <div className="revenue-filter-fields">
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
                        <span>To</span>
                        <input
                            type="date"
                            name="to"
                            value={filters.to}
                            onChange={updateFilter}
                            aria-label="End date"
                        />
                    </label>
                    <label>
                        <span>Order status</span>
                        <select name="status" value={filters.status} onChange={updateFilter}>
                            <option value="all">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </label>
                    <Button type="submit" isLoading={loading}>Apply filters</Button>
                </div>
            </form>

            {error && (
                <div className="revenue-report-error" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <Button
                        variant="outline"
                        onClick={() => setRefreshKey((key) => key + 1)}
                    >
                        Try again
                    </Button>
                </div>
            )}

            <section className="revenue-summary-grid" aria-label="Revenue summary">
                <article className="revenue-summary-card revenue-summary-primary">
                    <div className="revenue-summary-icon"><Wallet size={20} /></div>
                    <span>Total revenue</span>
                    <strong>{loading && !report ? "—" : formatCurrency(report?.total_final_price)}</strong>
                    <small>Final order value</small>
                </article>
                <article className="revenue-summary-card">
                    <div className="revenue-summary-icon revenue-icon-orders"><ShoppingCart size={20} /></div>
                    <span>Total orders</span>
                    <strong>{loading && !report ? "—" : formatNumber(report?.total_orders)}</strong>
                    <small>Orders matching the filters</small>
                </article>
                <article className="revenue-summary-card">
                    <div className="revenue-summary-icon revenue-icon-average"><BarChart3 size={20} /></div>
                    <span>Average order value</span>
                    <strong>{loading && !report ? "—" : formatCurrency(averageOrder)}</strong>
                    <small>Revenue divided by orders</small>
                </article>
                <article className="revenue-summary-card">
                    <div className="revenue-summary-icon revenue-icon-status">
                        {appliedFilters.status === "approved" ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}
                    </div>
                    <span>Report status</span>
                    <strong className="revenue-status-value">
                        {report?.status_filter || appliedFilters.status}
                    </strong>
                    <small>
                        {report?.period?.from || report?.period?.to
                            ? `${formatDate(report.period.from) || "Any date"} – ${formatDate(report.period.to) || "Any date"}`
                            : "All-time period"}
                    </small>
                </article>
            </section>

            {loading && report && <p className="revenue-report-loading">Updating report…</p>}

            <section className="revenue-charts-grid" aria-label="Revenue breakdown charts">
                <RevenueBarChart
                    title="Revenue by channel"
                    subtitle="Compare final order value across channels"
                    icon={BarChart3}
                    items={channels}
                    valueKey="revenue"
                    getLabel={(item) => CHANNEL_LABELS[item.name] || item.name}
                    colorForItem={(item) => CHANNEL_COLORS[item.name] || "revenue-bar-default"}
                />
                <RevenueBarChart
                    title="Revenue by package"
                    subtitle="Package revenue with order counts"
                    icon={Package}
                    items={packages}
                    valueKey="total_final_price"
                    getLabel={getPackageLabel}
                    colorForItem={(_, index) => `revenue-bar-package-${index % 4}`}
                />
            </section>
        </main>
    );
}

export default RevenueReportPage;

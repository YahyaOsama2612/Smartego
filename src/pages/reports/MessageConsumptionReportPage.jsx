import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    CalendarDays,
    MessageSquare,
    RefreshCw,
} from "lucide-react";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import "./MessageConsumptionReportPage.css";

const REPORT_ENDPOINT = "https://bcknd.smartego.org/api/admin/reports/messages";
const INITIAL_FILTERS = { from: "", to: "", channel: "" };
const CHANNELS = [
    { key: "whatsapp", label: "WhatsApp", color: "message-channel-whatsapp" },
    { key: "messenger", label: "Messenger", color: "message-channel-messenger" },
    { key: "instagram", label: "Instagram", color: "message-channel-instagram" },
];

const getErrorMessage = (error) => {
    const responseData = error.response?.data;
    if (typeof responseData?.message === "string") return responseData.message;
    if (typeof responseData?.error === "string") return responseData.error;
    if (typeof error.message === "string") return error.message;
    return "Couldn't load the message consumption report.";
};

const getReportData = (responseData) => {
    if (responseData?.status === false) {
        throw new Error(responseData.message || "The server couldn't load the message consumption report.");
    }

    const report = responseData?.data ?? responseData;
    if (!report || typeof report !== "object" || Array.isArray(report)) {
        throw new Error("The server returned an unexpected message consumption report response.");
    }
    return report;
};

const toCount = (value) => {
    const count = Number(value);
    return Number.isFinite(count) ? count : 0;
};

const formatCount = (value) => toCount(value).toLocaleString();

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

export function MessageConsumptionReportPage() {
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

        const params = {};
        if (appliedFilters.channel) params.channel = appliedFilters.channel;
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

    const channelCounts = CHANNELS.map((channel) => ({
        ...channel,
        count: toCount(report?.channels?.[channel.key]),
    }));
    const maximumCount = Math.max(...channelCounts.map((channel) => channel.count), 0);
    const period = report?.period || {};

    return (
        <main className="message-report-page">
            <header className="message-report-header">
                <div>
                    <span className="message-report-eyebrow">ANALYTICS</span>
                    <h1>Message Consumption Report</h1>
                    <p>Track messages consumed across your connected channels.</p>
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

            <form className="message-filter-card" onSubmit={applyFilters}>
                <div className="message-filter-title">
                    <CalendarDays size={18} />
                    <div>
                        <h2>Report filters</h2>
                        <p>Channel and date filters are optional.</p>
                    </div>
                </div>
                <div className="message-filter-fields">
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
                        <span>Channel</span>
                        <select name="channel" value={filters.channel} onChange={updateFilter}>
                            <option value="">Not Set (all channels)</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="messenger">Messenger</option>
                            <option value="instagram">Instagram</option>
                        </select>
                    </label>
                    <Button type="submit" isLoading={loading}>Apply filters</Button>
                </div>
            </form>

            {error && (
                <div className="message-report-error" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <Button variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
                        Try again
                    </Button>
                </div>
            )}

            <section className="message-summary-grid" aria-label="Message consumption summary">
                <article className="message-summary-card message-summary-total">
                    <div className="message-summary-icon"><MessageSquare size={20} /></div>
                    <span>Total messages</span>
                    <strong>{report ? formatCount(report.total_messages) : "—"}</strong>
                    <small>Messages matching the filters</small>
                </article>
                {CHANNELS.map((channel) => (
                    <article className="message-summary-card" key={channel.key}>
                        <div className={`message-summary-icon ${channel.color}`}>
                            <MessageSquare size={20} />
                        </div>
                        <span>{channel.label}</span>
                        <strong>
                            {report ? formatCount(report.channels?.[channel.key]) : "—"}
                        </strong>
                        <small>Messages from {channel.label}</small>
                    </article>
                ))}
            </section>

            {loading && report && <p className="message-report-loading">Updating report…</p>}

            <section className="message-breakdown-card" aria-label="Message consumption by channel">
                <div className="message-breakdown-heading">
                    <span className="message-breakdown-heading-icon"><MessageSquare size={18} /></span>
                    <div>
                        <h2>Messages by channel</h2>
                        <p>Compare message volume across channels.</p>
                    </div>
                </div>
                <div className="message-bars">
                    {report ? channelCounts.map((channel) => {
                        const width = maximumCount > 0 ? (channel.count / maximumCount) * 100 : 0;
                        return (
                            <div className="message-bar-row" key={channel.key}>
                                <div className="message-bar-label">
                                    <span>{channel.label}</span>
                                    <strong>{formatCount(channel.count)}</strong>
                                </div>
                                <div
                                    className="message-bar-track"
                                    role="img"
                                    aria-label={`${channel.label}: ${formatCount(channel.count)} messages`}
                                >
                                    <span
                                        className={`message-bar-fill ${channel.color}`}
                                        style={{ width: `${width}%` }}
                                    />
                                </div>
                            </div>
                        );
                    }) : (
                        <p className="message-report-empty">
                            {loading ? "Loading message data…" : "Message data is unavailable."}
                        </p>
                    )}
                </div>
                <div className="message-report-period">
                    <span>Reporting period</span>
                    <strong>
                        {period.from || period.to
                            ? `${formatDate(period.from) || "Any date"} – ${formatDate(period.to) || "Any date"}`
                            : "All time"}
                    </strong>
                    <span>Channel filter</span>
                    <strong>
                        {report?.channel_filter && report.channel_filter !== "null"
                            ? report.channel_filter
                            : "Not Set"}
                    </strong>
                </div>
            </section>
        </main>
    );
}

export default MessageConsumptionReportPage;

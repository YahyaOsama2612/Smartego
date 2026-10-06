import { useCallback, useEffect, useState } from "react";
import {
    AlertTriangle,
    ArrowLeft,
    Camera,
    MessageCircle,
    MessageSquare,
    RefreshCw,
    UserRound,
    Wallet,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import "./Subscriberspage.css";

const SUBSCRIBER_ENDPOINT = "/admin/subscriper";

const displayValue = (value) => {
    if (value === undefined || value === null || value === "") return "—";
    if (typeof value === "string" || typeof value === "number") return String(value);
    return "—";
};

const formatSubscriptionState = (value) => {
    if (value === true || value === 1 || value === "1") return "Subscribed";
    if (value === false || value === 0 || value === "0") return "Not subscribed";
    return displayValue(value);
};

const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return displayValue(value);
    return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
};

const formatPrice = (value) =>
    value === undefined || value === null || value === "" ? "—" : `${value} EGP`;

const localizedName = (value) => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") return value.en || value.ar || "—";
    return "—";
};

const getErrorMessage = (error) => {
    const responseData = error.response?.data;
    if (typeof responseData?.message === "string") return responseData.message;
    if (typeof responseData?.error === "string") return responseData.error;
    if (typeof error.message === "string") return error.message;
    return "Couldn't load subscriber details.";
};

const getSubscriberDetails = (responseData) => {
    if (responseData?.status === false) {
        throw new Error(responseData.message || "The server couldn't load subscriber details.");
    }
    const subscriber = responseData?.data ?? responseData;
    if (!subscriber || typeof subscriber !== "object" || Array.isArray(subscriber)) {
        throw new Error("The server returned an unexpected subscriber response.");
    }
    return subscriber;
};

function AccountSection({ title, icon: Icon, items, kind }) {
    const isWhatsAppSection = kind === "subscriber-icon-whatsapp";

    return (
        <section className="subscriber-detail-card">
            <div className="subscriber-section-heading">
                <span className={`subscriber-section-icon ${kind}`}>
                    <Icon size={18} />
                </span>
                <div>
                    <h2>{title}</h2>
                    <span>{items.length} {items.length === 1 ? "account" : "accounts"}</span>
                </div>
            </div>

            {items.length === 0 ? (
                <p className="subscriber-account-empty">No connected accounts.</p>
            ) : (
                <div className="subscriber-account-list">
                    {items.map((account) => (
                        <article className="subscriber-account" key={account.id}>
                            <div className="subscriber-account-main">
                                <strong>{displayValue(account.name)}</strong>
                                {isWhatsAppSection && account.phone && (
                                    <span>Phone: {account.phone}</span>
                                )}
                                {account.page_name && account.page_name !== account.name && (
                                    <span>{account.page_name}</span>
                                )}
                                {account.username && <span>@{account.username}</span>}
                                {account.page_id && (
                                    <span className="subscriber-account-id">Page Name: {account.page_name}</span>
                                )}
                            </div>
                            {isWhatsAppSection ? (
                                <div className="subscriber-whatsapp-details">
                                    <div className="subscriber-account-meta">
                                        <span className={`subscriber-status ${account.status === "active" ? "is-active" : ""}`}>
                                            {displayValue(account.status)}
                                        </span>
                                        <span>Phone status: {displayValue(account.phone_status)}</span>
                                        <span>
                                            Subscription:{" "}
                                            {formatSubscriptionState(
                                                account.is_subscribed
                                                    ?? account.is_subscripe
                                                    ?? account.subscribed,
                                            )}
                                        </span>
                                    </div>
                                    <div className="subscriber-whatsapp-stats">
                                        <span>Available messages: {displayValue(account.available_msgs)}</span>
                                        <span>Remaining messages: {displayValue(account.remaining_msgs)}</span>
                                        <span>Message number: {displayValue(account.msg_number)}</span>
                                        <span>
                                            Period: {formatDate(account.from)} – {formatDate(account.to)}
                                        </span>
                                        <span>
                                            Start: {formatDate(account.start_date)} · End: {formatDate(account.end_date)}
                                        </span>
                                        <span>Renewal: {formatDate(account.renewal_date)}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="subscriber-account-meta">
                                    <span className={`subscriber-status ${account.status === "active" ? "is-active" : ""}`}>
                                        {displayValue(account.status)}
                                    </span>
                                    <span>{displayValue(account.available_msgs)} messages</span>
                                    <span>Renewal: {formatDate(account.renewal_date)}</span>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}

export function SubscriberDetailsPage() {
    const { subscriberId } = useParams();
    const navigate = useNavigate();
    const [subscriber, setSubscriber] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    const loadSubscriber = useCallback(async (signal) => {
        if (signal.aborted) return;
        setLoading(true);
        setError("");
        try {
            const response = await axiosClient.get(SUBSCRIBER_ENDPOINT, {
                params: { id: subscriberId },
                signal,
            });
            setSubscriber(getSubscriberDetails(response.data));
        } catch (requestError) {
            if (!signal.aborted) setError(getErrorMessage(requestError));
        } finally {
            if (!signal.aborted) setLoading(false);
        }
    }, [subscriberId]);

    useEffect(() => {
        const controller = new AbortController();
        void Promise.resolve().then(() => loadSubscriber(controller.signal));
        return () => controller.abort();
    }, [loadSubscriber, refreshKey]);

    const refresh = () => setRefreshKey((key) => key + 1);
    const nextOrder = subscriber?.next_order;

    return (
        <div className="subscribers-page-container">
            <div className="subscribers-page-header">
                <div>
                    <Button
                        variant="outline"
                        icon={ArrowLeft}
                        onClick={() => navigate("/subscribes")}
                    >
                        Back to subscribers
                    </Button>
                    <h1 className="subscribers-page-title subscriber-detail-title">
                        {subscriber ? displayValue(subscriber.name) : "Subscriber details"}
                    </h1>
                    {subscriber && (
                        <p className="subscribers-page-description">
                            Subscriber #{displayValue(subscriber.id)}
                        </p>
                    )}
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

            {error && (
                <div className="subscribers-error" role="alert">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <Button variant="outline" onClick={refresh}>Try again</Button>
                </div>
            )}

            {loading && !subscriber && (
                <div className="subscriber-detail-card subscriber-detail-loading">Loading subscriber details...</div>
            )}

            {!loading && !error && subscriber && (
                <>
                    <section className="subscriber-detail-card">
                        <div className="subscriber-section-heading">
                            <span className="subscriber-section-icon subscriber-icon-profile">
                                <UserRound size={18} />
                            </span>
                            <div>
                                <h2>Subscriber profile</h2>
                                <span>Contact and subscription summary</span>
                            </div>
                        </div>
                        <div className="subscriber-profile-grid">
                            <div><span>Name</span><strong>{displayValue(subscriber.name)}</strong></div>
                            <div><span>Email</span><strong>{displayValue(subscriber.email)}</strong></div>
                            <div><span>Phone</span><strong>{displayValue(subscriber.phone)}</strong></div>
                            <div><span>Available messages</span><strong>{displayValue(subscriber.available_msgs)}</strong></div>
                            <div><span>Renewal date</span><strong>{formatDate(subscriber.renewal_date)}</strong></div>
                            <div><span>Next order price</span><strong>{formatPrice(subscriber.next_order_price)}</strong></div>
                        </div>
                    </section>

                    <section className="subscriber-detail-card">
                        <div className="subscriber-section-heading">
                            <span className="subscriber-section-icon subscriber-icon-order">
                                <Wallet size={18} />
                            </span>
                            <div>
                                <h2>Next order</h2>
                                <span>Upcoming subscription order</span>
                            </div>
                        </div>
                        {!nextOrder ? (
                            <p className="subscriber-account-empty">No upcoming order.</p>
                        ) : (
                            <div className="subscriber-order-grid">
                                <div><span>Order</span><strong>#{displayValue(nextOrder.order_id)}</strong></div>
                                <div><span>Package</span><strong>{localizedName(nextOrder.package_name)}</strong></div>
                                <div><span>Channel</span><strong>{displayValue(nextOrder.channel)}</strong></div>
                                <div><span>Renewal date</span><strong>{formatDate(nextOrder.renewal_date)}</strong></div>
                                <div><span>Price</span><strong>{formatPrice(nextOrder.price)}</strong></div>
                                <div><span>Discount</span><strong>{formatPrice(nextOrder.total_discount)}</strong></div>
                                <div><span>Tax</span><strong>{formatPrice(nextOrder.total_tax)}</strong></div>
                                <div><span>Total</span><strong>{formatPrice(nextOrder.final_price)}</strong></div>
                            </div>
                        )}
                    </section>

                    <div className="subscriber-account-counts">
                        <span><MessageSquare size={16} /> {displayValue(subscriber.messenger_accounts_count)} Messenger</span>
                        <span><MessageCircle size={16} /> {displayValue(subscriber.whatsapp_items_count)} WhatsApp</span>
                        <span><Camera size={16} /> {displayValue(subscriber.instagram_items_count)} Instagram</span>
                    </div>

                    <AccountSection
                        title="Messenger accounts"
                        icon={MessageSquare}
                        items={subscriber.messengerAccounts || []}
                        kind="subscriber-icon-messenger"
                    />
                    <AccountSection
                        title="WhatsApp accounts"
                        icon={MessageCircle}
                        items={subscriber.whatsItems || []}
                        kind="subscriber-icon-whatsapp"
                    />
                    <AccountSection
                        title="Instagram accounts"
                        icon={Camera}
                        items={subscriber.instagramItems || []}
                        kind="subscriber-icon-instagram"
                    />
                </>
            )}
        </div>
    );
}

export default SubscriberDetailsPage;

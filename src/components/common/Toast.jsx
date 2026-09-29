import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { X, AlertCircle, CheckCircle2, Info } from "lucide-react";
import "./Toast.css";

/**
 * Tiny dependency-free toast system.
 *
 * Usage anywhere (no provider needed, the container mounts itself the
 * first time a toast is shown):
 *
 *   import { toast } from "../components/common/Toast";
 *   toast.error("Something went wrong");
 *   toast.success("Saved");
 *   toast.info("Heads up");
 */

let toasts = [];
let nextId = 1;
let mounted = false;
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener(toasts));

const ensureMounted = () => {
    if (mounted || typeof document === "undefined") return;
    mounted = true;
    const el = document.createElement("div");
    el.id = "smartego-toast-root";
    document.body.appendChild(el);
    createRoot(el).render(<Toaster />);
};

// Must match the exit animation duration in Toast.css
const EXIT_MS = 620;

// Two-step dismiss: flag the toast as "leaving" so it can animate out,
// then remove it from the list once the animation has finished.
const dismiss = (id) => {
    const target = toasts.find((t) => t.id === id);
    if (!target || target.leaving) return;

    toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
    emit();

    setTimeout(() => {
        toasts = toasts.filter((t) => t.id !== id);
        emit();
    }, EXIT_MS);
};

const show = (type, message, { duration = 6000 } = {}) => {
    if (!message) return null;
    ensureMounted();

    // Avoid stacking identical toasts (e.g. React StrictMode double fetch)
    if (
        toasts.some((t) => !t.leaving && t.type === type && t.message === message)
    ) {
        return null;
    }

    const id = nextId++;
    toasts = [...toasts, { id, type, message }];
    emit();
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
};

export const toast = {
    error: (message, opts) => show("error", message, opts),
    success: (message, opts) => show("success", message, opts),
    info: (message, opts) => show("info", message, opts),
    dismiss,
};

const ICONS = {
    error: AlertCircle,
    success: CheckCircle2,
    info: Info,
};

function Toaster() {
    const [items, setItems] = useState(toasts);

    useEffect(() => {
        listeners.add(setItems);
        setItems(toasts);
        return () => listeners.delete(setItems);
    }, []);

    return (
        <div className="toast-container" aria-live="polite">
            {items.map((t) => {
                const Icon = ICONS[t.type] || Info;
                return (
                    <div key={t.id} className={`toast-wrap ${t.leaving ? "leaving" : ""}`}>
                        <div className="toast-wrap-inner">
                            <div className={`toast toast-${t.type}`} role="alert">
                                <Icon size={18} className="toast-icon" />
                                <span className="toast-message">{t.message}</span>
                                <button
                                    type="button"
                                    className="toast-close"
                                    onClick={() => dismiss(t.id)}
                                    aria-label="Dismiss"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default toast;
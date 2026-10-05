import React, { useState, useEffect } from "react";
import { Camera, AlertCircle, Plus, Key, Edit2, Trash2 } from "lucide-react";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { axiosClient } from "../../api/axiosClient";
import "./InstagramItemsModal.css";

// Live API base. Absolute URL so it hits this host regardless of axiosClient's
// baseURL (same approach as MessengerItemsModal).
const INSTAGRAM_ENDPOINT_BASE = "https://bcknd.smartego.org/api/admin/users";

// Storage files come back as a relative path (e.g. "instagram/ai_files/...").
// Adjust this base if your storage is served from a different host/path.
const FILE_STORAGE_BASE_URL = "https://bcknd.smartego.org/storage";

const resolveFileUrl = (path) => {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${FILE_STORAGE_BASE_URL}/${String(path).replace(/^\/+/, "")}`;
};

const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
};

// Inline so the avatar stays small even if the stylesheet isn't loaded.
const AVATAR_STYLE = {
    width: 36,
    height: 36,
    minWidth: 36,
    maxWidth: 36,
    borderRadius: "50%",
    objectFit: "cover",
    flexShrink: 0,
    display: "block"
};

const AVATAR_FALLBACK_STYLE = {
    ...AVATAR_STYLE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--primary-gradient, #10b981)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 14
};

// API statuses are "active" | "disabled"
const STATUS_OPTIONS = [
    { value: "active", label: "Active" },
    { value: "disabled", label: "Disabled" }
];

const emptyCreateForm = {
    instagram_id: "",
    access_token: "",
    username: "",
    name: "",
    profile_picture_url: "",
    page_id: "",
    status: "active",
    ai_context: "",
    android_link: "",
    ios_link: "",
    website_url: ""
};

const emptyEditForm = {
    access_token: "",
    username: "",
    name: "",
    profile_picture_url: "",
    page_id: "",
    status: "active",
    msg_number: "",
    ai_context: "",
    ai_file: "",
    android_link: "",
    ios_link: "",
    website_url: ""
};

export default function InstagramItemsModal({ isOpen, onClose, user }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);

    // Modal States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [subscription, setSubscription] = useState(null);

    // Notice dialog (replaces window.alert)
    const [notice, setNotice] = useState(null); // { type: "success" | "error", message: string }
    const showNotice = (type, message) => setNotice({ type, message });

    // Confirm dialog (replaces window.confirm)
    const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);

    // Form States
    const [createForm, setCreateForm] = useState(emptyCreateForm);
    const [createAiFile, setCreateAiFile] = useState(null);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [editAiFile, setEditAiFile] = useState(null);
    const [editAiFilePreviewUrl, setEditAiFilePreviewUrl] = useState(null);

    useEffect(() => {
        if (!editAiFile) {
            setEditAiFilePreviewUrl(null);
            return;
        }
        const objectUrl = URL.createObjectURL(editAiFile);
        setEditAiFilePreviewUrl(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [editAiFile]);

    useEffect(() => {
        if (isOpen && user) {
            fetchItems();
        } else {
            setItems([]);
            setError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, user]);

    const fetchItems = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const res = await axiosClient.get(`${INSTAGRAM_ENDPOINT_BASE}/${user.id}/instagram-items`);
            const data = res?.data?.data ?? res?.data ?? [];
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Failed to fetch Instagram accounts");
        } finally {
            setLoading(false);
        }
    };

    // Regenerate the webhook verify_token. Runs silently right after a
    // successful "Add Account", and is also available as a manual row action.
    const handleRegenerateToken = async (itemId, { silent = false } = {}) => {
        setActionLoading(`regen-${itemId}`);
        try {
            const res = await axiosClient.post(
                `${INSTAGRAM_ENDPOINT_BASE}/${user.id}/instagram-items/${itemId}/regenerate-token`
            );
            await fetchItems();
            if (!silent) {
                showNotice("success", res?.data?.message || "Verify token regenerated. Update it in Meta App Dashboard.");
            }
        } catch (err) {
            if (!silent) {
                showNotice("error", err?.response?.data?.message || err?.message || "Failed to regenerate verify token");
            }
        } finally {
            setActionLoading(null);
        }
    };

    // Build a multipart body, skipping empty values and the file key.
    const buildFormData = (payload, file) => {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            if (key === "ai_file") return;
            formData.append(key, value ?? "");
        });
        if (file) formData.append("ai_file", file);
        return formData;
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setActionLoading("create");
        try {
            // Optional fields left blank are omitted entirely.
            const payload = Object.fromEntries(
                Object.entries(createForm).filter(([, v]) => v !== "" && v != null)
            );

            let res;
            if (createAiFile) {
                res = await axiosClient.post(
                    `${INSTAGRAM_ENDPOINT_BASE}/${user.id}/instagram-items`,
                    buildFormData(payload, createAiFile),
                    { headers: { "Content-Type": undefined } }
                );
            } else {
                res = await axiosClient.post(`${INSTAGRAM_ENDPOINT_BASE}/${user.id}/instagram-items`, payload);
            }

            setIsCreateOpen(false);
            setCreateForm(emptyCreateForm);
            setCreateAiFile(null);
            await fetchItems();

            // Auto-regenerate the verify token right after a successful add, silently.
            const newId = res?.data?.data?.id;
            if (newId) {
                await handleRegenerateToken(newId, { silent: true });
            }
        } catch (err) {
            showNotice("error", err?.response?.data?.message || err?.message || "Failed to link Instagram account");
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setActionLoading("update");
        try {
            // access_token is optional on update — only send it if a new one was typed.
            // msg_number is only sent when it has a value.
            const payload = { ...editForm };
            if (!payload.access_token) delete payload.access_token;
            if (payload.msg_number === "" || payload.msg_number == null) delete payload.msg_number;

            if (editAiFile) {
                const formData = buildFormData(payload, editAiFile);
                // Laravel only parses multipart on POST; _method spoofs PUT.
                formData.append("_method", "PUT");
                await axiosClient.post(
                    `${INSTAGRAM_ENDPOINT_BASE}/${user.id}/instagram-items/${editItem.id}`,
                    formData,
                    { headers: { "Content-Type": undefined } }
                );
            } else {
                delete payload.ai_file; // unchanged file: don't send the stored path back
                await axiosClient.put(
                    `${INSTAGRAM_ENDPOINT_BASE}/${user.id}/instagram-items/${editItem.id}`,
                    payload
                );
            }
            setEditItem(null);
            setEditAiFile(null);
            setSubscription(null);
            showNotice("success", "Instagram account updated successfully!");
            await fetchItems();
        } catch (err) {
            showNotice("error", err?.response?.data?.message || err?.message || "Failed to update Instagram account");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = (itemId) => {
        setConfirmDeleteItem(itemId);
    };

    const confirmDelete = async () => {
        const itemId = confirmDeleteItem;
        if (!itemId) return;
        setConfirmDeleteItem(null);
        setActionLoading(`delete-${itemId}`);
        try {
            await axiosClient.delete(`${INSTAGRAM_ENDPOINT_BASE}/${user.id}/instagram-items/${itemId}`);
            await fetchItems();
        } catch (err) {
            showNotice("error", err?.response?.data?.message || err?.message || "Failed to remove Instagram account");
        } finally {
            setActionLoading(null);
        }
    };

    const applyEditForm = (item) => {
        setEditForm({
            access_token: "",
            username: item.username || "",
            name: item.name || "",
            profile_picture_url: item.profile_picture_url || "",
            page_id: item.page_id || "",
            status: item.status || "active",
            msg_number: item.msg_number ?? "",
            ai_context: item.ai_context || "",
            ai_file: item.ai_file || "",
            android_link: item.android_link || "",
            ios_link: item.ios_link || "",
            website_url: item.website_url || ""
        });
    };

    const openEditModal = async (item) => {
        // Show what we already have from the list immediately...
        applyEditForm(item);
        setEditAiFile(null);
        setSubscription(null);
        setEditItem(item);

        // ...then fetch the full record (also returns subscription info).
        setEditLoading(true);
        try {
            const res = await axiosClient.get(`${INSTAGRAM_ENDPOINT_BASE}/${user.id}/instagram-items/${item.id}`);
            const full = res?.data?.data ?? item;
            setEditItem(full);
            applyEditForm(full);
            setSubscription(res?.data?.subscription ?? null);
        } catch {
            // Keep the row data already shown; a failed refresh shouldn't break opening Edit.
        } finally {
            setEditLoading(false);
        }
    };

    const closeEdit = () => {
        setEditItem(null);
        setEditAiFile(null);
        setSubscription(null);
    };

    const closeCreate = () => {
        setIsCreateOpen(false);
        setCreateAiFile(null);
    };

    const statusSelect = (value, onChange) => (
        <div className="form-field">
            <label className="form-label">Status</label>
            <select className="input-control" value={value} onChange={(e) => onChange(e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );

    return (
        <>
            <Modal
                isOpen={isOpen && !isCreateOpen && !editItem}
                onClose={onClose}
                title={user ? `Instagram Accounts for ${user.name || user.email}` : "Instagram Accounts"}
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose}>Close</Button>
                        <Button variant="primary" icon={Plus} onClick={() => setIsCreateOpen(true)}>Add Account</Button>
                    </>
                }
            >
                <div className="instagram-items-container">
                    {error && (
                        <div className="instagram-items-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="instagram-items-loading">Loading accounts...</div>
                    ) : items.length === 0 ? (
                        <div className="instagram-items-empty">
                            <Camera size={32} className="empty-icon" />
                            <p>No Instagram accounts linked for this user.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Account</th>
                                        <th>Verify Token</th>
                                        <th>Status</th>
                                        <th>Msgs Sent</th>
                                        <th>Updated At</th>
                                        <th className="th-actions">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => (
                                        <tr key={item.id} className="table-row">
                                            <td>#{item.id}</td>
                                            <td>
                                                <div className="user-cell">
                                                    {item.profile_picture_url ? (
                                                        <img
                                                            src={item.profile_picture_url}
                                                            alt={item.username || "profile"}
                                                            className="instagram-avatar"
                                                            style={AVATAR_STYLE}
                                                            referrerPolicy="no-referrer"
                                                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                                                        />
                                                    ) : (
                                                        <div className="instagram-avatar instagram-avatar-fallback" style={AVATAR_FALLBACK_STYLE}>
                                                            {(item.username || item.name || "I").charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div className="user-cell-meta">
                                                        <span className="user-cell-name">
                                                            {item.username ? `@${item.username}` : item.name || "—"}
                                                        </span>
                                                        <span className="user-cell-email">{item.instagram_id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="truncate-text" title={item.verify_token}>{item.verify_token || "—"}</span>
                                            </td>
                                            <td>
                                                <span className={`status-pill ${item.status === "active" ? "status-active" : "status-pending"}`}>
                                                    {item.status || "—"}
                                                </span>
                                            </td>
                                            <td>{item.msg_number ?? "—"}</td>
                                            <td>{formatDate(item.updated_at)}</td>
                                            <td>
                                                <div className="actions-cell">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        title="Regenerate Verify Token"
                                                        isLoading={actionLoading === `regen-${item.id}`}
                                                        onClick={() => handleRegenerateToken(item.id)}
                                                        disabled={actionLoading !== null}
                                                    >
                                                        <Key size={14} />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        title="Edit Account"
                                                        onClick={() => openEditModal(item)}
                                                        disabled={actionLoading !== null}
                                                    >
                                                        <Edit2 size={14} />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        title="Remove Account"
                                                        isLoading={actionLoading === `delete-${item.id}`}
                                                        onClick={() => handleDelete(item.id)}
                                                        disabled={actionLoading !== null}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Modal>

            {/* ADD ACCOUNT MODAL */}
            <Modal
                isOpen={isCreateOpen}
                onClose={closeCreate}
                title="Link New Instagram Account"
                footer={
                    <>
                        <Button variant="secondary" onClick={closeCreate}>Cancel</Button>
                        <Button variant="primary" onClick={handleCreate} isLoading={actionLoading === "create"}>Add Account</Button>
                    </>
                }
            >
                <form onSubmit={handleCreate} className="crud-form">
                    <Input label="Instagram ID" name="instagram_id" value={createForm.instagram_id} onChange={(e) => setCreateForm({ ...createForm, instagram_id: e.target.value })} required />
                    <Input label="Access Token" name="access_token" value={createForm.access_token} onChange={(e) => setCreateForm({ ...createForm, access_token: e.target.value })} required />
                    <Input label="Username" name="username" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} />
                    <Input label="Name" name="name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                    <Input label="Profile Picture URL" name="profile_picture_url" value={createForm.profile_picture_url} onChange={(e) => setCreateForm({ ...createForm, profile_picture_url: e.target.value })} />
                    <Input label="Page ID" name="page_id" value={createForm.page_id} onChange={(e) => setCreateForm({ ...createForm, page_id: e.target.value })} />
                    {statusSelect(createForm.status, (v) => setCreateForm({ ...createForm, status: v }))}
                    <Input label="Android Link" name="android_link" value={createForm.android_link} onChange={(e) => setCreateForm({ ...createForm, android_link: e.target.value })} />
                    <Input label="iOS Link" name="ios_link" value={createForm.ios_link} onChange={(e) => setCreateForm({ ...createForm, ios_link: e.target.value })} />
                    <Input label="Website URL" name="website_url" value={createForm.website_url} onChange={(e) => setCreateForm({ ...createForm, website_url: e.target.value })} />
                    <Input label="AI Context" name="ai_context" value={createForm.ai_context} onChange={(e) => setCreateForm({ ...createForm, ai_context: e.target.value })} />
                    <div className="form-field">
                        <label className="form-label">AI File (Optional)</label>
                        <input
                            type="file"
                            className="input-control"
                            onChange={(e) => setCreateAiFile(e.target.files?.[0] || null)}
                        />
                    </div>
                </form>
            </Modal>

            {/* EDIT ACCOUNT MODAL */}
            <Modal
                isOpen={Boolean(editItem)}
                onClose={closeEdit}
                title="Edit Instagram Account"
                footer={
                    <>
                        <Button variant="secondary" onClick={closeEdit}>Cancel</Button>
                        <Button variant="primary" onClick={handleUpdate} isLoading={actionLoading === "update"}>Save Changes</Button>
                    </>
                }
            >
                <form onSubmit={handleUpdate} className="crud-form">
                    {editLoading && (
                        <p className="form-loading-hint">Loading full record…</p>
                    )}
                    <Input label="Username" name="username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
                    <Input label="Name" name="name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <Input
                        label="Access Token (optional)"
                        name="access_token"
                        value={editForm.access_token}
                        onChange={(e) => setEditForm({ ...editForm, access_token: e.target.value })}
                        placeholder="Leave blank to keep current token"
                    />
                    <Input label="Profile Picture URL" name="profile_picture_url" value={editForm.profile_picture_url} onChange={(e) => setEditForm({ ...editForm, profile_picture_url: e.target.value })} />
                    <Input label="Page ID" name="page_id" value={editForm.page_id} onChange={(e) => setEditForm({ ...editForm, page_id: e.target.value })} />
                    {statusSelect(editForm.status, (v) => setEditForm({ ...editForm, status: v }))}
                    <Input label="Messages Sent" name="msg_number" type="number" value={editForm.msg_number} onChange={(e) => setEditForm({ ...editForm, msg_number: e.target.value })} />
                    <Input label="Android Link" name="android_link" value={editForm.android_link} onChange={(e) => setEditForm({ ...editForm, android_link: e.target.value })} />
                    <Input label="iOS Link" name="ios_link" value={editForm.ios_link} onChange={(e) => setEditForm({ ...editForm, ios_link: e.target.value })} />
                    <Input label="Website URL" name="website_url" value={editForm.website_url} onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })} />
                    <Input label="AI Context" name="ai_context" value={editForm.ai_context} onChange={(e) => setEditForm({ ...editForm, ai_context: e.target.value })} />
                    <div className="form-field">
                        <label className="form-label">AI File (Optional)</label>
                        <input
                            type="file"
                            className="input-control"
                            onChange={(e) => setEditAiFile(e.target.files?.[0] || null)}
                        />
                        {editAiFile ? (
                            <a href={editAiFilePreviewUrl} target="_blank" rel="noopener noreferrer" className="ai-file-current">
                                Preview selected file: {editAiFile.name}
                            </a>
                        ) : editForm.ai_file ? (
                            <a href={resolveFileUrl(editForm.ai_file)} target="_blank" rel="noopener noreferrer" className="ai-file-current">
                                View current file
                            </a>
                        ) : null}
                    </div>

                    {editItem && (
                        <div className="readonly-info-grid">
                            <div className="readonly-info-item">
                                <span className="readonly-info-label">Instagram ID</span>
                                <span className="readonly-info-value">{editItem.instagram_id || "—"}</span>
                            </div>
                            <div className="readonly-info-item">
                                <span className="readonly-info-label">Verify Token</span>
                                <span className="readonly-info-value">{editItem.verify_token || "—"}</span>
                            </div>
                            <div className="readonly-info-item">
                                <span className="readonly-info-label">Created</span>
                                <span className="readonly-info-value">{formatDate(editItem.created_at)}</span>
                            </div>
                            <div className="readonly-info-item">
                                <span className="readonly-info-label">Last Updated</span>
                                <span className="readonly-info-value">{formatDate(editItem.updated_at)}</span>
                            </div>
                            {subscription && (
                                <>
                                    <div className="readonly-info-item">
                                        <span className="readonly-info-label">Subscription</span>
                                        <span className="readonly-info-value">{subscription.subscription_status ?? "—"}</span>
                                    </div>
                                    <div className="readonly-info-item">
                                        <span className="readonly-info-label">Msgs Used / Total</span>
                                        <span className="readonly-info-value">
                                            {subscription.used_msgs ?? "—"} / {subscription.total_msgs ?? "—"}
                                        </span>
                                    </div>
                                    <div className="readonly-info-item">
                                        <span className="readonly-info-label">Available Msgs</span>
                                        <span className="readonly-info-value">{subscription.available_msgs ?? "—"}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </form>
            </Modal>

            {/* NOTICE DIALOG (replaces window.alert) */}
            <Modal
                isOpen={Boolean(notice)}
                onClose={() => setNotice(null)}
                title={notice?.type === "error" ? "Error" : "Success"}
                footer={
                    <Button variant="primary" onClick={() => setNotice(null)}>OK</Button>
                }
            >
                <div className={`instagram-items-notice ${notice?.type === "error" ? "instagram-items-notice-error" : "instagram-items-notice-success"}`}>
                    <AlertCircle size={16} />
                    <span>{notice?.message}</span>
                </div>
            </Modal>

            {/* CONFIRM DELETE DIALOG (replaces window.confirm) */}
            <Modal
                isOpen={Boolean(confirmDeleteItem)}
                onClose={() => setConfirmDeleteItem(null)}
                title="Remove Instagram Account"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setConfirmDeleteItem(null)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDelete} isLoading={actionLoading === `delete-${confirmDeleteItem}`}>Remove</Button>
                    </>
                }
            >
                <p>Are you sure you want to remove this Instagram account? This action cannot be undone.</p>
            </Modal>
        </>
    );
}
import React, { useState, useEffect } from "react";
import { MessageCircle, RefreshCw, AlertCircle, Plus, Key, Edit2, Trash2 } from "lucide-react";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { axiosClient } from "../../api/axiosClient";
import "./MessengerItemsModal.css";

// Live API base. Passed as an absolute URL so it hits this host regardless
// of whatever baseURL axiosClient is configured with (same approach as
// USERS_ENDPOINT in UsersPage.jsx).
const MESSENGER_ENDPOINT_BASE = "https://smartego.keeto.org/api/admin/users";

// Storage files come back from the API as a relative path (e.g. "messenger/ai_files/...").
// Adjust this base if your storage is served from a different host/path.
const FILE_STORAGE_BASE_URL = "https://smartego.keeto.org/storage";

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

const emptyCreateForm = {
    page_id: "",
    page_access_token: "",
    page_name: "",
    status: "active",
    ai_context: "",
    website_url: ""
};

const emptyEditForm = {
    page_name: "",
    page_access_token: "",
    status: "active",
    ai_context: "",
    ai_file: "",
    android_link: "",
    ios_link: "",
    website_url: ""
};

export default function MessengerItemsModal({ isOpen, onClose, user }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState(null);

    // Modal States
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [editLoading, setEditLoading] = useState(false);

    // Notice dialog (replaces window.alert)
    const [notice, setNotice] = useState(null); // { type: "success" | "error", message: string }
    const showNotice = (type, message) => setNotice({ type, message });

    // Confirm dialog (replaces window.confirm)
    const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);

    // Form States
    const [createForm, setCreateForm] = useState(emptyCreateForm);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [editAiFile, setEditAiFile] = useState(null); // newly selected File for ai_file upload
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
            const res = await axiosClient.get(`${MESSENGER_ENDPOINT_BASE}/${user.id}/messenger-accounts`);
            const data = res?.data?.data ?? res?.data ?? [];
            setItems(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Failed to fetch Messenger accounts");
        } finally {
            setLoading(false);
        }
    };

    // Regenerate the verify_token for an account. Called automatically right
    // after a successful "Add Page" (silent: true — no notice shown either
    // way), and also available as a manual per-row action for re-configuring
    // the webhook later (silent: false — shows a generic success/error notice,
    // but the actual verify_token / webhook_url values are never surfaced).
    const handleRegenerateToken = async (itemId, { silent = false } = {}) => {
        setActionLoading(`regen-${itemId}`);
        try {
            const res = await axiosClient.post(
                `${MESSENGER_ENDPOINT_BASE}/${user.id}/messenger-accounts/${itemId}/regenerate-token`
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

    const handleCreate = async (e) => {
        e.preventDefault();
        setActionLoading("create");
        try {
            const res = await axiosClient.post(`${MESSENGER_ENDPOINT_BASE}/${user.id}/messenger-accounts`, createForm);
            setIsCreateOpen(false);
            setCreateForm(emptyCreateForm);
            await fetchItems();

            // Auto-regenerate the verify token right after a successful add, silently.
            const newId = res?.data?.data?.id;
            if (newId) {
                await handleRegenerateToken(newId, { silent: true });
            }
        } catch (err) {
            showNotice("error", err?.response?.data?.message || err?.message || "Failed to link Facebook Page");
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        setActionLoading("update");
        try {
            // page_access_token is optional on update — only include it if the
            // admin actually typed a new one; an empty string means "keep current".
            const { page_access_token, ...editFormRest } = editForm;
            const basePayload = page_access_token ? editForm : editFormRest;

            if (editAiFile) {
                const formData = new FormData();
                Object.entries(basePayload).forEach(([key, value]) => {
                    if (key === "ai_file") return; // sent as file below
                    formData.append(key, value ?? "");
                });
                formData.append("ai_file", editAiFile);
                // Some backends (e.g. Laravel) only parse multipart bodies on POST,
                // using method-spoofing for PUT/PATCH. Sending _method covers that
                // case; harmless if the backend doesn't need it.
                formData.append("_method", "PUT");
                await axiosClient.post(
                    `${MESSENGER_ENDPOINT_BASE}/${user.id}/messenger-accounts/${editItem.id}`,
                    formData,
                    { headers: { "Content-Type": undefined } } // let the browser set the multipart boundary
                );
            } else {
                await axiosClient.put(
                    `${MESSENGER_ENDPOINT_BASE}/${user.id}/messenger-accounts/${editItem.id}`,
                    basePayload
                );
            }
            setEditItem(null);
            setEditAiFile(null);
            showNotice("success", "Messenger account updated successfully!");
            await fetchItems();
        } catch (err) {
            showNotice("error", err?.response?.data?.message || err?.message || "Failed to update Messenger account");
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
            await axiosClient.delete(`${MESSENGER_ENDPOINT_BASE}/${user.id}/messenger-accounts/${itemId}`);
            await fetchItems();
        } catch (err) {
            showNotice("error", err?.response?.data?.message || err?.message || "Failed to remove Messenger page");
        } finally {
            setActionLoading(null);
        }
    };

    const applyEditForm = (item) => {
        setEditForm({
            page_name: item.page_name || "",
            page_access_token: "",
            status: item.status || "active",
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
        setEditItem(item);

        // ...then fetch the full record via GET .../messenger-accounts/{id}
        // in case the list row is missing any fields (ai_context, links, etc.).
        setEditLoading(true);
        try {
            const res = await axiosClient.get(`${MESSENGER_ENDPOINT_BASE}/${user.id}/messenger-accounts/${item.id}`);
            const full = res?.data?.data ?? res?.data ?? item;
            setEditItem(full);
            applyEditForm(full);
        } catch {
            // Keep the row data already shown; error surfaced via the notice dialog is skipped
            // here so opening Edit doesn't feel broken when only the refresh fails.
        } finally {
            setEditLoading(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen && !isCreateOpen && !editItem}
                onClose={onClose}
                title={user ? `Messenger Pages for ${user.name || user.email}` : "Messenger Pages"}
                footer={
                    <>
                        <Button variant="secondary" onClick={onClose}>Close</Button>
                        <Button variant="primary" icon={Plus} onClick={() => setIsCreateOpen(true)}>Add Page</Button>
                    </>
                }
            >
                <div className="messenger-items-container">
                    {error && (
                        <div className="messenger-items-error">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="messenger-items-loading">Loading pages...</div>
                    ) : items.length === 0 ? (
                        <div className="messenger-items-empty">
                            <MessageCircle size={32} className="empty-icon" />
                            <p>No Messenger pages linked for this user.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Page</th>
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
                                                <div className="user-cell-meta">
                                                    <span className="user-cell-name">{item.page_name || "—"}</span>
                                                    <span className="user-cell-email">{item.page_id}</span>
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
                                                        title="Edit Page"
                                                        onClick={() => openEditModal(item)}
                                                        disabled={actionLoading !== null}
                                                    >
                                                        <Edit2 size={14} />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        title="Remove Page"
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

            {/* ADD PAGE MODAL */}
            <Modal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                title="Link New Facebook Page"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleCreate} isLoading={actionLoading === "create"}>Add Page</Button>
                    </>
                }
            >
                <form onSubmit={handleCreate} className="crud-form">
                    <Input label="Page ID" name="page_id" value={createForm.page_id} onChange={(e) => setCreateForm({ ...createForm, page_id: e.target.value })} required />
                    <Input label="Page Access Token" name="page_access_token" value={createForm.page_access_token} onChange={(e) => setCreateForm({ ...createForm, page_access_token: e.target.value })} required />
                    <Input label="Page Name" name="page_name" value={createForm.page_name} onChange={(e) => setCreateForm({ ...createForm, page_name: e.target.value })} required />
                    <div className="form-field">
                        <label className="form-label">Status</label>
                        <select className="input-control" value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <Input label="AI Context" name="ai_context" value={createForm.ai_context} onChange={(e) => setCreateForm({ ...createForm, ai_context: e.target.value })} />
                    <Input label="Website URL" name="website_url" value={createForm.website_url} onChange={(e) => setCreateForm({ ...createForm, website_url: e.target.value })} />
                </form>
            </Modal>

            {/* EDIT PAGE MODAL */}
            <Modal
                isOpen={Boolean(editItem)}
                onClose={() => { setEditItem(null); setEditAiFile(null); }}
                title="Edit Messenger Page"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => { setEditItem(null); setEditAiFile(null); }}>Cancel</Button>
                        <Button variant="primary" onClick={handleUpdate} isLoading={actionLoading === "update"}>Save Changes</Button>
                    </>
                }
            >
                <form onSubmit={handleUpdate} className="crud-form">
                    {editLoading && (
                        <p className="form-loading-hint">Loading full record…</p>
                    )}
                    <Input label="Page Name" name="page_name" value={editForm.page_name} onChange={(e) => setEditForm({ ...editForm, page_name: e.target.value })} required />
                    <Input
                        label="Page Access Token (optional)"
                        name="page_access_token"
                        value={editForm.page_access_token}
                        onChange={(e) => setEditForm({ ...editForm, page_access_token: e.target.value })}
                        placeholder="Leave blank to keep current token"
                    />
                    <div className="form-field">
                        <label className="form-label">Status</label>
                        <select className="input-control" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
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
                                <span className="readonly-info-label">Page ID</span>
                                <span className="readonly-info-value">{editItem.page_id || "—"}</span>
                            </div>
                            <div className="readonly-info-item">
                                <span className="readonly-info-label">Verify Token</span>
                                <span className="readonly-info-value">{editItem.verify_token || "—"}</span>
                            </div>
                            <div className="readonly-info-item">
                                <span className="readonly-info-label">Messages Sent</span>
                                <span className="readonly-info-value">{editItem.msg_number ?? "—"}</span>
                            </div>
                            <div className="readonly-info-item">
                                <span className="readonly-info-label">Last Updated</span>
                                <span className="readonly-info-value">{formatDate(editItem.updated_at)}</span>
                            </div>
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
                <div className={`messenger-items-notice ${notice?.type === "error" ? "messenger-items-notice-error" : "messenger-items-notice-success"}`}>
                    <AlertCircle size={16} />
                    <span>{notice?.message}</span>
                </div>
            </Modal>

            {/* CONFIRM DELETE DIALOG (replaces window.confirm) */}
            <Modal
                isOpen={Boolean(confirmDeleteItem)}
                onClose={() => setConfirmDeleteItem(null)}
                title="Remove Messenger Page"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setConfirmDeleteItem(null)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmDelete} isLoading={actionLoading === `delete-${confirmDeleteItem}`}>Remove</Button>
                    </>
                }
            >
                <p>Are you sure you want to remove this Messenger page? This action cannot be undone.</p>
            </Modal>
        </>
    );
}
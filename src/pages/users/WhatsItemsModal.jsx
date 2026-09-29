import React, { useState, useEffect } from "react";
import { MessageSquare, RefreshCw, AlertCircle, Plus, Send, Key, Edit2, Trash2 } from "lucide-react";
import Modal from "../../components/common/Modal";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { axiosClient } from "../../api/axiosClient";
import "./WhatsItemsModal";

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

// Storage files come back from the API as a relative path (e.g. "whats/ai_files/...").
// Adjust this base if your storage is served from a different host/path.
const FILE_STORAGE_BASE_URL = "https://bcknd.smartego.org/storage";

const resolveFileUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${FILE_STORAGE_BASE_URL}/${String(path).replace(/^\/+/, "")}`;
};

export default function WhatsItemsModal({ isOpen, onClose, user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [requestItem, setRequestItem] = useState(null);
  const [verifyItem, setVerifyItem] = useState(null);
  const [editItem, setEditItem] = useState(null);

  // Notice dialog (replaces window.alert)
  const [notice, setNotice] = useState(null); // { type: "success" | "error", message: string }
  const showNotice = (type, message) => setNotice({ type, message });

  // Confirm dialog (replaces window.confirm)
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);

  // Form States
  const [createForm, setCreateForm] = useState({
    phone: "",
    verified_name: "",
    android_link: "",
    ios_link: "",
    website_url: "",
    auto_request_code: true,
    code_method: "SMS",
    ai_context: "",
    ai_file: ""
  });

  const [requestForm, setRequestForm] = useState({ code_method: "SMS", language: "en_US" });
  const [verifyForm, setVerifyForm] = useState({ code: "", pin: "" });
  const [editForm, setEditForm] = useState({
    phone: "",
    android_link: "",
    ios_link: "",
    website_url: "",
    phone_status: "pending_otp",
    ai_context: "",
    ai_file: ""
  });
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
  }, [isOpen, user]);

  const fetchItems = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axiosClient.get(`/admin/users/${user.id}/whats-items`);
      const data = res?.data?.data ?? res?.data ?? [];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to fetch WhatsApp items");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMeta = async (itemId) => {
    setActionLoading(`sync-${itemId}`);
    try {
      await axiosClient.get(`/admin/users/${user.id}/whats-items/${itemId}/meta-status`);
      await fetchItems();
    } catch (err) {
      showNotice("error", err?.response?.data?.message || err?.message || "Failed to sync Meta status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionLoading("create");
    try {
      await axiosClient.post(`/admin/users/${user.id}/whats-items`, createForm);
      setIsCreateOpen(false);
      setCreateForm({
        phone: "",
        verified_name: "",
        android_link: "",
        ios_link: "",
        website_url: "",
        auto_request_code: true,
        code_method: "SMS",
        ai_context: "",
        ai_file: ""
      });
      await fetchItems();
    } catch (err) {
      showNotice("error", err?.response?.data?.message || err?.message || "Failed to add WhatsApp number");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setActionLoading("request");
    try {
      await axiosClient.post(`/admin/users/${user.id}/whats-items/${requestItem.id}/request-code`, requestForm);
      setRequestItem(null);
      showNotice("success", "Code requested successfully");
    } catch (err) {
      showNotice("error", err?.response?.data?.message || err?.message || "Failed to request code");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setActionLoading("verify");
    const itemId = verifyItem.id;
    try {
      await axiosClient.post(`/admin/users/${user.id}/whats-items/${itemId}/verify-and-register`, verifyForm);
      setVerifyItem(null);
      setVerifyForm({ code: "", pin: "" });

      // Auto-trigger sync after successful verification
      try {
        await axiosClient.get(`/admin/users/${user.id}/whats-items/${itemId}/meta-status`);
      } catch (syncErr) {
        console.error("Auto-sync failed:", syncErr);
      }

      showNotice("success", "Phone number verified successfully!");
      await fetchItems();
    } catch (err) {
      showNotice("error", err?.response?.data?.message || err?.message || "Failed to verify code");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setActionLoading("update");
    try {
      if (editAiFile) {
        const formData = new FormData();
        Object.entries(editForm).forEach(([key, value]) => {
          if (key === "ai_file") return; // sent as file below
          formData.append(key, value ?? "");
        });
        formData.append("ai_file", editAiFile);
        // Some backends (e.g. Laravel) only parse multipart bodies on POST,
        // using method-spoofing for PUT/PATCH. Sending _method covers that
        // case; harmless if the backend doesn't need it.
        formData.append("_method", "PUT");
        await axiosClient.post(
          `/admin/users/${user.id}/whats-items/${editItem.id}`,
          formData,
          { headers: { "Content-Type": undefined } } // let the browser set the multipart boundary
        );
      } else {
        await axiosClient.put(`/admin/users/${user.id}/whats-items/${editItem.id}`, editForm);
      }
      setEditItem(null);
      setEditAiFile(null);
      showNotice("success", "WhatsApp item updated successfully!");
      await fetchItems();
    } catch (err) {
      showNotice("error", err?.response?.data?.message || err?.message || "Failed to update WhatsApp item");
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
      await axiosClient.delete(`/admin/users/${user.id}/whats-items/${itemId}`);
      await fetchItems();
    } catch (err) {
      showNotice("error", err?.response?.data?.message || err?.message || "Failed to delete WhatsApp item");
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (item) => {
    setEditForm({
      phone: item.phone || "",
      android_link: item.android_link || "",
      ios_link: item.ios_link || "",
      website_url: item.website_url || "",
      phone_status: item.phone_status || "pending_otp",
      ai_context: item.ai_context || "",
      ai_file: item.ai_file || ""
    });
    setEditAiFile(null);
    setEditItem(item);
  };

  return (
    <>
      <Modal
        isOpen={isOpen && !isCreateOpen && !requestItem && !verifyItem && !editItem}
        onClose={onClose}
        title={user ? `WhatsApp List for ${user.name || user.email}` : "WhatsApp List"}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button variant="primary" icon={Plus} onClick={() => setIsCreateOpen(true)}>Add New</Button>
          </>
        }
      >
        <div className="whats-items-container">
          {error && (
            <div className="whats-items-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="whats-items-loading">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="whats-items-empty">
              <MessageSquare size={32} className="empty-icon" />
              <p>No WhatsApp items found for this user.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Phone</th>
                    <th>WABA ID</th>
                    <th>Status</th>
                    <th>Verified At</th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="table-row">
                      <td>#{item.id}</td>
                      <td>{item.phone || "—"}</td>
                      <td>
                        <span className="truncate-text" title={item.waba_id}>{item.waba_id || "—"}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${item.phone_status === 'connected' || item.phone_status === 'APPROVED' ? 'status-active' : 'status-pending'}`}>
                          {item.phone_status || "—"}
                        </span>
                      </td>
                      <td>{formatDate(item.phone_verified_at)}</td>
                      <td>
                        <div className="actions-cell">
                          <Button
                            variant="outline"
                            size="sm"
                            title="Sync Meta Status"
                            isLoading={actionLoading === `sync-${item.id}`}
                            onClick={() => handleSyncMeta(item.id)}
                            disabled={actionLoading !== null}
                          >
                            <RefreshCw size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Request Code"
                            onClick={() => setRequestItem(item)}
                            disabled={actionLoading !== null}
                          >
                            <Send size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Verify Code"
                            onClick={() => setVerifyItem(item)}
                            disabled={actionLoading !== null}
                          >
                            <Key size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Edit Item"
                            onClick={() => openEditModal(item)}
                            disabled={actionLoading !== null}
                          >
                            <Edit2 size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Delete Item"
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

      {/* CREATE ITEM MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Add New WhatsApp Number"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} isLoading={actionLoading === "create"}>Add Number</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="crud-form">
          <Input label="Phone" name="phone" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} required />
          <Input label="Verified Name" name="verified_name" value={createForm.verified_name} onChange={(e) => setCreateForm({ ...createForm, verified_name: e.target.value })} required />
          <div className="form-field">
            <label className="form-label">Auto Request Code</label>
            <select className="input-control" value={createForm.auto_request_code.toString()} onChange={(e) => setCreateForm({ ...createForm, auto_request_code: e.target.value === "true" })}>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Code Method</label>
            <select className="input-control" value={createForm.code_method} onChange={(e) => setCreateForm({ ...createForm, code_method: e.target.value })}>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="VOICE">Voice</option>
            </select>
          </div>
          <Input label="AI Context" name="ai_context" value={createForm.ai_context} onChange={(e) => setCreateForm({ ...createForm, ai_context: e.target.value })} />
          <Input label="Website URL" name="website_url" value={createForm.website_url} onChange={(e) => setCreateForm({ ...createForm, website_url: e.target.value })} />
        </form>
      </Modal>

      {/* REQUEST CODE MODAL */}
      <Modal
        isOpen={Boolean(requestItem)}
        onClose={() => setRequestItem(null)}
        title={`Request Code for ${requestItem?.phone}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRequestItem(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleRequestCode} isLoading={actionLoading === "request"}>Send Request</Button>
          </>
        }
      >
        <form onSubmit={handleRequestCode} className="crud-form">
          <div className="form-field">
            <label className="form-label">Code Method</label>
            <select className="input-control" value={requestForm.code_method} onChange={(e) => setRequestForm({ ...requestForm, code_method: e.target.value })}>
              <option value="SMS">SMS</option>
              <option value="VOICE">Voice</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Language Code *</label>
            <select
              className="input-control"
              value={requestForm.language}
              onChange={(e) => setRequestForm({ ...requestForm, language: e.target.value })}
              required
            >
              <option value="en_US">English (en_US)</option>
              <option value="ar_AR">Arabic (ar_AR)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* VERIFY CODE MODAL */}
      <Modal
        isOpen={Boolean(verifyItem)}
        onClose={() => setVerifyItem(null)}
        title={`Verify & Register ${verifyItem?.phone}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVerifyItem(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleVerify} isLoading={actionLoading === "verify"}>Verify</Button>
          </>
        }
      >
        <form onSubmit={handleVerify} className="crud-form">
          <Input label="Verification Code" name="code" value={verifyForm.code} onChange={(e) => setVerifyForm({ ...verifyForm, code: e.target.value })} required />
          <Input label="PIN" name="pin" value={verifyForm.pin} onChange={(e) => setVerifyForm({ ...verifyForm, pin: e.target.value })} required />
        </form>
      </Modal>

      {/* EDIT ITEM MODAL */}
      <Modal
        isOpen={Boolean(editItem)}
        onClose={() => { setEditItem(null); setEditAiFile(null); }}
        title="Edit WhatsApp Number"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditItem(null); setEditAiFile(null); }}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdate} isLoading={actionLoading === "update"}>Save Changes</Button>
          </>
        }
      >
        <form onSubmit={handleUpdate} className="crud-form">
          <Input label="Phone" name="phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required />
          <div className="form-field">
            <label className="form-label">Phone Status</label>
            <select className="input-control" value={editForm.phone_status} onChange={(e) => setEditForm({ ...editForm, phone_status: e.target.value })}>
              <option value="pending_otp">Pending OTP</option>
              <option value="connected">Connected</option>
              <option value="disconnected">Disconnected</option>
              <option value="banned">Banned</option>
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
        <div className={`whats-items-notice ${notice?.type === "error" ? "whats-items-notice-error" : "whats-items-notice-success"}`}>
          <AlertCircle size={16} />
          <span>{notice?.message}</span>
        </div>
      </Modal>

      {/* CONFIRM DELETE DIALOG (replaces window.confirm) */}
      <Modal
        isOpen={Boolean(confirmDeleteItem)}
        onClose={() => setConfirmDeleteItem(null)}
        title="Delete WhatsApp Item"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteItem(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} isLoading={actionLoading === `delete-${confirmDeleteItem}`}>Delete</Button>
          </>
        }
      >
        <p>Are you sure you want to delete this WhatsApp item? This action cannot be undone.</p>
      </Modal>
    </>
  );
}
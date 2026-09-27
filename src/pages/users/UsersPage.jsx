import { useState, useEffect, useRef } from "react";
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Mail,
  Shield,
  Check,
  AlertTriangle,
  Database,
  Filter,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MessageCircle,
} from "lucide-react";
import useCrud from "../../hooks/useCrud";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import WhatsItemsModal from "./WhatsItemsModal";
import MessengerItemsModal from "./Messengeritemsmodal";
import "./UsersPage.css";

// Live API endpoint. Passed as an absolute URL so it hits this host
// regardless of whatever baseURL axiosClient is configured with.
const USERS_ENDPOINT = "https://smartego.keeto.org/api/admin/users";

// Helper: strip out "unset" filter values so we don't send empty/ALL
// query params to the API.
const buildQueryParams = ({ search, phoneStatus, paginate, perPage }) => {
  const params = {};
  if (search && search.trim()) params.search = search.trim();
  if (phoneStatus && phoneStatus !== "ALL") params.phone_status = phoneStatus;
  if (paginate !== "ALL") params.paginate = paginate === "true" ? 1 : 0;
  if (perPage) params.per_page = Number(perPage);
  return params;
};

// Helper: render the API's ISO created_at timestamp as a short readable date
const formatDate = (value) => {
  if (!value) return "Just now";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function UsersPage() {
  // Using the generic useCrud hook against the live admin users endpoint
  const {
    items: users,
    loading,
    actionLoading,
    pagination,
    fetchList,
    fetchById,
    createItem,
    updateItem,
    deleteItem,
    refetch,
  } = useCrud(USERS_ENDPOINT, {
    initialData: [],
    defaultParams: { page: 1, per_page: 10, paginate: 1 },
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [phoneStatusFilter, setPhoneStatusFilter] = useState("ALL");
  const [paginateFilter, setPaginateFilter] = useState("true");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const isFirstRun = useRef(true);

  // Re-fetch from the server whenever a filter changes (debounced for search).
  // Skipped on mount since useCrud already performs the initial fetch.
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const handle = setTimeout(
      () => {
        setPage(1);
        fetchList(
          {
            page: 1,
            ...buildQueryParams({
              search: searchTerm,
              phoneStatus: phoneStatusFilter,
              paginate: paginateFilter,
              perPage,
            }),
          },
          { merge: false },
        ).catch(() => {
          // Errors are surfaced via the hook's `error` state
        });
      },
      searchTerm ? 400 : 0,
    );

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, phoneStatusFilter, paginateFilter, perPage]);

  const goToPage = (nextPage) => {
    if (nextPage < 1) return;
    setPage(nextPage);
    fetchList(
      {
        page: nextPage,
        ...buildQueryParams({
          search: searchTerm,
          phoneStatus: phoneStatusFilter,
          paginate: paginateFilter,
          perPage,
        }),
      },
      { merge: false },
    ).catch(() => { });
  };

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [whatsItemsUser, setWhatsItemsUser] = useState(null);
  const [messengerItemsUser, setMessengerItemsUser] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const emptyForm = {
    name: "",
    email: "",
    phone: "",
    password: "",
    restuarant_name: "",
    auto_request_code: true,
    code_method: "SMS",
  };

  // Form states
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const handleOpenCreate = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const formFromUser = (user) => ({
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    password: "",
    restuarant_name: user.restuarant_name || "",
    auto_request_code: user.auto_request_code ?? true,
    code_method: user.code_method || "SMS",
  });

  const handleOpenEdit = async (user) => {
    // Show what we already have from the list immediately...
    setEditingUser(user);
    setFormData(formFromUser(user));
    setFormErrors({});

    // ...then fetch the full record via GET /admin/users/{id} for the
    // fields the list endpoint doesn't include (ai_context, links, etc.).
    setEditLoading(true);
    try {
      const full = await fetchById(user.id);
      setEditingUser(full);
      setFormData(formFromUser(full));
    } catch {
      // Keep the row data already shown; error is surfaced via the hook's `error` state
    } finally {
      setEditLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name.trim()) errors.name = "Full name is required";
    if (!formData.email.trim()) {
      errors.email = "Email address is required";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      errors.email = "Please provide a valid email";
    }
    if (!editingUser && !formData.password.trim()) {
      errors.password = "Password is required";
    } else if (formData.password && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Only include the specified properties
    const payload = {
      phone: formData.phone,
      password: formData.password,
      restuarant_name: formData.restuarant_name,
      name: formData.name,
      email: formData.email,
      auto_request_code: Boolean(formData.auto_request_code),
      code_method: formData.code_method,
    };
    if (editingUser && !payload.password) {
      delete payload.password;
    }

    try {
      if (editingUser) {
        // Execute update via useCrud
        await updateItem(editingUser.id, payload);
        setEditingUser(null);
      } else {
        // Execute create via useCrud
        await createItem(payload);
        setIsCreateModalOpen(false);
      }
    } catch {
      // Error handled by hook
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteItem(deletingUser.id);
      setDeletingUser(null);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="users-page-container">
      {/* Header with Hook Details Banner */}
      <div className="users-page-header">
        {/*  <div>
          <h2 className="users-page-title">
            Users & Admin Resource Management
          </h2>
        </div> */}
        <div className="page-header-actions">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={refetch}
            isLoading={loading}
          >
            Refresh
          </Button>
          <Button variant="primary" icon={UserPlus} onClick={handleOpenCreate}>
            Create New Admin
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="users-toolbar">
        <div className="search-box">
          <Search size={16} className="search-box-icon" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-box-input"
          />
        </div>

        <div className="toolbar-filters">
          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={phoneStatusFilter}
              onChange={(e) => setPhoneStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">Phone Status: Not Set</option>
              <option value="verified">Phone Status: verified</option>
              <option value="unverified">Phone Status: unverified</option>
            </select>
          </div>

          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={paginateFilter}
              onChange={(e) => setPaginateFilter(e.target.value)}
              className="filter-select"
            >
              <option value="ALL">Paginate: Not Set</option>
              <option value="true">Paginate: True</option>
              <option value="false">Paginate: False</option>
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

      {/* Users Table Card */}
      <div className="users-table-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Users</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Created Date</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    <Database size={32} className="empty-icon" />
                    <p>No records found matching your query.</p>
                  </td>
                </tr>
              ) : (
                users
                  .filter((user) =>
                    !searchTerm ||
                    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((user) => (
                    <tr key={user.id} className="table-row">
                      <td>
                        <div className="user-cell">
                          <div className="user-cell-avatar">
                            {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div className="user-cell-meta">
                            <span className="user-cell-name">{user.name}</span>
                            <span className="user-cell-email">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="role-tag">
                          <Shield size={12} />
                          {user.role || "user"}
                        </span>
                      </td>
                      <td>
                        <div className="user-cell-meta">
                          <span className="user-cell-name">
                            {user.phone || "—"}
                          </span>
                          {user.phone_status && (
                            <span
                              className={`status-pill ${user.phone_status === "verified"
                                ? "status-active"
                                : "status-pending"
                                }`}
                            >
                              <span className="status-dot"></span>
                              {user.phone_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="cell-date">{formatDate(user.created_at)}</td>
                      <td>
                        <div className="actions-cell">
                          <button
                            type="button"
                            className="action-icon-btn"
                            title="View WhatsApp Items"
                            onClick={() => setWhatsItemsUser(user)}
                          >
                            <MessageSquare size={16} />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn"
                            title="View Messenger Pages"
                            onClick={() => setMessengerItemsUser(user)}
                          >
                            <MessageCircle size={16} />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn edit-btn"
                            title="Edit user"
                            onClick={() => handleOpenEdit(user)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="action-icon-btn delete-btn"
                            title="Delete user"
                            onClick={() => setDeletingUser(user)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
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
            Showing {users.length} of {pagination.total || users.length} total
            entries
          </span>

          {paginateFilter === "true" && (
            <div className="pagination-controls">
              <button
                type="button"
                className="action-icon-btn"
                disabled={loading || page <= 1}
                onClick={() => goToPage(page - 1)}
                title="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {pagination.page || page} of {pagination.totalPages || 1}
              </span>
              <button
                type="button"
                className="action-icon-btn"
                disabled={loading || !pagination.hasMore}
                onClick={() => goToPage(page + 1)}
                title="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isCreateModalOpen || Boolean(editingUser)}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingUser(null);
        }}
        title={editingUser ? `Edit User #${editingUser.id}` : "Create New User"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={actionLoading}
              icon={Check}
            >
              {editingUser ? "Save Changes" : "Create User"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="crud-form">
          {editingUser && editLoading && (
            <p className="form-loading-hint">Loading full record…</p>
          )}

          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="e.g. John Doe"
            error={formErrors.name}
            required
          />

          <Input
            label="Email Address"
            name="email"
            type="email"
            icon={Mail}
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="e.g. admin@smartego.com"
            error={formErrors.email}
            required
          />

          <Input
            label="Phone"
            name="phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
            placeholder="e.g. +20 100 000 0000"
            error={formErrors.phone}
          />

          <Input
            label={editingUser ? "New Password (optional)" : "Password"}
            name="password"
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
            placeholder={
              editingUser
                ? "Leave blank to keep current password"
                : "e.g. ••••••••"
            }
            error={formErrors.password}
            required={!editingUser}
          />

          <Input
            label="Restaurant Name"
            name="restuarant_name"
            value={formData.restuarant_name}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                restuarant_name: e.target.value,
              }))
            }
            placeholder="e.g. Smart Ego Diner"
          />

          <div className="form-field">
            <label className="form-label">Auto Request Code</label>
            <select
              value={formData.auto_request_code.toString()}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, auto_request_code: e.target.value === "true" }))
              }
              className="input-control"
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Code Method</label>
            <select
              value={formData.code_method}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, code_method: e.target.value }))
              }
              className="input-control"
            >
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>

          {editingUser && (
            <div className="readonly-info-grid">
              <div className="readonly-info-item">
                <span className="readonly-info-label">Messages Sent</span>
                <span className="readonly-info-value">
                  {editingUser.msg_number ?? "—"}
                </span>
              </div>
              <div className="readonly-info-item">
                <span className="readonly-info-label">WABA ID</span>
                <span className="readonly-info-value">
                  {editingUser.waba_id || "—"}
                </span>
              </div>
              <div className="readonly-info-item">
                <span className="readonly-info-label">Phone Number ID</span>
                <span className="readonly-info-value">
                  {editingUser.phone_number_id || "—"}
                </span>
              </div>
              <div className="readonly-info-item">
                <span className="readonly-info-label">Email Verified</span>
                <span className="readonly-info-value">
                  {formatDate(editingUser.email_verified_at)}
                </span>
              </div>
              <div className="readonly-info-item">
                <span className="readonly-info-label">Phone Verified</span>
                <span className="readonly-info-value">
                  {formatDate(editingUser.phone_verified_at)}
                </span>
              </div>
              <div className="readonly-info-item">
                <span className="readonly-info-label">Last Updated</span>
                <span className="readonly-info-value">
                  {formatDate(editingUser.updated_at)}
                </span>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        title="Confirm User Deletion"
        maxWidth="440px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={actionLoading}
              icon={Trash2}
            >
              Delete User
            </Button>
          </>
        }
      >
        <div className="delete-confirm-body">
          <div className="delete-warning-icon">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="delete-confirm-title">
              Are you sure you want to delete this user?
            </p>
            <p className="delete-confirm-sub">
              This will remove <strong>{deletingUser?.name}</strong> (
              {deletingUser?.email}) from the system.
            </p>
          </div>
        </div>
      </Modal>

      <WhatsItemsModal
        isOpen={Boolean(whatsItemsUser)}
        onClose={() => setWhatsItemsUser(null)}
        user={whatsItemsUser}
      />

      <MessengerItemsModal
        isOpen={Boolean(messengerItemsUser)}
        onClose={() => setMessengerItemsUser(null)}
        user={messengerItemsUser}
      />
    </div>
  );
}

export default UsersPage;
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
} from "lucide-react";
import useCrud from "../../hooks/useCrud";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import "./AdminPage.css";

// Live API endpoints. Passed as absolute URLs so they hit this host
// regardless of whatever baseURL axiosClient is configured with.
// Every operation goes through /admin/admins:
//   GET    /admin/admins            -> list
//   POST   /admin/admins            -> create
//   GET    /admin/admins/{admin}    -> get one
//   PUT    /admin/admins/{admin}    -> update
//   DELETE /admin/admins/{admin}    -> delete
const ADMINS_ENDPOINT = "https://smartego.keeto.org/api/admin/admins";

// Helper: strip out "unset" filter values so we don't send empty/ALL
// query params to the API.
const buildQueryParams = ({ search, paginate, perPage }) => {
  const params = {};
  if (search && search.trim()) params.search = search.trim();
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

export function AdminsPage() {
  // Using the generic useCrud hook against the live admin/admins endpoint
  const {
    items: admins,
    loading,
    actionLoading,
    pagination,
    fetchList,
    fetchById,
    createItem,
    updateItem,
    deleteItem,
    refetch,
  } = useCrud(ADMINS_ENDPOINT, {
    initialData: [],
    defaultParams: { page: 1, per_page: 10, paginate: 1 },
  });

  const [searchTerm, setSearchTerm] = useState("");
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
  }, [searchTerm, paginateFilter, perPage]);

  const goToPage = (nextPage) => {
    if (nextPage < 1) return;
    setPage(nextPage);
    fetchList(
      {
        page: nextPage,
        ...buildQueryParams({
          search: searchTerm,
          paginate: paginateFilter,
          perPage,
        }),
      },
      { merge: false },
    ).catch(() => {});
  };

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [deletingAdmin, setDeletingAdmin] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const emptyForm = {
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "admin",
  };

  // Form states
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const handleOpenCreate = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const formFromAdmin = (admin) => ({
    name: admin.name || "",
    email: admin.email || "",
    phone: admin.phone || "",
    password: "",
    role: admin.role || "admin",
  });

  const handleOpenEdit = async (admin) => {
    // Show what we already have from the list immediately...
    setEditingAdmin(admin);
    setFormData(formFromAdmin(admin));
    setFormErrors({});

    // ...then fetch the full record via GET /admin/admins/{admin} for any
    // fields the list endpoint doesn't include.
    setEditLoading(true);
    try {
      const full = await fetchById(admin.id);
      setEditingAdmin(full);
      setFormData(formFromAdmin(full));
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
    if (!editingAdmin && !formData.password.trim()) {
      errors.password = "Password is required";
    } else if (formData.password && formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Don't send an empty password on update — only include it if the
    // admin actually typed a new one.
    const payload = { ...formData };
    if (editingAdmin && !payload.password) {
      delete payload.password;
    }

    try {
      if (editingAdmin) {
        // Execute update via useCrud
        await updateItem(editingAdmin.id, payload);
        setEditingAdmin(null);
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
    if (!deletingAdmin) return;
    try {
      await deleteItem(deletingAdmin.id);
      setDeletingAdmin(null);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="admins-page-container">
      {/* Header Actions */}
      <div className="admins-page-header">
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
      <div className="admins-toolbar">
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

      {/* Admins Table Card */}
      <div className="admins-table-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Created Date</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && admins.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    <Database size={32} className="empty-icon" />
                    <p>No records found matching your query.</p>
                  </td>
                </tr>
              ) : (
                admins
                  .filter((admin) =>
                    !searchTerm ||
                    admin.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    admin.email?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((admin) => (
                  <tr key={admin.id} className="table-row">
                    <td>
                      <div className="user-cell">
                        <div className="user-cell-avatar">
                          {admin.name
                            ? admin.name.charAt(0).toUpperCase()
                            : "A"}
                        </div>
                        <div className="user-cell-meta">
                          <span className="user-cell-name">{admin.name}</span>
                          <span className="user-cell-email">{admin.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="role-tag">
                        <Shield size={12} />
                        {admin.role || "admin"}
                      </span>
                    </td>
                    <td className="cell-date">{admin.phone || "—"}</td>
                    <td className="cell-date">
                      {formatDate(admin.created_at)}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="action-icon-btn edit-btn"
                          title="Edit admin"
                          onClick={() => handleOpenEdit(admin)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn delete-btn"
                          title="Delete admin"
                          onClick={() => setDeletingAdmin(admin)}
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
            Showing {admins.length} of {pagination.total || admins.length} total
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
        isOpen={isCreateModalOpen || Boolean(editingAdmin)}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingAdmin(null);
        }}
        title={
          editingAdmin ? `Edit Admin #${editingAdmin.id}` : "Create New Admin"
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingAdmin(null);
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
              {editingAdmin ? "Save Changes" : "Create Admin"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="crud-form">
          {editingAdmin && editLoading && (
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
            label={editingAdmin ? "New Password (optional)" : "Password"}
            name="password"
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
            placeholder={
              editingAdmin
                ? "Leave blank to keep current password"
                : "e.g. ••••••••"
            }
            error={formErrors.password}
            required={!editingAdmin}
          />

          <div className="form-field">
            <label className="form-label">Role</label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value }))
              }
              className="input-control"
            >
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
            </select>
          </div>

          {editingAdmin && (
            <div className="readonly-info-grid">
              <div className="readonly-info-item">
                <span className="readonly-info-label">Email Verified</span>
                <span className="readonly-info-value">
                  {formatDate(editingAdmin.email_verified_at)}
                </span>
              </div>
              <div className="readonly-info-item">
                <span className="readonly-info-label">Last Updated</span>
                <span className="readonly-info-value">
                  {formatDate(editingAdmin.updated_at)}
                </span>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingAdmin)}
        onClose={() => setDeletingAdmin(null)}
        title="Confirm Admin Deletion"
        maxWidth="440px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingAdmin(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={actionLoading}
              icon={Trash2}
            >
              Delete Admin
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
              Are you sure you want to delete this admin?
            </p>
            <p className="delete-confirm-sub">
              This will remove <strong>{deletingAdmin?.name}</strong> (
              {deletingAdmin?.email}) from the system.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default AdminsPage;

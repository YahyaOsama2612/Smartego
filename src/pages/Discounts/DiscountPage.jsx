import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  TicketPercent,
  Filter,
  AlertTriangle,
  Database,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useCrud from "../../hooks/useCrud";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import "./DiscountPage.css";

// Live API endpoint. Passed as an absolute URL so it hits this host
// regardless of whatever baseURL axiosClient is configured with.
// GET (list), GET one, POST, PUT and DELETE all live under the same
// /admin/discounts base path, so a single endpoint covers every op.
const DISCOUNTS_ENDPOINT = "https://smartego.keeto.org/api/admin/discounts";

// Helper: strip out "unset" filter values so we don't send empty/ALL
// query params to the API.
// NOTE: `search` as a list filter isn't documented on the discounts
// endpoint the same way it is for admins — it's included here to keep
// the same filtering flow as AdminsPage. Drop it if unsupported.
const buildQueryParams = ({ search, perPage }) => {
  const params = {};
  if (search && search.trim()) params.search = search.trim();
  if (perPage) params.per_page = Number(perPage);
  return params;
};

// Helper: render an ISO timestamp as a short readable date
const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Helper: render an ISO timestamp for a <input type="datetime-local">
const toDateTimeLocal = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
};

// Helper: convert a datetime-local input value back to an ISO string
const toISOString = (localValue) => {
  if (!localValue) return "";
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
};

// Helper: display the discount amount according to its type
const formatAmount = (amount, type) => {
  if (amount === undefined || amount === null || amount === "") return "—";
  return type === "fixed" ? `${amount} EGP` : `${amount}%`;
};

export function DiscountsPage() {
  // Using the generic useCrud hook against the live admin/discounts endpoint
  const {
    items: discounts,
    loading,
    actionLoading,
    pagination,
    fetchList,
    fetchById,
    createItem,
    updateItem,
    deleteItem,
    refetch,
  } = useCrud(DISCOUNTS_ENDPOINT, {
    initialData: [],
    defaultParams: { page: 1, per_page: 10 },
  });

  const [searchTerm, setSearchTerm] = useState("");
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
  }, [searchTerm, perPage]);

  const goToPage = (nextPage) => {
    if (nextPage < 1) return;
    setPage(nextPage);
    fetchList(
      {
        page: nextPage,
        ...buildQueryParams({
          search: searchTerm,
          perPage,
        }),
      },
      { merge: false },
    ).catch(() => {});
  };

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [deletingDiscount, setDeletingDiscount] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Type is fixed to "percentage" — there's currently only one discount type.
  const emptyForm = {
    name: "",
    amount: "",
    type: "percentage",
    from: "",
    to: "",
  };

  // Form states
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const handleOpenCreate = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const formFromDiscount = (discount) => ({
    name: discount.name || "",
    amount: discount.amount ?? "",
    type: "percentage",
    from: toDateTimeLocal(discount.from),
    to: toDateTimeLocal(discount.to),
  });

  const handleOpenEdit = async (discount) => {
    // Show what we already have from the list immediately...
    setEditingDiscount(discount);
    setFormData(formFromDiscount(discount));
    setFormErrors({});

    // ...then fetch the full record via GET /admin/discounts/{id} for any
    // fields the list endpoint doesn't include.
    setEditLoading(true);
    try {
      const full = await fetchById(discount.id);
      setEditingDiscount(full);
      setFormData(formFromDiscount(full));
    } catch {
      // Keep the row data already shown; error is surfaced via the hook's `error` state
    } finally {
      setEditLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name.trim()) errors.name = "Discount name is required";
    if (formData.amount === "" || Number.isNaN(Number(formData.amount))) {
      errors.amount = "A valid amount is required";
    } else if (Number(formData.amount) <= 0) {
      errors.amount = "Amount must be greater than 0";
    }
    if (!formData.from) errors.from = "Start date is required";
    if (!formData.to) errors.to = "End date is required";
    if (
      formData.from &&
      formData.to &&
      new Date(formData.to) <= new Date(formData.from)
    ) {
      errors.to = "End date must be after the start date";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      name: formData.name.trim(),
      amount: Number(formData.amount),
      type: formData.type,
      from: toISOString(formData.from),
      to: toISOString(formData.to),
    };

    try {
      if (editingDiscount) {
        // Execute update via useCrud
        await updateItem(editingDiscount.id, payload);
        setEditingDiscount(null);
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
    if (!deletingDiscount) return;
    try {
      await deleteItem(deletingDiscount.id);
      setDeletingDiscount(null);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="discounts-page-container">
      {/* Header Actions */}
      <div className="discounts-page-header">
        <div className="page-header-actions">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={refetch}
            isLoading={loading}
          >
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            Create New Discount
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="discounts-toolbar">
        <div className="search-box">
          <Search size={16} className="search-box-icon" />
          <input
            type="text"
            placeholder="Search by discount name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-box-input"
          />
        </div>

        <div className="toolbar-filters">
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

      {/* Discounts Table Card */}
      <div className="discounts-table-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Discount</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Valid From</th>
                <th>Valid To</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && discounts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <Database size={32} className="empty-icon" />
                    <p>No discounts found matching your query.</p>
                  </td>
                </tr>
              ) : (
                discounts
                  .filter((discount) => !searchTerm || discount.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((discount) => (
                  <tr key={discount.id} className="table-row">
                    <td>
                      <div className="discount-cell">
                        <div className="discount-cell-icon">
                          <TicketPercent size={16} />
                        </div>
                        <span className="discount-cell-name">
                          {discount.name}
                        </span>
                      </div>
                    </td>
                    <td className="cell-amount">
                      {formatAmount(discount.amount, discount.type)}
                    </td>
                    <td>
                      <span
                        className={`type-tag type-${discount.type === "fixed" ? "fixed" : "percentage"}`}
                      >
                        {discount.type === "fixed" ? "Fixed" : "Percentage"}
                      </span>
                    </td>
                    <td className="cell-date">{formatDate(discount.from)}</td>
                    <td className="cell-date">{formatDate(discount.to)}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="action-icon-btn edit-btn"
                          title="Edit discount"
                          onClick={() => handleOpenEdit(discount)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn delete-btn"
                          title="Delete discount"
                          onClick={() => setDeletingDiscount(discount)}
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
            Showing {discounts.length} of {pagination.total || discounts.length}{" "}
            total entries
          </span>

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
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isCreateModalOpen || Boolean(editingDiscount)}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingDiscount(null);
        }}
        title={
          editingDiscount
            ? `Edit Discount #${editingDiscount.id}`
            : "Create New Discount"
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingDiscount(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={actionLoading}
              icon={TicketPercent}
            >
              {editingDiscount ? "Save Changes" : "Create Discount"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="crud-form">
          {editingDiscount && editLoading && (
            <p className="form-loading-hint">Loading full record…</p>
          )}

          <Input
            label="Discount Name"
            name="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="e.g. Summer Sale"
            error={formErrors.name}
            required
          />

          <Input
            label="Amount (%)"
            name="amount"
            type="number"
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, amount: e.target.value }))
            }
            placeholder="e.g. 15"
            error={formErrors.amount}
            required
          />

          <Input
            label="Valid From"
            name="from"
            type="datetime-local"
            icon={Calendar}
            value={formData.from}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, from: e.target.value }))
            }
            error={formErrors.from}
            required
          />

          <Input
            label="Valid To"
            name="to"
            type="datetime-local"
            icon={Calendar}
            value={formData.to}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, to: e.target.value }))
            }
            error={formErrors.to}
            required
          />

          {editingDiscount && (
            <div className="readonly-info-grid">
              <div className="readonly-info-item">
                <span className="readonly-info-label">Created</span>
                <span className="readonly-info-value">
                  {formatDate(editingDiscount.created_at)}
                </span>
              </div>
              <div className="readonly-info-item">
                <span className="readonly-info-label">Last Updated</span>
                <span className="readonly-info-value">
                  {formatDate(editingDiscount.updated_at)}
                </span>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingDiscount)}
        onClose={() => setDeletingDiscount(null)}
        title="Confirm Discount Deletion"
        maxWidth="440px"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeletingDiscount(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={actionLoading}
              icon={Trash2}
            >
              Delete Discount
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
              Are you sure you want to delete this discount?
            </p>
            <p className="delete-confirm-sub">
              This will remove <strong>{deletingDiscount?.name}</strong> and it
              will no longer be applied at checkout.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DiscountsPage;

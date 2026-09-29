import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Percent,
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
import "./Taxpage.css";

// Every operation goes through /admin/taxes:
//   GET    /admin/taxes          -> list
//   POST   /admin/taxes          -> create
//   GET    /admin/taxes/{tax}    -> get one
//   PUT    /admin/taxes/{tax}    -> update
//   DELETE /admin/taxes/{tax}    -> delete
const TAXES_ENDPOINT = "https://bcknd.smartego.org/api/admin/taxes";

// Percentage is the only tax type the API supports.
const TAX_TYPE = "percentage";

// Helper: strip out "unset" filter values so we don't send empty/ALL
// query params to the API.
const buildQueryParams = ({ search, paginate, perPage }) => {
  const params = {};
  if (search && search.trim()) params.search = search.trim();
  if (paginate !== "ALL") params.paginate = paginate === "true" ? 1 : 0;
  if (perPage) params.per_page = Number(perPage);
  return params;
};

// Helper: render the API's ISO timestamp as a short readable date
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

// Helper: the API returns `amount` as a string, so format it by tax type
const formatAmount = (tax) => {
  if (tax.amount === null || tax.amount === undefined || tax.amount === "") {
    return "—";
  }
  return `${tax.amount}%`;
};

export function TaxesPage() {
  const {
    items: taxes,
    loading,
    actionLoading,
    pagination,
    fetchList,
    fetchById,
    createItem,
    updateItem,
    deleteItem,
    refetch,
  } = useCrud(TAXES_ENDPOINT, {
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
    ).catch(() => { });
  };

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState(null);
  const [deletingTax, setDeletingTax] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const emptyForm = {
    name: "",
    amount: "",
  };

  // Form states
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const handleOpenCreate = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const formFromTax = (tax) => ({
    name: tax.name || "",
    amount:
      tax.amount === null || tax.amount === undefined ? "" : String(tax.amount),
  });

  const handleOpenEdit = async (tax) => {
    // Show what we already have from the list immediately...
    setEditingTax(tax);
    setFormData(formFromTax(tax));
    setFormErrors({});

    // ...then fetch the full record via GET /admin/taxes/{tax} for any
    // fields the list endpoint doesn't include.
    setEditLoading(true);
    try {
      const full = await fetchById(tax.id);
      setEditingTax(full);
      setFormData(formFromTax(full));
    } catch {
      // Keep the row data already shown; error is surfaced via the hook's `error` state
    } finally {
      setEditLoading(false);
    }
  };

  const closeFormModal = () => {
    setIsCreateModalOpen(false);
    setEditingTax(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name.trim()) errors.name = "Tax name is required";

    const amountStr = String(formData.amount).trim();
    const amountNum = Number(amountStr);
    if (!amountStr) {
      errors.amount = "Amount is required";
    } else if (Number.isNaN(amountNum) || amountNum < 0) {
      errors.amount = "Amount must be a positive number";
    } else if (amountNum > 100) {
      errors.amount = "A percentage tax cannot exceed 100";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // The API expects `amount` as a number (it returns it as a string)
    const payload = {
      name: formData.name.trim(),
      amount: amountNum,
      type: TAX_TYPE,
    };

    try {
      if (editingTax) {
        await updateItem(editingTax.id, payload);
        setEditingTax(null);
      } else {
        await createItem(payload);
        setIsCreateModalOpen(false);
      }
    } catch {
      // Error handled by hook
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTax) return;
    try {
      await deleteItem(deletingTax.id);
      setDeletingTax(null);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="taxes-page-container">
      {/* Header Actions */}
      <div className="taxes-page-header">
        <div className="taxes-page-header-actions">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={refetch}
            isLoading={loading}
          >
            Refresh
          </Button>
          <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            Create New Tax
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="taxes-toolbar">
        <div className="taxes-search-box">
          <Search size={16} className="taxes-search-box-icon" />
          <input
            type="text"
            placeholder="Search by tax name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="taxes-search-box-input"
          />
        </div>

        <div className="taxes-toolbar-filters">
          <div className="taxes-filter-group">
            <Filter size={16} className="taxes-filter-icon" />
            <select
              value={paginateFilter}
              onChange={(e) => setPaginateFilter(e.target.value)}
              className="taxes-filter-select"
            >
              <option value="ALL">Paginate: Not Set</option>
              <option value="true">Paginate: True</option>
              <option value="false">Paginate: False</option>
            </select>
          </div>

          <div className="taxes-filter-group">
            <Filter size={16} className="taxes-filter-icon" />
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="taxes-filter-select"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Taxes Table Card */}
      <div className="taxes-table-card">
        <div className="taxes-table-responsive">
          <table className="taxes-table">
            <thead>
              <tr>
                <th>Tax</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Created Date</th>
                <th className="taxes-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && taxes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="taxes-empty-state">
                    <Database size={32} className="taxes-empty-icon" />
                    <p>No records found matching your query.</p>
                  </td>
                </tr>
              ) : (
                taxes
                  .filter((tax) => !searchTerm || tax.name?.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((tax) => (
                    <tr key={tax.id} className="taxes-table-row">
                      <td>
                        <div className="taxes-name-cell">
                          <div className="taxes-name-avatar">
                            {tax.name ? tax.name.charAt(0).toUpperCase() : "T"}
                          </div>
                          <div className="taxes-name-meta">
                            <span className="taxes-name-title">{tax.name}</span>
                            <span className="taxes-name-sub">#{tax.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="taxes-type-tag">
                          <Percent size={12} />
                          {tax.type || "—"}
                        </span>
                      </td>
                      <td className="taxes-cell-amount">{formatAmount(tax)}</td>
                      <td className="taxes-cell-muted">
                        {formatDate(tax.created_at)}
                      </td>
                      <td>
                        <div className="taxes-actions-cell">
                          <button
                            type="button"
                            className="taxes-action-icon-btn taxes-edit-btn"
                            title="Edit tax"
                            onClick={() => handleOpenEdit(tax)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            className="taxes-action-icon-btn taxes-delete-btn"
                            title="Delete tax"
                            onClick={() => setDeletingTax(tax)}
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
        <div className="taxes-table-footer">
          <span>
            Showing {taxes.length} of {pagination.total || taxes.length} total
            entries
          </span>

          {paginateFilter === "true" && (
            <div className="taxes-pagination-controls">
              <button
                type="button"
                className="taxes-action-icon-btn"
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
                className="taxes-action-icon-btn"
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
        isOpen={isCreateModalOpen || Boolean(editingTax)}
        onClose={closeFormModal}
        title={editingTax ? `Edit Tax #${editingTax.id}` : "Create New Tax"}
        footer={
          <>
            <Button variant="secondary" onClick={closeFormModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={actionLoading}
              icon={Check}
            >
              {editingTax ? "Save Changes" : "Create Tax"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="taxes-crud-form">
          {editingTax && editLoading && (
            <p className="taxes-form-loading-hint">Loading full record…</p>
          )}

          <Input
            label="Tax Name"
            name="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="e.g. VAT"
            error={formErrors.name}
            required
          />

          <Input
            label="Amount (%)"
            name="amount"
            type="number"
            min="0"
            step="any"
            value={formData.amount}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, amount: e.target.value }))
            }
            placeholder="e.g. 14"
            error={formErrors.amount}
            required
          />

          {editingTax && (
            <div className="taxes-readonly-info-grid">
              <div className="taxes-readonly-info-item">
                <span className="taxes-readonly-info-label">Created</span>
                <span className="taxes-readonly-info-value">
                  {formatDate(editingTax.created_at)}
                </span>
              </div>
              <div className="taxes-readonly-info-item">
                <span className="taxes-readonly-info-label">Last Updated</span>
                <span className="taxes-readonly-info-value">
                  {formatDate(editingTax.updated_at)}
                </span>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingTax)}
        onClose={() => setDeletingTax(null)}
        title="Confirm Tax Deletion"
        maxWidth="440px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingTax(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={actionLoading}
              icon={Trash2}
            >
              Delete Tax
            </Button>
          </>
        }
      >
        <div className="taxes-delete-confirm-body">
          <div className="taxes-delete-warning-icon">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="taxes-delete-confirm-title">
              Are you sure you want to delete this tax?
            </p>
            <p className="taxes-delete-confirm-sub">
              This will remove <strong>{deletingTax?.name}</strong> (
              {deletingTax ? formatAmount(deletingTax) : ""}) from the system.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default TaxesPage;

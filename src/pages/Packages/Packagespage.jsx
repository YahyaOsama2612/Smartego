import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  RefreshCw,
  Package as PackageIcon,
  Filter,
  AlertTriangle,
  Database,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useCrud from "../../hooks/useCrud";
import useTaxDiscountOptions from "./Usetaxdiscountoptions";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
import "./PackagesPage.css";

// Live API endpoint. Passed as an absolute URL so it hits this host
// regardless of whatever baseURL axiosClient is configured with.
// GET (list), GET one, POST, PUT and DELETE all live under the same
// /admin/packages base path, so a single endpoint covers every op.
const PACKAGES_ENDPOINT = "https://smartego.keeto.org/api/admin/packages";

// Helper: strip out "unset" filter values so we don't send empty/ALL
// query params to the API.
// NOTE: only `per_page` is documented on /admin/packages. `search` is
// included here to keep the same filtering flow as the other admin
// pages — drop it if the backend doesn't support it.
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

// Helper: render a price value with currency
const formatPrice = (price) => {
  if (price === undefined || price === null || price === "") return "—";
  return `${price} EGP`;
};

// The API's `name` field is a per-locale object: { en, ar }.
// `nameToDisplay` picks a single label to show in the table/confirm text
// (English first, falling back to Arabic).
const nameToDisplay = (name) => {
  if (!name || typeof name !== "object") return "";
  return name.en || name.ar || "";
};

// Helper: look up a reference option's display name by id, e.g. resolving
// a package's discount_id/tax_id against the tax-and-discount-list options
const findOptionLabel = (options, id) => {
  if (id === undefined || id === null || id === "") return "—";
  const match = options.find((o) => String(o.id) === String(id));
  return match ? match.name : `#${id}`;
};

export function PackagesPage() {
  // Using the generic useCrud hook against the live admin/packages endpoint
  const {
    items: packages,
    loading,
    actionLoading,
    pagination,
    fetchList,
    fetchById,
    createItem,
    updateItem,
    deleteItem,
    refetch,
  } = useCrud(PACKAGES_ENDPOINT, {
    initialData: [],
    defaultParams: { page: 1, per_page: 10 },
  });

  // Reference lists for the Discount / Tax select dropdowns, sourced from
  // the separate /admin/tax-and-discount-list lookup endpoint
  const { discounts: discountOptions, taxes: taxOptions } =
    useTaxDiscountOptions();

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
  const [editingPackage, setEditingPackage] = useState(null);
  const [deletingPackage, setDeletingPackage] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const emptyForm = {
    nameEn: "",
    nameAr: "",
    price: "",
    msgNumber: "",
    months: "",
    discountId: "",
    taxId: "",
    type: "whats",
  };

  // Form states
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const handleOpenCreate = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const formFromPackage = (pkg) => ({
    nameEn: pkg.name?.en || "",
    nameAr: pkg.name?.ar || "",
    price: pkg.price ?? "",
    msgNumber: pkg.msg_number ?? "",
    months: pkg.months ?? "",
    discountId: pkg.discount_id ?? "",
    taxId: pkg.tax_id ?? "",
    type: ["messenger", "all"].includes(pkg.type) ? pkg.type : "whats",
  });

  const handleOpenEdit = async (pkg) => {
    // Show what we already have from the list immediately...
    setEditingPackage(pkg);
    setFormData(formFromPackage(pkg));
    setFormErrors({});

    // ...then fetch the full record via GET /admin/packages/{id} for any
    // fields the list endpoint doesn't include.
    setEditLoading(true);
    try {
      const full = await fetchById(pkg.id);
      setEditingPackage(full);
      setFormData(formFromPackage(full));
    } catch {
      // Keep the row data already shown; error is surfaced via the hook's `error` state
    } finally {
      setEditLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.nameEn.trim()) errors.nameEn = "English name is required";
    if (!formData.nameAr.trim()) errors.nameAr = "Arabic name is required";
    if (formData.price === "" || Number.isNaN(Number(formData.price))) {
      errors.price = "A valid price is required";
    } else if (Number(formData.price) <= 0) {
      errors.price = "Price must be greater than 0";
    }
    if (
      formData.msgNumber === "" ||
      Number.isNaN(Number(formData.msgNumber)) ||
      Number(formData.msgNumber) < 0
    ) {
      errors.msgNumber = "A valid message count is required";
    }
    if (
      formData.months === "" ||
      Number.isNaN(Number(formData.months)) ||
      Number(formData.months) <= 0
    ) {
      errors.months = "A valid number of months is required";
    }
    if (!["whats", "messenger", "all"].includes(formData.type)) {
      errors.type = "Please select a valid package type";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      name: {
        en: formData.nameEn.trim(),
        ar: formData.nameAr.trim(),
      },
      price: Number(formData.price),
      msg_number: Number(formData.msgNumber),
      months: Number(formData.months),
      discount_id: formData.discountId ? Number(formData.discountId) : null,
      tax_id: formData.taxId ? Number(formData.taxId) : null,
      type: formData.type,
    };

    try {
      if (editingPackage) {
        // Execute update via useCrud
        await updateItem(editingPackage.id, payload);
        setEditingPackage(null);
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
    if (!deletingPackage) return;
    try {
      await deleteItem(deletingPackage.id);
      setDeletingPackage(null);
    } catch {
      // Error handled by hook
    }
  };

  return (
    <div className="packages-page-container">
      {/* Header Actions */}
      <div className="packages-page-header">
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
            Create New Package
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="packages-toolbar">
        <div className="search-box">
          <Search size={16} className="search-box-icon" />
          <input
            type="text"
            placeholder="Search by package name..."
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

      {/* Packages Table Card */}
      <div className="packages-table-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Price</th>
                <th>Messages</th>
                <th>Months</th>
                <th>Discount</th>
                <th>Tax</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && packages.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    <Database size={32} className="empty-icon" />
                    <p>No packages found matching your query.</p>
                  </td>
                </tr>
              ) : (
                packages
                  .filter((pkg) =>
                    !searchTerm ||
                    nameToDisplay(pkg.name).toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((pkg) => (
                  <tr key={pkg.id} className="table-row">
                    <td>
                      <div className="discount-cell">
                        <div className="discount-cell-icon">
                          <PackageIcon size={16} />
                        </div>
                        <span className="discount-cell-name">
                          {nameToDisplay(pkg.name)}
                        </span>
                      </div>
                    </td>
                    <td className="cell-amount">{formatPrice(pkg.price)}</td>
                    <td className="cell-amount">{pkg.msg_number ?? "—"}</td>
                    <td className="cell-amount">{pkg.months ?? "—"}</td>
                    <td>
                      <span className="type-tag type-percentage">
                        {findOptionLabel(discountOptions, pkg.discount_id)}
                      </span>
                    </td>
                    <td>
                      <span className="type-tag type-neutral">
                        {findOptionLabel(taxOptions, pkg.tax_id)}
                      </span>
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          type="button"
                          className="action-icon-btn edit-btn"
                          title="Edit package"
                          onClick={() => handleOpenEdit(pkg)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className="action-icon-btn delete-btn"
                          title="Delete package"
                          onClick={() => setDeletingPackage(pkg)}
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
            Showing {packages.length} of {pagination.total || packages.length}{" "}
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
        isOpen={isCreateModalOpen || Boolean(editingPackage)}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingPackage(null);
        }}
        title={
          editingPackage
            ? `Edit Package #${editingPackage.id}`
            : "Create New Package"
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingPackage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={actionLoading}
              icon={PackageIcon}
            >
              {editingPackage ? "Save Changes" : "Create Package"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="crud-form">
          {editingPackage && editLoading && (
            <p className="form-loading-hint">Loading full record…</p>
          )}

          <div className="form-row">
            <Input
              label="Package Name (English)"
              name="nameEn"
              value={formData.nameEn}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nameEn: e.target.value }))
              }
              placeholder="e.g. Gold Plan"
              error={formErrors.nameEn}
              required
            />

            <Input
              label="Package Name (Arabic)"
              name="nameAr"
              value={formData.nameAr}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, nameAr: e.target.value }))
              }
              placeholder="مثال: الباقة الذهبية"
              error={formErrors.nameAr}
              required
            />
          </div>

          <div className="form-row">
            <Input
              label="Price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, price: e.target.value }))
              }
              placeholder="e.g. 49.99"
              error={formErrors.price}
              required
            />

            <Input
              label="Months"
              name="months"
              type="number"
              min="1"
              step="1"
              value={formData.months}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, months: e.target.value }))
              }
              placeholder="e.g. 1"
              error={formErrors.months}
              required
            />
          </div>

          <Input
            label="Message Count"
            name="msgNumber"
            type="number"
            min="0"
            step="1"
            value={formData.msgNumber}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, msgNumber: e.target.value }))
            }
            placeholder="e.g. 1000"
            error={formErrors.msgNumber}
            required
          />

          <div className="form-select-group">
            <label className="form-select-label" htmlFor="type">
              Type
            </label>
            <select
              id="type"
              className="form-select"
              value={formData.type}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, type: e.target.value }))
              }
              required
            >
              <option value="whats">WhatsApp</option>
              <option value="messenger">Messenger</option>
              <option value="all">All</option>
            </select>
            {formErrors.type && (
              <span className="form-error">{formErrors.type}</span>
            )}
          </div>

          <div className="form-row">
            <div className="form-select-group">
              <label className="form-select-label" htmlFor="discountId">
                Discount
              </label>
              <select
                id="discountId"
                className="form-select"
                value={formData.discountId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    discountId: e.target.value,
                  }))
                }
              >
                <option value="">None</option>
                {discountOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-select-group">
              <label className="form-select-label" htmlFor="taxId">
                Tax
              </label>
              <select
                id="taxId"
                className="form-select"
                value={formData.taxId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, taxId: e.target.value }))
                }
              >
                <option value="">None</option>
                {taxOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {editingPackage && (
            <div className="readonly-info-grid">
              <div className="readonly-info-item">
                <span className="readonly-info-label">Created</span>
                <span className="readonly-info-value">
                  {formatDate(editingPackage.created_at)}
                </span>
              </div>
              <div className="readonly-info-item">
                <span className="readonly-info-label">Last Updated</span>
                <span className="readonly-info-value">
                  {formatDate(editingPackage.updated_at)}
                </span>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingPackage)}
        onClose={() => setDeletingPackage(null)}
        title="Confirm Package Deletion"
        maxWidth="440px"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeletingPackage(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              isLoading={actionLoading}
              icon={Trash2}
            >
              Delete Package
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
              Are you sure you want to delete this package?
            </p>
            <p className="delete-confirm-sub">
              This will remove{" "}
              <strong>{nameToDisplay(deletingPackage?.name)}</strong> and it
              will no longer be available for purchase.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PackagesPage;

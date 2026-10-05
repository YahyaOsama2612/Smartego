import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Search,
  RefreshCw,
  ShoppingCart,
  Filter,
  Check,
  X,
  AlertTriangle,
  Database,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useCrud from "../../hooks/useCrud";
import axiosClient from "../../api/axiosClient"; // TODO: adjust path to your axios instance
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import Modal from "../../components/common/Modal";
// Shared table / toolbar / modal styles come from the Packages page.
// TODO: adjust path, or move the shared rules into a common stylesheet.

import "./OrderPage";

const BASE = "https://bcknd.smartego.org/api/admin/orders";
const ORDERS_ENDPOINT = BASE; // GET list, POST create
const LOOKUP_ENDPOINT = `${BASE}/lookup`; // GET { users, packages } (same shape as /orders/lists)

const emptyFilters = {
  search: "",
  status: "",
  channel: "",
  packageId: "",
  userId: "",
  perPage: 10,
};

// Strip unset filters and map camelCase -> API param names
const buildQueryParams = (f) => {
  // Laravel's `boolean` rule rejects the string "true" in a query string, so send 1
  const params = { paginate: 1, per_page: Number(f.perPage) };
  if (f.search.trim()) params.search = f.search.trim();
  if (f.status) params.status = f.status;
  if (f.channel) params.channel = f.channel;
  if (f.packageId) params.package_id = Number(f.packageId);
  if (f.userId) params.user_id = Number(f.userId);
  return params;
};

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

// Prices are in Egyptian pounds
const formatPrice = (price) =>
  price === undefined || price === null || price === "" ? "—" : `${price} EGP`;

// Package `name` is a per-locale object { en, ar } (docs show it as null/array)
const nameToDisplay = (name) => {
  if (!name || typeof name !== "object")
    return typeof name === "string" ? name : "";
  return name.en || name.ar || "";
};

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const errorMessage = (err) =>
  err?.response?.data?.message || err?.message || "Something went wrong.";

// Lookup lists (users + packages) used by the filters and the create form
function useOrderLookups() {
  const [lookups, setLookups] = useState({ users: [], packages: [] });
  useEffect(() => {
    let cancelled = false;
    axiosClient
      .get(LOOKUP_ENDPOINT)
      .then((res) => {
        // Works whether or not axiosClient unwraps response.data
        const data = res?.data?.data ?? res?.data ?? {};
        if (!cancelled)
          setLookups({
            users: data.users || [],
            packages: data.packages || [],
          });
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);
  return lookups;
}

export function OrdersPage() {
  const {
    items: orders,
    loading,
    actionLoading,
    error,
    pagination,
    fetchList,
    createItem,
    refetch,
  } = useCrud(ORDERS_ENDPOINT, {
    initialData: [],
    defaultParams: { page: 1, per_page: 10, paginate: 1 },
  });

  const { users, packages } = useOrderLookups();

  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const isFirstRun = useRef(true);

  const setFilter = (key) => (e) =>
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));

  const load = (nextPage) =>
    fetchList(
      { page: nextPage, ...buildQueryParams(filters) },
      { merge: false },
    ).catch(() => { });

  // Refetch on any filter change (debounced for search); skip the mount run
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const handle = setTimeout(
      () => {
        setPage(1);
        load(1);
      },
      filters.search ? 400 : 0,
    );
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const goToPage = (nextPage) => {
    if (nextPage < 1) return;
    setPage(nextPage);
    load(nextPage);
  };

  // ---- Create order ----
  const emptyForm = { userId: "", packageId: "", from: nowLocal() };
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [formErrors, setFormErrors] = useState({});

  const handleOpenCreate = () => {
    setFormData({ ...emptyForm, from: nowLocal() });
    setFormErrors({});
    setIsCreateOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    // Order creation is disabled for now — kept here (commented) for when
    // this flow is wired back up.
    // const errors = {};
    // if (!formData.userId) errors.userId = "Select a customer";
    // if (!formData.packageId) errors.packageId = "Select a package";
    // if (!formData.from) errors.from = "Start date is required";
    // if (Object.keys(errors).length) {
    //   setFormErrors(errors);
    //   return;
    // }
    // try {
    //   await createItem({
    //     user_id: Number(formData.userId),
    //     package_id: Number(formData.packageId),
    //     from: new Date(formData.from).toISOString(),
    //   });
    //   setIsCreateOpen(false);
    //   setPage(1);
    //   load(1);
    // } catch {
    //   // Error surfaced via the hook's `error` state
    // }
  };

  // ---- Approve / Reject ----
  const [approvingOrder, setApprovingOrder] = useState(null);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // All three fields below are optional; ai_file is uploaded by the admin
  // via a file input.
  const emptyApproveForm = { aiContext: "", websiteUrl: "", aiFile: null };
  const [approveForm, setApproveForm] = useState(emptyApproveForm);

  const openApprove = (order) => {
    setApproveForm(emptyApproveForm);
    setApprovingOrder(order);
  };

  // Runs an approve/reject request, then reloads the current page
  const runStatusAction = async (request) => {
    setStatusLoading(true);
    setActionError("");
    try {
      await request();
      await load(page);
      return true;
    } catch (err) {
      setActionError(errorMessage(err));
      return false;
    } finally {
      setStatusLoading(false);
    }
  };

  const handleConfirmApprove = async () => {
    if (!approvingOrder) return;
    const ok = await runStatusAction(() => {
      // All fields are optional — only send the ones the admin filled in.
      // ai_file is a real upload, so this goes as multipart/form-data.
      const body = new FormData();
      if (approveForm.aiContext.trim())
        body.append("ai_context", approveForm.aiContext.trim());
      if (approveForm.websiteUrl.trim())
        body.append("website_url", approveForm.websiteUrl.trim());
      if (approveForm.aiFile) body.append("ai_file", approveForm.aiFile);

      return axiosClient.post(
        `${ORDERS_ENDPOINT}/${approvingOrder.id}/approve`,
        body,
      );
    });
    if (ok) setApprovingOrder(null);
  };

  const handleConfirmReject = async () => {
    if (!rejectingOrder) return;
    // Reason is optional — only include it if the admin typed one.
    const ok = await runStatusAction(() => {
      const body = {};
      if (rejectReason.trim()) body.reason = rejectReason.trim();
      return axiosClient.post(
        `${ORDERS_ENDPOINT}/${rejectingOrder.id}/reject`,
        body,
      );
    });
    if (ok) setRejectingOrder(null);
  };

  const openReject = (order) => {
    setRejectReason("");
    setRejectError("");
    setRejectingOrder(order);
  };

  const shownError = actionError || error;

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
          {/*    <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
            Create New Order
          </Button> */}
        </div>
      </div>

      {shownError && (
        <div className="orders-error" role="alert">
          {typeof shownError === "string"
            ? shownError
            : errorMessage(shownError)}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="packages-toolbar">
        <div className="search-box">
          <Search size={16} className="search-box-icon" />
          <input
            type="text"
            placeholder="Search orders..."
            value={filters.search}
            onChange={setFilter("search")}
            className="search-box-input"
          />
        </div>

        <div className="toolbar-filters">
          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={filters.status}
              onChange={setFilter("status")}
              className="filter-select"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={filters.channel}
              onChange={setFilter("channel")}
              className="filter-select"
            >
              <option value="">All channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="messenger">Messenger</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>

          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={filters.packageId}
              onChange={setFilter("packageId")}
              className="filter-select"
            >
              <option value="">All packages</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameToDisplay(p.name) || `#${p.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={filters.userId}
              onChange={setFilter("userId")}
              className="filter-select"
            >
              <option value="">All customers</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email || `#${u.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select
              value={filters.perPage}
              onChange={setFilter("perPage")}
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

      {/* Orders Table Card */}
      <div className="packages-table-card">
        <div className="table-responsive">
          <table className="custom-table orders-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Package</th>
                <th>Total</th>
                <th>Messages</th>
                <th>Period</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Created</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-state">
                    <p>Loading orders…</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-state">
                    <Database size={32} className="empty-icon" />
                    <p>No orders match your filters.</p>
                  </td>
                </tr>
              ) : (
                orders
                  .filter((order) => {
                    if (!filters.search) return true;
                    const term = filters.search.toLowerCase();
                    const custName = (order.user?.name || order.user_name || "").toLowerCase();
                    const custPhone = (order.user?.phone || order.user_phone || "").toLowerCase();
                    const pkgName = (nameToDisplay(order.package?.name) || nameToDisplay(order.package_name) || "").toLowerCase();
                    return custName.includes(term) || custPhone.includes(term) || pkgName.includes(term) || String(order.id).includes(term);
                  })
                  .map((order) => {
                    const customerName =
                      order.user?.name || order.user_name || "—";
                    const customerPhone =
                      order.user?.phone || order.user_phone || "";
                    const packageName =
                      nameToDisplay(order.package?.name) ||
                      nameToDisplay(order.package_name) ||
                      "—";
                    return (
                      <tr key={order.id} className="table-row">
                        <td className="cell-amount">#{order.id}</td>
                        <td>
                          <div
                            className="orders-customer"
                            title={`${customerName} ${customerPhone}`.trim()}
                          >
                            <span className="orders-avatar">
                              {customerName.charAt(0).toUpperCase()}
                            </span>
                            <span className="orders-truncate orders-customer-name">
                              {customerName}
                            </span>
                            {customerPhone && (
                              <span className="orders-subtext">
                                {customerPhone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span
                            className="type-tag type-neutral orders-truncate orders-package-tag"
                            title={packageName}
                          >
                            {packageName}
                          </span>
                        </td>
                        <td>
                          <div
                            className="orders-price-row"
                            title="Base price − discount + tax"
                          >
                            <span className="cell-amount">
                              {formatPrice(order.final_price)}
                            </span>
                            <span className="orders-subtext">
                              ({order.price ?? 0} − {order.total_discount ?? 0} +{" "}
                              {order.total_tax ?? 0})
                            </span>
                          </div>
                        </td>
                        <td className="cell-amount">{order.msgs ?? "—"}</td>
                        <td className="cell-date">
                          {formatDate(order.from)} → {formatDate(order.to)}
                        </td>
                        <td>
                          <span
                            className={`type-tag ${order.channel === "messenger"
                              ? "type-fixed"
                              : "type-percentage"
                              }`}
                          >
                            {order.channel || "—"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`type-tag order-status order-status-${order.status || "unknown"}`}
                          >
                            {order.status || "—"}
                          </span>
                        </td>
                        <td className="cell-date">
                          {formatDate(order.created_at)}
                        </td>
                        <td>
                          <div className="actions-cell">
                            {order.status === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  className="action-icon-btn edit-btn"
                                  title="Approve order"
                                  onClick={() => openApprove(order)}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="action-icon-btn delete-btn"
                                  title="Reject order"
                                  onClick={() => openReject(order)}
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <span className="cell-date">—</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="table-footer-bar">
          <span>
            Showing {orders.length} of {pagination.total || orders.length} total
            entries
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

      {/* CREATE MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Order"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              isLoading={actionLoading}
              icon={ShoppingCart}
            >
              Create Order
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="crud-form">
          <div className="form-select-group">
            <label className="form-select-label" htmlFor="orderUserId">
              Customer
            </label>
            <select
              id="orderUserId"
              className="form-select"
              value={formData.userId}
              onChange={(e) =>
                setFormData((p) => ({ ...p, userId: e.target.value }))
              }
            >
              <option value="">Select a customer</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email || `#${u.id}`}
                </option>
              ))}
            </select>
            {formErrors.userId && (
              <span className="orders-field-error">{formErrors.userId}</span>
            )}
          </div>

          <div className="form-select-group">
            <label className="form-select-label" htmlFor="orderPackageId">
              Package
            </label>
            <select
              id="orderPackageId"
              className="form-select"
              value={formData.packageId}
              onChange={(e) =>
                setFormData((p) => ({ ...p, packageId: e.target.value }))
              }
            >
              <option value="">Select a package</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {nameToDisplay(p.name) || `#${p.id}`}
                </option>
              ))}
            </select>
            {formErrors.packageId && (
              <span className="orders-field-error">{formErrors.packageId}</span>
            )}
          </div>

          <Input
            label="Start date"
            name="from"
            type="datetime-local"
            value={formData.from}
            onChange={(e) =>
              setFormData((p) => ({ ...p, from: e.target.value }))
            }
            error={formErrors.from}
            required
          />
        </form>
      </Modal>

      {/* APPROVE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(approvingOrder)}
        onClose={() => setApprovingOrder(null)}
        title="Approve Order"
        maxWidth="440px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApprovingOrder(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmApprove}
              isLoading={statusLoading}
              icon={Check}
            >
              Approve Order
            </Button>
          </>
        }
      >
        <div className="delete-confirm-body">
          <div className="delete-warning-icon orders-approve-icon">
            <Check size={28} />
          </div>
          <div>
            <p className="delete-confirm-title">Approve this order?</p>
            <p className="delete-confirm-sub">
              Order <strong>#{approvingOrder?.id}</strong> for{" "}
              <strong>
                {approvingOrder?.user?.name || approvingOrder?.user_name}
              </strong>{" "}
              will be activated.
            </p>
          </div>
        </div>

        <div className="crud-form">
          <Input
            label="AI Context (optional)"
            name="aiContext"
            value={approveForm.aiContext}
            onChange={(e) =>
              setApproveForm((p) => ({ ...p, aiContext: e.target.value }))
            }
            placeholder="e.g. Notes for the AI to use"
          />

          <Input
            label="Website URL (optional)"
            name="websiteUrl"
            type="url"
            value={approveForm.websiteUrl}
            onChange={(e) =>
              setApproveForm((p) => ({ ...p, websiteUrl: e.target.value }))
            }
            placeholder="https://example.com"
          />

          <div className="form-select-group">
            <label className="form-select-label" htmlFor="aiFile">
              AI File (optional)
            </label>
            <input
              id="aiFile"
              type="file"
              onChange={(e) =>
                setApproveForm((p) => ({
                  ...p,
                  aiFile: e.target.files?.[0] || null,
                }))
              }
            />
          </div>
        </div>
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        isOpen={Boolean(rejectingOrder)}
        onClose={() => setRejectingOrder(null)}
        title="Reject Order"
        maxWidth="440px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectingOrder(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmReject}
              isLoading={statusLoading}
              icon={X}
            >
              Reject Order
            </Button>
          </>
        }
      >
        <div className="crud-form">
          <div className="delete-confirm-body">
            <div className="delete-warning-icon">
              <AlertTriangle size={28} />
            </div>
            <div>
              <p className="delete-confirm-title">
                Reject order #{rejectingOrder?.id}?
              </p>
              <p className="delete-confirm-sub">
                Tell the customer why. This reason is sent with the rejection.
              </p>
            </div>
          </div>
          <div className="form-select-group">
            <label className="form-select-label" htmlFor="rejectReason">
              Reason (optional)
            </label>
            <textarea
              id="rejectReason"
              className="form-textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                setRejectError("");
              }}
              placeholder="e.g. Payment could not be verified (optional)"
            />
            {rejectError && (
              <span className="orders-field-error">{rejectError}</span>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default OrdersPage;
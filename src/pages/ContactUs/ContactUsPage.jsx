import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  Mail,
  Phone,
  RefreshCw,
} from "lucide-react";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import "./ContactUsPage.css";

const CONTACT_US_ENDPOINT = "/admin/contact_us";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const getErrorMessage = (error) => {
  const responseData = error.response?.data;
  if (typeof responseData?.message === "string") return responseData.message;
  if (typeof responseData?.error === "string") return responseData.error;
  if (typeof error.message === "string") return error.message;
  return "Couldn't load contact messages.";
};

const getContactList = (responseData) => {
  if (responseData?.status === false) {
    throw new Error(responseData.message || "The server couldn't load contact messages.");
  }

  const payload = responseData?.data ?? responseData;
  if (Array.isArray(payload)) {
    return { contacts: payload, pagination: responseData?.pagination ?? {} };
  }
  if (payload && typeof payload === "object" && Array.isArray(payload.data)) {
    return { contacts: payload.data, pagination: payload };
  }

  throw new Error("The server returned an unexpected contact list response.");
};

const getField = (contact, ...keys) => {
  for (const key of keys) {
    const value = contact?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const displayValue = (value) => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return "—";
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return displayValue(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function ContactUsPage() {
  const [contacts, setContacts] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: null,
    to: null,
    hasPrevious: false,
    hasNext: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadContacts = useCallback(async (signal) => {
    if (signal.aborted) return;

    setLoading(true);
    setError("");

    try {
      const response = await axiosClient.get(CONTACT_US_ENDPOINT, {
        params: { page, per_page: perPage },
        signal,
      });
      const { contacts: records, pagination: meta } = getContactList(response.data);
      const currentPage = Math.max(1, Number(meta.current_page) || page);
      const lastPage = Math.max(1, Number(meta.last_page) || 1);

      setContacts(records);
      setPagination({
        currentPage,
        lastPage,
        total: Number(meta.total) || records.length,
        from: meta.from ?? null,
        to: meta.to ?? null,
        hasPrevious: Boolean(meta.prev_page_url) || currentPage > 1,
        hasNext: Boolean(meta.next_page_url) || currentPage < lastPage,
      });
    } catch (requestError) {
      if (!signal.aborted) setError(getErrorMessage(requestError));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [page, perPage]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadContacts(controller.signal));
    return () => controller.abort();
  }, [loadContacts, refreshKey]);

  const refresh = () => setRefreshKey((key) => key + 1);

  const changePageSize = (event) => {
    setPerPage(Number(event.target.value));
    setPage(1);
  };

  return (
    <section className="contact-us-page">
      <div className="contact-us-page-header">
        <p>View messages submitted through the contact form.</p>
        <Button
          variant="outline"
          icon={RefreshCw}
          onClick={refresh}
          isLoading={loading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="contact-us-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <Button variant="outline" onClick={refresh}>Try again</Button>
        </div>
      )}

      <div className="contact-us-table-card">
        <div className="contact-us-table-responsive">
          <table className="contact-us-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Subject</th>
                <th>Message</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !error && contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="contact-us-empty-state">
                    <Database size={30} />
                    <span>No contact messages found.</span>
                  </td>
                </tr>
              ) : (
                contacts.map((contact, index) => {
                  const name = getField(contact, "name", "f_name", "user_name");
                  const email = getField(contact, "email", "user_email");
                  const phone = getField(contact, "phone", "phone_number", "user_phone");
                  const id = getField(contact, "id");

                  return (
                    <tr key={id ?? `${pagination.currentPage}-${index}`}>
                      <td>{displayValue(name)}</td>
                      <td>
                        {email ? (
                          <a href={`mailto:${displayValue(email)}`}>
                            <Mail size={14} />
                            {displayValue(email)}
                          </a>
                        ) : "—"}
                      </td>
                      <td>
                        {phone ? (
                          <a href={`tel:${displayValue(phone)}`}>
                            <Phone size={14} />
                            {displayValue(phone)}
                          </a>
                        ) : "—"}
                      </td>
                      <td>{displayValue(getField(contact, "subject", "title"))}</td>
                      <td className="contact-us-message">
                        {displayValue(getField(contact, "message", "body", "description"))}
                      </td>
                      <td className="contact-us-date">
                        {formatDate(getField(contact, "created_at", "createdAt", "date"))}
                      </td>
                    </tr>
                  );
                })
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="contact-us-loading">Loading contact messages…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="contact-us-table-footer">
          <span>
            {pagination.total === 0
              ? "No entries"
              : `Showing ${pagination.from ?? ((pagination.currentPage - 1) * perPage + 1)}–${pagination.to ?? ((pagination.currentPage - 1) * perPage + contacts.length)} of ${pagination.total}`}
          </span>
          <div className="contact-us-pagination">
            <label htmlFor="contact-us-page-size">Rows</label>
            <select
              id="contact-us-page-size"
              value={perPage}
              onChange={changePageSize}
              disabled={loading}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Previous page"
              disabled={loading || !pagination.hasPrevious}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span>Page {pagination.currentPage} of {pagination.lastPage}</span>
            <button
              type="button"
              aria-label="Next page"
              disabled={loading || !pagination.hasNext}
              onClick={() => setPage((current) => current + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ContactUsPage;

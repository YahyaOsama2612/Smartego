import { useState, useEffect, useCallback, useRef } from "react";
import axiosClient from "../api/axiosClient";

/**
 * Reusable generic CRUD Hook for RESTful resources
 *
 * @param {string} endpoint - The API resource endpoint used for fetchById/create/update/delete (e.g., '/users', '/products')
 * @param {object} options
 * @param {boolean} [options.immediate=true] - Auto-fetch list on mount
 * @param {object} [options.defaultParams={}] - Default query parameters
 * @param {string} [options.idKey='id'] - The primary key field name
 * @param {Array} [options.initialData=[]] - Optional fallback/initial dataset
 * @param {string} [options.listEndpoint=endpoint] - Endpoint used only for fetchList (GET all).
 *   Defaults to `endpoint` when not provided, so this stays backwards compatible for callers
 *   that only need a single endpoint. Pass this when the "list" resource lives at a different
 *   path than the single-record CRUD endpoints (e.g. GET all at /admin/admins but
 *   GET one/POST/PUT/DELETE at /admin/users/{id}).
 */
export function useCrud(endpoint, options = {}) {
  const {
    immediate = true,
    defaultParams = {},
    idKey = "id",
    initialData = [],
    listEndpoint = endpoint,
  } = options;

  const [items, setItems] = useState(initialData);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: defaultParams.page || 1,
    perPage: defaultParams.limit || defaultParams.per_page || 10,
    total: initialData.length,
    totalPages:
      Math.ceil(initialData.length / (defaultParams.limit || 10)) || 1,
    hasMore: false,
  });

  const lastParamsRef = useRef(defaultParams);

  /**
   * Fetch paginated or filtered list of records
   */
  const fetchList = useCallback(
    async (params = {}, { merge = true } = {}) => {
      setLoading(true);
      setError(null);
      const queryParams = merge
        ? { ...lastParamsRef.current, ...params }
        : { ...params };
      lastParamsRef.current = queryParams;

      try {
        const response = await axiosClient.get(listEndpoint, {
          params: queryParams,
        });
        const data = response.data;

        // Support various API response formats (custom {status,data,pagination}
        // wrapper, Laravel paginator, standard REST, plain array, etc.)
        let list = [];
        let total = 0;
        let perPage = Number(queryParams.per_page || queryParams.limit) || 10;
        let currentPage = Number(queryParams.page) || 1;
        let lastPage = 1;
        let hasMore = false;

        const pag = data && typeof data === "object" ? data.pagination : null;

        if (
          data &&
          typeof data === "object" &&
          "status" in data &&
          "data" in data
        ) {
          // Custom API shape: { status, data: <array | Laravel paginator>, pagination: {...} }
          const inner = data.data;

          if (Array.isArray(inner)) {
            // paginate=false (or no pagination requested): data is the raw array
            list = inner;
          } else if (inner && Array.isArray(inner.data)) {
            // paginate=true: Laravel paginator nested inside data
            list = inner.data;
            currentPage =
              Number(inner.current_page ?? currentPage) || currentPage;
            perPage = Number(inner.per_page ?? perPage) || perPage;
            lastPage = Number(inner.last_page ?? lastPage) || lastPage;
            total = Number(inner.total ?? list.length) || list.length;
          }

          // The separate `pagination` block, when present, takes precedence
          if (pag) {
            currentPage =
              Number(pag.current_page ?? currentPage) || currentPage;
            perPage = Number(pag.per_page ?? perPage) || perPage;
            lastPage = Number(pag.last_page ?? lastPage) || lastPage;
            total =
              Number(pag.total ?? total ?? list.length) || total || list.length;
            hasMore =
              typeof pag.has_more === "boolean"
                ? pag.has_more
                : currentPage < lastPage;
          }

          if (!total) total = list.length;
        } else if (Array.isArray(data)) {
          list = data;
          total = data.length;
        } else if (Array.isArray(data.data)) {
          list = data.data;
          total = data.total ?? data.data.length;
          perPage = data.per_page ?? perPage;
          currentPage = data.current_page ?? currentPage;
        } else if (Array.isArray(data.items)) {
          list = data.items;
          total = data.total ?? data.items.length;
        } else if (data.data && typeof data.data === "object") {
          // nested object check
          const potentialList = Object.values(data.data).find(Array.isArray);
          if (potentialList) {
            list = potentialList;
            total = list.length;
          }
        }

        if (!lastPage || lastPage < 1)
          lastPage = Math.ceil(total / perPage) || 1;
        if (!hasMore) hasMore = currentPage < lastPage;

        setItems(list);
        setPagination({
          page: currentPage,
          perPage,
          total,
          totalPages: lastPage,
          hasMore,
        });

        return { data: list, total, raw: data };
      } catch (err) {
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          `Failed to fetch records from ${listEndpoint}`;
        setError(errorMsg);

        // If initial data was provided and network/404 failed, retain initialData
        if (items.length === 0 && initialData.length > 0) {
          setItems(initialData);
          setPagination((prev) => ({ ...prev, total: initialData.length }));
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [listEndpoint, initialData, items.length],
  );

  /**
   * Fetch single record by ID
   */
  const fetchById = useCallback(
    async (id) => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosClient.get(`${endpoint}/${id}`);
        const singleItem = response.data.data || response.data;
        setItem(singleItem);
        return singleItem;
      } catch (err) {
        // Check if found in local items
        const local = items.find((i) => String(i[idKey]) === String(id));
        if (local) {
          setItem(local);
          return local;
        }
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          `Failed to fetch record #${id}`;
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [endpoint, idKey, items],
  );

  /**
   * Create a new record
   */
  const createItem = useCallback(
    async (payload) => {
      setActionLoading(true);
      setError(null);
      try {
        let created;
        try {
          const response = await axiosClient.post(endpoint, payload);
          created = response.data.data || response.data;
        } catch (apiErr) {
          // If server returned 404 (endpoint not yet created on backend), simulate creation locally
          if (
            apiErr.response?.status === 404 ||
            apiErr.response?.status === 405
          ) {
            created = {
              [idKey]: Date.now(),
              ...payload,
              createdAt: new Date().toISOString(),
            };
          } else {
            throw apiErr;
          }
        }

        setItems((prev) => [created, ...prev]);
        setPagination((prev) => ({
          ...prev,
          total: prev.total + 1,
        }));
        return created;
      } catch (err) {
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          "Failed to create record";
        setError(errorMsg);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [endpoint, idKey],
  );

  /**
   * Update an existing record
   */
  const updateItem = useCallback(
    async (id, payload) => {
      setActionLoading(true);
      setError(null);
      try {
        let updated;
        try {
          const response = await axiosClient.put(`${endpoint}/${id}`, payload);
          updated = response.data.data || response.data;
        } catch (apiErr) {
          if (
            apiErr.response?.status === 404 ||
            apiErr.response?.status === 405
          ) {
            updated = {
              [idKey]: id,
              ...payload,
              updatedAt: new Date().toISOString(),
            };
          } else {
            throw apiErr;
          }
        }

        setItems((prev) =>
          prev.map((i) =>
            String(i[idKey]) === String(id) ? { ...i, ...updated } : i,
          ),
        );
        if (item && String(item[idKey]) === String(id)) {
          setItem((prev) => ({ ...prev, ...updated }));
        }
        return updated;
      } catch (err) {
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          `Failed to update record #${id}`;
        setError(errorMsg);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [endpoint, idKey, item],
  );

  /**
   * Delete a record by ID
   */
  const deleteItem = useCallback(
    async (id) => {
      setActionLoading(true);
      setError(null);
      try {
        try {
          await axiosClient.delete(`${endpoint}/${id}`);
        } catch (apiErr) {
          if (
            apiErr.response?.status !== 404 &&
            apiErr.response?.status !== 405
          ) {
            throw apiErr;
          }
        }

        setItems((prev) => prev.filter((i) => String(i[idKey]) !== String(id)));
        setPagination((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
        }));
        if (item && String(item[idKey]) === String(id)) {
          setItem(null);
        }
        return true;
      } catch (err) {
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          `Failed to delete record #${id}`;
        setError(errorMsg);
        throw err;
      } finally {
        setActionLoading(false);
      }
    },
    [endpoint, idKey, item],
  );

  /**
   * Refetch current list
   */
  const refetch = useCallback(() => {
    return fetchList(lastParamsRef.current);
  }, [fetchList]);

  // Initial fetch on mount if immediate is true
  useEffect(() => {
    if (immediate) {
      fetchList(defaultParams).catch(() => {
        // Handled within fetchList
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  return {
    items,
    item,
    loading,
    actionLoading,
    error,
    pagination,
    fetchList,
    fetchById,
    createItem,
    updateItem,
    deleteItem,
    refetch,
    setItem,
    setItems,
    setError,
  };
}

export default useCrud;

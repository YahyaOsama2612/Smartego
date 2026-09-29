import { useState, useEffect, useCallback } from "react";
import axiosClient from "../../api/axiosClient";

const TAX_DISCOUNT_LIST_ENDPOINT =
  "https://bcknd.smartego.org/api/admin/tax-and-discount-list";

/**
 * Fetches the combined discounts + taxes reference lists used to populate
 * the Discount / Tax select dropdowns on the Packages create/edit form.
 *
 * This is a lookup endpoint, not a paginated CRUD resource — its response
 * shape ({ status, data: { discounts: [], taxes: [] } }) doesn't match any
 * of the list shapes useCrud's fetchList knows how to parse (no `.data`
 * array or Laravel paginator directly under `data`), so it's kept as its
 * own small hook rather than forced through useCrud.
 */
export function useTaxDiscountOptions() {
  const [discounts, setDiscounts] = useState([]);
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get(TAX_DISCOUNT_LIST_ENDPOINT);
      const payload = response.data?.data || {};
      setDiscounts(Array.isArray(payload.discounts) ? payload.discounts : []);
      setTaxes(Array.isArray(payload.taxes) ? payload.taxes : []);
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to fetch discounts/taxes list";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return { discounts, taxes, loading, error, refetch: fetchOptions };
}

export default useTaxDiscountOptions;

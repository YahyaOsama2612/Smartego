import { useState, useEffect, useCallback } from "react";
import {
  Save,
  RefreshCw,
  Check,
  AlertTriangle,
  Cpu,
  CreditCard,
} from "lucide-react";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import "./SettingsPage.css";

// Absolute URL so it hits this host regardless of axiosClient's baseURL.
const AI_CONTEXT_ENDPOINT =
  "https://bcknd.smartego.org/api/admin/settings/ai-context";
const PAYMOB_ENDPOINT = "https://bcknd.smartego.org/api/admin/paymob";

const EMPTY_PAYMOB = {
  title: "",
  type: "Not Set",
  callback: "",
  api_key: "",
  iframe_id: "",
  integration_id: "",
  Hmac: "",
  logo: "",
};

const readPaymob = (response) => {
  if (response?.status === false) {
    throw new Error(response.message || "The server couldn't load Paymob settings.");
  }

  const data = response?.data ?? response;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The server returned an unexpected Paymob settings response.");
  }

  return data;
};

export function SettingsPage() {
  // GET response shape: { status: true, data: { name, value } }
  const [setting, setSetting] = useState({ name: "ai_context", value: "" });
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const [paymob, setPaymob] = useState(EMPTY_PAYMOB);
  const [paymobLoading, setPaymobLoading] = useState(true);
  const [paymobSaving, setPaymobSaving] = useState(false);
  const [paymobError, setPaymobError] = useState(null);
  const [paymobSaved, setPaymobSaved] = useState(false);

  const loadPaymob = useCallback(async () => {
    setPaymobLoading(true);
    setPaymobError(null);
    setPaymobSaved(false);
    try {
      const response = await axiosClient.get(PAYMOB_ENDPOINT);
      const data = readPaymob(response.data);
      setPaymob({
        title: data.title ?? "",
        type: data.type ?? "Not Set",
        callback: data.callback ?? "",
        api_key: data.api_key ?? "",
        iframe_id: data.iframe_id ?? "",
        integration_id: data.integration_id ?? "",
        Hmac: data.Hmac ?? "",
        logo: data.logo ?? "",
      });
    } catch (err) {
      setPaymobError(
        err.response?.data?.message ||
        err.message ||
        "Couldn't load Paymob settings.",
      );
    } finally {
      setPaymobLoading(false);
    }
  }, []);

  const loadSetting = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const response = await axiosClient.get(AI_CONTEXT_ENDPOINT);
      const data = response.data?.data ?? response.data ?? {};
      const next = {
        name: data.name || "ai_context",
        value: data.value ?? "",
      };
      setSetting(next);
      setValue(next.value);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Couldn't load the AI context setting.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadSetting);
  }, [loadSetting]);

  useEffect(() => {
    void Promise.resolve().then(loadPaymob);
  }, [loadPaymob]);

  const updatePaymobField = (event) => {
    const { name, value } = event.target;
    setPaymob((current) => ({ ...current, [name]: value }));
    setPaymobSaved(false);
  };

  const handlePaymobSave = async (event) => {
    event.preventDefault();
    setPaymobSaving(true);
    setPaymobError(null);
    setPaymobSaved(false);

    try {
      const response = await axiosClient.post(PAYMOB_ENDPOINT, {
        title: paymob.title,
        type: paymob.type,
        callback: paymob.callback,
        api_key: paymob.api_key,
        iframe_id: paymob.iframe_id,
        integration_id: paymob.integration_id,
        Hmac: paymob.Hmac,
        logo: paymob.logo || null,
      });
      const data = readPaymob(response.data);
      setPaymob((current) => ({
        ...current,
        ...Object.fromEntries(
          Object.keys(EMPTY_PAYMOB).map((key) => [
            key,
            data[key] === undefined ? current[key] : data[key] ?? "",
          ]),
        ),
      }));
      setPaymobSaved(true);
    } catch (err) {
      setPaymobError(
        err.response?.data?.message ||
        err.message ||
        "Couldn't save Paymob settings.",
      );
    } finally {
      setPaymobSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    // The API only exposes GET and POST here, and POST takes just { value }.
    const payload = { value };

    try {
      const response = await axiosClient.post(AI_CONTEXT_ENDPOINT, payload);

      const data = response.data?.data ?? response.data ?? {};
      const next = {
        name: data.name || setting.name || "ai_context",
        value: data.value ?? value,
      };
      setSetting(next);
      setValue(next.value);
      setSaved(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Couldn't save the AI context setting.",
      );
    } finally {
      setSaving(false);
    }
  };

  const isDirty = value !== setting.value;

  return (
    <div className="settings-page-container">
      {/* Header */}
      <div className="settings-page-header">
        {/*  <div>
          <h2 className="settings-page-title">Settings</h2>
          
        </div> */}
        <div className="page-header-actions">
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={loadSetting}
            isLoading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* AI CONTEXT SETTING */}
      <div className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-icon">
            <Cpu size={18} />
          </div>
          <div>
            <h3 className="settings-card-title">AI context</h3>
            <p className="settings-card-desc">
              The instructions sent to the assistant with every conversation.
            </p>
          </div>
          <span className="setting-key">{setting.name}</span>
        </div>

        <form onSubmit={handleSave} className="crud-form">
          <div className="form-field">
            <label className="form-label" htmlFor="ai-context-value">
              Value
            </label>
            <textarea
              id="ai-context-value"
              dir="auto"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSaved(false);
              }}
              placeholder={
                loading
                  ? "Loading current value…"
                  : "Describe how the assistant should behave"
              }
              className="input-control settings-textarea"
              rows={8}
              disabled={loading}
            />
            <span className="field-hint">
              {value.length} characters
              {isDirty && !loading ? " · unsaved changes" : ""}
            </span>
          </div>

          {error && (
            <div className="settings-banner settings-banner-error">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {saved && !isDirty && (
            <div className="settings-banner settings-banner-success">
              <Check size={16} />
              <span>AI context saved.</span>
            </div>
          )}

          <div className="settings-card-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setValue(setting.value);
                setSaved(false);
              }}
              disabled={!isDirty || saving}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              icon={Save}
              onClick={handleSave}
              isLoading={saving}
              disabled={!isDirty || loading}
            >
              Save changes
            </Button>
          </div>
        </form>
      </div>

      <div className="settings-card">
        <div className="settings-card-head">
          <div className="settings-card-icon">
            <CreditCard size={18} />
          </div>
          <div>
            <h3 className="settings-card-title">Paymob</h3>
            <p className="settings-card-desc">
              Configure the Paymob payment integration and checkout credentials.
            </p>
          </div>
        </div>

        <form onSubmit={handlePaymobSave} className="crud-form">
          <div className="paymob-fields">
            <Input
              id="paymob-title"
              label="Title"
              name="title"
              value={paymob.title}
              onChange={updatePaymobField}
              disabled={paymobLoading || paymobSaving}
              placeholder="Payment method title"
            />

            <div className="form-field">
              <label className="form-label" htmlFor="paymob-type">Type</label>
              <select
                id="paymob-type"
                name="type"
                className="input-control"
                value={paymob.type}
                onChange={updatePaymobField}
                disabled={paymobLoading || paymobSaving}
              >
                <option value="Not Set">Not Set</option>
                <option value="live">Live</option>
                <option value="test">Test</option>
              </select>
            </div>

            <Input
              id="paymob-callback"
              label="Callback URL"
              name="callback"
              value={paymob.callback}
              onChange={updatePaymobField}
              disabled={paymobLoading || paymobSaving}
              placeholder="https://..."
            />
            <Input
              id="paymob-api-key"
              label="API key"
              name="api_key"
              type="password"
              autoComplete="new-password"
              value={paymob.api_key}
              onChange={updatePaymobField}
              disabled={paymobLoading || paymobSaving}
            />
            <Input
              id="paymob-iframe-id"
              label="Iframe ID"
              name="iframe_id"
              value={paymob.iframe_id}
              onChange={updatePaymobField}
              disabled={paymobLoading || paymobSaving}
            />
            <Input
              id="paymob-integration-id"
              label="Integration ID"
              name="integration_id"
              value={paymob.integration_id}
              onChange={updatePaymobField}
              disabled={paymobLoading || paymobSaving}
            />
            <Input
              id="paymob-hmac"
              label="HMAC"
              name="Hmac"
              type="password"
              autoComplete="new-password"
              value={paymob.Hmac}
              onChange={updatePaymobField}
              disabled={paymobLoading || paymobSaving}
            />
            <Input
              id="paymob-logo"
              label="Logo URL"
              name="logo"
              value={paymob.logo}
              onChange={updatePaymobField}
              disabled={paymobLoading || paymobSaving}
              placeholder="https://..."
              helperText="Leave blank to send null and remove the logo."
            />
          </div>

          {paymobError && (
            <div className="settings-banner settings-banner-error" role="alert">
              <AlertTriangle size={16} />
              <span>{paymobError}</span>
            </div>
          )}

          {paymobSaved && (
            <div className="settings-banner settings-banner-success" role="status">
              <Check size={16} />
              <span>Paymob settings saved.</span>
            </div>
          )}

          <div className="settings-card-actions">
            <Button
              variant="outline"
              icon={RefreshCw}
              onClick={loadPaymob}
              isLoading={paymobLoading}
              disabled={paymobSaving}
            >
              Reload Paymob
            </Button>
            <Button
              variant="primary"
              icon={Save}
              type="submit"
              isLoading={paymobSaving}
              disabled={paymobLoading}
            >
              Save Paymob settings
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SettingsPage;
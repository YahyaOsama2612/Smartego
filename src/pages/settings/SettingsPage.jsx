import { useState, useEffect, useCallback } from "react";
import { Save, RefreshCw, Check, AlertTriangle, Cpu } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import Button from "../../components/common/Button";
import "./SettingsPage.css";

// Absolute URL so it hits this host regardless of axiosClient's baseURL.
const AI_CONTEXT_ENDPOINT =
  "https://bcknd.smartego.org/api/admin/settings/ai-context";

export function SettingsPage() {
  // GET response shape: { status: true, data: { name, value } }
  const [setting, setSetting] = useState({ name: "ai_context", value: "" });
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

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
    loadSetting();
  }, [loadSetting]);

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
    </div>
  );
}

export default SettingsPage;
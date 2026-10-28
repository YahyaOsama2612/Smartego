import { useState, useCallback, useEffect } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Eye,
  FileText,
  Copy,
  Check,
  Layers,
  Type,
  Hash,
  Mail,
  Phone,
  Calendar,
  AlignLeft,
  ToggleLeft,
  List,
  Link,
  Upload,
  Save,
  X,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Camera,
  MessageCircle,
  Send,
  Video,
  Edit2,
  AlertTriangle,
  Database,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  LayoutList,
  PenSquare,
  Clock,
  Download,
} from "lucide-react";
import axiosClient from "../../api/axiosClient";
import { toast } from "../../components/common/Toast";
import "./TemplatesPage.css";

// ─── Endpoints ───────────────────────────────────────────────────────────────
const ACCOUNTS_URL      = "/admin/templates/accounts";
const SAVE_TEMPLATE_URL = "/admin/templates";
const GENERATE_AI_URL   = "/admin/templates/generate-ai-file";
const LIST_URL          = "/admin/templates";
const TEMPLATE_URL      = (id) => `/admin/templates/${id}`;

// ─── Date formatter ──────────────────────────────────────────────────────────
const fmtDate = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

// ─── Input type catalogue ────────────────────────────────────────────────────
const INPUT_TYPES = [
  { value: "text",     label: "Short Text",  icon: Type },
  { value: "number",   label: "Number",      icon: Hash },
  { value: "email",    label: "Email",       icon: Mail },
  { value: "phone",    label: "Phone",       icon: Phone },
  { value: "date",     label: "Date",        icon: Calendar },
  { value: "textarea", label: "Long Text",   icon: AlignLeft },
  { value: "select",   label: "Dropdown",    icon: List },
  { value: "checkbox", label: "Checkbox",    icon: ToggleLeft },
  { value: "url",      label: "URL",         icon: Link },
  { value: "file",     label: "File Upload", icon: Upload },
];

// ─── ID generator ────────────────────────────────────────────────────────────
let _id = 0;
const uid = () => `id_${++_id}_${Date.now()}`;

// ─── Model factories ──────────────────────────────────────────────────────────
const newField = () => ({
  id: uid(),
  label: "New Field",
  type: "text",
  required: false,
  placeholder: "",
});

const newGroup = (name = "New Group") => ({
  id: uid(),
  name,
  collapsed: false,
  fields: [newField()],
  subGroups: [],
});

const cloneGroupDeep = (g) => ({
  ...g,
  id: uid(),
  name: g.name ? `${g.name} (Copy)` : "Group Copy",
  fields: (g.fields || []).map((f) => ({ ...f, id: uid() })),
  subGroups: (g.subGroups || []).map(cloneGroupDeep),
});

// ─── Extract groups array from raw request_template ──────────────────────────
// Handles: { groups: [...] }, [ ... ], or JSON-stringified versions
const extractGroupsArray = (raw) => {
  if (!raw) return [];
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (Array.isArray(data)) return data.filter(Boolean);
  if (data && typeof data === "object") {
    if (Array.isArray(data.groups)) return data.groups.filter(Boolean);
    if (Array.isArray(data.request_template?.groups)) return data.request_template.groups.filter(Boolean);
    if (Array.isArray(data.request_template)) return data.request_template.filter(Boolean);
    if (Array.isArray(data.data)) return data.data.filter(Boolean);
  }
  return [];
};

// ─── Parse API request_template → local group tree ───────────────────────────
// request_template is stored as: { groups: [ { name, data: [[{lable,value}]] } ] }
// or directly [ { name, data: [[{lable,value}]] } ]
const parseRequestTemplate = (requestTemplate) => {
  const validList = extractGroupsArray(requestTemplate);
  if (validList.length === 0) return [newGroup()];

  return validList.map((g) => {
    const rows = Array.isArray(g?.data) ? g.data : [];
    const firstRow = Array.isArray(rows[0]) ? rows[0] : [];
    // First row → top-level fields; subsequent rows → sub-groups
    const fields = firstRow
      .filter(Boolean)
      .map((item) => ({
        id: uid(),
        label: item?.lable || item?.label || "Field",
        type: INPUT_TYPES.some((t) => t.value === item?.value) ? item.value : "text",
        required: false,
        placeholder: "",
      }));
    const subGroups = rows.slice(1).map((row, idx) => ({
      id: uid(),
      name: `Sub-Group ${idx + 1}`,
      collapsed: false,
      fields: (Array.isArray(row) ? row : [])
        .filter(Boolean)
        .map((item) => ({
          id: uid(),
          label: item?.lable || item?.label || "Field",
          type: INPUT_TYPES.some((t) => t.value === item?.value) ? item.value : "text",
          required: false,
          placeholder: "",
        })),
      subGroups: [],
    }));
    return {
      id: uid(),
      name: g?.name || "Group",
      collapsed: false,
      fields: fields.length > 0 ? fields : [newField()],
      subGroups,
    };
  });
};

// ─── Icon lookup ──────────────────────────────────────────────────────────────
const iconFor = (typeValue) => {
  const found = INPUT_TYPES.find((t) => t.value === typeValue);
  return found ? found.icon : Type;
};

// ─── Payload builder ─────────────────────────────────────────────────────────
// Converts local group tree → API groups array format
// Note: API spells "label" as "lable"
const buildGroupsPayload = (groups) =>
  groups.map((group) => {
    const rows = [];
    if (group.fields.length > 0)
      rows.push(group.fields.map((f) => ({ lable: f.label, value: f.type })));
    group.subGroups.forEach((sg) => {
      if (sg.fields.length > 0)
        rows.push(sg.fields.map((f) => ({ lable: f.label, value: f.type })));
      sg.subGroups?.forEach((ssg) => {
        if (ssg.fields.length > 0)
          rows.push(ssg.fields.map((f) => ({ lable: f.label, value: f.type })));
      });
    });
    if (rows.length === 0) rows.push([]);
    return { name: group.name, data: rows };
  });

// ─── Markdown preview builder ─────────────────────────────────────────────────
const buildMarkdown = (groups, templateName) => {
  const lines = [`# ${templateName || "Template"}\n`];
  const renderGroup = (group, depth = 2) => {
    lines.push(`${"#".repeat(Math.min(depth, 6))} ${group.name}\n`);
    group.fields.forEach((f) => {
      lines.push(`**${f.label}**${f.required ? " *(required)*" : ""}`);
      lines.push(`- Type: \`${f.type}\``);
      if (f.placeholder) lines.push(`- Placeholder: ${f.placeholder}`);
      lines.push(`- Answer: ___________\n`);
    });
    group.subGroups.forEach((sg) => renderGroup(sg, depth + 1));
  };
  groups.forEach((g) => renderGroup(g));
  return lines.join("\n");
};

// ─── Preview Input ────────────────────────────────────────────────────────────
const PreviewInput = ({ field }) => {
  if (field.type === "textarea")
    return (
      <textarea
        className="tpl-preview-input"
        placeholder={field.placeholder || `Enter ${field.label}...`}
        rows={3}
        readOnly
      />
    );
  if (field.type === "checkbox")
    return (
      <div className="tpl-preview-checkbox">
        <input type="checkbox" readOnly />
        <span>{field.placeholder || field.label}</span>
      </div>
    );
  if (field.type === "select")
    return (
      <select className="tpl-preview-input">
        <option>{field.placeholder || `Select ${field.label}...`}</option>
      </select>
    );
  return (
    <input
      className="tpl-preview-input"
      type={field.type === "phone" ? "tel" : field.type}
      placeholder={field.placeholder || `Enter ${field.label}...`}
      readOnly
    />
  );
};

// ─── FieldRow ─────────────────────────────────────────────────────────────────
function FieldRow({ field, onUpdate, onRemove, onDuplicate }) {
  const TypeIcon = iconFor(field.type);
  return (
    <div className="tpl-field-row">
      <span className="tpl-field-grip"><GripVertical size={14} /></span>
      <div className="tpl-field-type-icon"><TypeIcon size={13} /></div>
      <div className="tpl-field-controls">
        <input
          className="tpl-ctrl-input tpl-label-input"
          value={field.label}
          placeholder="Field label..."
          onChange={(e) => onUpdate({ ...field, label: e.target.value })}
        />
        <select
          className="tpl-ctrl-select"
          value={field.type}
          onChange={(e) => onUpdate({ ...field, type: e.target.value })}
        >
          {INPUT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          className="tpl-ctrl-input tpl-placeholder-input"
          value={field.placeholder}
          placeholder="Placeholder text..."
          onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
        />
        <label className="tpl-required-toggle">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate({ ...field, required: e.target.checked })}
          />
          <span>Req.</span>
        </label>
      </div>
      {onDuplicate && (
        <button className="tpl-icon-btn tpl-copy-btn" onClick={onDuplicate} title="Duplicate field">
          <Copy size={13} />
        </button>
      )}
      <button className="tpl-icon-btn tpl-remove-btn" onClick={onRemove} title="Delete field">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── GroupCard (recursive) ────────────────────────────────────────────────────
function GroupCard({ group, onUpdate, onRemove, onDuplicate, depth = 0 }) {
  const toggle = () => onUpdate({ ...group, collapsed: !group.collapsed });
  const updateField = (idx, updated) => {
    const fields = [...group.fields];
    fields[idx] = updated;
    onUpdate({ ...group, fields });
  };
  const removeField = (idx) =>
    onUpdate({ ...group, fields: group.fields.filter((_, i) => i !== idx) });
  const duplicateField = (idx) => {
    const target = group.fields[idx];
    const cloned = { ...target, id: uid(), label: target.label ? `${target.label} (Copy)` : "Field (Copy)" };
    const nextFields = [...group.fields];
    nextFields.splice(idx + 1, 0, cloned);
    onUpdate({ ...group, fields: nextFields });
  };
  const addField = () =>
    onUpdate({ ...group, fields: [...group.fields, newField()] });
  const updateSubGroup = (idx, updated) => {
    const subGroups = [...group.subGroups];
    subGroups[idx] = updated;
    onUpdate({ ...group, subGroups });
  };
  const removeSubGroup = (idx) =>
    onUpdate({ ...group, subGroups: group.subGroups.filter((_, i) => i !== idx) });
  const duplicateSubGroup = (idx) => {
    const nextSubGroups = [...group.subGroups];
    nextSubGroups.splice(idx + 1, 0, cloneGroupDeep(group.subGroups[idx]));
    onUpdate({ ...group, subGroups: nextSubGroups });
  };
  const addSubGroup = () =>
    onUpdate({ ...group, subGroups: [...group.subGroups, newGroup("Sub-Group")] });

  const depthColors = ["#10b981", "#0d9488", "#0284c7", "#7c3aed"];
  const accentColor = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div
      className="tpl-group-card"
      style={{ borderLeftColor: accentColor, "--group-accent": accentColor }}
    >
      <div className="tpl-group-header">
        <button className="tpl-collapse-btn" onClick={toggle}>
          {group.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <Layers size={14} className="tpl-group-icon" style={{ color: accentColor }} />
        <input
          className="tpl-group-name-input"
          value={group.name}
          placeholder="Group name..."
          onChange={(e) => onUpdate({ ...group, name: e.target.value })}
        />
        {depth > 0 && (
          <span className="tpl-depth-badge" style={{ background: accentColor }}>L{depth + 1}</span>
        )}
        <div className="tpl-group-actions">
          <button className="tpl-pill-btn add-field" onClick={addField}>
            <Plus size={12} /> Field
          </button>
          {depth < 2 && (
            <button className="tpl-pill-btn add-sub" onClick={addSubGroup}>
              <Plus size={12} /> Sub-Group
            </button>
          )}
          {onDuplicate && (
            <button className="tpl-icon-btn tpl-copy-btn" onClick={onDuplicate} title="Duplicate group">
              <Copy size={13} />
            </button>
          )}
          <button className="tpl-icon-btn tpl-remove-btn" onClick={onRemove} title="Delete group">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {!group.collapsed && (
        <div className="tpl-group-body">
          {group.fields.length === 0 && group.subGroups.length === 0 && (
            <p className="tpl-empty-hint">No fields yet -- click "+ Field" to add one.</p>
          )}
          {group.fields.map((field, idx) => (
            <FieldRow
              key={field.id}
              field={field}
              onUpdate={(updated) => updateField(idx, updated)}
              onRemove={() => removeField(idx)}
              onDuplicate={() => duplicateField(idx)}
            />
          ))}
          {group.subGroups.map((sg, idx) => (
            <GroupCard
              key={sg.id}
              group={sg}
              depth={depth + 1}
              onUpdate={(updated) => updateSubGroup(idx, updated)}
              onRemove={() => removeSubGroup(idx)}
              onDuplicate={() => duplicateSubGroup(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────
function PreviewPanel({ groups, templateName }) {
  const renderGroup = (group, depth = 0) => (
    <div key={group.id} className="tpl-preview-group" style={{ marginLeft: depth * 16 }}>
      <div className="tpl-preview-group-title" style={{ fontSize: `${16 - depth * 2}px` }}>
        {group.name || "Untitled Group"}
      </div>
      {group.fields.map((f) => (
        <div key={f.id} className="tpl-preview-field">
          <label className="tpl-preview-label">
            {f.label || "Label"}
            {f.required && <span className="tpl-required-star"> *</span>}
          </label>
          <PreviewInput field={f} />
        </div>
      ))}
      {group.subGroups.map((sg) => renderGroup(sg, depth + 1))}
    </div>
  );

  return (
    <div className="tpl-preview-panel">
      <div className="tpl-panel-header">
        <Eye size={15} />
        <span>Live Preview</span>
      </div>
      <div className="tpl-preview-body">
        {templateName && <h2 className="tpl-preview-title">{templateName}</h2>}
        {groups.length === 0 ? (
          <div className="tpl-preview-empty">
            <FileText size={40} />
            <p>Your template preview will appear here.</p>
            <span>Add a group to get started</span>
          </div>
        ) : (
          groups.map((g) => renderGroup(g))
        )}
      </div>
    </div>
  );
}

// ─── MD Modal ─────────────────────────────────────────────────────────────────
function MdModal({ md, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };
  return (
    <div className="tpl-modal-overlay" onClick={onClose}>
      <div className="tpl-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-modal-header">
          <span className="tpl-modal-title"><FileText size={16} /> Markdown Output</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="tpl-pill-btn add-field" onClick={copy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button className="tpl-icon-btn tpl-remove-btn" onClick={onClose}><X size={14} /></button>
          </div>
        </div>
        <pre className="tpl-md-pre">{md}</pre>
      </div>
    </div>
  );
}

// ─── Accounts Panel ───────────────────────────────────────────────────────────
function AccountsPanel({ accounts, loadingAccounts, selectedAccounts, onChange, onRefresh }) {
  const accountTypes = [
    {
      key: "whats_item_id",
      label: "WhatsApp Account",
      icon: MessageSquare,
      list: accounts.whats_items || [],
      display: (item) => item.phone,
      color: "#25d366",
    },
    {
      key: "instgram_item_id",
      label: "Instagram Account",
      icon: Camera,
      list: accounts.instgram_items || [],
      display: (item) => `@${item.username}`,
      color: "#e1306c",
    },
    {
      key: "messenger_account_id",
      label: "Messenger Page",
      icon: MessageCircle,
      list: accounts.messenger_accounts || [],
      display: (item) => item.page_name,
      color: "#0084ff",
    },
    {
      key: "telegram_account_id",
      label: "Telegram Bot",
      icon: Send,
      list: accounts.telegram_accounts || [],
      display: (item) => `@${item.bot_username}`,
      color: "#229ed9",
    },
    {
      key: "tiktok_account_id",
      label: "TikTok Account",
      icon: Video,
      list: accounts.tiktok_accounts || [],
      display: (item) => item.username || `ID ${item.id}`,
      color: "#010101",
    },
  ];

  return (
    <div className="tpl-accounts-panel">
      <div className="tpl-panel-header">
        <Layers size={15} />
        <span>Associate Accounts</span>
        <button
          className="tpl-icon-btn tpl-refresh-btn"
          onClick={onRefresh}
          disabled={loadingAccounts}
          title="Refresh accounts"
          style={{ marginLeft: "auto" }}
        >
          <RefreshCw size={13} className={loadingAccounts ? "tpl-spin" : ""} />
        </button>
      </div>

      <div className="tpl-accounts-body">
        {loadingAccounts ? (
          <div className="tpl-accounts-loading">
            <RefreshCw size={22} className="tpl-spin" />
            <span>Loading accounts...</span>
          </div>
        ) : (
          accountTypes.map(({ key, label, icon: Icon, list, display, color }) => (
            <div key={key} className="tpl-account-row">
              <div className="tpl-account-label">
                <div className="tpl-account-icon" style={{ background: `${color}22`, color }}>
                  <Icon size={13} />
                </div>
                <span>{label}</span>
              </div>
              <select
                className="tpl-account-select"
                value={selectedAccounts[key] ?? ""}
                onChange={(e) =>
                  onChange({
                    ...selectedAccounts,
                    [key]: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">-- None --</option>
                {list.map((item) => (
                  <option key={item.id} value={item.id}>
                    {display(item)}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}
        {!loadingAccounts &&
          accountTypes.every(({ list }) => list.length === 0) && (
            <p className="tpl-accounts-empty">
              No accounts found. Configure accounts first.
            </p>
          )}
      </div>
    </div>
  );
}

// ─── Builder Tab (create new) ────────────────────────────────────────────────
function BuilderTab({ onSwitchToList }) {
  const [templateName, setTemplateName] = useState("My Template");
  const [groups, setGroups] = useState([newGroup("Personal Info")]);
  const [showMd, setShowMd] = useState(false);

  // Accounts
  const [accounts, setAccounts] = useState({
    whats_items: [],
    instgram_items: [],
    messenger_accounts: [],
    telegram_accounts: [],
    tiktok_accounts: [],
  });
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState({
    whats_item_id: null,
    instgram_item_id: null,
    messenger_account_id: null,
    telegram_account_id: null,
    tiktok_account_id: null,
  });

  // Action states
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedFileUrl, setGeneratedFileUrl] = useState(null);

  // Fetch accounts on mount
  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await axiosClient.get(ACCOUNTS_URL);
      const data = res.data?.data || res.data;
      setAccounts({
        whats_items:        data.whats_items        || [],
        instgram_items:     data.instgram_items     || [],
        messenger_accounts: data.messenger_accounts || [],
        telegram_accounts:  data.telegram_accounts  || [],
        tiktok_accounts:    data.tiktok_accounts    || [],
      });
    } catch (err) {
      if (err.response?.status !== 401)
        toast.error(err.response?.data?.message || err.message || "Failed to load accounts");
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Group management
  const addGroup = () => setGroups((prev) => [...prev, newGroup()]);
  const updateGroup = useCallback((idx, updated) => {
    setGroups((prev) => { const next = [...prev]; next[idx] = updated; return next; });
  }, []);
  const removeGroup = (idx) => setGroups((prev) => prev.filter((_, i) => i !== idx));
  const duplicateGroup = (idx) => {
    setGroups((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, cloneGroupDeep(prev[idx]));
      return next;
    });
  };

  // Save Template → POST /admin/templates
  const handleSaveTemplate = async () => {
    if (groups.length === 0) { toast.error("Add at least one group before saving."); return; }
    setSaving(true);
    try {
      await axiosClient.post(SAVE_TEMPLATE_URL, { groups: buildGroupsPayload(groups) });
      toast.success("Template saved successfully!");
    } catch (err) {
      if (err.response?.status !== 401) {
        const errData = err.response?.data;
        const msg = errData?.errors
          ? Object.values(errData.errors).flat().join(", ")
          : errData?.message || err.message || "Failed to save template";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // Generate AI File → POST /admin/templates/generate-ai-file
  const handleGenerateAI = async () => {
    if (groups.length === 0) { toast.error("Add at least one group first."); return; }
    const hasAccount = Object.values(selectedAccounts).some((v) => v !== null && v !== "");
    if (!hasAccount) { toast.error("Select at least one account to associate with."); return; }
    setGenerating(true);
    setGeneratedFileUrl(null); // reset previous download
    try {
      // Only include account IDs that were actually selected (non-null/empty)
      const payload = { groups: buildGroupsPayload(groups) };
      if (selectedAccounts.whats_item_id)        payload.whats_item_id        = selectedAccounts.whats_item_id;
      if (selectedAccounts.instgram_item_id)     payload.instgram_item_id     = selectedAccounts.instgram_item_id;
      if (selectedAccounts.messenger_account_id) payload.messenger_account_id = selectedAccounts.messenger_account_id;
      if (selectedAccounts.telegram_account_id)  payload.telegram_account_id  = selectedAccounts.telegram_account_id;
      if (selectedAccounts.tiktok_account_id)    payload.tiktok_account_id    = selectedAccounts.tiktok_account_id;
      const res = await axiosClient.post(GENERATE_AI_URL, payload);
      const data = res.data?.data || res.data;
      // Support both full URL (file_url) and relative path (ai_file)
      const STORAGE_BASE = "https://bcknd.smartego.org/storage/";
      const fileUrl =
        data?.file_url ||
        (data?.ai_file ? `${STORAGE_BASE}${data.ai_file.replace(/\\/g, "/")}` : null);
      if (fileUrl) setGeneratedFileUrl(fileUrl);
      toast.success("AI markdown file generated and linked successfully!");
    } catch (err) {
      if (err.response?.status !== 401) {
        const errData = err.response?.data;
        const msg = errData?.errors
          ? Object.values(errData.errors).flat().join(", ")
          : errData?.message || err.message || "Failed to generate AI file";
        toast.error(msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  const md = buildMarkdown(groups, templateName);

  // Force-download the AI file
  // Uses XMLHttpRequest so we can attach the auth token and get a binary response.
  // If CORS blocks reading the body (storage path has no CORS headers), we fall
  // back to window.open so the browser can download it natively.
  const [downloading, setDownloading] = useState(false);
  const handleDownloadAiFile = () => {
    if (!generatedFileUrl) return;
    const token = localStorage.getItem("smartego_token");
    const fileName = generatedFileUrl.split("/").pop() || "ai_file.md";
    setDownloading(true);

    const xhr = new XMLHttpRequest();
    xhr.open("GET", generatedFileUrl, true);
    xhr.responseType = "blob";
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.onload = () => {
      setDownloading(false);
      if (xhr.status === 200) {
        const blobUrl = URL.createObjectURL(xhr.response);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      } else {
        // XHR succeeded but non-200 — fall back to direct navigation
        window.open(generatedFileUrl, "_blank");
      }
    };

    xhr.onerror = () => {
      // CORS blocked reading the response → fall back to direct navigation
      setDownloading(false);
      window.open(generatedFileUrl, "_blank");
      toast.info("File opened in a new tab — use Ctrl+S / File > Save to save it.");
    };

    xhr.send();
  };

  return (
    <div className="tpl-page">
      {/* Header */}
      <div className="tpl-page-header">
        <div className="tpl-header-left">
          <div className="tpl-name-wrap">
            <FileText size={18} className="tpl-header-icon" />
            <input
              className="tpl-template-name-input"
              value={templateName}
              placeholder="Template name..."
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </div>
          <span className="tpl-header-sub">Template Builder</span>
        </div>
        <div className="tpl-header-right">
          <button className="tpl-btn tpl-btn-outline" onClick={addGroup}>
            <Plus size={15} /> Add Group
          </button>
          <button className="tpl-btn tpl-btn-ghost" onClick={() => setShowMd(true)}>
            <FileText size={15} /> View MD
          </button>
          <button className="tpl-btn tpl-btn-secondary" onClick={handleSaveTemplate} disabled={saving}>
            {saving ? <RefreshCw size={15} className="tpl-spin" /> : <Save size={15} />}
            {saving ? "Saving..." : "Save Template"}
          </button>
          <button className="tpl-btn tpl-btn-primary" onClick={handleGenerateAI} disabled={generating}>
            {generating ? <RefreshCw size={15} className="tpl-spin" /> : <Sparkles size={15} />}
            {generating ? "Generating..." : "Generate AI File"}
          </button>
          {generatedFileUrl && (
            <button
              className="tpl-btn tpl-btn-download"
              onClick={handleDownloadAiFile}
              disabled={downloading}
              title="Download generated AI file"
            >
              {downloading
                ? <RefreshCw size={15} className="tpl-spin" />
                : <Download size={15} />}
              {downloading ? "Downloading..." : "Download AI File"}
            </button>
          )}
          {onSwitchToList && (
            <button className="tpl-btn tpl-btn-ghost" onClick={onSwitchToList} title="View all templates">
              <LayoutList size={15} /> All Templates
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="tpl-body">
        {/* Builder column */}
        <div className="tpl-builder">
          <div className="tpl-panel-header">
            <Layers size={15} />
            <span>Groups &amp; Fields</span>
            <span className="tpl-count-badge">{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="tpl-groups-list">
            {groups.length === 0 ? (
              <div className="tpl-builder-empty">
                <Layers size={36} />
                <p>No groups yet.</p>
                <button className="tpl-btn tpl-btn-primary" onClick={addGroup}>
                  <Plus size={15} /> Add First Group
                </button>
              </div>
            ) : (
              groups.map((group, idx) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onUpdate={(updated) => updateGroup(idx, updated)}
                  onRemove={() => removeGroup(idx)}
                  onDuplicate={() => duplicateGroup(idx)}
                />
              ))
            )}
            {groups.length > 0 && (
              <button className="tpl-add-group-row" onClick={addGroup}>
                <Plus size={14} /> Add Group
              </button>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="tpl-right-col">
          <PreviewPanel groups={groups} templateName={templateName} />
          <AccountsPanel
            accounts={accounts}
            loadingAccounts={loadingAccounts}
            selectedAccounts={selectedAccounts}
            onChange={setSelectedAccounts}
            onRefresh={fetchAccounts}
          />
        </div>
      </div>

      {showMd && <MdModal md={md} onClose={() => setShowMd(false)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Templates List Tab ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ─── View Detail Modal ────────────────────────────────────────────────────────
function TemplateDetailModal({ template, onClose, onEdit, onDuplicate }) {
  const groups = parseRequestTemplate(template?.request_template);
  return (
    <div className="tpl-modal-overlay" onClick={onClose}>
      <div className="tpl-modal tpl-modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-modal-header">
          <span className="tpl-modal-title">
            <Eye size={16} /> Template #{template?.id}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {onDuplicate && (
              <button
                className="tpl-pill-btn add-field"
                onClick={() => onDuplicate(template)}
                title="Duplicate template"
              >
                <Copy size={12} /> Duplicate
              </button>
            )}
            <button className="tpl-pill-btn add-sub" onClick={() => onEdit(template)}>
              <Edit2 size={12} /> Edit
            </button>
            <button className="tpl-icon-btn tpl-remove-btn" onClick={onClose}><X size={14} /></button>
          </div>
        </div>
        <div className="tpl-modal-body">
          <div className="tpl-detail-meta">
            <span className="tpl-meta-item"><Clock size={12} /> Created: {fmtDate(template?.created_at)}</span>
            <span className="tpl-meta-item"><Clock size={12} /> Updated: {fmtDate(template?.updated_at)}</span>
            <span className="tpl-count-badge">{groups.length} group{groups.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="tpl-detail-groups">
            {groups.map((g) => (
              <div key={g.id} className="tpl-detail-group">
                <div className="tpl-detail-group-name">
                  <Layers size={13} /> {g.name}
                </div>
                {g.fields.length > 0 && (
                  <div className="tpl-detail-fields">
                    {g.fields.map((f) => (
                      <div key={f.id} className="tpl-detail-field">
                        <span className="tpl-detail-field-label">{f.label}</span>
                        <span className="tpl-detail-field-type">{f.type}</span>
                      </div>
                    ))}
                  </div>
                )}
                {g.subGroups.map((sg) => (
                  <div key={sg.id} className="tpl-detail-subgroup">
                    <div className="tpl-detail-group-name" style={{ fontSize: 12, opacity: 0.85 }}>
                      <Layers size={11} /> {sg.name}
                    </div>
                    <div className="tpl-detail-fields">
                      {sg.fields.map((f) => (
                        <div key={f.id} className="tpl-detail-field">
                          <span className="tpl-detail-field-label">{f.label}</span>
                          <span className="tpl-detail-field-type">{f.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal (full builder inside modal) ───────────────────────────────────
function TemplateEditModal({ template, onClose, onSaved }) {
  const [groups, setGroups] = useState(() => parseRequestTemplate(template?.request_template));
  const [saving, setSaving] = useState(false);

  const addGroup   = () => setGroups((prev) => [...prev, newGroup()]);
  const updateGroup = useCallback((idx, updated) => {
    setGroups((prev) => { const next = [...prev]; next[idx] = updated; return next; });
  }, []);
  const removeGroup = (idx) => setGroups((prev) => prev.filter((_, i) => i !== idx));
  const duplicateGroup = (idx) => {
    setGroups((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, cloneGroupDeep(prev[idx]));
      return next;
    });
  };

  const handleUpdate = async () => {
    if (groups.length === 0) { toast.error("Add at least one group."); return; }
    setSaving(true);
    try {
      await axiosClient.put(TEMPLATE_URL(template.id), { groups: buildGroupsPayload(groups) });
      toast.success("Template updated successfully!");
      onSaved();
      onClose();
    } catch (err) {
      if (err.response?.status !== 401) {
        const errData = err.response?.data;
        const msg = errData?.errors
          ? Object.values(errData.errors).flat().join(", ")
          : errData?.message || err.message || "Failed to update template";
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tpl-modal-overlay" onClick={onClose}>
      <div className="tpl-modal tpl-modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="tpl-modal-header">
          <span className="tpl-modal-title">
            <Edit2 size={16} /> Edit Template #{template?.id}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="tpl-btn tpl-btn-secondary" style={{ height: 32, fontSize: 12 }} onClick={addGroup}>
              <Plus size={13} /> Add Group
            </button>
            <button
              className="tpl-btn tpl-btn-primary"
              style={{ height: 32, fontSize: 12 }}
              onClick={handleUpdate}
              disabled={saving}
            >
              {saving ? <RefreshCw size={13} className="tpl-spin" /> : <Save size={13} />}
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button className="tpl-icon-btn tpl-remove-btn" onClick={onClose}><X size={14} /></button>
          </div>
        </div>
        <div className="tpl-modal-body tpl-edit-body">
          {groups.length === 0 ? (
            <div className="tpl-builder-empty">
              <Layers size={30} />
              <p>No groups yet.</p>
              <button className="tpl-btn tpl-btn-primary" onClick={addGroup}>
                <Plus size={14} /> Add Group
              </button>
            </div>
          ) : (
            <div className="tpl-groups-list" style={{ padding: 0 }}>
              {groups.map((group, idx) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onUpdate={(updated) => updateGroup(idx, updated)}
                  onRemove={() => removeGroup(idx)}
                  onDuplicate={() => duplicateGroup(idx)}
                />
              ))}
              <button className="tpl-add-group-row" onClick={addGroup}>
                <Plus size={14} /> Add Group
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────
function DeleteConfirmModal({ template, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axiosClient.delete(TEMPLATE_URL(template.id));
      toast.success(`Template #${template.id} deleted.`);
      onDeleted();
      onClose();
    } catch (err) {
      if (err.response?.status !== 401)
        toast.error(err.response?.data?.message || err.message || "Failed to delete template");
    } finally {
      setDeleting(false);
    }
  };
  return (
    <div className="tpl-modal-overlay" onClick={onClose}>
      <div className="tpl-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="tpl-modal-header">
          <span className="tpl-modal-title" style={{ color: "var(--accent-rose)" }}>
            <AlertTriangle size={16} /> Delete Template
          </span>
          <button className="tpl-icon-btn tpl-remove-btn" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="tpl-modal-body" style={{ padding: "20px 24px" }}>
          <p style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 6 }}>
            Are you sure you want to delete <strong>Template #{template?.id}</strong>?
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            This action cannot be undone. The template and its associated AI file will be permanently removed.
          </p>
          <div className="tpl-delete-actions">
            <button className="tpl-btn tpl-btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="tpl-btn tpl-btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <RefreshCw size={14} className="tpl-spin" /> : <Trash2 size={14} />}
              {deleting ? "Deleting..." : "Delete Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Templates Listing Tab ────────────────────────────────────────────────────
function TemplatesListTab({ onSwitchToBuilder }) {
  const [templates, setTemplates]     = useState([]);
  const [loading, setLoading]         = useState(false);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [total, setTotal]             = useState(0);

  const [viewTemplate, setViewTemplate]     = useState(null);
  const [editTemplate, setEditTemplate]     = useState(null);
  const [deleteTemplate, setDeleteTemplate] = useState(null);
  const [duplicatingId, setDuplicatingId]   = useState(null);

  const fetchTemplates = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await axiosClient.get(LIST_URL, { params: { page: p, per_page: 10 } });
      const outer = res.data?.data || res.data;
      // Handle both plain array and Laravel paginator (or stringified data)
      if (Array.isArray(outer)) {
        setTemplates(outer);
        setTotal(outer.length);
        setTotalPages(1);
      } else if (Array.isArray(outer?.data)) {
        setTemplates(outer.data);
        setTotal(Number(outer.total) || outer.data.length);
        setTotalPages(Number(outer.last_page) || 1);
      } else if (typeof outer?.data === "string") {
        try {
          const parsed = JSON.parse(outer.data);
          const arr = Array.isArray(parsed) ? parsed : [];
          setTemplates(arr);
          setTotal(Number(outer.total) || arr.length);
          setTotalPages(Number(outer.last_page) || 1);
        } catch {
          setTemplates([]);
        }
      } else {
        setTemplates([]);
      }
      setPage(p);
    } catch (err) {
      if (err.response?.status !== 401)
        toast.error(err.response?.data?.message || err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch full template detail before opening view/edit
  const openView = async (row) => {
    try {
      const res = await axiosClient.get(TEMPLATE_URL(row.id));
      setViewTemplate(res.data?.data || res.data);
    } catch {
      setViewTemplate(row);
    }
  };

  const openEdit = async (row) => {
    try {
      const res = await axiosClient.get(TEMPLATE_URL(row.id));
      setEditTemplate(res.data?.data || res.data);
    } catch {
      setEditTemplate(row);
    }
  };

  const handleDuplicateTemplate = async (tpl) => {
    setDuplicatingId(tpl.id);
    try {
      let fullTpl = tpl;
      try {
        const res = await axiosClient.get(TEMPLATE_URL(tpl.id));
        fullTpl = res.data?.data || res.data || tpl;
      } catch {
        // fallback
      }
      const parsedGroups = parseRequestTemplate(fullTpl?.request_template);
      const payload = {
        groups: buildGroupsPayload(parsedGroups),
      };
      await axiosClient.post(SAVE_TEMPLATE_URL, payload);
      toast.success(`Template #${tpl.id} duplicated successfully!`);
      if (viewTemplate?.id === tpl.id) setViewTemplate(null);
      fetchTemplates(page);
    } catch (err) {
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.message || err.message || "Failed to duplicate template");
      }
    } finally {
      setDuplicatingId(null);
    }
  };

  useEffect(() => { fetchTemplates(1); }, [fetchTemplates]);

  return (
    <div className="tpl-list-tab">
      {/* Toolbar */}
      <div className="tpl-list-toolbar">
        <span className="tpl-list-count">
          {total} template{total !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {onSwitchToBuilder && (
            <button className="tpl-btn tpl-btn-primary" onClick={onSwitchToBuilder}>
              <Plus size={14} /> New Template
            </button>
          )}
          <button
            className="tpl-btn tpl-btn-ghost"
            onClick={() => fetchTemplates(page)}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "tpl-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="tpl-list-card">
        <div className="tpl-table-wrap">
          <table className="tpl-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Groups</th>
                <th>Created</th>
                <th>Updated</th>
                <th className="tpl-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="tpl-table-state-cell">
                    <div className="tpl-table-state">
                      <RefreshCw size={26} className="tpl-spin" style={{ color: "var(--primary)" }} />
                      <span className="tpl-empty-desc" style={{ margin: 0 }}>Loading templates...</span>
                    </div>
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="tpl-table-state-cell">
                    <div className="tpl-table-state">
                      <div className="tpl-empty-icon-wrap">
                        <Database size={28} />
                      </div>
                      <h4 className="tpl-empty-title">No templates found</h4>
                      <p className="tpl-empty-desc">
                        Get started by creating your first input template for users.
                      </p>
                      {onSwitchToBuilder && (
                        <button
                          className="tpl-btn tpl-btn-primary"
                          onClick={onSwitchToBuilder}
                        >
                          <Plus size={15} /> Create First Template
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                templates.map((tpl) => {
                  const groups = extractGroupsArray(tpl?.request_template);
                  const groupNames = groups.slice(0, 3).map((g) => g?.name).filter(Boolean);
                  return (
                    <tr key={tpl.id} className="tpl-table-row">
                      <td>
                        <span className="tpl-id-badge">#{tpl.id}</span>
                      </td>
                      <td>
                        <div className="tpl-group-chips">
                          {groupNames.length > 0
                            ? groupNames.map((name, i) => (
                                <span key={i} className="tpl-group-chip">{name}</span>
                              ))
                            : <span className="tpl-chip-empty">—</span>}
                          {groups.length > 3 && (
                            <span className="tpl-chip-more">+{groups.length - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td className="tpl-cell-date">{fmtDate(tpl.created_at)}</td>
                      <td className="tpl-cell-date">{fmtDate(tpl.updated_at)}</td>
                      <td>
                        <div className="tpl-row-actions">
                          <button
                            className="tpl-action-btn view-btn"
                            onClick={() => openView(tpl)}
                            title="View details"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="tpl-action-btn edit-btn"
                            onClick={() => openEdit(tpl)}
                            title="Edit template"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="tpl-action-btn copy-btn"
                            onClick={() => handleDuplicateTemplate(tpl)}
                            title="Duplicate template"
                            disabled={duplicatingId === tpl.id}
                          >
                            {duplicatingId === tpl.id ? (
                              <RefreshCw size={13} className="tpl-spin" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <button
                            className="tpl-action-btn del-btn"
                            onClick={() => setDeleteTemplate(tpl)}
                            title="Delete template"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="tpl-pagination">
            <span className="tpl-page-info">
              Page {page} of {totalPages}
            </span>
            <div className="tpl-page-controls">
              <button
                className="tpl-icon-btn tpl-refresh-btn"
                disabled={loading || page <= 1}
                onClick={() => fetchTemplates(page - 1)}
              >
                <ChevronLeft size={15} />
              </button>
              <button
                className="tpl-icon-btn tpl-refresh-btn"
                disabled={loading || page >= totalPages}
                onClick={() => fetchTemplates(page + 1)}
              >
                <ChevronRightIcon size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {viewTemplate && (
        <TemplateDetailModal
          template={viewTemplate}
          onClose={() => setViewTemplate(null)}
          onEdit={(tpl) => { setViewTemplate(null); setEditTemplate(tpl); }}
          onDuplicate={handleDuplicateTemplate}
        />
      )}
      {editTemplate && (
        <TemplateEditModal
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSaved={() => fetchTemplates(page)}
        />
      )}
      {deleteTemplate && (
        <DeleteConfirmModal
          template={deleteTemplate}
          onClose={() => setDeleteTemplate(null)}
          onDeleted={() => fetchTemplates(page)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Root Page (tab wrapper) ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export function TemplatesPage() {
  const [activeTab, setActiveTab] = useState("builder");
  return (
    <div className="tpl-root">
      {/* Tab Bar */}
      <div className="tpl-tab-bar">
        <button
          className={`tpl-tab ${activeTab === "builder" ? "active" : ""}`}
          onClick={() => setActiveTab("builder")}
        >
          <PenSquare size={15} /> Builder
        </button>
        <button
          className={`tpl-tab ${activeTab === "list" ? "active" : ""}`}
          onClick={() => setActiveTab("list")}
        >
          <LayoutList size={15} /> All Templates
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "builder" ? (
        <BuilderTab onSwitchToList={() => setActiveTab("list")} />
      ) : (
        <TemplatesListTab onSwitchToBuilder={() => setActiveTab("builder")} />
      )}
    </div>
  );
}

export default TemplatesPage;

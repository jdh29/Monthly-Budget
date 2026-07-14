import React, { useState, useMemo, useEffect, useRef } from "react";

const FREQUENCY_OPTIONS = ["Weekly", "Fortnightly", "Monthly"];

const toMonthly = (amount, frequency) => {
  if (!amount || isNaN(amount)) return 0;
  const n = parseFloat(amount);
  if (frequency === "Weekly") return n * 52 / 12;
  if (frequency === "Fortnightly") return n * 26 / 12;
  return n;
};

const fmt = (n) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const DEFAULT_ITEMS = [
  { id: "wage",          label: "Wage",                         category: "Income",        defaultFreq: "Weekly",       isIncome: true, multiDate: true },
  { id: "rent",          label: "Rent",                         category: "Housing",       defaultFreq: "Weekly",       multiDate: true },
  { id: "allianz",       label: "Allianz Car Insurance",        category: "Vehicle",       defaultFreq: "Monthly" },
  { id: "angle_auto",    label: "Angle Auto Car Loan",          category: "Vehicle",       defaultFreq: "Monthly" },
  { id: "bupa",          label: "Bupa",                         category: "Insurance",     defaultFreq: "Monthly",      multiDate: true },
  { id: "budget_direct", label: "Budget Direct House Insurance",category: "Insurance",     defaultFreq: "Monthly" },
  { id: "telstra",       label: "Telstra",                      category: "Utilities",     defaultFreq: "Monthly" },
  { id: "starlink",      label: "Starlink",                     category: "Utilities",     defaultFreq: "Monthly" },
  { id: "zip_pay",       label: "Zip Pay",                      category: "Loans & Debt",  defaultFreq: "Monthly",      multiDate: true },
  { id: "zip_money",     label: "Zip Money",                    category: "Loans & Debt",  defaultFreq: "Monthly" },
  { id: "afterpay",      label: "Afterpay",                     category: "Loans & Debt",  defaultFreq: "Fortnightly",  multiDate: true },
  { id: "latitude",      label: "Latitude",                     category: "Loans & Debt",  defaultFreq: "Monthly" },
  { id: "personal_loan", label: "Personal Loan",                category: "Loans & Debt",  defaultFreq: "Fortnightly",  multiDate: true },
  { id: "savings",       label: "Savings",                      category: "Financial",     defaultFreq: "Weekly",       multiDate: true },
  { id: "apple_one",     label: "Apple One",                    category: "Subscriptions", defaultFreq: "Monthly" },
  { id: "audible",       label: "Audible",                      category: "Subscriptions", defaultFreq: "Monthly" },
  { id: "youtube",       label: "YouTube",                      category: "Subscriptions", defaultFreq: "Monthly" },
  { id: "claude",        label: "Claude",                       category: "Subscriptions", defaultFreq: "Monthly" },
  { id: "haircut",       label: "Haircut",                      category: "Personal",      defaultFreq: "Monthly" },
];

const CATEGORY_COLORS = {
  "Income":        { color: "#4ade80", bg: "#052e16", border: "#166534" },
  "Housing":       { color: "#60a5fa", bg: "#0c1f3e", border: "#1e40af" },
  "Vehicle":       { color: "#fbbf24", bg: "#1c1200", border: "#92400e" },
  "Insurance":     { color: "#f472b6", bg: "#1a0a14", border: "#9d174d" },
  "Utilities":     { color: "#a78bfa", bg: "#1a0a2e", border: "#5b21b6" },
  "Loans & Debt":  { color: "#f87171", bg: "#1c0606", border: "#991b1b" },
  "Financial":     { color: "#34d399", bg: "#022c22", border: "#065f46" },
  "Subscriptions": { color: "#38bdf8", bg: "#082f49", border: "#075985" },
  "Personal":      { color: "#fb923c", bg: "#1c0f00", border: "#9a3412" },
};

const newPayment = () => ({ id: Date.now().toString() + Math.floor(Math.random() * 10000).toString(), amount: "", dueDate: "", paid: false });

const getMonthKey = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
const getMonthLabel = (key) => {
  const parts = key.split("-");
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1).toLocaleString("en-AU", { month: "long", year: "numeric" });
};

const buildFreshItems = (template) =>
  template.map(item => ({
    ...item,
    amount: "",
    frequency: item.defaultFreq,
    dueDate: "",
    paid: false,
    payments: item.multiDate ? [newPayment()] : undefined,
  }));

const rolloverItems = (prevItems, template) =>
  template.map(item => {
    const prev = prevItems.find(p => p.id === item.id);
    if (!prev) return { ...item, amount: "", frequency: item.defaultFreq, dueDate: "", paid: false, payments: item.multiDate ? [newPayment()] : undefined };
    return {
      ...item,
      amount: prev.amount,
      frequency: prev.frequency,
      dueDate: "",
      paid: false,
      payments: item.multiDate
        ? (prev.payments || [newPayment()]).map(p => ({ ...p, dueDate: "", paid: false }))
        : undefined,
    };
  });

const STORAGE_KEY = "budget_tracker_v1";
const SYNC_CODE_KEY = "budget_sync_code";

const loadStorage = () => {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};
const saveStorage = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
};
const loadSyncCode = () => {
  try { return localStorage.getItem(SYNC_CODE_KEY) || ""; } catch { return ""; }
};
const saveSyncCode = (code) => {
  try { localStorage.setItem(SYNC_CODE_KEY, code); } catch {}
};

export default function BudgetTracker() {
  const todayKey = getMonthKey(new Date());

  const [allMonths, setAllMonths] = useState(() => {
    const stored = loadStorage();
    if (!stored[todayKey]) {
      const keys = Object.keys(stored).sort();
      const lastKey = keys[keys.length - 1];
      const fresh = lastKey && stored[lastKey]
        ? rolloverItems(stored[lastKey], DEFAULT_ITEMS)
        : buildFreshItems(DEFAULT_ITEMS);
      stored[todayKey] = fresh;
    }
    return stored;
  });

  const [currentKey, setCurrentKey] = useState(todayKey);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState("all");
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [syncCode, setSyncCode] = useState(loadSyncCode);
  const [syncInput, setSyncInput] = useState(loadSyncCode);
  const [showSync, setShowSync] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const isSavingFromCloud = useRef(false);

  const items = allMonths[currentKey] || buildFreshItems(DEFAULT_ITEMS);

  useEffect(() => { saveStorage(allMonths); }, [allMonths]);

  useEffect(() => {
    if (!syncCode) return;
    if (isSavingFromCloud.current) return;
    setSyncStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ syncCode, data: allMonths }),
        });
        setSyncStatus(res.ok ? "saved" : "error");
      } catch { setSyncStatus("error"); }
      setTimeout(() => setSyncStatus(""), 2000);
    }, 800);
    return () => clearTimeout(timer);
  }, [allMonths, syncCode]);

  const loadFromCloud = (code) => {
    setSyncStatus("loading");
    fetch("/api/load?syncCode=" + encodeURIComponent(code))
      .then(r => r.json())
      .then(data => {
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
          isSavingFromCloud.current = true;
          setAllMonths(data);
          saveStorage(data);
          setTimeout(() => { isSavingFromCloud.current = false; }, 2000);
        }
        setSyncStatus("saved");
        setTimeout(() => setSyncStatus(""), 2000);
      })
      .catch(() => setSyncStatus("error"));
  };

  const pushToCloud = async () => {
    if (!syncCode) return;
    setSyncStatus("saving");
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCode, data: allMonths }),
      });
      setSyncStatus(res.ok ? "saved" : "error");
    } catch { setSyncStatus("error"); }
    setTimeout(() => setSyncStatus(""), 2000);
  };

  useEffect(() => { if (syncCode) loadFromCloud(syncCode); }, [syncCode]);

  const applySyncCode = () => {
    const code = syncInput.trim();
    if (!code) return;
    saveSyncCode(code);
    setSyncCode(code);
    setShowSync(false);
  };

  const clearSyncCode = () => {
    saveSyncCode("");
    setSyncCode("");
    setSyncInput("");
    setShowSync(false);
  };

  const setItems = (updater) => {
    setAllMonths(prev => {
      const current = prev[currentKey] || buildFreshItems(DEFAULT_ITEMS);
      const updated = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [currentKey]: updated };
    });
  };

  const update = (id, field, value) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addPayment = (itemId) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, payments: [...(item.payments || []), newPayment()] } : item
    ));
  };

  const updatePayment = (itemId, payId, field, value) => {
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, payments: item.payments.map(p => p.id === payId ? { ...p, [field]: value } : p) }
        : item
    ));
  };

  const removePayment = (itemId, payId) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, payments: item.payments.filter(p => p.id !== payId) } : item
    ));
  };

  const switchMonth = (key) => {
    setAllMonths(prev => {
      if (!prev[key]) {
        const keys = Object.keys(prev).sort();
        const lastKey = keys[keys.length - 1];
        const rolled = lastKey && prev[lastKey]
          ? rolloverItems(prev[lastKey], DEFAULT_ITEMS)
          : buildFreshItems(DEFAULT_ITEMS);
        return { ...prev, [key]: rolled };
      }
      return prev;
    });
    setCurrentKey(key);
    setShowMonthPicker(false);
    setView("all");
  };

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = -3; i <= 2; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push(getMonthKey(d));
    }
    Object.keys(allMonths).forEach(k => { if (!options.includes(k)) options.push(k); });
    return options.sort();
  }, [allMonths]);

  const categories = useMemo(() => {
    const cats = {};
    for (const item of items) {
      if (!cats[item.category]) cats[item.category] = [];
      cats[item.category].push(item);
    }
    return cats;
  }, [items]);

  const monthlyByCategory = useMemo(() => {
    const totals = {};
    for (const item of items) {
      let m;
      if (item.multiDate && item.payments) {
        m = item.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      } else {
        m = toMonthly(item.amount, item.frequency);
      }
      totals[item.category] = (totals[item.category] || 0) + m;
    }
    return totals;
  }, [items]);

  const totalIncome = monthlyByCategory["Income"] || 0;
  const totalExpenses = Object.entries(monthlyByCategory)
    .filter(([cat]) => cat !== "Income")
    .reduce((s, [, v]) => s + v, 0);
  const balance = totalIncome - totalExpenses;
  const paidCount = items.filter(i => i.multiDate ? i.payments?.every(p => p.paid) : i.paid).length;

  const exportCSV = () => {
    const rows = [["Month", getMonthLabel(currentKey)], [], ["Item", "Category", "Amount", "Frequency", "Monthly Equiv.", "Due Date", "Paid"]];
    for (const item of items) {
      if (item.multiDate && item.payments) {
        item.payments.forEach((p, i) => {
          rows.push([item.label + " (payment " + (i + 1) + ")", item.category, p.amount || "0", "One-off", (parseFloat(p.amount) || 0).toFixed(2), p.dueDate || "", p.paid ? "Yes" : "No"]);
        });
      } else {
        rows.push([item.label, item.category, item.amount || "0", item.frequency, toMonthly(item.amount, item.frequency).toFixed(2), item.dueDate || "", item.paid ? "Yes" : "No"]);
      }
    }
    rows.push([]);
    rows.push(["TOTAL INCOME (monthly)", "", "", "", totalIncome.toFixed(2)]);
    rows.push(["TOTAL EXPENSES (monthly)", "", "", "", totalExpenses.toFixed(2)]);
    rows.push([balance >= 0 ? "SURPLUS" : "DEFICIT", "", "", "", Math.abs(balance).toFixed(2)]);
    const csv = rows.map(r => r.map(c => '"' + c + '"').join(",")).join("\n");
    navigator.clipboard.writeText(csv).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  const visibleCategories = view === "all" ? Object.keys(categories) : [view];
  const isCurrentMonth = currentKey === todayKey;

  const dotColor = syncStatus === "error" ? "#ef4444"
    : (syncStatus === "saving" || syncStatus === "loading") ? "#fbbf24"
    : syncCode ? "#4ade80" : "#374151";

  return (
    <div style={{ minHeight: "100vh", background: "#030712", color: "#f9fafb", fontFamily: "'Inter', system-ui, sans-serif", padding: "20px 14px 40px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>Monthly Budget Tracker</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button onClick={() => setShowMonthPicker(!showMonthPicker)} style={{
                  background: "none", border: "1.5px solid #374151", borderRadius: 10,
                  color: "#f9fafb", padding: "6px 14px", fontSize: 24, fontWeight: 800,
                  cursor: "pointer", fontFamily: "inherit", letterSpacing: "-0.02em",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  {getMonthLabel(currentKey)}
                  <span style={{ fontSize: 14, color: "#6b7280" }}>v</span>
                </button>
                {!isCurrentMonth && (
                  <button onClick={() => switchMonth(todayKey)} style={{
                    background: "#1f2937", border: "1px solid #374151", borderRadius: 8,
                    color: "#9ca3af", padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  }}>Today</button>
                )}
              </div>
            </div>

            {/* Sync icon button */}
            <button onClick={() => { setSyncInput(syncCode); setShowSync(!showSync); }} style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "#1a1f2e", border: "1.5px solid #2d3748",
              borderRadius: 20, padding: "8px 14px",
              cursor: "pointer", marginTop: 2, flexShrink: 0,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: dotColor }} />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={syncCode ? "#a78bfa" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                <path d="M3 22v-6h6" />
                <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>

          {/* Month Picker */}
          {showMonthPicker && (
            <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 12, padding: 8, marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {monthOptions.map(key => (
                <button key={key} onClick={() => switchMonth(key)} style={{
                  padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  border: key === currentKey ? "1.5px solid #4ade80" : "1.5px solid #374151",
                  background: key === currentKey ? "#052e16" : "#1f2937",
                  color: key === currentKey ? "#4ade80" : key === todayKey ? "#f9fafb" : "#9ca3af",
                }}>{getMonthLabel(key)}</button>
              ))}
            </div>
          )}

          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
            {paidCount} of {items.length} payments marked as paid
            {!syncCode && <span style={{ marginLeft: 10, fontSize: 11, color: "#4ade80" }}>* Auto-saving</span>}
            {syncCode && syncStatus && (
              <span style={{ marginLeft: 10, fontSize: 11, color: dotColor }}>
                * {syncStatus === "saving" ? "Syncing..." : syncStatus === "loading" ? "Loading..." : syncStatus === "error" ? "Sync error" : "Synced"}
              </span>
            )}
          </div>

          {/* Sync Panel */}
          {showSync && (
            <div style={{ background: "#111827", border: "1px solid #2d3748", borderRadius: 14, padding: 16, marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>Cross-device Sync</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                Enter the same sync code on all your devices to keep data in sync.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  value={syncInput}
                  onChange={e => setSyncInput(e.target.value)}
                  placeholder="e.g. james-budget-2026"
                  style={{
                    flex: 1, minWidth: 160, padding: "8px 12px",
                    background: "#0f172a", border: "1px solid #374151",
                    borderRadius: 8, color: "#f9fafb", fontSize: 13,
                    fontFamily: "inherit", outline: "none",
                  }}
                />
                <button onClick={applySyncCode} style={{
                  background: "#3b0764", border: "1.5px solid #a78bfa",
                  color: "#a78bfa", padding: "8px 16px", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>Save</button>
                {syncCode && (
                  <button onClick={() => loadFromCloud(syncCode)} style={{
                    background: "#052e16", border: "1.5px solid #4ade80",
                    color: "#4ade80", padding: "8px 14px", borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>Pull</button>
                )}
                {syncCode && (
                  <button onClick={pushToCloud} style={{
                    background: "#082f49", border: "1.5px solid #38bdf8",
                    color: "#38bdf8", padding: "8px 14px", borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>Push</button>
                )}
                {syncCode && (
                  <button onClick={clearSyncCode} style={{
                    background: "none", border: "1px solid #374151",
                    color: "#6b7280", padding: "8px 14px", borderRadius: 8,
                    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}>Disable</button>
                )}
              </div>
              {syncCode && (
                <div style={{ fontSize: 11, color: "#4b5563", marginTop: 10 }}>
                  Active code: <span style={{ color: "#a78bfa" }}>{syncCode}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Monthly Income", value: totalIncome, color: "#4ade80" },
            { label: "Monthly Expenses", value: totalExpenses, color: "#f97316" },
            { label: balance >= 0 ? "Surplus" : "Deficit", value: Math.abs(balance), color: balance >= 0 ? "#34d399" : "#ef4444" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{fmt(value)}</div>
            </div>
          ))}
        </div>

        {/* Category Filter Tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={() => setView("all")} style={{
            padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            border: view === "all" ? "1.5px solid #f9fafb" : "1.5px solid #374151",
            background: view === "all" ? "#1f2937" : "#111827",
            color: view === "all" ? "#f9fafb" : "#6b7280",
          }}>All</button>
          {Object.keys(categories).map(cat => {
            const meta = CATEGORY_COLORS[cat] || { color: "#9ca3af", bg: "#111827", border: "#374151" };
            return (
              <button key={cat} onClick={() => setView(cat)} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                border: view === cat ? "1.5px solid " + meta.color : "1.5px solid #374151",
                background: view === cat ? meta.bg : "#111827",
                color: view === cat ? meta.color : "#6b7280",
              }}>{cat}</button>
            );
          })}
        </div>

        {/* Categories */}
        {visibleCategories.map(cat => {
          const meta = CATEGORY_COLORS[cat] || { color: "#9ca3af", bg: "#111827", border: "#374151" };
          const catItems = categories[cat] || [];
          const catTotal = monthlyByCategory[cat] || 0;
          return (
            <div key={cat} style={{ background: "#0d1117", border: "1px solid " + meta.border, borderRadius: 14, marginBottom: 16, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: meta.bg, borderBottom: "1px solid " + meta.border }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: meta.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{cat}</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: meta.color, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(catTotal)}<span style={{ fontWeight: 400, fontSize: 11, color: "#6b7280", marginLeft: 4 }}>/mo</span>
                </span>
              </div>

              {catItems.map((item, idx) => {
                const isIncome = item.isIncome;

                if (item.multiDate) {
                  const apTotal = item.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                  const allDone = item.payments.length > 0 && item.payments.every(p => p.paid);
                  const entryLabel = isIncome ? "Pay" : "Payment";
                  const dateLabel = isIncome ? "Pay Date" : "Due Date";
                  const doneLabel = isIncome ? "RECVD" : "PAID";
                  return (
                    <div key={item.id} style={{ borderTop: idx > 0 ? "1px solid #1a1f2e" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px 6px", background: allDone ? "rgba(74,222,128,0.04)" : "transparent" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: meta.color }}>{item.label}</span>
                          {isIncome && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", background: "#052e16", border: "1px solid #166534", padding: "1px 5px", borderRadius: 4, letterSpacing: "0.05em" }}>INCOMING</span>
                          )}
                          <span style={{ fontSize: 10, color: "#6b7280" }}>{item.payments.length} {entryLabel.toLowerCase()}{item.payments.length !== 1 ? "s" : ""} this month</span>
                          {apTotal > 0 && <span style={{ fontSize: 11, color: "#f9fafb", fontVariantNumeric: "tabular-nums" }}>= {fmt(apTotal)}</span>}
                        </div>
                        <button onClick={() => addPayment(item.id)} style={{ background: meta.bg, border: "1px solid " + meta.border, color: meta.color, padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Add</button>
                      </div>
                      {item.payments.map((p, pi) => (
                        <div key={p.id} style={{ padding: "8px 12px 8px 24px", background: p.paid ? "rgba(74,222,128,0.04)" : "#0a0e17", borderTop: "1px solid #1a1f2e", opacity: p.paid ? 0.6 : 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input type="checkbox" checked={p.paid} onChange={e => updatePayment(item.id, p.id, "paid", e.target.checked)} style={{ width: 16, height: 16, accentColor: meta.color, cursor: "pointer" }} />
                              <span style={{ fontSize: 12, color: p.paid ? "#6b7280" : "#9ca3af", textDecoration: p.paid ? "line-through" : "none" }}>{entryLabel} {pi + 1}</span>
                              {p.paid && <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", background: "#052e16", padding: "1px 5px", borderRadius: 4 }}>{doneLabel}</span>}
                            </div>
                            {item.payments.length > 1 && (
                              <button onClick={() => removePayment(item.id, p.id)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>x</button>
                            )}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <div style={{ fontSize: 9, color: "#4b5563", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Amount</div>
                              <div style={{ position: "relative" }}>
                                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: 13, pointerEvents: "none" }}>$</span>
                                <input type="number" min="0" placeholder="0" value={p.amount} onChange={e => updatePayment(item.id, p.id, "amount", e.target.value)}
                                  style={{ width: "100%", padding: "8px 8px 8px 22px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: "#f9fafb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                                  onFocus={e => e.target.style.borderColor = meta.color} onBlur={e => e.target.style.borderColor = "#1f2937"} />
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 9, color: "#4b5563", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{dateLabel}</div>
                              <input type="date" value={p.dueDate} onChange={e => updatePayment(item.id, p.id, "dueDate", e.target.value)}
                                style={{ width: "100%", padding: "8px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: p.dueDate ? "#f9fafb" : "#4b5563", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                                onFocus={e => e.target.style.borderColor = meta.color} onBlur={e => e.target.style.borderColor = "#1f2937"} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                const monthly = toMonthly(item.amount, item.frequency);
                return (
                  <div key={item.id} style={{ padding: "10px 14px", background: item.paid ? (isIncome ? "rgba(74,222,128,0.07)" : "rgba(74,222,128,0.04)") : "transparent", borderTop: idx > 0 ? "1px solid #1a1f2e" : "none", opacity: item.paid ? 0.7 : 1, transition: "opacity 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="checkbox" checked={item.paid} onChange={e => update(item.id, "paid", e.target.checked)} style={{ width: 18, height: 18, accentColor: meta.color, cursor: "pointer", flexShrink: 0 }} />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: item.paid ? "#6b7280" : "#f9fafb", textDecoration: item.paid ? "line-through" : "none" }}>{item.label}</span>
                            {isIncome && <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", background: "#052e16", border: "1px solid #166534", padding: "1px 5px", borderRadius: 4, letterSpacing: "0.05em" }}>INCOMING</span>}
                          </div>
                          {monthly > 0 && item.frequency !== "Monthly" && (
                            <div style={{ fontSize: 11, color: "#4b5563", marginTop: 1 }}>{fmt(monthly)}/mo</div>
                          )}
                        </div>
                      </div>
                      {item.paid && <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", background: "#052e16", padding: "2px 8px", borderRadius: 5, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{isIncome ? "RECVD" : "PAID"}</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingLeft: 28 }}>
                      <div>
                        <div style={{ fontSize: 9, color: "#4b5563", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Amount</div>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: 13, pointerEvents: "none" }}>$</span>
                          <input type="number" min="0" placeholder="0" value={item.amount} onChange={e => update(item.id, "amount", e.target.value)}
                            style={{ width: "100%", padding: "8px 6px 8px 22px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: "#f9fafb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", fontVariantNumeric: "tabular-nums" }}
                            onFocus={e => e.target.style.borderColor = meta.color} onBlur={e => e.target.style.borderColor = "#1f2937"} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: "#4b5563", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Frequency</div>
                        <select value={item.frequency} onChange={e => update(item.id, "frequency", e.target.value)}
                          style={{ width: "100%", padding: "8px 4px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: "#f9fafb", fontSize: 12, fontFamily: "inherit", outline: "none", cursor: "pointer", boxSizing: "border-box" }}>
                          {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: "#4b5563", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{isIncome ? "Pay Day" : "Due Date"}</div>
                        <input type="date" value={item.dueDate} onChange={e => update(item.id, "dueDate", e.target.value)}
                          style={{ width: "100%", padding: "8px 4px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: item.dueDate ? "#f9fafb" : "#4b5563", fontSize: 11, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                          onFocus={e => e.target.style.borderColor = meta.color} onBlur={e => e.target.style.borderColor = "#1f2937"} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8 }}>
          <button onClick={exportCSV} style={{ background: "#166534", border: "1.5px solid #4ade80", color: "#4ade80", padding: "9px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {copied ? "Copied!" : "Copy CSV"}
          </button>
          <button onClick={() => setItems(prev => prev.map(i => ({ ...i, paid: false, dueDate: "", payments: i.multiDate ? [newPayment()] : undefined })))} style={{ background: "none", border: "1px solid #374151", color: "#6b7280", padding: "9px 20px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Reset Month
          </button>
        </div>
      </div>
    </div>
  );
}

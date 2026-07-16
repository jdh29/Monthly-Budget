import React, { useState, useMemo, useEffect, useRef } from "react";

const FREQUENCY_OPTIONS = ["Weekly", "Fortnightly", "Monthly"];
const toMonthly = (amount, frequency) => {
  if (!amount || isNaN(amount)) return 0;
  const n = parseFloat(amount);
  if (frequency === "Weekly") return n * 52 / 12;
  if (frequency === "Fortnightly") return n * 26 / 12;
  return n;
};
const fmt = (n) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

const DEFAULT_ITEMS = [
  { id: "wage", label: "Wage", category: "Income", defaultFreq: "Weekly", isIncome: true, multiDate: true },
  { id: "rent", label: "Rent", category: "Housing", defaultFreq: "Weekly", multiDate: true },
  { id: "allianz", label: "Allianz Car Insurance", category: "Vehicle", defaultFreq: "Monthly" },
  { id: "angle_auto", label: "Angle Auto Car Loan", category: "Vehicle", defaultFreq: "Monthly" },
  { id: "bupa", label: "Bupa", category: "Insurance", defaultFreq: "Monthly", multiDate: true },
  { id: "budget_direct", label: "Budget Direct House Insurance", category: "Insurance", defaultFreq: "Monthly" },
  { id: "telstra", label: "Telstra", category: "Utilities", defaultFreq: "Monthly" },
  { id: "starlink", label: "Starlink", category: "Utilities", defaultFreq: "Monthly" },
  { id: "zip_pay", label: "Zip Pay", category: "Loans & Debt", defaultFreq: "Monthly", multiDate: true },
  { id: "zip_money", label: "Zip Money", category: "Loans & Debt", defaultFreq: "Monthly" },
  { id: "afterpay", label: "Afterpay", category: "Loans & Debt", defaultFreq: "Fortnightly", multiDate: true },
  { id: "latitude", label: "Latitude", category: "Loans & Debt", defaultFreq: "Monthly" },
  { id: "personal_loan", label: "Personal Loan", category: "Loans & Debt", defaultFreq: "Fortnightly", multiDate: true },
  { id: "savings", label: "Savings", category: "Financial", defaultFreq: "Weekly", multiDate: true },
  { id: "apple_one", label: "Apple One", category: "Subscriptions", defaultFreq: "Monthly" },
  { id: "audible", label: "Audible", category: "Subscriptions", defaultFreq: "Monthly" },
  { id: "youtube", label: "YouTube", category: "Subscriptions", defaultFreq: "Monthly" },
  { id: "claude", label: "Claude", category: "Subscriptions", defaultFreq: "Monthly" },
  { id: "haircut", label: "Haircut", category: "Personal", defaultFreq: "Monthly" },
];

const CATEGORY_COLORS = {
  "Income": { color: "#4ade80", bg: "#052e16", border: "#166534" },
  "Housing": { color: "#60a5fa", bg: "#0c1f3e", border: "#1e40af" },
  "Vehicle": { color: "#fbbf24", bg: "#1c1200", border: "#92400e" },
  "Insurance": { color: "#f472b6", bg: "#1a0a14", border: "#9d174d" },
  "Utilities": { color: "#a78bfa", bg: "#1a0a2e", border: "#5b21b6" },
  "Loans & Debt": { color: "#f87171", bg: "#1c0606", border: "#991b1b" },
  "Financial": { color: "#34d399", bg: "#022c22", border: "#065f46" },
  "Subscriptions": { color: "#38bdf8", bg: "#082f49", border: "#075985" },
  "Personal": { color: "#fb923c", bg: "#1c0f00", border: "#9a3412" },
};

const newPayment = () => ({ id: Date.now().toString() + Math.floor(Math.random() * 10000).toString(), amount: "", dueDate: "", paid: false });
const getMonthKey = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
const getMonthLabel = (key) => { const p = key.split("-"); return new Date(parseInt(p[0]), parseInt(p[1]) - 1, 1).toLocaleString("en-AU", { month: "long", year: "numeric" }); };
const buildFreshItems = (t) => t.map(item => ({ ...item, amount: "", frequency: item.defaultFreq, dueDate: "", paid: false, payments: item.multiDate ? [newPayment()] : undefined }));
const rolloverItems = (prev, template) => template.map(item => {
  const p = prev.find(x => x.id === item.id);
  if (!p) return { ...item, amount: "", frequency: item.defaultFreq, dueDate: "", paid: false, payments: item.multiDate ? [newPayment()] : undefined };
  return { ...item, amount: p.amount, frequency: p.frequency, dueDate: "", paid: false, payments: item.multiDate ? (p.payments || [newPayment()]).map(x => ({ ...x, dueDate: "", paid: false })) : undefined };
});

const SYNC_KEY = "bgt_sync";
const getSyncCode = () => { try { return localStorage.getItem(SYNC_KEY) || ""; } catch { return ""; } };
const storeSyncCode = (c) => { try { localStorage.setItem(SYNC_KEY, c); } catch {} };

export default function App() {
  const today = getMonthKey(new Date());
  const [months, setMonths] = useState({ [today]: buildFreshItems(DEFAULT_ITEMS) });
  const [monthKey, setMonthKey] = useState(today);
  const [view, setView] = useState("all");
  const [showPicker, setShowPicker] = useState(false);
  const [syncCode, setSyncCode] = useState(getSyncCode);
  const [syncInput, setSyncInput] = useState(getSyncCode);
  const [showSync, setShowSync] = useState(false);
  const [status, setStatus] = useState("idle");
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);

  // These refs track cloud operations to prevent conflicts
  const cloudLoading = useRef(false);
  const saveTimer = useRef(null);

  const items = months[monthKey] || buildFreshItems(DEFAULT_ITEMS);

  // Load from cloud ONCE on startup
  useEffect(() => {
    const code = getSyncCode();
    if (!code) { setReady(true); return; }
    cloudLoading.current = true;
    setStatus("loading");
    fetch("/api/load?syncCode=" + encodeURIComponent(code))
      .then(r => r.json())
      .then(d => {
        if (d && typeof d === "object" && Object.keys(d).length > 0) {
          setMonths(d);
        }
        setStatus("idle");
      })
      .catch(() => setStatus("idle"))
      .finally(() => {
        // Wait 2 seconds before allowing auto-save to fire
        setTimeout(() => {
          cloudLoading.current = false;
          setReady(true);
        }, 2000);
      });
  }, []); // Empty array = runs ONCE only

  // Auto-save: only fires when ready AND not loading from cloud
  useEffect(() => {
    if (!ready || !syncCode || cloudLoading.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (cloudLoading.current) return;
      setStatus("saving");
      fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCode, data: months }),
      })
        .then(r => setStatus(r.ok ? "saved" : "error"))
        .catch(() => setStatus("error"))
        .finally(() => setTimeout(() => setStatus("idle"), 2000));
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [months, ready, syncCode]);

  const connect = () => {
    const code = syncInput.trim();
    if (!code) return;
    storeSyncCode(code);
    setSyncCode(code);
    cloudLoading.current = true;
    setStatus("loading");
    fetch("/api/load?syncCode=" + encodeURIComponent(code))
      .then(r => r.json())
      .then(d => {
        if (d && typeof d === "object" && Object.keys(d).length > 0) setMonths(d);
        setStatus("idle");
      })
      .catch(() => setStatus("idle"))
      .finally(() => setTimeout(() => { cloudLoading.current = false; }, 2000));
    setShowSync(false);
  };

  const wipeAll = () => {
    const empty = { [today]: buildFreshItems(DEFAULT_ITEMS) };
    cloudLoading.current = true;
    setMonths(empty);
    fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncCode, data: empty }),
    }).finally(() => setTimeout(() => { cloudLoading.current = false; }, 2000));
  };

  const setItems = (fn) => setMonths(prev => {
    const cur = prev[monthKey] || buildFreshItems(DEFAULT_ITEMS);
    return { ...prev, [monthKey]: typeof fn === "function" ? fn(cur) : fn };
  });

  const update = (id, field, val) => setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i));
  const addPay = (id) => setItems(prev => prev.map(i => i.id === id ? { ...i, payments: [...(i.payments || []), newPayment()] } : i));
  const updatePay = (id, pid, field, val) => setItems(prev => prev.map(i => i.id === id ? { ...i, payments: i.payments.map(p => p.id === pid ? { ...p, [field]: val } : p) } : i));
  const removePay = (id, pid) => setItems(prev => prev.map(i => i.id === id ? { ...i, payments: i.payments.filter(p => p.id !== pid) } : i));

  const switchMonth = (k) => {
    setMonths(prev => {
      if (!prev[k]) {
        const keys = Object.keys(prev).sort();
        const last = keys[keys.length - 1];
        return { ...prev, [k]: last && prev[last] ? rolloverItems(prev[last], DEFAULT_ITEMS) : buildFreshItems(DEFAULT_ITEMS) };
      }
      return prev;
    });
    setMonthKey(k);
    setShowPicker(false);
    setView("all");
  };

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = -3; i <= 2; i++) opts.push(getMonthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
    Object.keys(months).forEach(k => { if (!opts.includes(k)) opts.push(k); });
    return opts.sort();
  }, [months]);

  const cats = useMemo(() => {
    const c = {};
    for (const item of items) { if (!c[item.category]) c[item.category] = []; c[item.category].push(item); }
    return c;
  }, [items]);

  const catTotals = useMemo(() => {
    const t = {};
    for (const item of items) {
      const m = item.multiDate && item.payments
        ? item.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
        : toMonthly(item.amount, item.frequency);
      t[item.category] = (t[item.category] || 0) + m;
    }
    return t;
  }, [items]);

  const totalIncome = catTotals["Income"] || 0;
  const totalExpenses = Object.entries(catTotals).filter(([c]) => c !== "Income").reduce((s, [, v]) => s + v, 0);
  const balance = totalIncome - totalExpenses;
  const paidCount = items.filter(i => i.multiDate ? i.payments?.every(p => p.paid) : i.paid).length;

  const exportCSV = () => {
    const rows = [["Month", getMonthLabel(monthKey)], [], ["Item", "Category", "Amount", "Frequency", "Monthly", "Due Date", "Paid"]];
    for (const item of items) {
      if (item.multiDate && item.payments) {
        item.payments.forEach((p, i) => rows.push([item.label + " (" + (i + 1) + ")", item.category, p.amount || "0", "One-off", (parseFloat(p.amount) || 0).toFixed(2), p.dueDate || "", p.paid ? "Yes" : "No"]));
      } else {
        rows.push([item.label, item.category, item.amount || "0", item.frequency, toMonthly(item.amount, item.frequency).toFixed(2), item.dueDate || "", item.paid ? "Yes" : "No"]);
      }
    }
    rows.push([], ["TOTAL INCOME", "", "", "", totalIncome.toFixed(2)], ["TOTAL EXPENSES", "", "", "", totalExpenses.toFixed(2)], [balance >= 0 ? "SURPLUS" : "DEFICIT", "", "", "", Math.abs(balance).toFixed(2)]);
    const csv = rows.map(r => r.map(c => '"' + c + '"').join(",")).join("\n");
    navigator.clipboard.writeText(csv).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  const visCats = view === "all" ? Object.keys(cats) : [view];
  const dotColor = status === "error" ? "#ef4444" : (status === "saving" || status === "loading") ? "#fbbf24" : syncCode ? "#4ade80" : "#374151";

  if (!ready) return (
    <div style={{ minHeight: "100vh", background: "#030712", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ color: "#6b7280", fontSize: 14 }}>Loading from cloud...</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#030712", color: "#f9fafb", fontFamily: "'Inter', system-ui, sans-serif", padding: "16px 12px 40px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Monthly Budget</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => setShowPicker(!showPicker)} style={{ background: "none", border: "1.5px solid #374151", borderRadius: 10, color: "#f9fafb", padding: "4px 12px", fontSize: 22, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                  {getMonthLabel(monthKey)}<span style={{ fontSize: 12, color: "#6b7280" }}>v</span>
                </button>
                {monthKey !== today && <button onClick={() => switchMonth(today)} style={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#9ca3af", padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Today</button>}
              </div>
            </div>
            <button onClick={() => { setSyncInput(syncCode); setShowSync(!showSync); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a1f2e", border: "1.5px solid #2d3748", borderRadius: 20, padding: "7px 12px", cursor: "pointer", marginTop: 2 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor }} />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={syncCode ? "#a78bfa" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </button>
          </div>

          {showPicker && (
            <div style={{ background: "#111827", border: "1px solid #374151", borderRadius: 12, padding: 8, marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {monthOptions.map(k => <button key={k} onClick={() => switchMonth(k)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: k === monthKey ? "1.5px solid #4ade80" : "1.5px solid #374151", background: k === monthKey ? "#052e16" : "#1f2937", color: k === monthKey ? "#4ade80" : k === today ? "#f9fafb" : "#9ca3af" }}>{getMonthLabel(k)}</button>)}
            </div>
          )}

          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{paidCount} of {items.length} paid</span>
            {status === "saving" && <span style={{ fontSize: 10, color: "#fbbf24" }}>* Saving...</span>}
            {status === "saved" && <span style={{ fontSize: 10, color: "#4ade80" }}>* Saved</span>}
            {status === "error" && <span style={{ fontSize: 10, color: "#ef4444" }}>* Save failed</span>}
            {status === "loading" && <span style={{ fontSize: 10, color: "#fbbf24" }}>* Loading...</span>}
          </div>

          {showSync && (
            <div style={{ background: "#111827", border: "1px solid #2d3748", borderRadius: 12, padding: 14, marginTop: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f9fafb", marginBottom: 4 }}>Cloud Sync</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10 }}>Enter the same code on all devices. Data saves automatically.</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                <input value={syncInput} onChange={e => setSyncInput(e.target.value)} placeholder="e.g. james-budget-2026" style={{ flex: 1, minWidth: 140, padding: "7px 10px", background: "#0f172a", border: "1px solid #374151", borderRadius: 8, color: "#f9fafb", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                <button onClick={connect} style={{ background: "#3b0764", border: "1.5px solid #a78bfa", color: "#a78bfa", padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Connect</button>
              </div>
              {syncCode && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={wipeAll} style={{ background: "#1c0606", border: "1px solid #991b1b", color: "#f87171", padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Wipe All</button>
                  <button onClick={() => { storeSyncCode(""); setSyncCode(""); setSyncInput(""); setShowSync(false); }} style={{ background: "none", border: "1px solid #374151", color: "#6b7280", padding: "7px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Disconnect</button>
                </div>
              )}
              {syncCode && <div style={{ fontSize: 10, color: "#4b5563", marginTop: 8 }}>Connected: <span style={{ color: "#a78bfa" }}>{syncCode}</span></div>}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[{ label: "Income", value: totalIncome, color: "#4ade80" }, { label: "Expenses", value: totalExpenses, color: "#f97316" }, { label: balance >= 0 ? "Surplus" : "Deficit", value: Math.abs(balance), color: balance >= 0 ? "#34d399" : "#ef4444" }].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 10, padding: "10px" }}>
              <div style={{ fontSize: 9, color: "#6b7280", marginBottom: 3, textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color }}>{fmt(value)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => setView("all")} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: view === "all" ? "1.5px solid #f9fafb" : "1.5px solid #374151", background: view === "all" ? "#1f2937" : "#111827", color: view === "all" ? "#f9fafb" : "#6b7280" }}>All</button>
          {Object.keys(cats).map(cat => { const m = CATEGORY_COLORS[cat] || { color: "#9ca3af", bg: "#111827", border: "#374151" }; return <button key={cat} onClick={() => setView(cat)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: view === cat ? "1.5px solid " + m.color : "1.5px solid #374151", background: view === cat ? m.bg : "#111827", color: view === cat ? m.color : "#6b7280" }}>{cat}</button>; })}
        </div>

        {visCats.map(cat => {
          const m = CATEGORY_COLORS[cat] || { color: "#9ca3af", bg: "#111827", border: "#374151" };
          const catItems = cats[cat] || [];
          return (
            <div key={cat} style={{ background: "#0d1117", border: "1px solid " + m.border, borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: m.bg, borderBottom: "1px solid " + m.border }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: m.color, textTransform: "uppercase" }}>{cat}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: m.color }}>{fmt(catTotals[cat] || 0)}<span style={{ fontWeight: 400, fontSize: 10, color: "#6b7280", marginLeft: 3 }}>/mo</span></span>
              </div>
              {catItems.map((item, idx) => {
                const isIncome = item.isIncome;
                if (item.multiDate) {
                  const total = item.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                  const el = isIncome ? "Pay" : "Payment";
                  const dl = isIncome ? "Pay Date" : "Due Date";
                  return (
                    <div key={item.id} style={{ borderTop: idx > 0 ? "1px solid #1a1f2e" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px 5px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{item.label}</span>
                          {isIncome && <span style={{ fontSize: 8, fontWeight: 700, color: "#4ade80", background: "#052e16", border: "1px solid #166534", padding: "1px 4px", borderRadius: 4 }}>INCOMING</span>}
                          <span style={{ fontSize: 10, color: "#6b7280" }}>{item.payments.length} {el.toLowerCase()}{item.payments.length !== 1 ? "s" : ""}</span>
                          {total > 0 && <span style={{ fontSize: 11, color: "#f9fafb" }}>= {fmt(total)}</span>}
                        </div>
                        <button onClick={() => addPay(item.id)} style={{ background: m.bg, border: "1px solid " + m.border, color: m.color, padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
                      </div>
                      {item.payments.map((p, pi) => (
                        <div key={p.id} style={{ padding: "6px 10px 6px 20px", background: p.paid ? "rgba(74,222,128,0.04)" : "#0a0e17", borderTop: "1px solid #1a1f2e", opacity: p.paid ? 0.6 : 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <input type="checkbox" checked={p.paid} onChange={e => updatePay(item.id, p.id, "paid", e.target.checked)} style={{ width: 15, height: 15, accentColor: m.color, cursor: "pointer" }} />
                              <span style={{ fontSize: 12, color: p.paid ? "#6b7280" : "#9ca3af", textDecoration: p.paid ? "line-through" : "none" }}>{el} {pi + 1}</span>
                              {p.paid && <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", background: "#052e16", padding: "1px 4px", borderRadius: 4 }}>{isIncome ? "RECVD" : "PAID"}</span>}
                            </div>
                            {item.payments.length > 1 && <button onClick={() => removePay(item.id, p.id)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 16, cursor: "pointer", padding: "0 3px" }}>x</button>}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                            <div>
                              <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 2, textTransform: "uppercase" }}>Amount</div>
                              <div style={{ position: "relative" }}>
                                <span style={{ position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: 12, pointerEvents: "none" }}>$</span>
                                <input type="number" min="0" placeholder="0" value={p.amount} onChange={e => updatePay(item.id, p.id, "amount", e.target.value)} style={{ width: "100%", padding: "7px 7px 7px 20px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: "#f9fafb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = m.color} onBlur={e => e.target.style.borderColor = "#1f2937"} />
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 2, textTransform: "uppercase" }}>{dl}</div>
                              <input type="date" value={p.dueDate} onChange={e => updatePay(item.id, p.id, "dueDate", e.target.value)} style={{ width: "100%", padding: "7px 5px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: p.dueDate ? "#f9fafb" : "#4b5563", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = m.color} onBlur={e => e.target.style.borderColor = "#1f2937"} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                const monthly = toMonthly(item.amount, item.frequency);
                return (
                  <div key={item.id} style={{ padding: "9px 12px", background: item.paid ? "rgba(74,222,128,0.04)" : "transparent", borderTop: idx > 0 ? "1px solid #1a1f2e" : "none", opacity: item.paid ? 0.7 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="checkbox" checked={item.paid} onChange={e => update(item.id, "paid", e.target.checked)} style={{ width: 16, height: 16, accentColor: m.color, cursor: "pointer", flexShrink: 0 }} />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: item.paid ? "#6b7280" : "#f9fafb", textDecoration: item.paid ? "line-through" : "none" }}>{item.label}</span>
                            {isIncome && <span style={{ fontSize: 8, fontWeight: 700, color: "#4ade80", background: "#052e16", border: "1px solid #166534", padding: "1px 4px", borderRadius: 4 }}>INCOMING</span>}
                          </div>
                          {monthly > 0 && item.frequency !== "Monthly" && <div style={{ fontSize: 10, color: "#4b5563", marginTop: 1 }}>{fmt(monthly)}/mo</div>}
                        </div>
                      </div>
                      {item.paid && <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", background: "#052e16", padding: "2px 6px", borderRadius: 5 }}>{isIncome ? "RECVD" : "PAID"}</span>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, paddingLeft: 24 }}>
                      <div>
                        <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 2, textTransform: "uppercase" }}>Amount</div>
                        <div style={{ position: "relative" }}>
                          <span style={{ position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)", color: "#6b7280", fontSize: 12, pointerEvents: "none" }}>$</span>
                          <input type="number" min="0" placeholder="0" value={item.amount} onChange={e => update(item.id, "amount", e.target.value)} style={{ width: "100%", padding: "7px 5px 7px 20px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: "#f9fafb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = m.color} onBlur={e => e.target.style.borderColor = "#1f2937"} />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 2, textTransform: "uppercase" }}>Frequency</div>
                        <select value={item.frequency} onChange={e => update(item.id, "frequency", e.target.value)} style={{ width: "100%", padding: "7px 3px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: "#f9fafb", fontSize: 11, fontFamily: "inherit", outline: "none", cursor: "pointer", boxSizing: "border-box" }}>
                          {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <div style={{ fontSize: 8, color: "#4b5563", marginBottom: 2, textTransform: "uppercase" }}>{isIncome ? "Pay Day" : "Due Date"}</div>
                        <input type="date" value={item.dueDate} onChange={e => update(item.id, "dueDate", e.target.value)} style={{ width: "100%", padding: "7px 3px", background: "#0f172a", border: "1px solid #1f2937", borderRadius: 7, color: item.dueDate ? "#f9fafb" : "#4b5563", fontSize: 10, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} onFocus={e => e.target.style.borderColor = m.color} onBlur={e => e.target.style.borderColor = "#1f2937"} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={exportCSV} style={{ background: "#166534", border: "1.5px solid #4ade80", color: "#4ade80", padding: "9px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{copied ? "Copied!" : "Copy CSV"}</button>
          <button onClick={() => setItems(prev => prev.map(i => ({ ...i, paid: false, dueDate: "", payments: i.multiDate ? [newPayment()] : undefined })))} style={{ background: "none", border: "1px solid #374151", color: "#6b7280", padding: "9px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Reset Month</button>
        </div>
      </div>
    </div>
  );
}

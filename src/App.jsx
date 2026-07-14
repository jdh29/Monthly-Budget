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
const newPayment = () => ({ id: Date.now() + Math.random(), amount: "", dueDate: "", paid: false });
const getMonthKey = (date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
const getMonthLabel = (key) => { const p = key.split("-"); return new Date(parseInt(p[0]), parseInt(p[1]) - 1, 1).toLocaleString("en-AU", { month: "long", year: "numeric" }); };
const buildFreshItems = (t) => t.map(item => ({ ...item, amount: "", frequency: item.defaultFreq, dueDate: "", paid: false, payments: item.multiDate ? [newPayment()] : undefined }));
const rolloverItems = (prevItems, template) => template.map(item => { const prev = prevItems.find(p => p.id === item.id); if (!prev) return { ...item, amount: "", frequency: item.defaultFreq, dueDate: "", paid: false, payments: item.multiDate ? [newPayment()] : undefined }; return { ...item, amount: prev.amount, frequency: prev.frequency, dueDate: "", paid: false, payments: item.multiDate ? (prev.payments || [newPayment()]).map(p => ({ ...p, dueDate: "", paid: false })) : undefined }; });
const STORAGE_KEY = "budget_tracker_v1";
const SYNC_CODE_KEY = "budget_sync_code";
const loadStorage = () => { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; } };
const saveStorage = (data) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {} };
const loadSyncCode = () => { try { return localStorage.getItem(SYNC_CODE_KEY) || ""; } catch { return ""; } };
const saveSyncCode = (code) => { try { localStorage.setItem(SYNC_CODE_KEY, code); } catch {} };
export default function BudgetTracker() {
  const todayKey = getMonthKey(new Date());
  const [allMonths, setAllMonths] = useState(() => { const stored = loadStorage(); if (!stored[todayKey]) { const keys = Object.keys(stored).sort(); const lastKey = keys[keys.length - 1]; stored[todayKey] = lastKey && stored[lastKey] ? rolloverItems(stored[lastKey], DEFAULT_ITEMS) : buildFreshItems(DEFAULT_ITEMS); } return stored; });
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
  useEffect(() => { if (!syncCode || isSavingFromCloud.current) return; setSyncStatus("saving"); const timer = setTimeout(async () => { try { const res = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ syncCode, data: allMonths }) }); setSyncStatus(res.ok ? "saved" : "error"); } catch { setSyncStatus("error"); } setTimeout(() => setSyncStatus(""), 2000); }, 1500); return () => clearTimeout(timer); }, [allMonths, syncCode]);
  const loadFromCloud = (code) => { setSyncStatus("loading"); fetch("/api/load?syncCode=" + encodeURIComponent(code)).then(r => r.json()).then(data => { if (data && typeof data === "object" && Object.keys(data).length > 0) { isSavingFromCloud.current = true; setAllMonths(data); saveStorage(data); setTimeout(() => { isSavingFromCloud.current = false; }, 2000); } setSyncStatus("saved"); setTimeout(() => setSyncStatus(""), 2000); }).catch(() => setSyncStatus("error")); };
  useEffect(() => { if (syncCode) loadFromCloud(syncCode); }, [syncCode]);
  const applySyncCode = () => { const code = syncInput.trim(); if (!code) return; saveSyncCode(code); setSyncCode(code); setShowSync(false); };
  const clearSyncCode = () => { saveSyncCode(""); setSyncCode(""); setSyncInput(""); setShowSync(false); };
  const setItems = (updater) => { setAllMonths(prev => { const current = prev[currentKey] || buildFreshItems(DEFAULT_ITEMS); const updated = typeof updater === "function" ? updater(current) : updater; return { ...prev, [currentKey]: updated }; }); };
  const update = (id, field, value) => { setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item)); };
  const addPayment = (itemId) => { setItems(prev => prev.map(item => item.id === itemId ? { ...item, payments: [...(item.payments || []), newPayment()] } : item)); };
  const updatePayment = (itemId, payId, field, value) => { setItems(prev => prev.map(item => item.id === itemId ? { ...item, payments: item.payments.map(p => p.id === payId ? { ...p, [field]: value } : p) } : item)); };
  const removePayment = (itemId, payId) => { setItems(prev => prev.map(item => item.id === itemId ? { ...item, payments: item.payments.filter(p => p.id !== payId) } : item)); };
  const switchMonth = (key) => { setAllMonths(prev => { if (!prev[key]) { const keys = Object.keys(prev).sort(); const lastKey = keys[keys.length - 1]; return { ...prev, [key]: lastKey && prev[lastKey] ? rolloverItems(prev[lastKey], DEFAULT_ITEMS) : buildFreshItems(DEFAULT_ITEMS) }; } return prev; }); setCurrentKey(key); setShowMonthPicker(false); setView("all"); };
  const monthOptions = useMemo(() => { const options = []; const now = new Date(); for (let i = -3; i <= 2; i++) { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); options.push(getMonthKey(d)); } Object.keys(allMonths).forEach(k => { if (!options.includes(k)) options.push(k); }); return options.sort(); }, [allMonths]);
  const categories = useMemo(() => { const cats = {}; for (const item of items) { if (!cats[item.category]) cats[item.category] = []; cats[item.category].push(item); } return cats; }, [items]);
  const monthlyByCategory = useMemo(() => { const totals = {}; for (const item of items) { let m; if (item.multiDate && item.payments) { m = item.payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0); } else { m = toMonthly(item.amount, item.frequency); } totals[item.category] = (totals[item.category] || 0) + m; } return totals; }, [items]);
  const totalIncome = monthlyByCategory["Income"] || 0;
  const totalExpenses = Object.entries(monthlyByCategory).filter(([cat]) => cat !== "Income").reduce((s, [, v]) => s + v, 0);
  const balance = totalIncome - totalExpenses;
  const paidCount = items.filter(i => i.multiDate ? i.payments?.every(p => p.paid) : i.paid).length;
  const exportCSV = () => { const rows = [["Month", getMonthLabel(currentKey)], [], ["Item", "Category", "Amount", "Frequency", "Monthly Equiv.", "Due Date", "Paid"]]; for (const item of items) { if (item.multiDate && item.payments) { item.payments.forEach((p, i) => { rows.push([item.label + " (payment " + (i + 1) + ")", item.category, p.amount || "0", "One-off", (parseFloat(p.amount) || 0).toFixed(2), p.dueDate || "", p.paid ? "Yes" : "No"]); }); } else { rows.push([item.label, item.category, item.amount || "0", item.frequency, toMonthly(item.amount, item.frequency).toFixed(2), item.dueDate || "", item.paid ? "Yes" : "No"]); } } rows.push([]); rows.push(["TOTAL INCOME (monthly)", "", "", "", totalIncome.toFixed(2)]); rows.push(["TOTAL EXPENSES (monthly)", "", "", "", totalExpenses.toFixed(2)]); rows.push([balance >= 0 ? "SURPLUS" : "DEFICIT", "", "", "", Math.abs(balance).toFixed(2)]); const csv = rows.map(r => r.map(c => '"' + c + '"').join(",")).join("\n"); navigator.clipboard.writeText(csv).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }); };
  const visibleCategories = view === "all" ? Object.keys(categories) : [view];
  const isCurrentMonth = currentKey === todayKey;
  const dotColor = syncStatus === "error" ? "#ef4444" : (syncStatus === "saving" || syncStatus === "loading") ? "#fbbf24" : syncCode ? "#4ade80" : "#374151";

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

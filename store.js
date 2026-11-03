/* Data layer — single source of truth.
   All UI reads through this module; a future Google Sheets sync
   module would hook in here (and nowhere else). No secrets are ever
   stored or transmitted by this app. */

import * as db from './db.js';
import { uid, parseISO, todayISO, monthKey } from './ui.js';

export const DEFAULT_CATEGORIES = [
  { name: 'Tea/Coffee', emoji: '☕' },
  { name: 'Food/Restaurant', emoji: '🍽️' },
  { name: 'Grocery', emoji: '🛒' },
  { name: 'Online Shopping', emoji: '📦' },
  { name: 'Shopping', emoji: '🛍️' },
  { name: 'Transportation', emoji: '🚌' },
  { name: 'Fuel', emoji: '⛽' },
  { name: 'Medical/Healthcare', emoji: '🩺' },
  { name: 'Electricity and Bills', emoji: '💡' },
  { name: 'Mobile/Internet', emoji: '📱' },
  { name: 'Entertainment', emoji: '🎬' },
  { name: 'Travel', emoji: '✈️' },
  { name: 'Research/Work', emoji: '🧪' },
  { name: 'Other', emoji: '🧾' },
];

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Net Banking', 'Other'];

/* ---------- in-memory cache ---------- */
let txns = [];          // sorted: date desc, createdAt desc
let categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
let settings = { theme: 'auto' };
let initialized = false;
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function emit(type) {
  for (const fn of listeners) {
    try { fn(type); } catch (e) { console.error('listener failed', e); }
  }
}

/* ---------- init ---------- */
export async function init() {
  if (initialized) return;
  const [metaRows, rawTxns] = await Promise.all([db.getAll(db.STORE_META), db.getAll(db.STORE_TXNS)]);

  for (const row of metaRows) {
    if (row.key === 'categories' && Array.isArray(row.value) && row.value.length) categories = row.value;
    if (row.key === 'settings' && row.value && typeof row.value === 'object') settings = { ...settings, ...row.value };
  }
  if (!metaRows.some((r) => r.key === 'categories')) {
    await saveMeta('categories', categories); // seed defaults on first run
  }
  txns = sortTxns(rawTxns.filter(validShape));
  initialized = true;
}

function validShape(t) {
  return t && typeof t === 'object' && typeof t.id === 'string' &&
    typeof t.date === 'string' && typeof t.amount === 'number' && Number.isFinite(t.amount);
}

function sortTxns(list) {
  return list.slice().sort((a, b) =>
    a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : (a.date < b.date ? 1 : -1));
}

/* ---------- meta helpers ---------- */
async function saveMeta(key, value) {
  await db.put(db.STORE_META, { key, value });
}

/* ---------- categories ---------- */
export function categoryList() { return categories.map((c) => ({ ...c })); }
export function customCategories() { return categories.filter((c) => c.custom).map((c) => ({ ...c })); }

export function categoryMeta(name) {
  const c = categories.find((x) => x.name === name);
  return c || { name: name || 'Other', emoji: '🏷️' };
}

export async function addCategory(name, emoji) {
  const n = String(name || '').trim();
  if (!n) throw new Error('Category name is required.');
  if (n.length > 24) throw new Error('Category name must be 24 characters or fewer.');
  if (categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
    throw new Error(`Category “${n}” already exists.`);
  }
  const cat = { name: n, emoji: (emoji && String(emoji).trim().slice(0, 4)) || '🏷️', custom: true };
  categories.push(cat);
  await saveMeta('categories', categories);
  await emit('categories');
  return cat;
}

/* Deleting a category never touches past transactions — they keep
   their category name as plain text and appear under 🏷️. */
export async function removeCategory(name) {
  const c = categories.find((x) => x.name === name);
  if (!c) return;
  if (!c.custom) throw new Error('Built-in categories cannot be removed.');
  categories = categories.filter((x) => x.name !== name);
  await saveMeta('categories', categories);
  await emit('categories');
}

export async function restoreCategory(v) {
  if (v && typeof v === 'object' && typeof v.name === 'string' && v.name &&
    !categories.some((c) => c.name.toLowerCase() === v.name.toLowerCase())) {
    categories.push({ name: v.name, emoji: v.emoji || '🏷️', custom: true });
    await saveMeta('categories', categories);
  }
}

/* ---------- settings ---------- */
export function getSettings() { return { ...settings }; }

export async function setSetting(key, value) {
  settings = { ...settings, [key]: value };
  await saveMeta('settings', settings);
  await emit('settings');
  return { ...settings };
}

/* ---------- validation ---------- */
export function validateTransaction(input) {
  const errors = {};
  const rawAmount = typeof input?.amount === 'string' ? input.amount.replace(/[,\s₹]/g, '') : input?.amount;
  const amount = Number(rawAmount);
  if (!rawAmount || rawAmount === '' || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a valid amount greater than ₹0.';
  } else if (amount > 9999999) {
    errors.amount = 'That amount looks too large — please check it.';
  }

  if (!parseISO(input?.date)) errors.date = 'Choose a valid date.';
  else if (input.date > todayISO()) errors.date = 'Date cannot be in the future.';

  if (!categories.some((c) => c.name === input?.category)) errors.category = 'Choose a category.';
  if (!PAYMENT_METHODS.includes(input?.paymentMethod)) errors.paymentMethod = 'Choose a payment method.';

  const description = String(input?.description || '').trim().slice(0, 140);

  return {
    errors,
    value: {
      date: input.date,
      amount: Math.round(amount * 100) / 100,
      category: input.category,
      paymentMethod: input.paymentMethod,
      description,
    },
  };
}

/* ---------- transaction CRUD ---------- */
export function allTransactions() { return txns.map((t) => ({ ...t })); }
export function getTransaction(id) { return txns.find((t) => t.id === id) || null; }

export async function addTransaction(data) {
  const { errors, value } = validateTransaction(data);
  if (Object.keys(errors).length) {
    const err = new Error(Object.values(errors)[0]);
    err.fields = errors;
    throw err;
  }
  if (!initialized) await init();
  const txn = { id: uid(), createdAt: Date.now(), ...value };
  await db.put(db.STORE_TXNS, txn);
  txns = sortTxns([...txns, txn]);
  await emit('transactions');
  return txn;
}

export async function updateTransaction(id, data) {
  const existing = getTransaction(id);
  if (!existing) throw new Error('That transaction no longer exists.');
  const { errors, value } = validateTransaction(data);
  if (Object.keys(errors).length) {
    const err = new Error(Object.values(errors)[0]);
    err.fields = errors;
    throw err;
  }
  const updated = { ...existing, ...value, updatedAt: Date.now() };
  await db.put(db.STORE_TXNS, updated);
  txns = sortTxns(txns.map((t) => (t.id === id ? updated : t)));
  await emit('transactions');
  return updated;
}

export async function deleteTransaction(id) {
  if (!getTransaction(id)) throw new Error('That transaction no longer exists.');
  await db.del(db.STORE_TXNS, id);
  txns = txns.filter((t) => t.id !== id);
  await emit('transactions');
}

/* ---------- export / backup / restore ---------- */
export function exportJSON() {
  return {
    app: 'expense-tracker',
    schema: 1,
    exportedAt: new Date().toISOString(),
    transactions: allTransactions(),
    categories: categoryList(),
  };
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCSV() {
  const rows = [['Date', 'Amount (INR)', 'Category', 'Description', 'Payment Method']];
  const asc = [...txns].sort((a, b) =>
    a.date === b.date ? (a.createdAt || 0) - (b.createdAt || 0) : (a.date < b.date ? -1 : 1));
  for (const t of asc) {
    rows.push([t.date, t.amount.toFixed(2), t.category, t.description, t.paymentMethod]);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/* Merge-only restore: existing records are NEVER overwritten.
   Rows with ids already present are skipped; invalid rows are counted. */
export async function restoreFromBackup(data) {
  if (!initialized) await init();
  let arr = Array.isArray(data) ? data : data?.transactions;
  if (!Array.isArray(arr)) throw new Error('This file does not contain a transactions list.');

  const cats = Array.isArray(data?.categories) ? data.categories : null;
  let catsAdded = 0;
  if (cats) {
    for (const v of cats) {
      if (v && typeof v === 'object' && typeof v.name === 'string' && v.name) {
        await restoreCategory(v);
        catsAdded++;
      }
    }
  }

  const existing = new Set(txns.map((t) => t.id));
  const toAdd = [];
  let skipped = 0, invalid = 0;

  for (const raw of arr) {
    const { errors, value } = validateTransaction(raw);
    if (Object.keys(errors).length) { invalid++; continue; }
    const id = (typeof raw.id === 'string' && raw.id.length <= 80) ? raw.id : uid();
    if (existing.has(id)) { skipped++; continue; }
    existing.add(id);
    toAdd.push({ id, createdAt: Number(raw.createdAt) || Date.now(), ...value });
  }

  if (toAdd.length) await db.bulkPut(db.STORE_TXNS, toAdd);
  txns = sortTxns([...txns, ...toAdd]);
  await emit('all');
  return { found: arr.length, added: toAdd.length, skipped, invalid, categoriesRestored: catsAdded };
}

export async function clearAllData() {
  await db.clear(db.STORE_TXNS);
  await db.clear(db.STORE_META);
  txns = [];
  categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  settings = { theme: 'auto' };
  await saveMeta('categories', categories);
  await saveMeta('settings', settings);
  await emit('all');
}

/* ---------- quick stats used by storage info ---------- */
export function dataCounts() {
  return { transactions: txns.length, categories: categories.length };
}

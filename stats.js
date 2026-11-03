/* Pure aggregation helpers — no DOM, no storage */

import { todayISO, monthKey, weekRange, thisMonthKey, thisYear, parseISO } from './ui.js';

export const sum = (list) => list.reduce((a, t) => a + t.amount, 0);

export function inRange(t, fromISO, toISO) {
  return fromISO <= t.date && t.date <= toISO;
}

export function byCategory(list) {
  const m = new Map();
  for (const t of list) m.set(t.category, (m.get(t.category) || 0) + t.amount);
  return [...m.entries()].sort((a, b) => b[1] - a[1]); // [name, amount] desc
}

export function byMonth(list) {
  const m = new Map();
  for (const t of list) {
    const k = monthKey(t.date);
    m.set(k, (m.get(k) || 0) + t.amount);
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function byDay(list) {
  const m = new Map();
  for (const t of list) m.set(t.date, (m.get(t.date) || 0) + t.amount);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/* Array of last n month keys ending with (relative) current month */
export function lastNMonths(n, endKey = thisMonthKey()) {
  const [y, m] = endKey.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/* All days of a month key ('2026-11') as ISO strings */
export function daysOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) =>
    `${ym}-${String(i + 1).padStart(2, '0')}`);
}

export function dashboardStats(txns) {
  const today = todayISO();
  const ym = thisMonthKey();
  const yr = thisYear();

  const todayList = txns.filter((t) => t.date === today);
  const monthList = txns.filter((t) => monthKey(t.date) === ym);
  const yearList = txns.filter((t) => t.date.slice(0, 4) === yr);

  const prevYm = lastNMonths(2, ym)[0];
  const prevList = txns.filter((t) => monthKey(t.date) === prevYm);

  const monthTotal = sum(monthList);
  const prevTotal = sum(prevList);
  let delta = null;
  if (prevTotal > 0 && monthTotal > 0) delta = Math.round(((monthTotal - prevTotal) / prevTotal) * 100);
  else if (prevTotal === 0 && monthTotal > 0) delta = null;

  const dayNum = Number(today.slice(8));
  const avgDaily = monthTotal / Math.max(dayNum, 1);

  const cats = byCategory(monthList);
  const topCat = cats.length ? cats[0] : null;

  return {
    todayTotal: sum(todayList),
    monthTotal,
    prevMonthTotal: prevTotal,
    monthDelta: delta,
    yearTotal: sum(yearList),
    txnCount: txns.length,
    avgDaily,
    topCategory: topCat ? { name: topCat[0], amount: topCat[1] } : null,
  };
}

/* Weekly buckets (Mon-start) covering the given year-to-date transactions */
export function byWeek(list, weeksBack = 8) {
  if (!list.length) return [];
  const today = todayISO();
  const [wStart] = weekRange(today);
  const end = parseISO(wStart);
  const buckets = [];
  for (let i = 0; i < weeksBack; i++) {
    const s = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i * 7);
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const from = iso(s), to = iso(e);
    const amt = sum(list.filter((t) => inRange(t, from, to)));
    buckets.unshift({ from, to, amount: amt });
  }
  return buckets;
}

export const THIS_MONTH = thisMonthKey;
export const THIS_YEAR = thisYear;

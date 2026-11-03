/* Reports view — daily / weekly / monthly / yearly totals,
   category breakdown and month-to-month comparison. */

import * as store from '../store.js';
import * as stats from '../stats.js';
import { barChart, doughnutChart, lineChart, colorFor } from '../charts.js';
import { el, fmtINR, fmtINR0, inrShort, todayISO, thisMonthKey, thisYear, parseISO, fmtMonthLabel } from '../ui.js';

const state = { month: thisMonthKey() };

export async function render(root) {
  root.textContent = ''; // this view re-renders itself when the report month changes
  const txns = store.allTransactions();
  const today = todayISO();
  const [wFrom, wTo] = weekBounds(today);
  const totals = {
    today: stats.sum(txns.filter((t) => t.date === today)),
    week: stats.sum(txns.filter((t) => wFrom <= t.date && t.date <= wTo)),
    month: stats.sum(txns.filter((t) => t.date.startsWith(state.month))),
    year: stats.sum(txns.filter((t) => t.date.startsWith(thisYear()))),
  };

  const afterAppend = [];  // chart factories to run once canvases are in the DOM
  const mTxns = txns.filter((t) => t.date.startsWith(state.month));

  const grid = el('div', 'reports-grid');

  /* period cards */
  const g2 = el('div', 'stat-grid');
  g2.style.maxWidth = 'none';
  g2.append(...[
    ['Today', totals.today, 'expenditure'],
    ['This week', totals.week, 'Mon – Sun'],
    ['This month', totals.month, monthLong(state.month)],
    ['This year', totals.year, 'Jan – Dec'],
  ].map(([k, v, s]) => el('div', 'stat', `<div class="k">${k}</div><div class="v num">${fmtINR0(v)}</div><div class="s">${s}</div>`)
  ));
  const p1 = el('section', 'card span-2');
  p1.append(g2);
  p1.style.maxWidth = 'none';

  /* month picker card */
  const pPicker = el('section', 'card');
  pPicker.innerHTML = `
    <header><h3>Reporting month</h3></header>
    <div class="field"><input id="rp-month" type="month" value="${state.month}"></div>`;
  pPicker.querySelector('#rp-month').addEventListener('change', (e) => {
    if (/^\d{4}-\d{2}$/.test(e.target.value)) { state.month = e.target.value; render(root); }
  });

  const pDaily = el('section', 'card span-2', `
    <header><h3>Daily expenditure<span class="hint">${monthLong(state.month)} · total ${fmtINR(totals.month)} · ${mTxns.length} transactions</span></h3></header>
    <div class="chart-box"><canvas id="rp-daily" role="img" aria-label="Daily expenditure chart"></canvas></div>`);
  afterAppend.push(() => {
    const daily = new Map(stats.byDay(mTxns));
    const days = stats.daysOfMonth(state.month);
    lineChart('rp-daily', days.map((d) => String(Number(d.slice(8)))), days.map((d) => daily.get(d) || 0));
  });

  /* weekly chart */
  const weeks = stats.byWeek(txns, 8);
  const pWeekly = el('section', 'card span-2', `
    <header><h3>Weekly expenditure<span class="hint">Last 8 weeks (Mon–Sun)</span></h3></header>
    <div class="chart-box"><canvas id="rp-weekly" role="img" aria-label="Weekly expenditure chart"></canvas></div>`);
  afterAppend.push(() => barChart('rp-weekly', weeks.map((w) => `${Short(w.from)}–${Short(w.to)}`), weeks.map((w) => w.amount)));

  /* category-wise */
  const cats = stats.byCategory(mTxns);
  const pCat = el('section', 'card');
  if (!cats.length) {
    pCat.append(el('div', 'empty', `<div class="art">📊</div><b>No data for ${monthLong(state.month)}</b><p>Pick another month or add expenses.</p>`));
  } else {
    pCat.innerHTML = `<header><h3>Category-wise<span class="hint">${monthLong(state.month)}</span></h3></header><div class="chart-box"><canvas id="rp-cat" role="img" aria-label="Category chart"></canvas></div>`;
    afterAppend.push(() => doughnutChart('rp-cat', cats.map((c) => c[0]), cats.map((c) => c[1])));
    const rows = cats.map(([name, amt]) => {
      const pct = totals.month ? Math.round((amt / totals.month) * 100) : 0;
      const cat = store.categoryMeta(name);
      return `
        <div class="bar-row">
          <div class="top">
            <span class="name">${cat.emoji} ${esc(name)} <span class="share">${pct}%</span></span>
            <span class="amt num">${fmtINR(amt)}</span>
          </div>
          <div class="track"><div class="fill" style="width:${Math.max(pct, 3)}%;background:${colorFor(name)}"></div></div>
        </div>`;
    }).join('');
    const moneyLeft = new DOMParser().parseFromString(`<div class="bar-list">${rows}</div>`, 'text/html').body.firstChild;
    pCat.append(moneyLeft);
  }

  /* month-to-month comparison */
  const months = stats.lastNMonths(12);
  const mmap = new Map(stats.byMonth(txns));
  const mvals = months.map((m) => mmap.get(m) || 0);
  const prevM = months[months.length - 2] || null;
  const curV = mvals[mvals.length - 1];
  const prevV = mvals[mvals.length - 2];
  let compare = '—';
  if (prevV > 0) {
    const d = Math.round(((curV - prevV) / prevV) * 100);
    compare = d > 0 ? `▲ ${d}% vs ${fmtMonthLabel(prevM)}` : d < 0 ? `▼ ${Math.abs(d)}% vs ${fmtMonthLabel(prevM)}` : `Same as ${fmtMonthLabel(prevM)}`;
  } else if (curV > 0) {
    compare = `No spending in ${prevM ? fmtMonthLabel(prevM) : 'previous month'}`;
  }
  const pCompare = el('section', 'card', `
    <header><h3>Month-to-month comparison<span class="hint">Last 12 months · ${compare}</span></h3></header>
    <div class="chart-box"><canvas id="rp-comp" role="img" aria-label="Month to month comparison chart"></canvas></div>`);
  afterAppend.push(() => barChart('rp-comp', months.map((m) => fmtMonthLabel(m).split(' ')), mvals));

  /* yearly comparison table */
  const years = [...new Set(txns.map((t) => t.date.slice(0, 4)))].sort().reverse();
  const pYears = el('section', 'card', '<header><h3>Yearly expenditure</h3></header>');
  if (!years.length) {
    pYears.append(el('div', 'empty', '<div class="art">🗓️</div><b>No data yet</b><p>Add expenses to see yearly totals.</p>'));
  } else {
    const rows = el('div', 'table-list');
    for (const y of years) {
      const yt = txns.filter((t) => t.date.startsWith(y));
      const row = el('div', 'trow', `
        <span class="l">${y} <small style="color:var(--faint)">${yt.length} txns</small></span>
        <span class="r num">${fmtINR(stats.sum(yt))}</span>`);
      rows.append(row);
    }
    pYears.append(rows);
  }

  grid.append(p1, pDaily, pWeekly, pCat, pCompare, pPicker, pYears);
  root.append(grid);

  // all canvases are attached now — safe to build charts
  for (const fn of afterAppend) {
    try { fn(); } catch (e) { console.error('chart failed', e); }
  }
}

/* helpers */
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function Short(iso) { const d = parseISO(iso); return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''; }
function monthLong(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
function weekBounds(iso) {
  const d = parseISO(iso);
  const day = (d.getDay() + 6) % 7;
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
  const f = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return [f(s), f(e)];
}

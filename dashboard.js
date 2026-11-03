/* Dashboard view */

import * as store from '../store.js';
import * as stats from '../stats.js';
import { doughnutChart, barChart } from '../charts.js';
import { el, fmtINR, fmtINR0, inrShort, thisMonthKey, fmtMonthLabel, $ } from '../ui.js';
import { txnRow } from '../components.js';

export function render(root) {
  const txns = store.allTransactions();
  const s = stats.dashboardStats(txns);
  const ym = thisMonthKey();

  root.append(
    heroCard(s),
    statGrid(s),
    categoryChartCard(txns.filter((t) => t.date.startsWith(ym))),
    monthlyBarCard(txns),
    recentCard(txns),
    monthlySummaryCard(txns),
  );

  // charts must be created after their canvases are attached to the DOM
  const monthTxns = txns.filter((t) => t.date.startsWith(ym));
  const cats = stats.byCategory(monthTxns);
  if (cats.length) {
    doughnutChart('ch-doughnut', cats.map((c) => c[0]), cats.map((c) => c[1]));
  }
  const months = stats.lastNMonths(12);
  const map = new Map(stats.byMonth(txns));
  barChart('ch-bar', months.map((m) => fmtMonthLabel(m).split(' ')), months.map((m) => map.get(m) || 0));
}

function heroCard(s) {
  let deltaHtml;
  if (s.monthDelta === null) {
    deltaHtml = '<span class="badge">—</span> no data for last month';
  } else if (s.monthDelta <= 0) {
    deltaHtml = `<span class="badge">${s.monthDelta === 0 ? '=' : '▼ ' + Math.abs(s.monthDelta) + '%'}</span> vs last month`;
  } else {
    deltaHtml = `<span class="badge">▲ ${s.monthDelta}%</span> vs last month`;
  }
  return el('section', 'card hero', `
    <div class="label">Total spent this month</div>
    <div class="amount-lg num">${fmtINR(s.monthTotal)}</div>
    <div class="delta num">${deltaHtml}</div>
  `);
}

function statGrid(s) {
  const mk = (k, v, sub) => `
    <div class="stat"><div class="k">${k}</div><div class="v num">${v}</div><div class="s">${sub}</div></div>`;
  return el('div', 'stat-grid', `
    ${mk('Today', fmtINR0(s.todayTotal), 'expenditure')}
    ${mk('This month', fmtINR0(s.monthTotal), 'calendar month')}
    ${mk('This year', fmtINR0(s.yearTotal), 'Jan – Dec')}
    ${mk('Transactions', String(s.txnCount), 'all time')}
    ${mk('Avg / day', fmtINR0(s.avgDaily), 'this month')}
    ${mk('Top category', s.topCategory ? s.topCategory.name : '—', s.topCategory ? fmtINR0(s.topCategory.amount) + ' this month' : 'no spending yet')}
  `);
}

function categoryChartCard(monthTxns) {
  const cats = stats.byCategory(monthTxns);
  const card = el('section', 'card');
  if (!cats.length) {
    card.append(emptyCard('🧾', 'No expenses this month yet', 'Add your first expense to see the breakdown.'));
    return card;
  }
  card.innerHTML = `<header><h3>Category breakdown<span class="hint">${monthLabel()}</span></h3></header><div class="chart-box"><canvas id="ch-doughnut" aria-label="Spending by category chart" role="img"></canvas></div>`;
  return card;
}

function monthlyBarCard(txns) {
  const card = el('section', 'card', `
    <header><h3>Monthly spending<span class="hint">Last 12 months</span></h3></header>
    <div class="chart-box"><canvas id="ch-bar" aria-label="Monthly spending chart" role="img"></canvas></div>`);
  return card;
}

function recentCard(txns) {
  const card = el('section', 'card');
  const recent = txns.slice(0, 5);
  card.innerHTML = `<header><h3>Recent transactions</h3><a class="link" href="#/transactions">View all</a></header>`;
  if (!recent.length) {
    card.append(emptyCard('🧾', 'Nothing yet', 'Add expense appears here instantly.'));
    return card;
  }
  const list = el('div');
  for (const t of recent) list.append(txnRow(t));
  card.append(list);
  return card;
}

function monthlySummaryCard(txns) {
  const months = stats.lastNMonths(6).reverse();
  const map = new Map(stats.byMonth(txns));
  const countMap = new Map();
  for (const t of txns) {
    const k = t.date.slice(0, 7);
    countMap.set(k, (countMap.get(k) || 0) + 1);
  }
  const total = Math.max(...months.map((m) => map.get(m) || 0), 1);

  const rows = months.map((m) => {
    const amt = map.get(m) || 0;
    const pct = Math.round((amt / total) * 100);
    const color = amt ? hexFor(m) : 'var(--border)';
    return `
      <div class="bar-row">
        <div class="top">
          <span class="name">${fmtMonthLabel(m)} <span class="share">${countMap.get(m) || 0} txns</span></span>
          <span class="amt num">${fmtINR(amt)}</span>
        </div>
        <div class="track"><div class="fill" style="width:${Math.max(pct, amt ? 3 : 0)}%;background:${color}"></div></div>
      </div>`;
  }).join('');

  return el('section', 'card', `<header><h3>Monthly summary<span class="hint">Last 6 months</span></h3></header><div class="bar-list">${rows}</div>`);
}

function hexFor(ym) {
  // deterministic friendly bars
  const palette = ['#4f46e5', '#6366f1', '#0d9488', '#0ea5e9', '#7c3aed', '#f59e0b'];
  const [y, m] = ym.split('-').map(Number);
  return palette[(y * 12 + m) % palette.length];
}

function emptyCard(art, title, sub) {
  return el('div', 'empty', `<div class="art">${art}</div><b>${title}</b><p>${sub}</p>`);
}

function monthLabel() {
  const [y, m] = thisMonthKey().split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/* Transactions view — search, filters, day/month grouping, edit, delete */

import * as store from '../store.js';
import { el, ESC, fmtINR, relativeDayLabel, fmtMonthLabel, parseISO, toast } from '../ui.js';
import { txnRow } from '../components.js';
import { PAYMENT_METHODS } from '../store.js';

const state = {
  q: '', month: '', from: '', to: '', category: '', payment: '',
  group: 'day', sort: 'desc',
};

export async function render(root) {
  root.textContent = ''; // this view may re-render itself on filter changes
  const all = store.allTransactions();
  const card = el('section', 'card');

  const filtersEl = el('div', 'filters');
  filtersEl.innerHTML = `
    <div class="field full"><label for="fl-q">Search</label>
      <input id="fl-q" type="search" placeholder="Search description or category…" value="${ESC(state.q)}" autocomplete="off"></div>
    <div class="field"><label for="fl-month">Month</label>
      <input id="fl-month" type="month" value="${ESC(state.month)}"></div>
    <div class="field"><label for="fl-group">Group by</label>
      <select id="fl-group">
        <option value="day"${state.group === 'day' ? ' selected' : ''}>Day</option>
        <option value="month"${state.group === 'month' ? ' selected' : ''}>Month</option>
      </select></div>
    <div class="field"><label for="fl-cat">Category</label>
      <select id="fl-cat"><option value="">All categories</option>
        ${store.categoryList().map((c) => `<option value="${ESC(c.name)}"${state.category === c.name ? ' selected' : ''}>${c.emoji} ${ESC(c.name)}</option>`).join('')}
      </select></div>
    <div class="field"><label for="fl-pay">Payment</label>
      <select id="fl-pay"><option value="">All payments</option>
        ${PAYMENT_METHODS.map((m) => `<option value="${ESC(m)}"${state.payment === m ? ' selected' : ''}>${ESC(m)}</option>`).join('')}
      </select></div>
    <div class="field"><label for="fl-from">From date</label>
      <input id="fl-from" type="date" value="${ESC(state.from)}"></div>
    <div class="field"><label for="fl-to">To date</label>
      <input id="fl-to" type="date" value="${ESC(state.to)}"></div>
  `;

  card.append(filtersEl);

  const gridBtn = el('div', 'btn-row');
  gridBtn.style.marginTop = '12px';
  const clearBtn = el('button', 'btn btn-secondary btn-compact', 'Clear filters ✓︎');
  clearBtn.type = 'button';
  const sortBtn = el('button', 'btn btn-secondary btn-compact');
  sortBtn.type = 'button';
  sortBtn.innerHTML = state.sort === 'desc' ? '↓ Newest first' : '↑ Oldest first';
  gridBtn.append(clearBtn, sortBtn);
  card.append(gridBtn);

  root.append(card);

  const listCard = el('section', 'card');
  root.append(listCard);

  function paint() {
    let list = all.filter((t) => {
      if (state.q) {
        const q = state.q.toLowerCase();
        const hay = `${t.description} ${t.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (state.month && !t.date.startsWith(state.month)) return false;
      if (state.from && t.date < state.from) return false;
      if (state.to && t.date > state.to) return false;
      if (state.category && t.category !== state.category) return false;
      if (state.payment && t.paymentMethod !== state.payment) return false;
      return true;
    });
    if (state.sort === 'asc') list.reverse();

    listCard.textContent = '';
    const hit = `
      <div class="result-foot"><span>${list.length} transaction${list.length === 1 ? '' : 's'}</span>
      <span class="num">${fmtINR(list.reduce((a, t) => a + t.amount, 0))}</span></div>`;
    if (!list.length) {
      const anyFilter = state.q || state.month || state.from || state.to || state.category || state.payment;
      listCard.append(el('div', 'empty', anyFilter
        ? '<div class="art">🔍</div><b>No transactions match</b><p>Try adjusting or clearing the filters.</p>'
        : '<div class="art">🧾</div><b>No transactions yet</b><p>Use Add Expense to record your first one.</p>'));
      return;
    }

    const groups = new Map();
    if (state.group === 'day') {
      for (const t of list) {
        (groups.get(t.date) || groups.set(t.date, []).get(t.date)).push(t);
      }
    } else {
      for (const t of list) {
        const k = t.date.slice(0, 7);
        (groups.get(k) || groups.set(k, []).get(k)).push(t);
      }
    }
    for (const [key, items] of groups) {
      const total = items.reduce((a, t) => a + t.amount, 0);
      const head = el('div', 'tx-group-head', state.group === 'day'
        ? `<span class="d">${ESC(relativeDayLabel(key))} <span class="rel">· ${ESC(dow(key))}</span></span>`
        : `<span class="d">${ESC(fmtMonthLabel(key))}</span>`,
        `<span class="t num">${fmtINR(total)}</span>`);
      listCard.append(head);
      for (const t of items) listCard.append(txnRow(t, { actions: true }));
    }
    listCard.append(el('div', '', hit));
  }

  function dow(iso) {
    try { return parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short' }); } catch { return ''; }
  }

  paint();

  /* wire filters (state persists across re-renders) */
  /* text/date filters repaint only the list so focus / typing isn't lost */
  const bindPaint = (sel, key) => {
    filtersEl.querySelector(sel).addEventListener('input', (e) => {
      state[key] = e.target.value;
      paint();
    });
  };
  const bind = (sel, key) => {
    filtersEl.querySelector(sel).addEventListener('change', (e) => {
      state[key] = e.target.value;
      paint();
    });
  };
  bindPaint('#fl-q', 'q');
  bindPaint('#fl-from', 'from');
  bindPaint('#fl-to', 'to');
  bind('#fl-month', 'month');
  bind('#fl-cat', 'category');
  bind('#fl-pay', 'payment');
  bind('#fl-group', 'group');

  sortBtn.addEventListener('click', () => {
    state.sort = state.sort === 'desc' ? 'asc' : 'desc';
    sortBtn.innerHTML = state.sort === 'desc' ? '↓ Newest first' : '↑ Oldest first';
    paint();
  });
  clearBtn.addEventListener('click', () => {
    Object.assign(state, { q: '', month: '', from: '', to: '', category: '', payment: '' });
    render(root);
    toast('Filters cleared');
  });
}

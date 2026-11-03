/* App bootstrap, hash router, navigation */

import * as store from './store.js';
import { destroyCharts } from './charts.js';
import { $ } from './ui.js';
import * as dashboard from './views/dashboard.js';
import * as add from './views/add.js';
import * as transactions from './views/transactions.js';
import * as reports from './views/reports.js';
import * as settings from './views/settings.js';

const ICONS = {
  dashboard: '<svg class="stroke" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7.4" height="7.4" rx="2"/><rect x="13.1" y="3.5" width="7.4" height="7.4" rx="2"/><rect x="3.5" y="13.1" width="7.4" height="7.4" rx="2"/><rect x="13.1" y="13.1" width="7.4" height="7.4" rx="2"/></svg>',
  add: '<svg class="stroke" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.2v7.6M8.2 12h7.6"/></svg>',
  transactions: '<svg class="stroke" viewBox="0 0 24 24"><path d="M4 6.5h16M4 12h16M4 17.5h10"/></svg>',
  reports: '<svg class="stroke" viewBox="0 0 24 24"><path d="M4 4v15.2a.8.8 0 0 0 .8.8H20"/><path d="M8 15.5v-4M12.5 15.5V8M17 15.5v-6"/></svg>',
  settings: '<svg class="stroke" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1"/><path d="M19.2 14.2a1.9 1.9 0 0 0 .38 2.1l.02.02a1.9 1.9 0 1 1-2.68 2.68l-.02-.02a1.9 1.9 0 0 0-2.1-.38 1.9 1.9 0 0 0-1.15 1.74v.05a1.9 1.9 0 1 1-3.8 0v-.03a1.9 1.9 0 0 0-1.24-1.73 1.9 1.9 0 0 0-2.1.38l-.02.02a1.9 1.9 0 1 1-2.68-2.68l.02-.02a1.9 1.9 0 0 0 .38-2.1 1.9 1.9 0 0 0-1.74-1.15h-.05a1.9 1.9 0 1 1 0-3.8h.03a1.9 1.9 0 0 0 1.73-1.24 1.9 1.9 0 0 0-.38-2.1l-.02-.02A1.9 1.9 0 1 1 6.44 3.4l.02.02a1.9 1.9 0 0 0 2.1.38h.09a1.9 1.9 0 0 0 1.15-1.74v-.05a1.9 1.9 0 1 1 3.8 0v.03a1.9 1.9 0 0 0 1.15 1.74 1.9 1.9 0 0 0 2.1-.38l.02-.02a1.9 1.9 0 1 1 2.68 2.68l-.02.02a1.9 1.9 0 0 0-.38 2.1v.09a1.9 1.9 0 0 0 1.74 1.15h.05a1.9 1.9 0 1 1 0 3.8h-.03a1.9 1.9 0 0 0-1.74 1.15Z"/></svg>',
};

const ROUTES = [
  { id: 'dashboard', label: 'Dashboard', view: dashboard },
  { id: 'add', label: 'Add Expense', view: add },
  { id: 'transactions', label: 'Transactions', view: transactions },
  { id: 'reports', label: 'Reports', view: reports },
  { id: 'settings', label: 'Settings', view: settings },
];

function currentRoute() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return ROUTES.some((r) => r.id === h) ? h : 'dashboard';
}

function buildNav() {
  const route = currentRoute();
  const bottom = document.getElementById('bottomNav');
  const side = document.getElementById('navLinks');
  bottom.textContent = '';
  side.textContent = '';
  for (const r of ROUTES) {
    const mk = (container, withLabel) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = route === r.id ? 'active' : '';
      b.setAttribute('aria-current', route === r.id ? 'page' : 'false');
      b.innerHTML = `${ICONS[r.id]}${withLabel ? `<span>${r.label}</span>` : ''}`;
      b.addEventListener('click', () => { location.hash = `#/${r.id}`; });
      container.append(b);
    };
    mk(bottom, true);
    mk(side, true);
  }
}

async function render() {
  destroyCharts();
  const route = currentRoute();
  buildNav();
  const info = ROUTES.find((r) => r.id === route);
  document.title = `${info.label} · Expense Tracker`;
  $('#pageTitle').textContent = info.label;
  const viewEl = $('#view');
  viewEl.textContent = '';
  await info.view.render(viewEl);
  viewEl.scrollTop = 0;
  window.scrollTo({ top: 0 });
}

/* Re-render the active view when data changes (add/edit/delete/categories),
   so dashboard cards and charts always stay in sync. */
let rerenderTimer = null;
function onData(type) {
  if (rerenderTimer) return;
  rerenderTimer = setTimeout(() => {
    rerenderTimer = null;
    // safe: forms are read before emit; modals live outside #view
    if (currentRoute() === 'add') return; // add page manages its own state
    render();
  }, 60);
}

function applyTheme() {
  const s = store.getSettings().theme;
  let t = s;
  if (s === 'auto') {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = t;
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

async function boot() {
  await store.init();
  applyTheme();
  buildNav();
  window.addEventListener('hashchange', render);
  store.subscribe(onData);

  $('#quickAdd').addEventListener('click', () => { location.hash = '#/add'; });

  if (!location.hash) history.replaceState(null, '', '#/dashboard');
  await render();

  const secure = ['https:', 'http:'].includes(location.protocol) &&
    (['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'https:');
  if ('serviceWorker' in navigator && secure) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW:', e.message));
  }
}

boot().catch((e) => {
  document.getElementById('view').innerHTML =
    `<div class="card"><div class="empty"><div class="art">⚠️</div><b>Could not start the app</b><p>${e.message ?? e}</p></div></div>`;
  console.error(e);
});

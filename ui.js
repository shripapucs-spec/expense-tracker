/* Formatting, DOM helpers, dialogs, toasts */

export const ESC = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- money ---------- */
export function fmtINR(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(Number(n) || 0);
}

export function fmtINR0(n) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Math.round(Number(n) || 0));
}

export function inrShort(n) {
  n = Number(n) || 0;
  const a = Math.abs(n);
  let s;
  if (a >= 1e7) s = (n / 1e7).toFixed(a >= 1e8 ? 0 : 1) + 'Cr';
  else if (a >= 1e5) s = (n / 1e5).toFixed(a >= 1e6 ? 0 : 1) + 'L';
  else if (a >= 1e3) s = (n / 1e3).toFixed(1) + 'k';
  else s = String(Math.round(n));
  return '₹' + s;
}

/* ---------- dates (local timezone) ---------- */
const pad = (x) => String(x).padStart(2, '0');

export function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO() { return isoDate(new Date()); }
export function monthKey(iso) { return String(iso).slice(0, 7); }
export function thisMonthKey() { return monthKey(todayISO()); }
export function thisYear() { return todayISO().slice(0, 4); }

export function parseISO(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(iso) {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
export function fmtDateShort(iso) {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
}
export function dowShort(iso) {
  const d = parseISO(iso);
  return d ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : '';
}

export function fmtMonthLabel(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  if (!y || !m) return '—';
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export function relativeDayLabel(iso) {
  const t = todayISO();
  if (iso === t) return 'Today';
  const d = parseISO(iso), n = parseISO(t);
  if (d && n) {
    const yst = isoDate(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1));
    if (iso === yst) return 'Yesterday';
  }
  return `${dowShort(iso)}, ${fmtDateShort(iso)}`;
}

/* Monday-start week containing iso → [startISO, endISO] */
export function weekRange(iso) {
  const d = parseISO(iso);
  if (!d) return null;
  const day = (d.getDay() + 6) % 7; // Mon=0
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
  return [isoDate(s), isoDate(e)];
}

/* ---------- element helpers ---------- */
export function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html != null) e.innerHTML = html;
  return e;
}

export function $(sel, root = document) { return root.querySelector(sel); }

/* ---------- toasts ---------- */
export function toast(msg, type = 'default') {
  const root = document.getElementById('toastRoot');
  const t = el('div', `toast ${type}`, ESC(msg));
  root.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 260);
  }, 2400);
}

/* ---------- modals ---------- */
export function openModal({ title, body, confirm = false, onClose, grabber = true }) {
  const root = document.getElementById('modalRoot');
  root.textContent = '';

  const overlay = el('div', 'modal-overlay');
  const box = el('div', `modal ${confirm ? 'confirm' : ''} ${grabber ? 'grab' : ''}`);
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  if (title) {
    const head = el('div', 'modal-head', `<h3>${ESC(title)}</h3>`);
    const close = el('button', 'icon-btn', '✕');
    close.setAttribute('aria-label', 'Close');
    close.type = 'button';
    head.append(close);
    box.append(head);
    box._closeBtn = close;
  }
  const bodyWrap = el('div', 'modal-body');
  if (body) bodyWrap.append(body);
  box.append(bodyWrap);

  let result = null;
  const close = (val) => {
    if (!overlay.isConnected) return;
    result = val;
    root.textContent = '';
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose(result);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(null); };

  overlay.append(box);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
  if (box._closeBtn) box._closeBtn.addEventListener('click', () => close(null));
  document.addEventListener('keydown', onKey);
  root.append(overlay);
  box.__close = close;
  return box;
}

export function confirmDialog({ title = 'Are you sure?', message = '', warn = '', confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const body = el('div');
    body.innerHTML = `<p class="msg">${ESC(message)}</p>${warn ? `<p class="warn">${ESC(warn)}</p>` : ''}`;
    const foot = el('div', 'modal-foot');
    const cancel = el('button', 'btn btn-secondary', 'Cancel');
    cancel.type = 'button';
    const ok = el('button', `btn ${danger ? 'btn-danger' : 'btn-primary'}`, confirmText);
    ok.type = 'button';
    foot.append(cancel, ok);
    body.append(foot);

    const box = openModal({
      title, body, confirm: true,
      onClose: (v) => resolve(v === true),
    });
    cancel.addEventListener('click', () => box.__close(null));
    ok.addEventListener('click', () => box.__close(true));
    ok.focus();
  });
}

/* ---------- download ---------- */
export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

/* ---------- misc ---------- */
export function uid() {
  return (crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
}

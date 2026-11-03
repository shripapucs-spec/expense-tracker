/* Shared UI building blocks: transaction form + transaction row */

import * as store from './store.js';
import { el, ESC, fmtINR, fmtDate, relativeDayLabel, dowShort, openModal, confirmDialog, toast } from './ui.js';
import { PAYMENT_METHODS } from './store.js';

/* ---------- category select ---------- */
function categoryOptions(selected) {
  return store.categoryList().map((c) =>
    `<option value="${ESC(c.name)}"${c.name === selected ? ' selected' : ''}>${c.emoji} ${ESC(c.name)}</option>`).join('');
}

/* ---------- add/edit expense form ---------- */
export function txnForm({ txn = null, submitLabel = 'Save Expense' } = {}) {
  const editing = Boolean(txn);
  const form = el('form', 'form-grid');
  form.noValidate = true;
  form.innerHTML = `
    <div class="field" data-f="date">
      <label for="f-date">Date</label>
      <input id="f-date" name="date" type="date" required>
      <div class="err"></div>
    </div>
    <div class="field" data-f="amount">
      <label for="f-amount">Amount (₹)</label>
      <div class="amount-wrap">
        <span class="cur">₹</span>
        <input id="f-amount" name="amount" type="text" inputmode="decimal" enterkeyhint="next"
               placeholder="0" autocomplete="off" required>
      </div>
      <div class="err"></div>
    </div>
    <div class="field" data-f="category">
      <label for="f-category">Category</label>
      <select id="f-category" name="category">${categoryOptions(txn?.category || '')}</select>
      <div class="err"></div>
    </div>
    <div class="field" data-f="paymentMethod">
      <label for="f-payment">Payment method</label>
      <div class="chip-group" id="f-payment" role="radiogroup" aria-label="Payment method">
        ${PAYMENT_METHODS.map((m) => `
          <input type="radio" name="paymentMethod" id="pm-${m.replace(/\s/g, '')}" value="${ESC(m)}">
          <label class="chip" for="pm-${m.replace(/\s/g, '')}">${ESC(m)}</label>`).join('')}
      </div>
      <div class="err"></div>
    </div>
    <div class="field full" data-f="description">
      <label for="f-desc">Description / remarks <span style="font-weight:500">(optional)</span></label>
      <input id="f-desc" name="description" type="text" maxlength="140" placeholder="e.g. Lunch near office">
    </div>
    <div class="full">
      <button class="btn btn-primary btn-block" type="submit">${ESC(editing ? 'Update Expense' : submitLabel)}</button>
    </div>
  `;

  const today = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const fDate = form.querySelector('#f-date');
  const fAmount = form.querySelector('#f-amount');
  const fCategory = form.querySelector('#f-category');
  const fDesc = form.querySelector('#f-desc');

  fDate.max = todayStr;
  fDate.value = txn?.date || todayStr;
  fDesc.value = txn?.description || '';
  if (txn) {
    fAmount.value = String(txn.amount);
    if (txn.paymentMethod) {
      form.querySelector(`input[name="paymentMethod"][value="${txn.paymentMethod.replace(/"/g, '\\"')}"]`).checked = true;
    }
  } else {
    // sensible new-entry defaults: first category + first payment method
    form.querySelector('input[name="paymentMethod"]').checked = true;
    fCategory.value = store.categoryList()[0]?.name || '';
  }

  const errEl = (f) => form.querySelector(`[data-f="${f}"]`);
  function setErrors(errors) {
    ['date', 'amount', 'category', 'paymentMethod'].forEach((f) => {
      errEl(f).classList.toggle('invalid', Boolean(errors[f]));
      errEl(f).querySelector('.err').textContent = errors[f] || '';
    });
  }

  fAmount.addEventListener('focus', () => fAmount.select());

  async function getValues() {
    const values = {
      date: fDate.value,
      amount: fAmount.value.trim(),
      category: fCategory.value,
      paymentMethod: form.querySelector('input[name="paymentMethod"]:checked')?.value || '',
      description: fDesc.value,
    };
    const { errors, value } = store.validateTransaction(values);
    setErrors(errors);
    return { errors, value };
  }

  /* "+ New category" inline connect hook (optional) */
  form._refreshCategories = (selected) => {
    fCategory.innerHTML = categoryOptions(selected);
  };
  form._focusAmount = () => fAmount.focus();
  form._getValues = getValues;
  return form;
}

/* Inline "+ New" category button + handler for the add page */
export function attachNewCategoryButton(form, button) {
  button.addEventListener('click', () => {
    const body = el('div');
    body.innerHTML = `
      <div class="field">
        <label for="nc-name">Category name</label>
        <input id="nc-name" type="text" maxlength="24" placeholder="e.g. Baby Care / Gifts" autocomplete="off">
      </div>
      <div class="modal-foot">
        <button class="btn btn-secondary" type="button" data-x="cancel">Cancel</button>
        <button class="btn btn-primary" type="button" data-x="save">Add category</button>
      </div>`;
    const box = openModal({ title: 'New category', body });
    const input = body.querySelector('#nc-name');
    const save = async () => {
      try {
        const cat = await store.addCategory(input.value);
        form._refreshCategories(cat.name);
        toast(`Category “${cat.name}” added`);
        box.__close(true);
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    body.querySelector('[data-x="save"]').addEventListener('click', save);
    body.querySelector('[data-x="cancel"]').addEventListener('click', () => box.__close(null));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    input.focus();
  });
}

/* ---------- transaction row ---------- */
export function txnRow(t, { actions = false } = {}) {
  const cat = store.categoryMeta(t.category);
  const row = el('div', 'tx-row');
  row.innerHTML = `
    <div class="tx-emoji" aria-hidden="true">${cat.emoji}</div>
    <div class="tx-main">
      <div class="tx-title">${t.description ? ESC(t.description) : `${ESC(cat.name)}`}</div>
      <div class="tx-sub">
        <span class="chip">${ESC(cat.name)}</span>
        <span class="chip">${ESC(t.paymentMethod)}</span>
        <span class="tx-when">${ESC(relativeDayLabel(t.date))}</span>
      </div>
    </div>
    <div class="tx-amt num">${ESC(fmtINR(t.amount))}</div>
    ${actions ? `
    <div class="tx-actions">
      <button class="icon-btn" type="button" data-a="edit" aria-label="Edit transaction">✏️</button>
      <button class="icon-btn danger" type="button" data-a="delete" aria-label="Delete transaction">🗑️</button>
    </div>` : ''}
  `;

  if (actions) {
    row.querySelector('[data-a="edit"]').addEventListener('click', () => openEditModal(t.id));
    row.querySelector('[data-a="delete"]').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete transaction?',
        message: `${cat.emoji} ${cat.name} · ${fmtDate(t.date)} · ${fmtINR(t.amount)}`,
        warn: 'This cannot be undone. Dashboards and charts update immediately after deletion.',
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      try {
        await store.deleteTransaction(t.id);
        toast('Transaction deleted');
      } catch (e) {
        toast(e.message, 'error');
      }
    });
  }
  return row;
}

/* ---------- edit modal (shared with add form) ---------- */
export function openEditModal(id) {
  const txn = store.getTransaction(id);
  if (!txn) { toast('That transaction no longer exists', 'error'); return; }

  const box = openModal({ title: 'Edit expense', grabber: true });
  const form = txnForm({ txn });
  const body = el('div');
  body.append(form);
  box.querySelector('.modal-body').append(body);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { errors, value } = await form._getValues();
    if (Object.keys(errors).length) return;
    try {
      await store.updateTransaction(id, value);
      toast('Expense updated');
      box.__close(true);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

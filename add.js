/* Add Expense view */

import * as store from '../store.js';
import { el, toast, todayISO, $ } from '../ui.js';
import { txnForm, attachNewCategoryButton } from '../components.js';

export async function render(root) {
  const card = el('section', 'card');
  card.innerHTML = `
    <header><h3>New expense<span class="hint">Saved locally on this device — instantly</span></h3></header>
    <div class="field" style="margin-bottom:12px">
      <label>Add category</label>
      <button class="btn btn-secondary btn-compact" type="button" id="btn-newcat" style="width:100%">＋ New category</button>
    </div>`;
  const form = txnForm({ submitLabel: 'Add Expense' });
  form.classList.add('form-in-card');
  card.append(form);
  root.append(card);
  attachNewCategoryButton(form, card.querySelector('#btn-newcat'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { errors, value } = await form._getValues();
    if (Object.keys(errors).length) {
      toast(Object.values(errors)[0], 'error');
      return;
    }
    try {
      await store.addTransaction(value);
      toast(`₹${value.amount.toLocaleString('en-IN')} ${value.category} added ✓`);
      // reset for rapid consecutive entry; keep category + payment method
      form.querySelector('#f-date').value = todayISO();
      form.querySelector('#f-amount').value = '';
      form.querySelector('#f-desc').value = '';
      form._focusAmount();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  form._refreshCategories(store.categoryList()[0]?.name || '');
  form._focusAmount();
}

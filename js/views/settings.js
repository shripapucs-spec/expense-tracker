/* Settings view — data export/backup/restore, categories, appearance, about */

import * as store from '../store.js';
import { el, ESC, toast, confirmDialog, download, fmtINR } from '../ui.js';

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export async function render(root) {
  const txns = store.allTransactions();
  const counts = store.dataCounts();

  /* ---------- data card ---------- */
  const dataCard = el('section', 'card', `
    <header><h3>Data · Backup &amp; export<span class="hint">${counts.transactions} transactions · stored locally in IndexedDB</span></h3></header>
    <div class="btn-row">
      <button class="btn btn-secondary" type="button" data-x="csv">⬇️ Export CSV</button>
      <button class="btn btn-secondary" type="button" data-x="json">⬇️ Export JSON</button>
      <button class="btn btn-secondary" type="button" data-x="backup">⬇️ Full backup</button>
    </div>
    <div class="field" style="margin-top:14px">
      <label for="restore-input">Restore from backup (JSON)</label>
      <input id="restore-input" type="file" accept="application/json,.json">
    </div>
    <div class="note-box">
      <b>Restore is merge-only:</b> new records are added, but existing records are never
      changed or overwritten. Rows with the same transaction ID are skipped, and you will
      see exactly how many were added/skipped.
    </div>
    <div class="note-box" style="margin-top:8px">
      <b>Important:</b> your data lives only in this browser via IndexedDB. Clearing Safari
      website data, reinstalling, or switching devices will lose it — there is no cloud copy.
      Use <b>Full backup</b> regularly and keep the downloaded file safe (e.g., iCloud Drive).
    </div>
  `);

  const restoreInput = dataCard.querySelector('#restore-input');
  restoreInput.addEventListener('change', async () => {
    const file = restoreInput.files?.[0];
    restoreInput.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (e) {
      toast('That file is not valid JSON', 'error');
      return;
    }
    const preview = Array.isArray(parsed) ? parsed : parsed?.transactions;
    if (!Array.isArray(preview)) {
      toast('This file does not contain a transactions list', 'error');
      return;
    }
    const ok = await confirmDialog({
      title: 'Restore backup?',
      message: `File contains ${preview.length} record${preview.length === 1 ? '' : 's'} (exported ${parsed?.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : 'unknown date'}).`,
      warn: 'Existing records will not be modified or overwritten. Duplicates are skipped automatically.',
      confirmText: 'Restore',
    });
    if (!ok) return;
    try {
      const r = await store.restoreFromBackup(parsed);
      toast(`Restored: ${r.added} added · ${r.skipped} duplicates skipped${r.invalid ? ` · ${r.invalid} invalid` : ''}`);
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  dataCard.querySelector('[data-x="csv"]').addEventListener('click', () => {
    download(`expenses-${stamp()}.csv`, store.exportCSV(), 'text/csv');
    toast('CSV exported');
  });
  dataCard.querySelector('[data-x="json"]').addEventListener('click', () => {
    const data = store.exportJSON();
    download(`expenses-${stamp()}.json`, JSON.stringify(data, null, 2));
    toast('JSON exported');
  });
  dataCard.querySelector('[data-x="backup"]').addEventListener('click', () => {
    const data = store.exportJSON();
    download(`expense-tracker-backup-${stamp()}.json`, JSON.stringify(data, null, 2));
    toast('Full backup downloaded');
  });

  /* ---------- categories card ---------- */
  const catCard = el('section', 'card', '<header><h3>Custom categories<span class="hint">Built-in categories cannot be removed</span></h3></header>');
  const addRow = el('div', 'btn-row');
  addRow.innerHTML = `
    <input id="nc-name" type="text" maxlength="24" placeholder="New category name…" autocomplete="off"
      style="flex:1;min-width:180px;padding:12px 13px;border:1px solid var(--border);border-radius:12px;font-size:16px;background:var(--surface);color:var(--text)">
  `;
  const addBtn = el('button', 'btn btn-primary btn-compact', '＋ Add');
  addBtn.type = 'button';
  addBtn.style.alignSelf = 'center';
  addRow.append(addBtn);
  catCard.append(addRow);

  const list = el('div', 'table-list');
  list.style.marginTop = '10px';
  const custom = store.customCategories();
  if (!custom.length) list.append(el('div', 'empty', '<b style="font-size:13px">No custom categories</b><p>Use + Add above.</p>'));
  for (const c of custom) {
    const row = el('div', 'trow', `
      <span class="l">${c.emoji} ${ESC(c.name)}</span>
      <button class="btn btn-ghost-danger btn-compact" type="button">Remove</button>`);
    list.append(row);
    row.querySelector('button').addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Remove “${c.name}”?`,
        message: 'The category disappears from pickers, but past transactions keep their name and history.',
        confirmText: 'Remove category', danger: true,
      });
      if (!ok) return;
      try {
        await store.removeCategory(c.name);
        toast('Category removed');
      } catch (e) { toast(e.message, 'error'); }
    });
  }
  catCard.append(list);

  const addCat = async () => {
    const input = catCard.querySelector('#nc-name');
    const name = input.value.trim();
    if (!name) { toast('Type a category name first', 'error'); return; }
    try {
      await store.addCategory(name);
      input.value = '';
      toast(`Category “${name}” added`);
    } catch (e) { toast(e.message, 'error'); }
  };
  addBtn.addEventListener('click', addCat);
  catCard.querySelector('#nc-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });

  /* ---------- appearance ---------- */
  const theme = store.getSettings().theme;
  const themeCard = el('section', 'card', `
    <header><h3>Appearance</h3></header>
    <div class="field">
      <label for="set-theme">Theme</label>
      <select id="set-theme">
        <option value="auto"${theme === 'auto' ? ' selected' : ''}>Follow system</option>
        <option value="light"${theme === 'light' ? ' selected' : ''}>Light</option>
        <option value="dark"${theme === 'dark' ? ' selected' : ''}>Dark</option>
      </select>
    </div>`);
  themeCard.querySelector('#set-theme').addEventListener('change', async (e) => {
    await store.setSetting('theme', e.target.value);
  });

  /* ---------- future sync placeholder ---------- */
  const syncCard = el('section', 'card', `
    <header><h3>Google Sheets sync<span class="hint">Planned for a future phase</span></h3></header>
    <div class="note-box">
      Sync stays <b>off</b> for now. When it arrives it will use OAuth with <b>your</b> consent,
      store no credentials in this app or repo, and only write to a Google Sheet you choose.
      The local-first behaviour above will not change.
    </div>`);

  /* ---------- privacy / about ---------- */
  const aboutCard = el('section', 'card', `
    <header><h3>Privacy &amp; storage</h3></header>
    <div class="note-box">
      This app is <b>local-first</b>: every expense is stored only on this device (browser
      IndexedDB). Nothing is sent to any server — there are no analytics, no trackers and no
      paid services. All amounts use Indian Rupees (₹).
    </div>
    <div class="note-box" style="margin-top:8px">
      <b>On iPhone:</b> open this page in Safari → Share → <b>Add to Home Screen</b>. It then
      runs full-screen like a native app and works offline.
      <br><br>
      Browser storage can be cleared by iOS under storage pressure or if you clear website
      data — please keep regular backups.
    </div>`);

  /* ---------- danger zone ---------- */
  const dangerCard = el('section', 'card', `
    <header><h3 style="color:var(--danger)">Danger zone</h3></header>
    <div class="btn-row">
      <button class="btn btn-danger" type="button" id="clear-all">Clear all data</button>
    </div>
    <div class="note-box">Deletes every transaction, custom category and setting on this device. Current total: <b>${fmtINR(txns.reduce((a, t) => a + t.amount, 0))}</b> across ${counts.transactions} transactions.</div>`);
  dangerCard.querySelector('#clear-all').addEventListener('click', async () => {
    const ok1 = await confirmDialog({
      title: 'Clear all data?',
      message: `This permanently deletes ${counts.transactions} transactions and all custom categories from this device.`,
      warn: 'Consider downloading a Full backup first.',
      confirmText: 'Continue', danger: true,
    });
    if (!ok1) return;
    const ok2 = await confirmDialog({
      title: 'Are you absolutely sure?',
      message: 'This is the final confirmation. Data cannot be recovered without a backup file.',
      confirmText: 'Delete everything', danger: true,
    });
    if (!ok2) return;
    await store.clearAllData();
    toast('All data cleared');
  });

  root.append(dataCard, catCard, themeCard, syncCard, aboutCard, dangerCard);
}

import { useState } from 'react';
import { api } from '../../api.js';

export default function TransactionModal({ tx, accounts, categories, profileId, month, onClose, onSaved }) {
  const isNew = !tx.id;

  // Default date to first day of current month view when adding new
  const defaultDate = tx.date ?? `${month}-01`;

  const [form, setForm] = useState({
    date:         defaultDate,
    description:  tx.description ?? '',
    amount:       tx.amount !== undefined ? String(Math.abs(tx.amount)).replace('.', ',') : '',
    isExpense:    tx.amount === undefined ? true : tx.amount < 0,
    accountId:    tx.account_id ?? (accounts[0]?.id ?? ''),
    categoryId:   tx.category_id ?? '',
    is_recurring: tx.is_recurring === 1,
  });
  const [error, setError] = useState('');

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function submit(e) {
    e.preventDefault();
    setError('');

    const numeric = parseFloat(String(form.amount).replace(',', '.'));
    if (isNaN(numeric) || numeric <= 0) { setError('Voer een geldig bedrag in'); return; }
    if (!form.accountId) { setError('Selecteer een rekening'); return; }
    if (!form.date) { setError('Voer een datum in'); return; }

    const payload = {
      profileId,
      accountId:    Number(form.accountId),
      categoryId:   form.categoryId ? Number(form.categoryId) : null,
      date:         form.date,
      amount:       form.isExpense ? -numeric : numeric,
      description:  form.description,
      is_recurring: form.is_recurring,
    };

    try {
      if (isNew) {
        await api.transactions.create(payload);
      } else {
        await api.transactions.update(tx.id, payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>{isNew ? 'Transactie toevoegen' : 'Transactie bewerken'}</h2>
        <form onSubmit={submit}>

          <div className="form-row-inline">
            <div className="form-row" style={{ margin: 0 }}>
              <label>Datum</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div className="form-row" style={{ margin: 0 }}>
              <label>Bedrag (€)</label>
              <input
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="form-row">
            <label>Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: 0 }}>
                <input type="radio" checked={form.isExpense} onChange={() => set('isExpense', true)} /> Uitgave
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: 0 }}>
                <input type="radio" checked={!form.isExpense} onChange={() => set('isExpense', false)} /> Ontvangst
              </label>
            </div>
          </div>

          <div className="form-row">
            <label>Omschrijving</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optioneel" />
          </div>

          <div className="form-row-inline">
            <div className="form-row" style={{ margin: 0 }}>
              <label>Rekening</label>
              <select value={form.accountId} onChange={e => set('accountId', e.target.value)}>
                <option value="">— kies rekening —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-row" style={{ margin: 0 }}>
              <label>Categorie</label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">— niet gecategoriseerd —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={e => set('is_recurring', e.target.checked)}
              />
              Terugkerende transactie
            </label>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn btn-primary">{isNew ? 'Toevoegen' : 'Opslaan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

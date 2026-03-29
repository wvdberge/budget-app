import { useState } from 'react';
import { api } from '../../api.js';

export default function TransferModal({ accounts, profileId, month, onClose, onSaved }) {
  const [form, setForm] = useState({
    date:          `${month}-01`,
    fromAccountId: accounts[0]?.id ?? '',
    toAccountId:   accounts[1]?.id ?? '',
    amount:        '',
    description:   '',
  });
  const [error, setError] = useState('');

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    const numeric = parseFloat(String(form.amount).replace(',', '.'));
    if (isNaN(numeric) || numeric <= 0) { setError('Voer een geldig bedrag in'); return; }
    if (!form.fromAccountId || !form.toAccountId) { setError('Selecteer beide rekeningen'); return; }
    if (Number(form.fromAccountId) === Number(form.toAccountId)) { setError('Van en naar rekening mogen niet hetzelfde zijn'); return; }

    try {
      await api.transfers.create({
        profileId,
        fromAccountId: Number(form.fromAccountId),
        toAccountId:   Number(form.toAccountId),
        amount:        numeric,
        date:          form.date,
        description:   form.description,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>Overboeking</h2>
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
                autoFocus
              />
            </div>
          </div>

          <div className="form-row-inline">
            <div className="form-row" style={{ margin: 0 }}>
              <label>Van rekening</label>
              <select value={form.fromAccountId} onChange={e => set('fromAccountId', e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-row" style={{ margin: 0 }}>
              <label>Naar rekening</label>
              <select value={form.toAccountId} onChange={e => set('toAccountId', e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <label>Omschrijving</label>
            <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optioneel" />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn btn-primary">Toevoegen</button>
          </div>
        </form>
      </div>
    </div>
  );
}

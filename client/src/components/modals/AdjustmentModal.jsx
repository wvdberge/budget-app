import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { formatAmount } from '../../format.js';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdjustmentModal({ accounts, profileId, defaultAccountId, onClose, onSaved }) {
  const [form, setForm] = useState({
    accountId:   defaultAccountId || accounts[0]?.id || '',
    date:        todayISO(),
    amount:      '',
    description: '',
  });
  const [currentBalance, setCurrentBalance] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(key, value) { setForm(f => ({ ...f, [key]: value })); }

  useEffect(() => {
    if (!form.accountId || !form.date) { setCurrentBalance(null); return; }
    let cancelled = false;
    api.accounts.balance(form.accountId, form.date)
      .then(r => { if (!cancelled) setCurrentBalance(r.balance); })
      .catch(() => { if (!cancelled) setCurrentBalance(null); });
    return () => { cancelled = true; };
  }, [form.accountId, form.date]);

  const numeric = parseFloat(String(form.amount).replace(',', '.'));
  const projected = currentBalance !== null && !isNaN(numeric) ? currentBalance + numeric : null;

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.accountId) { setError('Selecteer een rekening'); return; }
    if (isNaN(numeric) || numeric === 0) { setError('Voer een verschil in (positief of negatief, niet 0)'); return; }

    setSaving(true);
    try {
      await api.transactions.adjustment({
        profileId,
        accountId:   Number(form.accountId),
        date:        form.date,
        amount:      numeric,
        description: form.description,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>Saldo aanpassen</h2>
        <form onSubmit={submit}>

          <div className="form-row">
            <label>Rekening</label>
            <select value={form.accountId} onChange={e => set('accountId', e.target.value)}>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="form-row-inline">
            <div className="form-row" style={{ margin: 0 }}>
              <label>Datum</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
            </div>
            <div className="form-row" style={{ margin: 0 }}>
              <label>Verschil (€)</label>
              <input
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="-0,03"
                inputMode="decimal"
                autoFocus
              />
            </div>
          </div>

          {currentBalance !== null && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -4, marginBottom: 8 }}>
              Saldo op deze datum: <strong>{formatAmount(currentBalance)}</strong>
              {projected !== null && (
                <> → na aanpassing: <strong>{formatAmount(projected)}</strong></>
              )}
            </div>
          )}

          <div className="form-row">
            <label>Omschrijving</label>
            <input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optioneel (bijv. 'afronding bankafschrift')"
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Annuleren</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Bezig…' : 'Aanpassen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

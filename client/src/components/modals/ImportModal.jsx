import { useState, useRef } from 'react';
import { api } from '../../api.js';
import { formatAmount, formatDate } from '../../format.js';

// Match a parsed description against the rule list.
// Returns "cat:N" / "acc:N" for matched rules, or "" if none match.
function ruleAssignment(rules, description) {
  if (!description || !rules?.length) return '';
  const lower = description.toLowerCase();
  const rule = rules.find(r => lower.includes(r.keyword.toLowerCase()));
  if (!rule) return '';
  if (rule.category_id)         return `cat:${rule.category_id}`;
  if (rule.transfer_account_id) return `acc:${rule.transfer_account_id}`;
  return '';
}

export default function ImportModal({ profileId, accounts, categories, rules, onClose, onSaved }) {
  const [step, setStep]             = useState('config'); // 'config' | 'preview'
  const [bank, setBank]             = useState('abnamro');
  const [accountId, setAccountId]   = useState(accounts[0]?.id ?? '');
  const [parsed, setParsed]         = useState([]); // [{ date, amount, description, assignment, existing?, _selected }]
  const [error, setError]           = useState('');
  const [saving, setSaving]         = useState(false);
  const fileRef = useRef(null);

  async function parse(e) {
    e.preventDefault();
    setError('');
    const file = fileRef.current?.files[0];
    if (!file) { setError('Kies een bestand'); return; }
    if (!accountId) { setError('Kies een rekening'); return; }

    try {
      const result = await api.import.parse(bank, file, profileId, accountId);
      if (!result.transactions.length) { setError('Geen transacties gevonden in dit bestand.'); return; }
      setParsed(result.transactions.map(t => ({
        ...t,
        assignment: ruleAssignment(rules, t.description),
        _selected:  !t.existing, // pre-deselect duplicates
      })));
      setStep('preview');
    } catch (e) {
      setError(e.message);
    }
  }

  function toggleAll(checked) {
    setParsed(ps => ps.map(p => ({ ...p, _selected: checked })));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const toSave = parsed
        .filter(t => t._selected)
        .map(t => {
          const row = { date: t.date, amount: t.amount, description: t.description };
          if (t.assignment.startsWith('cat:')) {
            row.categoryId = Number(t.assignment.slice(4));
          } else if (t.assignment.startsWith('acc:')) {
            row.transferAccountId = Number(t.assignment.slice(4));
          }
          return row;
        });
      await api.import.save(profileId, accountId, toSave);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const selectedCount  = parsed.filter(t => t._selected).length;
  const existingCount  = parsed.filter(t => t.existing).length;
  const otherAccounts  = accounts.filter(a => String(a.id) !== String(accountId));

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide">
        <h2>CSV importeren</h2>

        {step === 'config' && (
          <form onSubmit={parse}>
            <div className="form-row">
              <label>Bank</label>
              <select value={bank} onChange={e => setBank(e.target.value)}>
                <option value="abnamro">ABN AMRO</option>
                <option value="asn">ASN Bank</option>
              </select>
            </div>
            <div className="form-row">
              <label>Importeren naar rekening</label>
              <select value={accountId} onChange={e => setAccountId(e.target.value)}>
                <option value="">— kies rekening —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <label>Bestand</label>
              <input type="file" ref={fileRef} accept=".csv,.txt,.tab" style={{ padding: '4px 0' }} />
            </div>
            {error && <div className="error-msg">{error}</div>}
            <div className="modal-footer">
              <button type="button" className="btn" onClick={onClose}>Annuleren</button>
              <button type="submit" className="btn btn-primary">Inlezen</button>
            </div>
          </form>
        )}

        {step === 'preview' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {parsed.length} transacties — {selectedCount} geselecteerd
                {existingCount > 0 && <> · {existingCount} al geïmporteerd</>}
              </span>
              <button className="btn btn-sm" onClick={() => toggleAll(true)}>Alles aan</button>
              <button className="btn btn-sm" onClick={() => toggleAll(false)}>Alles uit</button>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto', marginBottom: 12 }}>
              <table className="import-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}>✓</th>
                    <th>Datum</th>
                    <th>Omschrijving</th>
                    <th style={{ textAlign: 'right' }}>Bedrag</th>
                    <th>Toewijzing</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((t, i) => (
                    <tr key={i} style={{ opacity: t._selected ? 1 : .4 }}>
                      <td>
                        <input
                          type="checkbox"
                          checked={t._selected}
                          onChange={e => setParsed(ps => ps.map((p, j) => j === i ? { ...p, _selected: e.target.checked } : p))}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                      <td>
                        {t.description}
                        {t.existing && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-faint)' }}>
                            (al geïmporteerd)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: t.amount < 0 ? 'var(--negative)' : 'var(--positive)' }}>
                        {formatAmount(t.amount)}
                      </td>
                      <td>
                        <select
                          value={t.assignment ?? ''}
                          onChange={e => setParsed(ps => ps.map((p, j) => j === i ? { ...p, assignment: e.target.value } : p))}
                        >
                          <option value="">—</option>
                          <optgroup label="Categorie">
                            {categories.map(c => <option key={`c${c.id}`} value={`cat:${c.id}`}>{c.name}</option>)}
                          </optgroup>
                          {otherAccounts.length > 0 && (
                            <optgroup label="Overboeking naar">
                              {otherAccounts.map(a => <option key={`a${a.id}`} value={`acc:${a.id}`}>→ {a.name}</option>)}
                            </optgroup>
                          )}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && <div className="error-msg">{error}</div>}
            <div className="modal-footer">
              <button className="btn" onClick={() => setStep('config')}>Terug</button>
              <button className="btn" onClick={onClose}>Annuleren</button>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={saving || selectedCount === 0}
              >
                {saving ? 'Bezig…' : `${selectedCount} importeren`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

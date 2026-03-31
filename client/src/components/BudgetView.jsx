import { useContext, useEffect, useState, useRef } from 'react';
import { AppContext } from '../App.jsx';
import { api } from '../api.js';
import { formatAmount, availableClass } from '../format.js';

export default function BudgetView() {
  const { profileId, month } = useContext(AppContext);
  const [budget, setBudget] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [editingTarget, setEditingTarget] = useState(null); // { categoryId, value }
  const [feedback, setFeedback] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    api.budget.get(profileId, month)
      .then(setBudget)
      .finally(() => setLoading(false));
  }, [profileId, month]);

  function showFeedback(msg) {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  }

  async function applyRecurring() {
    const { created } = await api.budget.applyRecurring(profileId, month);
    api.budget.get(profileId, month).then(setBudget);
    showFeedback(created > 0 ? `${created} terugkerende transactie(s) toegevoegd.` : 'Geen terugkerende transacties gevonden in de vorige maand.');
  }

  async function copyTargets() {
    const { copied } = await api.budget.copyTargets(profileId, month);
    api.budget.get(profileId, month).then(setBudget);
    showFeedback(copied > 0 ? `${copied} doelen gekopieerd.` : 'Geen doelen om te kopiëren.');
  }

  function startEditTarget(categoryId, currentTarget) {
    // Convert target to Dutch display format for editing
    const displayVal = String(currentTarget).replace('.', ',');
    setEditingTarget({ categoryId, value: displayVal });
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function saveTarget(categoryId) {
    if (!editingTarget) return;
    // Parse Dutch format: replace comma with dot
    const numeric = parseFloat(String(editingTarget.value).replace(',', '.'));
    if (!isNaN(numeric)) {
      await api.budget.setTarget(profileId, month, categoryId, numeric);
      const updated = await api.budget.get(profileId, month);
      setBudget(updated);
    }
    setEditingTarget(null);
  }

  if (loading) return <div className="empty-state">Laden…</div>;
  if (!budget) return null;

  const hasCategories = budget.groups.some(g => g.categories.length > 0);

  // Totals (exclude income groups from budget table totals)
  const allCats = budget.groups.filter(g => !g.is_income).flatMap(g => g.categories);
  const totalTarget    = allCats.reduce((s, c) => s + c.target, 0);
  const totalSpent     = allCats.reduce((s, c) => s + c.spent, 0);
  const totalAvailable = allCats.reduce((s, c) => s + c.available, 0);

  return (
    <div>
      {/* Toolbar */}
      <div className="tx-toolbar" style={{ marginBottom: 14 }}>
        <button className="btn btn-sm" onClick={copyTargets} title="Kopieer budgetten van vorige maand">Doelen kopiëren</button>
        <button className="btn btn-sm" onClick={applyRecurring} title="Voeg terugkerende transacties toe voor deze maand">Terugkerend toevoegen</button>
        {feedback && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{feedback}</span>}
      </div>

      {/* Income summary */}
      {budget.totalIncome > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--positive-bg, #e8f5e9)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Inkomen deze maand</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--positive)' }}>{formatAmount(budget.totalIncome)}</span>
        </div>
      )}

      {!hasCategories ? (
        <div className="empty-state">Nog geen categorieën. Ga naar Beheer om categorieën aan te maken.</div>
      ) : (
        <table className="budget-table">
          <thead>
            <tr>
              <td style={{ padding: '0 8px 6px', color: 'var(--text-muted)', fontSize: 11 }}>Categorie</td>
              <td style={{ padding: '0 8px 6px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>Doel</td>
              <td style={{ padding: '0 8px 6px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>Uitgegeven</td>
              <td style={{ padding: '0 8px 6px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>Beschikbaar</td>
            </tr>
          </thead>
          <tbody>
            {budget.groups.map(group => (
              group.categories.length === 0 ? null : (
                <>
                  <tr key={`g-${group.id}`} className="budget-group-header">
                    <td colSpan={4}>{group.name}</td>
                  </tr>
                  {group.categories.map(cat => (
                    <tr key={cat.id} className="budget-row">
                      <td className="name">{cat.name}</td>
                      <td className="amount">
                        {editingTarget?.categoryId === cat.id ? (
                          <input
                            ref={inputRef}
                            className="target-input"
                            value={editingTarget.value}
                            onChange={e => setEditingTarget(et => ({ ...et, value: e.target.value }))}
                            onBlur={() => saveTarget(cat.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveTarget(cat.id);
                              if (e.key === 'Escape') setEditingTarget(null);
                            }}
                          />
                        ) : (
                          <span
                            style={{ cursor: 'pointer' }}
                            title="Klik om doel te bewerken"
                            onClick={() => startEditTarget(cat.id, cat.target)}
                          >
                            {formatAmount(cat.target)}
                          </span>
                        )}
                      </td>
                      <td className="amount">{formatAmount(-cat.spent)}</td>
                      <td className="amount available-cell">
                        <span className={`available-value ${availableClass(cat.available)}`}>
                          {formatAmount(cat.available)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </>
              )
            ))}

            {/* Totals row */}
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>Totaal</td>
              <td className="amount" style={{ padding: '8px', fontWeight: 600 }}>{formatAmount(totalTarget)}</td>
              <td className="amount" style={{ padding: '8px', fontWeight: 600 }}>{formatAmount(-totalSpent)}</td>
              <td className="amount" style={{ padding: '8px' }}>
                <span className={`available-value ${availableClass(totalAvailable)}`} style={{ fontWeight: 600 }}>
                  {formatAmount(totalAvailable)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

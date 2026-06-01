import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App.jsx';
import { api } from '../api.js';
import { formatAmount, formatDate } from '../format.js';
import TransactionModal from './modals/TransactionModal.jsx';
import ImportModal from './modals/ImportModal.jsx';
import TransferModal from './modals/TransferModal.jsx';
import AdjustmentModal from './modals/AdjustmentModal.jsx';

export default function TransactionsView() {
  const { profileId, month } = useContext(AppContext);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [rules, setRules]               = useState([]);
  const [loading, setLoading]           = useState(false);
  const [editTx, setEditTx]             = useState(null);   // null = closed, {} = new, tx = edit
  const [showImport, setShowImport]     = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [filterAccountId, setFilterAccountId] = useState('');

  function load() {
    if (!profileId) return;
    setLoading(true);
    Promise.all([
      api.transactions.list(profileId, month, filterAccountId || null),
      api.accounts.list(profileId),
      api.categories.list(profileId),
      api.rules.list(profileId),
    ]).then(([txs, accs, cats, rls]) => {
      setTransactions(txs);
      setAccounts(accs);
      setCategories(cats);
      setRules(rls);
    }).finally(() => setLoading(false));
  }

  useEffect(load, [profileId, month, filterAccountId]);

  async function deleteTx(id, isTransfer, isAdjustment) {
    let msg = 'Transactie verwijderen?';
    if (isTransfer) msg = 'Overboeking verwijderen? Beide boekingen worden verwijderd.';
    else if (isAdjustment) msg = 'Saldo-aanpassing verwijderen?';
    if (!confirm(msg)) return;
    await api.transactions.delete(id);
    load();
  }

  if (loading) return <div className="empty-state">Laden…</div>;

  const selectedAccount = filterAccountId ? accounts.find(a => String(a.id) === filterAccountId) : null;

  return (
    <div>
      <div className="tx-toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => setEditTx(filterAccountId ? { account_id: Number(filterAccountId) } : {})}>+ Transactie</button>
        <button className="btn btn-sm" onClick={() => setShowTransfer(true)}>↔ Overboeking</button>
        <button className="btn btn-sm" onClick={() => setShowAdjustment(true)}>± Saldo aanpassen</button>
        <button className="btn btn-sm" onClick={() => setShowImport(true)}>CSV importeren</button>
        <select
          value={filterAccountId}
          onChange={e => setFilterAccountId(e.target.value)}
          style={{ fontSize: 13 }}
        >
          <option value="">Alle rekeningen</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <span className="spacer" />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {transactions.length} transactie{transactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {selectedAccount && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 4px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{selectedAccount.name}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Huidig saldo:</span>
          <span style={{ fontWeight: 600, fontSize: 15, color: selectedAccount.current_balance >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
            {formatAmount(selectedAccount.current_balance)}
          </span>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="empty-state">Geen transacties in deze maand.</div>
      ) : (
        <table className="tx-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Omschrijving</th>
              <th>Rekening</th>
              <th>Categorie</th>
              <th style={{ textAlign: 'right' }}>Bedrag</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDate(tx.date)}</td>
                <td>
                  {tx.description || <span style={{ color: 'var(--text-faint)' }}>—</span>}
                  {tx.is_recurring   ? <span className="recurring-badge">↻</span> : null}
                  {tx.is_transfer    ? <span className="recurring-badge">↔</span> : null}
                  {tx.is_adjustment  ? <span className="recurring-badge" title="Saldo-aanpassing">±</span> : null}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{tx.account_name}</td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {tx.category_name || <span style={{ color: 'var(--text-faint)' }}>Niet gecategoriseerd</span>}
                </td>
                <td className={`tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}>
                  {formatAmount(tx.amount)}
                </td>
                <td style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  {!tx.is_transfer && !tx.is_adjustment && <button className="icon-btn" title="Bewerken" onClick={() => setEditTx(tx)}>✎</button>}
                  <button className="icon-btn" title="Verwijderen" onClick={() => deleteTx(tx.id, tx.is_transfer, tx.is_adjustment)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editTx !== null && (
        <TransactionModal
          tx={editTx}
          accounts={accounts}
          categories={categories}
          rules={rules}
          profileId={profileId}
          month={month}
          onClose={() => setEditTx(null)}
          onSaved={load}
        />
      )}

      {showImport && (
        <ImportModal
          profileId={profileId}
          accounts={accounts}
          categories={categories}
          rules={rules}
          onClose={() => setShowImport(false)}
          onSaved={load}
        />
      )}

      {showTransfer && (
        <TransferModal
          profileId={profileId}
          accounts={accounts}
          month={month}
          onClose={() => setShowTransfer(false)}
          onSaved={load}
        />
      )}

      {showAdjustment && (
        <AdjustmentModal
          profileId={profileId}
          accounts={accounts}
          defaultAccountId={filterAccountId ? Number(filterAccountId) : null}
          onClose={() => setShowAdjustment(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

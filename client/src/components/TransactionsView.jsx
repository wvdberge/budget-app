import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App.jsx';
import { api } from '../api.js';
import { formatAmount, formatDate } from '../format.js';
import TransactionModal from './modals/TransactionModal.jsx';
import ImportModal from './modals/ImportModal.jsx';
import TransferModal from './modals/TransferModal.jsx';

export default function TransactionsView() {
  const { profileId, month } = useContext(AppContext);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [editTx, setEditTx]             = useState(null);   // null = closed, {} = new, tx = edit
  const [showImport, setShowImport]     = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  function load() {
    if (!profileId) return;
    setLoading(true);
    Promise.all([
      api.transactions.list(profileId, month),
      api.accounts.list(profileId),
      api.categories.list(profileId),
    ]).then(([txs, accs, cats]) => {
      setTransactions(txs);
      setAccounts(accs);
      setCategories(cats);
    }).finally(() => setLoading(false));
  }

  useEffect(load, [profileId, month]);

  async function deleteTx(id, isTransfer) {
    const msg = isTransfer ? 'Overboeking verwijderen? Beide boekingen worden verwijderd.' : 'Transactie verwijderen?';
    if (!confirm(msg)) return;
    await api.transactions.delete(id);
    load();
  }

  if (loading) return <div className="empty-state">Laden…</div>;

  return (
    <div>
      <div className="tx-toolbar">
        <button className="btn btn-primary btn-sm" onClick={() => setEditTx({})}>+ Transactie</button>
        <button className="btn btn-sm" onClick={() => setShowTransfer(true)}>↔ Overboeking</button>
        <button className="btn btn-sm" onClick={() => setShowImport(true)}>CSV importeren</button>
        <span className="spacer" />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {transactions.length} transactie{transactions.length !== 1 ? 's' : ''}
        </span>
      </div>

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
                  {tx.is_recurring ? <span className="recurring-badge">↻</span> : null}
                  {tx.is_transfer  ? <span className="recurring-badge">↔</span> : null}
                </td>
                <td style={{ color: 'var(--text-muted)' }}>{tx.account_name}</td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {tx.category_name || <span style={{ color: 'var(--text-faint)' }}>Niet gecategoriseerd</span>}
                </td>
                <td className={`tx-amount ${tx.amount >= 0 ? 'positive' : 'negative'}`}>
                  {formatAmount(tx.amount)}
                </td>
                <td style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  {!tx.is_transfer && <button className="icon-btn" title="Bewerken" onClick={() => setEditTx(tx)}>✎</button>}
                  <button className="icon-btn" title="Verwijderen" onClick={() => deleteTx(tx.id, tx.is_transfer)}>✕</button>
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
    </div>
  );
}

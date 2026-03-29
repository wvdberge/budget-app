import { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App.jsx';
import { api } from '../api.js';
import { formatAmount } from '../format.js';

function EditableItem({ name, onSave, onDelete, children }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(name);

  async function save() {
    if (val.trim()) await onSave(val.trim());
    setEditing(false);
  }

  if (editing) return (
    <li className="manage-item">
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ flex: 1 }}
      />
      {children}
      <button className="btn btn-sm btn-danger" onClick={onDelete} title="Verwijderen">✕</button>
    </li>
  );

  return (
    <li className="manage-item">
      <span className="manage-item-name" onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}>{name}</span>
      {children}
      <button className="icon-btn" onClick={() => setEditing(true)} title="Naam bewerken">✎</button>
      <button className="icon-btn" onClick={onDelete} title="Verwijderen" style={{ color: 'var(--negative)' }}>✕</button>
    </li>
  );
}

function AddForm({ placeholder, onAdd, extraField }) {
  const [name, setName]   = useState('');
  const [extra, setExtra] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await onAdd(name.trim(), extra);
    setName('');
    setExtra('');
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} style={{ flex: 1 }} />
      {extraField && (
        <input
          value={extra}
          onChange={e => setExtra(e.target.value)}
          placeholder={extraField}
          style={{ width: 90 }}
        />
      )}
      <button type="submit" className="btn btn-sm btn-primary">+</button>
    </form>
  );
}

export default function ManageView() {
  const { profileId, profiles, reloadProfiles } = useContext(AppContext);
  const [accounts, setAccounts]   = useState([]);
  const [groups, setGroups]       = useState([]);
  const [categories, setCategories] = useState([]);

  function load() {
    if (!profileId) return;
    Promise.all([
      api.accounts.list(profileId),
      api.groups.list(profileId),
      api.categories.list(profileId),
    ]).then(([accs, grps, cats]) => {
      setAccounts(accs);
      setGroups(grps);
      setCategories(cats);
    });
  }

  useEffect(load, [profileId]);

  // ── Profiles ─────────────────────────────────────────────────────────────
  async function deleteProfile(id) {
    if (!confirm('Profiel en alle bijbehorende data verwijderen?')) return;
    await api.profiles.delete(id);
    reloadProfiles();
  }

  // ── Accounts ─────────────────────────────────────────────────────────────
  async function addAccount(name, initialBalanceStr) {
    const initial_balance = parseFloat(String(initialBalanceStr).replace(',', '.')) || 0;
    await api.accounts.create(profileId, name, initial_balance);
    load();
  }
  async function updateAccount(id, name, initial_balance) { await api.accounts.update(id, name, initial_balance); load(); }
  async function updateAccountBalance(id, balanceStr, name) {
    const initial_balance = parseFloat(String(balanceStr).replace(',', '.'));
    if (!isNaN(initial_balance)) { await api.accounts.update(id, name, initial_balance); load(); }
  }
  async function deleteAccount(id) {
    if (!confirm('Rekening verwijderen?')) return;
    await api.accounts.delete(id);
    load();
  }

  // ── Groups ───────────────────────────────────────────────────────────────
  async function addGroup(name) {
    await api.groups.create(profileId, name, groups.length);
    load();
  }
  async function updateGroup(id, name) { await api.groups.update(id, name); load(); }
  async function deleteGroup(id) {
    if (!confirm('Groep en alle bijbehorende categorieën verwijderen?')) return;
    await api.groups.delete(id);
    load();
  }

  // ── Categories ───────────────────────────────────────────────────────────
  async function addCategory(name, targetStr, groupId) {
    const target = parseFloat(String(targetStr).replace(',', '.')) || 0;
    await api.categories.create(profileId, groupId, name, target);
    load();
  }
  async function updateCategory(id, name) {
    await api.categories.update(id, { name });
    load();
  }
  async function updateCategoryTarget(id, targetStr) {
    const target = parseFloat(String(targetStr).replace(',', '.'));
    if (!isNaN(target)) { await api.categories.update(id, { name: categories.find(c => c.id === id)?.name, monthly_target: target }); load(); }
  }
  async function deleteCategory(id) {
    if (!confirm('Categorie verwijderen?')) return;
    await api.categories.delete(id);
    load();
  }

  if (!profileId) return <div className="empty-state">Geen profiel geselecteerd.</div>;

  return (
    <div className="manage-grid">

      {/* Profiles */}
      <div className="manage-section">
        <h3>Profielen</h3>
        <ul className="manage-list">
          {profiles.map(p => (
            <EditableItem
              key={p.id}
              name={p.name}
              onSave={name => api.profiles.update(p.id, name).then(reloadProfiles)}
              onDelete={() => deleteProfile(p.id)}
            />
          ))}
        </ul>
        {/* Profile add is in the header */}
      </div>

      {/* Accounts */}
      <div className="manage-section">
        <h3>Rekeningen</h3>
        <ul className="manage-list">
          {accounts.map(a => (
            <EditableItem key={a.id} name={a.name} onSave={n => updateAccount(a.id, n, a.initial_balance)} onDelete={() => deleteAccount(a.id)}>
              <TargetEditor
                value={a.initial_balance}
                onSave={v => updateAccountBalance(a.id, v, a.name)}
                title="Beginsaldo"
              />
              <span className="manage-item-sub" style={{ marginRight: 4, color: a.current_balance >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {formatAmount(a.current_balance)}
              </span>
            </EditableItem>
          ))}
        </ul>
        <AddForm placeholder="Nieuwe rekening" extraField="Beginsaldo (€)" onAdd={addAccount} />
      </div>

      {/* Category groups + categories — full width */}
      <div className="manage-section" style={{ gridColumn: '1 / -1' }}>
        <h3>Categoriegroepen &amp; categorieën</h3>

        {groups.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
            Nog geen groepen. Voeg een groep toe om categorieën aan te maken.
          </div>
        )}

        {groups.map(g => {
          const groupCats = categories.filter(c => c.group_id === g.id);
          return (
            <div key={g.id} className="category-full-section">
              <div className="group-header-full">
                <EditableItem
                  name={g.name}
                  onSave={n => updateGroup(g.id, n)}
                  onDelete={() => deleteGroup(g.id)}
                />
              </div>
              <ul className="manage-list" style={{ paddingLeft: 16 }}>
                {groupCats.map(c => (
                  <EditableItem
                    key={c.id}
                    name={c.name}
                    onSave={n => updateCategory(c.id, n)}
                    onDelete={() => deleteCategory(c.id)}
                  >
                    <TargetEditor value={c.monthly_target} onSave={v => updateCategoryTarget(c.id, v)} />
                  </EditableItem>
                ))}
              </ul>
              <div style={{ paddingLeft: 16 }}>
                <AddForm
                  placeholder="Nieuwe categorie"
                  extraField="Doel (€)"
                  onAdd={(name, target) => addCategory(name, target, g.id)}
                />
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 12 }}>
          <AddForm placeholder="Nieuwe groep" onAdd={addGroup} />
        </div>
      </div>

    </div>
  );
}

function TargetEditor({ value, onSave, title = 'Klik om standaard doel te bewerken' }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState('');

  function start() {
    setVal(String(value).replace('.', ','));
    setEditing(true);
  }

  async function save() {
    await onSave(val);
    setEditing(false);
  }

  if (editing) return (
    <input
      autoFocus
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      style={{ width: 80, textAlign: 'right', fontSize: 12 }}
    />
  );

  return (
    <span
      className="manage-item-sub"
      style={{ cursor: 'pointer', marginRight: 4 }}
      onClick={start}
      title={title}
    >
      {formatAmount(value)}
    </span>
  );
}

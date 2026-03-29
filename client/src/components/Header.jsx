import { useContext, useState } from 'react';
import { AppContext } from '../App.jsx';
import { formatMonth, addMonths } from '../format.js';
import { api } from '../api.js';

export default function Header({ tab, setTab }) {
  const { profiles, profileId, setProfileId, reloadProfiles, month, setMonth } = useContext(AppContext);
  const [addingProfile, setAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');

  async function createProfile(e) {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    await api.profiles.create(newProfileName.trim());
    setNewProfileName('');
    setAddingProfile(false);
    reloadProfiles();
  }

  return (
    <header className="header">
      <span className="header-title">Budget</span>
      <span className="header-sep">·</span>

      {/* Profile selector */}
      {profiles.length > 0 && (
        <select
          className="profile-select"
          value={profileId ?? ''}
          onChange={e => setProfileId(Number(e.target.value))}
        >
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {/* Add profile inline */}
      {addingProfile ? (
        <form onSubmit={createProfile} style={{ display: 'flex', gap: 4 }}>
          <input
            autoFocus
            style={{ width: 130, padding: '3px 8px', fontSize: 13 }}
            value={newProfileName}
            onChange={e => setNewProfileName(e.target.value)}
            placeholder="Profielnaam"
          />
          <button type="submit" className="btn btn-sm btn-primary">OK</button>
          <button type="button" className="btn btn-sm" onClick={() => setAddingProfile(false)}>✕</button>
        </form>
      ) : (
        <button className="btn-ghost btn-sm" onClick={() => setAddingProfile(true)} title="Nieuw profiel">+ profiel</button>
      )}

      <span className="spacer" />

      {/* Month navigation — only on budget and transactions tabs */}
      {(tab === 'budget' || tab === 'transactions') && (
        <div className="month-nav">
          <button className="icon-btn" onClick={() => setMonth(m => addMonths(m, -1))}>‹</button>
          <span className="month-label">{formatMonth(month)}</span>
          <button className="icon-btn" onClick={() => setMonth(m => addMonths(m, 1))}>›</button>
        </div>
      )}

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: 2, marginLeft: 12 }}>
        {[['budget', 'Budget'], ['transactions', 'Transacties'], ['manage', 'Beheer']].map(([key, label]) => (
          <button
            key={key}
            className={`tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >{label}</button>
        ))}
      </nav>
    </header>
  );
}

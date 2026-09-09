import { useState, useEffect, createContext, useContext } from 'react';
import { api } from './api.js';
import { currentMonth, addMonths, formatMonth } from './format.js';
import Header from './components/Header.jsx';
import BudgetView from './components/BudgetView.jsx';
import TransactionsView from './components/TransactionsView.jsx';
import ManageView from './components/ManageView.jsx';

export const AppContext = createContext(null);

export default function App() {
  const [profiles, setProfiles]   = useState([]);
  const [profileId, setProfileId] = useState(null);
  const [month, setMonth]         = useState(currentMonth());
  const [tab, setTab]             = useState('budget'); // 'budget' | 'transactions' | 'manage'
  const [categoryFilter, setCategoryFilter] = useState(''); // '' = all; set by clicking a budget category

  useEffect(() => {
    api.profiles.list().then(list => {
      setProfiles(list);
      if (list.length > 0 && !profileId) setProfileId(list[0].id);
    });
  }, []);

  // Category ids are profile-scoped, so a filter from one profile is meaningless in another.
  useEffect(() => { setCategoryFilter(''); }, [profileId]);

  function reloadProfiles() {
    api.profiles.list().then(list => {
      setProfiles(list);
      if (list.length > 0 && !list.find(p => p.id === profileId)) {
        setProfileId(list[0].id);
      }
    });
  }

  const ctx = { profileId, setProfileId, profiles, reloadProfiles, month, setMonth, tab, setTab, categoryFilter, setCategoryFilter };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <Header tab={tab} setTab={setTab} />
        <main className="main">
          {!profileId ? (
            <div className="empty-state">Maak een profiel aan via Beheer om te beginnen.</div>
          ) : tab === 'budget' ? (
            <BudgetView />
          ) : tab === 'transactions' ? (
            <TransactionsView />
          ) : (
            <ManageView />
          )}
        </main>
      </div>
    </AppContext.Provider>
  );
}

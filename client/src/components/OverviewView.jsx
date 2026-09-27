import { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../App.jsx';
import { api } from '../api.js';
import { formatAmount, formatMonth, currentMonth, addMonths, availableClass } from '../format.js';
import OverviewChart from './OverviewChart.jsx';

// Categorical slots (dark steps), assigned to groups in budget order. Past eight groups,
// the eighth slot becomes "Overig" and the remaining groups fold into it.
const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];
const OTHER_COLOR = '#6b6b6b';
const UNCAT_COLOR = '#6b6b6b';

const PRESETS = [
  ['year', 'Dit jaar'],
  ['3',    'Laatste 3 mnd'],
  ['6',    'Laatste 6 mnd'],
  ['12',   'Laatste 12 mnd'],
  ['all',  'Alles'],
  ['custom', 'Aangepast'],
];

const EPS = 0.005;
const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0);

function monthsBetween(from, to) {
  const out = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export default function OverviewView() {
  const { profileId, setTab, setCategoryFilter, setTxPeriod } = useContext(AppContext);
  const [preset, setPreset]             = useState('6');
  const [includeCurrent, setIncludeCurrent] = useState(false);
  const [custom, setCustom]             = useState(() => {
    const end = addMonths(currentMonth(), -1);
    return { from: addMonths(end, -5), to: end };
  });
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [collapsed, setCollapsed]       = useState(new Set());
  const [flat, setFlat]                 = useState(false);
  const [selected, setSelected]         = useState(null); // { key, name, color, values } shown alone in the chart

  // Requested range; `from` null means "from the first month with data".
  const range = useMemo(() => {
    if (preset === 'custom') return custom;
    const end = includeCurrent ? currentMonth() : addMonths(currentMonth(), -1);
    if (preset === 'all')  return { from: null, to: end };
    if (preset === 'year') return { from: `${end.slice(0, 4)}-01`, to: end };
    return { from: addMonths(end, -(Number(preset) - 1)), to: end };
  }, [preset, includeCurrent, custom]);

  useEffect(() => {
    if (!profileId) return;
    if (range.from && range.from > range.to) { setError('Beginmaand ligt na eindmaand.'); return; }
    setLoading(true);
    setError('');
    api.overview.get(profileId, range.from, range.to)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [profileId, range]);

  useEffect(() => { setSelected(null); setCollapsed(new Set()); }, [profileId]);

  const view = useMemo(() => {
    if (!data) return null;
    const months = monthsBetween(data.from, data.to);
    const n = months.length;

    // Colour follows the group's place among all expense groups, so it stays put when the period changes.
    const expenseGroups = data.groups.filter(g => g.categories.length > 0);
    const fold = expenseGroups.length > PALETTE.length;
    const colorOf = {};
    expenseGroups.forEach((g, i) => {
      colorOf[g.id] = fold && i >= PALETTE.length - 1 ? OTHER_COLOR : PALETTE[i];
    });

    const groups = expenseGroups.map(g => {
      const categories = g.categories
        .map(c => ({ ...c, total: sum(c.months), color: colorOf[g.id], groupName: g.name }))
        .filter(c => Object.values(c.months).some(v => Math.abs(v) > EPS));
      const values = {};
      for (const c of categories) for (const [m, v] of Object.entries(c.months)) values[m] = (values[m] ?? 0) + v;
      return { ...g, categories, values, total: sum(values), color: colorOf[g.id] };
    }).filter(g => g.categories.length > 0);

    const total  = groups.reduce((s, g) => s + g.total, 0);
    const income = sum(data.income);
    const uncat  = { ...data.uncategorized, total: sum(data.uncategorized.months) };

    // Chart series: one per group, with folded groups merged into "Overig".
    const series = [];
    for (const g of groups) {
      if (g.color === OTHER_COLOR) {
        let other = series.find(s => s.key === 'other');
        if (!other) series.push(other = { key: 'other', name: 'Overig', color: OTHER_COLOR, values: {} });
        for (const [m, v] of Object.entries(g.values)) other.values[m] = (other.values[m] ?? 0) + v;
      } else {
        series.push({ key: `g${g.id}`, name: g.name, color: g.color, values: g.values });
      }
    }

    return { months, n, groups, total, income, uncat, series };
  }, [data]);

  function openTransactions(categoryFilter) {
    setCategoryFilter(categoryFilter);
    setTxPeriod({ from: data.from, to: data.to });
    setTab('transactions');
  }

  function toggleSelect(item) {
    setSelected(s => (s?.key === item.key ? null : item));
  }

  function toggleCollapsed(id) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!view && loading) return <div className="empty-state">Laden…</div>;

  const pct = v => (view.total > EPS ? `${((v / view.total) * 100).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}%` : '—');

  // Keep the selection's values in step with the current period.
  const selectedLive = selected && view && (() => {
    if (selected.key === 'uncat') return { ...selected, values: view.uncat.months };
    for (const g of view.groups) {
      if (selected.key === `g${g.id}`) return { ...selected, values: g.values };
      const c = g.categories.find(c => selected.key === `c${c.id}`);
      if (c) return { ...selected, values: c.months };
    }
    return { ...selected, values: {} };
  })();

  function categoryRow(c, showGroup) {
    const key = `c${c.id}`;
    return (
      <tr key={key} className={`budget-row ov-row ${selected?.key === key ? 'ov-selected' : ''}`}
          onClick={() => toggleSelect({ key, name: c.name, color: c.color })}>
        <td className="name ov-indent">
          {c.name}
          {showGroup && <span className="ov-group-hint">{c.groupName}</span>}
        </td>
        <td className="amount">{formatAmount(c.total)}</td>
        <td className="amount">{formatAmount(c.total / view.n)}</td>
        <td className="amount ov-pct">{pct(c.total)}</td>
        <td className="ov-link">
          <button className="icon-btn" title="Toon transacties" onClick={e => { e.stopPropagation(); openTransactions(String(c.id)); }}>↗</button>
        </td>
      </tr>
    );
  }

  return (
    <div className="ov">
      {/* Period controls */}
      <div className="tx-toolbar">
        {PRESETS.map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${preset === key ? 'ov-preset-active' : ''}`} onClick={() => setPreset(key)}>
            {label}
          </button>
        ))}
        {preset === 'custom' ? (
          <>
            <input type="month" className="ov-month-input" value={custom.from} max={custom.to}
                   onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} />
            <span style={{ color: 'var(--text-muted)' }}>t/m</span>
            <input type="month" className="ov-month-input" value={custom.to} min={custom.from}
                   onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} />
          </>
        ) : (
          <label className="ov-check">
            <input type="checkbox" checked={includeCurrent} onChange={e => setIncludeCurrent(e.target.checked)} />
            incl. huidige maand
          </label>
        )}
        <span className="spacer" />
        {view && (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {formatMonth(data.from)} – {formatMonth(data.to)} · {view.n} mnd
          </span>
        )}
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

      {view && view.groups.length === 0 && view.uncat.count === 0 ? (
        <div className="empty-state">Geen uitgaven in deze periode.</div>
      ) : view && (
        <>
          {/* Chart */}
          <div className="ov-chart-head">
            <span className="ov-chart-title">
              {selectedLive ? `${selectedLive.name} per maand` : 'Uitgaven per maand'}
            </span>
            {selectedLive ? (
              <button className="btn btn-sm" onClick={() => setSelected(null)}>Alles</button>
            ) : (
              <div className="ov-legend">
                {view.series.map(s => (
                  <span key={s.key} className="ov-legend-item">
                    <span className="ov-swatch" style={{ background: s.color }} />{s.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <OverviewChart months={view.months} series={view.series} single={selectedLive} />

          {/* Table */}
          <table className="budget-table ov-table">
            <thead>
              <tr>
                <td className="ov-th">Categorie</td>
                <td className="ov-th ov-th-sort" style={{ textAlign: 'right' }} onClick={() => setFlat(f => !f)}
                    title={flat ? 'Groepeer per groep' : 'Sorteer op bedrag'}>
                  Totaal {flat ? '▼' : ''}
                </td>
                <td className="ov-th" style={{ textAlign: 'right' }}>Gem./mnd</td>
                <td className="ov-th" style={{ textAlign: 'right' }}>%</td>
                <td className="ov-th" />
              </tr>
            </thead>
            <tbody>
              {flat ? (
                view.groups.flatMap(g => g.categories)
                  .sort((a, b) => b.total - a.total)
                  .map(c => categoryRow(c, true))
              ) : view.groups.map(g => {
                const key = `g${g.id}`;
                const open = !collapsed.has(g.id);
                return [
                  <tr key={key} className={`ov-group-row ${selected?.key === key ? 'ov-selected' : ''}`}
                      onClick={() => toggleSelect({ key, name: g.name, color: g.color })}>
                    <td><span className="ov-group-name">
                      <button className="ov-caret" title={open ? 'Inklappen' : 'Uitklappen'}
                              onClick={e => { e.stopPropagation(); toggleCollapsed(g.id); }}>{open ? '▾' : '▸'}</button>
                      <span className="ov-swatch" style={{ background: g.color }} />
                      {g.name}
                    </span></td>
                    <td className="amount">{formatAmount(g.total)}</td>
                    <td className="amount">{formatAmount(g.total / view.n)}</td>
                    <td className="amount ov-pct">{pct(g.total)}</td>
                    <td />
                  </tr>,
                  ...(open ? g.categories.map(c => categoryRow(c, false)) : []),
                ];
              })}

              {/* Totals */}
              <tr className="ov-total-row">
                <td>Totaal uitgaven</td>
                <td className="amount">{formatAmount(view.total)}</td>
                <td className="amount">{formatAmount(view.total / view.n)}</td>
                <td className="amount ov-pct">{view.total > EPS ? '100%' : '—'}</td>
                <td />
              </tr>
              <tr className="ov-sub-row">
                <td>Inkomsten</td>
                <td className="amount">{formatAmount(view.income)}</td>
                <td className="amount">{formatAmount(view.income / view.n)}</td>
                <td /><td />
              </tr>
              <tr className="ov-sub-row">
                <td>Netto (inkomsten − uitgaven)</td>
                <td className="amount">
                  <span className={`available-value ${availableClass(view.income - view.total)}`}>
                    {formatAmount(view.income - view.total)}
                  </span>
                </td>
                <td className="amount">
                  <span className={`available-value ${availableClass(view.income - view.total)}`}>
                    {formatAmount((view.income - view.total) / view.n)}
                  </span>
                </td>
                <td /><td />
              </tr>

              {view.uncat.count > 0 && (
                <tr className={`ov-uncat-row ov-row ${selected?.key === 'uncat' ? 'ov-selected' : ''}`}
                    onClick={() => toggleSelect({ key: 'uncat', name: 'Niet gecategoriseerd', color: UNCAT_COLOR })}>
                  <td>Niet gecategoriseerd <span className="ov-group-hint">{view.uncat.count} transactie{view.uncat.count !== 1 ? 's' : ''}, niet in totaal</span></td>
                  <td className="amount">{formatAmount(view.uncat.total)}</td>
                  <td className="amount">{formatAmount(view.uncat.total / view.n)}</td>
                  <td />
                  <td className="ov-link">
                    <button className="icon-btn" title="Toon transacties" onClick={e => { e.stopPropagation(); openTransactions('none'); }}>↗</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

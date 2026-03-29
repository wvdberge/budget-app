// Dutch number formatting: period as thousands separator, comma as decimal
// e.g. 1234.56 → "€1.234,56"

export function formatAmount(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (value < 0 ? '-' : '') + '€\u2009' + formatted;
}

// Returns a sign-aware coloured class for an available amount
export function availableClass(value) {
  if (value > 0.005) return 'positive';
  if (value < -0.005) return 'negative';
  return 'neutral';
}

// Format YYYY-MM as Dutch month + year: "maart 2026"
export function formatMonth(yyyyMM) {
  if (!yyyyMM) return '';
  const [y, m] = yyyyMM.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
}

// Format YYYY-MM-DD as Dutch short date: "27 mrt 2026"
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Current month as YYYY-MM
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(yyyyMM, n) {
  let [y, m] = yyyyMM.split('-').map(Number);
  m += n;
  while (m > 12) { m -= 12; y++; }
  while (m < 1)  { m += 12; y--; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

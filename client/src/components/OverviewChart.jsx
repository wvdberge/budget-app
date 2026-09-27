import { useEffect, useRef, useState } from 'react';
import { formatAmount } from '../format.js';

const HEIGHT  = 240;
const PAD     = { top: 12, right: 12, bottom: 26, left: 64 };
const GAP     = 2;   // surface gap between stacked segments
const RADIUS  = 4;   // rounded data end

// "apr", or "jan '26" at the first month and at each year change
function monthTick(m, i) {
  const [y, mm] = m.split('-').map(Number);
  const label = new Date(y, mm - 1, 1).toLocaleDateString('nl-NL', { month: 'short' }).replace('.', '');
  return i === 0 || mm === 1 ? `${label} '${String(y).slice(2)}` : label;
}

function axisAmount(v) {
  return '€ ' + Math.round(v).toLocaleString('nl-NL');
}

// Rounds the step up to 1, 2 or 5 × 10^k so there are about four gridlines.
function niceTicks(min, max) {
  const span = max - min || 1;
  const raw  = span / 4;
  const mag  = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(f => f * mag).find(s => s >= raw);
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// Bar from yA to yB (pixel coords, either order), rounding the end away from zero.
function barPath(x, w, yZero, yEnd, round) {
  const top = Math.min(yZero, yEnd), bottom = Math.max(yZero, yEnd);
  const h = bottom - top;
  const r = round ? Math.min(RADIUS, h, w / 2) : 0;
  if (r <= 0) return `M${x},${top}h${w}v${h}h${-w}Z`;
  if (yEnd <= yZero) {
    return `M${x},${bottom}V${top + r}q0,${-r} ${r},${-r}h${w - 2 * r}q${r},0 ${r},${r}V${bottom}Z`;
  }
  return `M${x},${top}V${bottom - r}q0,${r} ${r},${r}h${w - 2 * r}q${r},0 ${r},${-r}V${top}Z`;
}

/**
 * Monthly bar chart.
 * - series given (stacked mode): one segment per series per month; negative values are drawn as zero,
 *   the tooltip shows the true values.
 * - single given: plain bars for one item (negatives drop below zero) with a dashed average line.
 */
export default function OverviewChart({ months, series, single }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState(null); // month index

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stacked = !single;
  const totals = months.map(m => stacked
    ? series.reduce((s, sr) => s + Math.max(0, sr.values[m] ?? 0), 0)
    : single.values[m] ?? 0);

  const lo = Math.min(0, ...totals);
  const hi = Math.max(0, ...totals);
  const ticks = niceTicks(lo, hi);
  const yMin = ticks[0], yMax = ticks[ticks.length - 1];

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const y = v => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const band = plotW / Math.max(1, months.length);
  const barW = Math.min(48, band * 0.6);
  const barX = i => PAD.left + i * band + (band - barW) / 2;
  const avg = single ? totals.reduce((a, b) => a + b, 0) / Math.max(1, months.length) : 0;

  const hoverMonth = hover !== null ? months[hover] : null;

  return (
    <div ref={wrapRef} className="ov-chart">
      <svg width={width} height={HEIGHT} role="img" aria-label="Uitgaven per maand">
        {/* Gridlines and y-axis labels */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)}
                  stroke={t === 0 ? 'var(--text-faint)' : 'var(--border)'} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="ov-axis">{axisAmount(t)}</text>
          </g>
        ))}

        {months.map((m, i) => (
          <g key={m}>
            {hover === i && (
              <rect x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} fill="var(--bg-elevated)" />
            )}
            {stacked ? (() => {
              // Stack upward from zero; a gap separates segments, the topmost gets the rounded end.
              const segs = series.map(sr => ({ ...sr, v: Math.max(0, sr.values[m] ?? 0) })).filter(s => s.v > 0.005);
              let acc = 0;
              return segs.map((s, k) => {
                const y0 = y(acc), y1 = y(acc + s.v);
                acc += s.v;
                const top = k === segs.length - 1;
                const yEnd = Math.min(y0, y1 + (top ? 0 : GAP));
                if (y0 - yEnd < 0.5) return null;
                return <path key={s.key} d={barPath(barX(i), barW, y0, yEnd, top)} fill={s.color} />;
              });
            })() : (
              Math.abs(totals[i]) > 0.005 &&
                <path d={barPath(barX(i), barW, y(0), y(totals[i]), true)} fill={single.color} />
            )}
            <text x={PAD.left + i * band + band / 2} y={HEIGHT - 8} textAnchor="middle" className="ov-axis">
              {monthTick(m, i)}
            </text>
            {/* Hit target covers the whole month column */}
            <rect x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} fill="transparent"
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        ))}

        {single && months.length > 1 && (
          <g pointerEvents="none">
            <line x1={PAD.left} x2={PAD.left + plotW} y1={y(avg)} y2={y(avg)}
                  stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 4" />
            <text x={PAD.left + plotW} y={y(avg) - 5} textAnchor="end" className="ov-axis">gem. {axisAmount(avg)}</text>
          </g>
        )}
      </svg>

      {hoverMonth && (
        <div className="ov-tooltip" style={{
          left: Math.min(PAD.left + hover * band + band / 2 + 12, width - 220),
          top: PAD.top,
        }}>
          <div className="ov-tooltip-title">{monthTick(hoverMonth, 0)}</div>
          {stacked ? (
            <>
              {[...series].reverse().filter(s => Math.abs(s.values[hoverMonth] ?? 0) > 0.005).map(s => (
                <div key={s.key} className="ov-tooltip-row">
                  <span className="ov-swatch" style={{ background: s.color }} />
                  <span className="ov-tooltip-name">{s.name}</span>
                  <span className="ov-tooltip-val">{formatAmount(s.values[hoverMonth])}</span>
                </div>
              ))}
              <div className="ov-tooltip-row ov-tooltip-total">
                <span className="ov-tooltip-name">Totaal</span>
                <span className="ov-tooltip-val">
                  {formatAmount(series.reduce((sum, s) => sum + (s.values[hoverMonth] ?? 0), 0))}
                </span>
              </div>
            </>
          ) : (
            <div className="ov-tooltip-row">
              <span className="ov-tooltip-name">{single.name}</span>
              <span className="ov-tooltip-val">{formatAmount(totals[hover])}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

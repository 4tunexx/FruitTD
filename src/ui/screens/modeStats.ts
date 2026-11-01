import { MODE_ICONS } from '../modeIcons';
import { runHistory } from '../../game/runStats';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import type { GameMode } from '../../game/save';
/** Absolute date with time, e.g. `1 Nov 2026, 21:12`. */
export function formatRunDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
/** Friendly age used beside dates so players do not have to do the maths. */
export function relativeDay(ms: number, now = Date.now()): string {
  const days = Math.floor((now - ms) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 30 ? `${days} days ago` : new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
export function renderModeStats(root: HTMLElement): void {
  const section = el('section', { class: 'ftd-mode-stats', 'aria-label': 'Statistics by game mode' });
  section.appendChild(el('h2', { text: 'YOUR RUNS' })); section.appendChild(el('p', { text: 'Recent runs on this device · accuracy counts swipes that hit a target.' }));
  const tabs = el('div', { class: 'ftd-duel-tabs', role: 'group', 'aria-label': 'Game mode statistics' }); const body = el('div', { class: 'ftd-mode-stats__body' }); section.appendChild(tabs); section.appendChild(body); root.appendChild(section);
  const modes: GameMode[] = ['casual', 'horde', 'campaign', 'coop'];
  const label = (mode: GameMode) => mode === 'coop' ? 'Co-op' : mode[0]!.toUpperCase() + mode.slice(1);
  const overview = el('div', { class: 'ftd-mode-overview', role: 'list', 'aria-label': 'Modes played' }, modes.map(mode => {
    const played = runHistory().filter(row => row.mode === mode);
    const last = played[played.length - 1];
    const text = last ? `${label(mode)}: ${played.length} run${played.length === 1 ? '' : 's'} · last ${formatRunDate(last.date)}` : `${label(mode)}: not played yet`;
    return el('span', { class: 'ftd-mode-overview__item', role: 'listitem', tabindex: '0', title: text, 'aria-label': text }, [el('strong', { text: label(mode) }), el('small', { text: last ? `${played.length} · ${relativeDay(last.date)}` : 'Not played' })]);
  }));
  section.insertBefore(overview, tabs);
  const show = (mode: GameMode) => {
    tabs.querySelectorAll('button').forEach(button => { const active = button.dataset.mode === mode; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
    const rows = runHistory().filter(row => row.mode === mode);
    body.replaceChildren();
    if (!rows.length) { body.appendChild(el('p', { text: 'Finish a run to start your record.' })); return; }
    const strokes = rows.reduce((sum, row) => sum + row.strokes, 0), hits = rows.reduce((sum, row) => sum + row.hits, 0);
    const accuracy = strokes ? Math.round(hits / strokes * 100) : 0;
    const recent = rows.slice(-12), peak = Math.max(1, ...recent.map(row => row.score));
    const latest = recent[recent.length - 1]!, previous = recent[recent.length - 2];
    const change = previous ? latest.score - previous.score : null;
    const trend = change === null ? 'First run recorded · play again to see your trend' : change === 0 ? 'Same score as your previous run' : `${change > 0 ? '▲' : '▼'} ${Math.abs(change).toLocaleString()} points ${change > 0 ? 'up' : 'down'} from your previous run`;
    const chart = el('div', { class: 'ftd-score-chart', style: `--points:${recent.length}`, role: 'group', 'aria-label': `Recent ${mode} runs, oldest to newest` });
    const detail = el('p', { class: 'ftd-run-trend__detail', role: 'status', text: 'Hover, focus or tap a bar for run details.' });
    const describe = (row: (typeof recent)[number], index: number) => `Run ${index + 1} · ${formatRunDate(row.date)} (${relativeDay(row.date)}) · ${row.score.toLocaleString()} points · wave ${row.wave} · combo ×${row.combo} · ${row.kills.toLocaleString()} fruit${row.strokes ? ` · ${Math.round(row.hits / row.strokes * 100)}% accuracy` : ''}${row.completed ? '' : ' · unfinished'}`;
    recent.forEach((row, index) => {
      const text = describe(row, index);
      const bar = el('button', { type: 'button', class: 'ftd-score-chart__run', title: text, 'aria-label': text }, [
        el('span', { class: 'ftd-score-chart__plot', style: `--bar-height:${Math.max(5, row.score / peak * 100)}%;--bar-delay:${index * 55}ms` }, [el('i')]),
        el('small', { text: row.score.toLocaleString() }),
      ]);
      const reveal = () => { detail.textContent = text; chart.querySelectorAll('.is-selected').forEach(node => node.classList.remove('is-selected')); bar.classList.add('is-selected'); };
      for (const type of ['mouseenter', 'focus', 'click']) bar.addEventListener(type, reveal);
      chart.appendChild(bar);
    });
    body.appendChild(el('section', { class: 'ftd-run-trend', 'aria-label': 'Recent score trend' }, [
      el('div', { class: 'ftd-run-trend__heading' }, [
        el('div', {}, [el('p', { text: 'RECENT SCORES' }), el('strong', { text: latest.score.toLocaleString() }), el('span', { text: `latest score · ${relativeDay(latest.date)}` })]),
        el('div', { class: 'ftd-run-trend__best' }, [el('small', { text: 'BEST' }), el('strong', { text: peak.toLocaleString() })]),
      ]),
      chart,
      detail,
      el('p', { class: 'ftd-run-trend__caption', text: trend }),
    ]));
    if (strokes) body.appendChild(el('div', { class:'ftd-accuracy-summary' }, [
      el('div', { class:'ftd-accuracy-ring', role:'img', 'aria-label':`${accuracy}% of swipes hit a target`, style:`--accuracy:${accuracy}` }, [el('strong', { text:`${accuracy}%` })]),
      el('div', {}, [el('h3', { text:'SWIPE ACCURACY' }), el('p', { text:`${hits.toLocaleString()} hits / ${strokes.toLocaleString()} swipes` })]),
    ]));
    const values = [['Runs', rows.length], ['Last played', relativeDay(rows[rows.length - 1]!.date)], ['Best wave', Math.max(...rows.map(row => row.wave))], ['Best combo', Math.max(...rows.map(row => row.combo))], ['Fruit destroyed', rows.reduce((sum, row) => sum + row.kills, 0)]];
    body.appendChild(el('div', { class: 'ftd-stat-grid ftd-run-kpis' }, values.map(([label, value]) => el('div', { class: 'ftd-stat' }, [el('p', { class: 'ftd-stat__label', text: String(label) }), el('strong', { class: 'ftd-stat__value', text: typeof value === 'number' ? value.toLocaleString() : value })]))));
  };
  modes.forEach(mode => { const button = GameButton({ icon: MODE_ICONS[mode], label: label(mode), onClick: () => show(mode) }); button.dataset.mode = mode; tabs.appendChild(button); }); show('casual');
}


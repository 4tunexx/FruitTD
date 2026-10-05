import { runHistory } from '../../game/runStats';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import type { GameMode } from '../../game/save';
export function renderModeStats(root: HTMLElement): void {
  const section = el('section', { class: 'ftd-mode-stats', 'aria-label': 'Statistics by game mode' });
  section.append(el('h2', { text: 'YOUR RUNS' }), el('p', { text: 'Recent runs on this device · accuracy counts swipes that hit a target.' }));
  const tabs = el('div', { class: 'ftd-duel-tabs' }); const body = el('div'); section.append(tabs, body); root.append(section);
  const modes: GameMode[] = ['casual', 'horde', 'campaign', 'coop'];
  const show = (mode: GameMode) => {
    tabs.querySelectorAll('button').forEach(button => { const active = button.dataset.mode === mode; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
    const rows = runHistory().filter(row => row.mode === mode);
    body.replaceChildren();
    if (!rows.length) { body.append(el('p', { text: 'Finish a run to start your record.' })); return; }
    const strokes = rows.reduce((sum, row) => sum + row.strokes, 0), hits = rows.reduce((sum, row) => sum + row.hits, 0);
    const accuracy = strokes ? Math.round(hits / strokes * 100) : 0;
    if (strokes) body.append(el('div', { class:'ftd-accuracy-summary' }, [
      el('div', { class:'ftd-accuracy-ring', role:'img', 'aria-label':`${accuracy}% of swipes hit a target`, style:`--accuracy:${accuracy}` }, [el('strong', { text:`${accuracy}%` })]),
      el('div', {}, [el('h3', { text:'SWIPE ACCURACY' }), el('p', { text:`${hits.toLocaleString()} hits / ${strokes.toLocaleString()} swipes` })]),
    ]));
    const values = [['Runs', rows.length], ['High score', Math.max(...rows.map(row => row.score))], ['Best wave', Math.max(...rows.map(row => row.wave))], ['Best combo', Math.max(...rows.map(row => row.combo))], ['Fruit destroyed', rows.reduce((sum, row) => sum + row.kills, 0)], ['Swipe accuracy', strokes ? `${Math.round(hits / strokes * 100)}%` : 'No swipes yet']];
    body.append(el('div', { class: 'ftd-stat-grid' }, values.map(([label, value]) => el('div', { class: 'ftd-stat' }, [el('p', { class: 'ftd-stat__label', text: String(label) }), el('strong', { class: 'ftd-stat__value', text: typeof value === 'number' ? value.toLocaleString() : value })]))));
    const recent = rows.slice(-12), peak = Math.max(1, ...recent.map(row => row.score));
    const chart = el('div', { class: 'ftd-score-chart', role: 'img', 'aria-label': `Last ${recent.length} scores: ${recent.map(row => row.score).join(', ')}` });
    recent.forEach(row => chart.append(el('div', { title: `${new Date(row.date).toLocaleDateString()} · ${row.score.toLocaleString()} points`, style: `--bar-height:${Math.max(3, row.score / peak * 100)}%` }, [el('i'), el('small', { text: row.score.toLocaleString() })])));
    body.append(el('h3', { text: 'RECENT SCORES' }), chart);
  };
  modes.forEach(mode => { const button = GameButton({ label: mode === 'coop' ? 'Co-op' : mode[0].toUpperCase() + mode.slice(1), onClick: () => show(mode) }); button.dataset.mode = mode; tabs.append(button); }); show('casual');
}

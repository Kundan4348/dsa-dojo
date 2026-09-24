// log.js — every drill, the stall histogram, export/import, settings.
import { db } from './db.js';
import { h, toast, fmtSecs, INTERVIEW_DATE_KEY, updateDaysLeft } from './app.js';
import { STEPS } from './drill.js';

export async function renderLog(container, params = {}) {
  const drills = (await db.all('drills')).sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  if (params.path && params.path[0]) return renderDetail(container, drills.find(d => d.id === params.path[0]));

  container.replaceChildren(
    h('div', { class: 'row between' }, h('h1', {}, 'Log'), h('span', { class: 'muted small' }, `${drills.length} drill${drills.length === 1 ? '' : 's'}`)),
    renderHistogram(drills),
    h('h2', {}, 'Drills'),
    drills.length ? renderTable(drills) : h('div', { class: 'card empty' }, 'No drills yet. ', h('a', { href: '#/drill' }, 'Run the first one.')),
    h('h2', {}, 'Data & settings'),
    await renderSettings(),
  );
}

function stepIndex(key) { return STEPS.findIndex(s => s.key === key); }

function renderHistogram(drills) {
  const counts = Object.fromEntries(STEPS.map(s => [s.key, 0]));
  const secs = Object.fromEntries(STEPS.map(s => [s.key, 0]));
  for (const d of drills) { if (counts[d.stalledAt] != null) counts[d.stalledAt]++; for (const s of STEPS) secs[s.key] += d.stepSeconds?.[s.key] || 0; }
  const maxC = Math.max(1, ...Object.values(counts));
  const totalS = Math.max(1, Object.values(secs).reduce((a, b) => a + b, 0));
  const topKey = drills.length ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : null;
  const rows = (vals, max, fmt) => h('div', { class: 'hist' }, ...STEPS.map((s, i) =>
    h('div', { class: 'hist-row' + (s.key === topKey && drills.length ? ' top' : '') },
      h('span', {}, `${i + 1}. ${s.title}`),
      h('div', { class: 'hist-bar' }, h('div', { class: 'hist-fill', style: `width:${(vals[s.key] / max) * 100}%` })),
      h('span', { class: 'hist-val' }, fmt(vals[s.key])))));
  return h('div', { class: 'grid cols-2' },
    h('div', { class: 'card' }, h('h3', {}, 'Where you stall'), h('p', { class: 'muted small' }, 'Times each step was the bottleneck (from post-mortems).'),
      drills.length ? rows(counts, maxC, v => String(v)) : h('p', { class: 'muted' }, 'Appears after your first drill.')),
    h('div', { class: 'card' }, h('h3', {}, 'Where the minutes go'), h('p', { class: 'muted small' }, 'Share of total time spent in each step.'),
      drills.length ? rows(secs, totalS, v => Math.round((v / totalS) * 100) + '%') : h('p', { class: 'muted' }, 'Appears after your first drill.')));
}

function renderTable(drills) {
  return h('div', { class: 'card', style: 'padding:0;overflow:auto' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Problem'), h('th', {}, 'Result'), h('th', {}, 'Time'), h('th', {}, 'Stalled at'), h('th', {}, 'Hints'), h('th', {}, 'Lesson'))),
    h('tbody', {}, ...drills.map(d => h('tr', {},
      h('td', { class: 'mono small' }, d.date),
      h('td', {}, h('a', { href: `#/log/${d.id}` }, d.problemTitle), d.problemUrl ? h('span', {}, ' ', h('a', { href: d.problemUrl, target: '_blank', rel: 'noopener', class: 'small' }, '↗')) : null),
      h('td', { class: `result-${d.result}` }, d.result),
      h('td', { class: 'mono small' }, fmtSecs(d.totalSeconds)),
      h('td', {}, `${stepIndex(d.stalledAt) + 1}. ${STEPS[stepIndex(d.stalledAt)]?.title || d.stalledAt}`),
      h('td', { class: 'mono' }, String(d.hints)),
      h('td', { class: 'small' }, d.lesson || h('span', { class: 'muted' }, '—')))))));
}

function renderDetail(container, d) {
  if (!d) { container.replaceChildren(h('h1', {}, 'Not found'), h('a', { href: '#/log' }, '← Log')); return; }
  container.replaceChildren(
    h('a', { href: '#/log', class: 'small' }, '← Log'),
    h('h1', {}, d.problemTitle),
    h('p', { class: 'muted' }, `${d.date} · `, h('span', { class: `result-${d.result}` }, d.result), ` · ${fmtSecs(d.totalSeconds)} · stalled at ${stepIndex(d.stalledAt) + 1}. ${STEPS[stepIndex(d.stalledAt)]?.title} · ${d.hints} hint(s)`),
    d.lesson ? h('div', { class: 'card' }, h('b', {}, 'Lesson: '), d.lesson) : null,
    ...STEPS.map((s, i) => h('section', { class: 'step done' },
      h('div', { class: 'step-head' }, h('span', { class: 'step-num' }, String(i + 1)), h('span', { class: 'step-title' }, s.title), h('span', { class: 'step-time' }, fmtSecs(d.stepSeconds?.[s.key] || 0))),
      h('pre', { style: 'white-space:pre-wrap' }, d.steps?.[s.key] || '—'))),
    h('div', { class: 'row' }, h('button', { class: 'btn danger', onClick: async () => { if (confirm('Delete this drill?')) { await db.del('drills', d.id); location.hash = '#/log'; } } }, 'Delete drill')),
  );
}

async function renderSettings() {
  const date = h('input', { type: 'date', value: await db.setting(INTERVIEW_DATE_KEY, '2026-10-24'), style: 'max-width:200px' });
  const file = h('input', { type: 'file', accept: 'application/json', style: 'display:none', onChange: async () => {
    const f = file.files[0]; if (!f) return;
    try { await db.importAll(JSON.parse(await f.text()), { merge: true }); toast('Imported.'); location.reload(); }
    catch (e) { toast('Import failed: ' + e.message, 4000); }
  } });
  return h('div', { class: 'card' },
    h('div', { class: 'row' },
      h('label', { style: 'margin:0' }, 'Interview date'), date,
      h('button', { class: 'btn sm', onClick: async () => { await db.setSetting(INTERVIEW_DATE_KEY, date.value); await updateDaysLeft(); toast('Saved.'); } }, 'Save'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn sm', onClick: async () => {
        const data = await db.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `dsa-dojo-export-${new Date().toISOString().slice(0, 10)}.json` });
        document.body.append(a); a.click(); a.remove(); toast('Exported. Drop it in ~/Documents/Google-Prep/ for Kiro.');
      } }, 'Export JSON'),
      h('button', { class: 'btn sm', onClick: () => file.click() }, 'Import JSON'), file),
    h('p', { class: 'help' }, 'Everything lives in this browser (IndexedDB). Export before clearing site data or switching devices.'));
}

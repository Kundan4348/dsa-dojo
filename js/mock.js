// mock.js — 45-minute mock interview: think-aloud notes, code, follow-ups, self-scored rubric. Saves to `mocks`.
import { db, uid, today } from './db.js';
import { h, mount, toast, fmtSecs, copyText } from './app.js';

const DRAFT_KEY = 'mock:draft';
export const RUBRIC = [
  ['comm', 'Communication', 'Restated, thought aloud, checked assumptions, announced complexity before coding.'],
  ['edge', 'Edge cases', 'Named them before coding; tested at least two after.'],
  ['cx', 'Complexity', 'Correct Big-O for time and space, and the reason the brute force was not enough.'],
  ['code', 'Code quality', 'Readable, small steps, no fused conditions, meaningful names.'],
  ['followup', 'Follow-ups', 'Handled at least one variation without restarting from zero.'],
];
const GENERIC_FOLLOWUPS = [
  'What if the input does not fit in memory — stream it?',
  'What changes if the values can be negative / duplicated / unsorted?',
  'Can you reduce the space? What do you give up?',
  'How would you test this? Name three inputs that could break it.',
  'The array now receives updates between queries. What breaks?',
  'Return the actual solution (indices / path), not just the value.',
];

let state = null, tick = null, root = null;

export async function renderMock(container) {
  root = container; stopTick();
  state = await db.setting(DRAFT_KEY, null);
  if (!state) return renderSetup();
  renderActive();
}

async function saveDraft() { if (state) await db.setSetting(DRAFT_KEY, state); }
function stopTick() { if (tick) clearInterval(tick); tick = null; }

async function renderSetup() {
  const index = await (await fetch('data/patterns/index.json')).json();
  const title = h('input', { placeholder: 'Problem title', required: true });
  const url = h('input', { type: 'url', placeholder: 'Link (optional)' });
  const statement = h('textarea', { placeholder: 'Paste the statement (optional).', style: 'min-height:120px' });
  const pattern = h('select', {}, h('option', { value: '' }, 'Unknown / decide during the mock'), ...index.map(p => h('option', { value: p.id }, p.name)));
  const form = h('form', { class: 'card', onSubmit: async (e) => {
    e.preventDefault(); if (!title.value.trim()) return title.focus();
    let followups = GENERIC_FOLLOWUPS;
    if (pattern.value) { try { const p = await (await fetch(`data/patterns/${pattern.value}.json`)).json(); if (p.followups?.length) followups = [...p.followups, ...GENERIC_FOLLOWUPS.slice(0, 2)]; } catch { /* unauthored pattern */ } }
    state = { id: uid(), date: today(), problemTitle: title.value.trim(), problemUrl: url.value.trim(), statement: statement.value, patternId: pattern.value,
      limitSec: 45 * 60, elapsed: 0, notes: '', code: '', followups, followupAnswers: {}, rubric: Object.fromEntries(RUBRIC.map(r => [r[0], null])), reflection: '' };
    await saveDraft(); renderActive();
  } },
    h('div', { class: 'field' }, h('label', {}, 'Problem'), title),
    h('div', { class: 'field' }, h('label', {}, 'Link'), url),
    h('div', { class: 'field' }, h('label', {}, 'Statement'), statement),
    h('div', { class: 'field' }, h('label', {}, 'Pattern (loads that pattern\'s follow-ups)'), pattern),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Start 45:00'),
      h('span', { class: 'help' }, 'Talk out loud the whole time. Minute 0–5 clarify, 5–15 approach, 15–35 code, 35–45 test + follow-ups.')));
  mount(root, h('h1', {}, 'Mock interview'), h('p', { class: 'muted' }, 'One problem, 45 minutes, Google format. Score yourself honestly, then send to Kiro for a second score.'), form);
  title.focus();
}

function renderActive() {
  const timer = h('span', { class: 'timer' }, fmtSecs(state.limitSec - state.elapsed));
  const phase = h('span', { class: 'pill' });
  const updatePhase = () => { const m = state.elapsed / 60; phase.textContent = m < 5 ? 'clarify' : m < 15 ? 'approach' : m < 35 ? 'code' : m < 45 ? 'test + follow-ups' : 'over time'; };
  updatePhase();
  const notes = h('textarea', { placeholder: 'Think-aloud notes: restatement, assumptions you checked, brute force, the object…', style: 'min-height:140px', onInput: () => { state.notes = notes.value; } }); notes.value = state.notes;
  const code = h('textarea', { class: 'code', onInput: () => { state.code = code.value; } }); code.value = state.code;
  const fus = h('ol', {}, ...state.followups.map((f, i) => h('li', { style: 'margin-bottom:.5rem' }, f, h('input', { placeholder: 'Your answer in one line', style: 'margin-top:.25rem', value: state.followupAnswers[i] || '', onInput: (e) => { state.followupAnswers[i] = e.target.value; } }))));
  const rubricEls = RUBRIC.map(([k, name, desc]) => h('div', { class: 'row', style: 'margin-bottom:.5rem' },
    h('div', { style: 'flex:1;min-width:200px' }, h('b', {}, name), h('div', { class: 'help', style: 'margin:0' }, desc)),
    h('div', { class: 'row', role: 'radiogroup', 'aria-label': name }, ...[0, 1, 2, 3].map(v => h('button', { class: 'btn sm' + (state.rubric[k] === v ? ' primary' : ''), onClick: (e) => { state.rubric[k] = v; e.target.parentElement.querySelectorAll('.btn').forEach((b, i) => b.classList.toggle('primary', i === v)); } }, String(v))))));
  const reflection = h('input', { placeholder: 'One sentence: what would the interviewer remember?', value: state.reflection, onInput: (e) => { state.reflection = e.target.value; } });

  const text = () => [`[MOCK REVIEW] Score this 45-minute mock as a Google interviewer (0-3 on: communication, edge cases, complexity, code quality, follow-ups) and give the single most important thing to fix.`,
    `Problem: ${state.problemTitle}${state.problemUrl ? ' — ' + state.problemUrl : ''}`, state.statement ? `\nStatement:\n${state.statement}` : '', `\nTime used: ${fmtSecs(state.elapsed)}`,
    `\n## Think-aloud notes\n${state.notes || '(none)'}`, `\n## Code\n${state.code || '(none)'}`,
    `\n## Follow-ups\n${state.followups.map((f, i) => `- ${f}\n  → ${state.followupAnswers[i] || '(no answer)'}`).join('\n')}`,
    `\n## Self-score\n${RUBRIC.map(([k, n]) => `${n}: ${state.rubric[k] ?? '-'}`).join(', ')}`].join('\n');

  mount(root, 
    h('h1', {}, 'Mock interview'),
    h('div', { class: 'timerbar' }, timer, h('div', {}, h('div', { style: 'font-weight:700' }, state.problemTitle), h('div', { class: 'small muted' }, state.problemUrl ? h('a', { href: state.problemUrl, target: '_blank', rel: 'noopener' }, 'open problem') : '45 min')), h('span', { class: 'spacer' }), phase,
      h('button', { class: 'btn sm danger', onClick: async () => { if (confirm('Abandon this mock?')) { stopTick(); await db.del('settings', DRAFT_KEY); state = null; renderSetup(); } } }, 'Abandon')),
    state.statement ? h('details', { class: 'card', style: 'margin-bottom:1rem' }, h('summary', { style: 'cursor:pointer;font-weight:600' }, 'Problem statement'), h('pre', { style: 'white-space:pre-wrap;margin-top:.6rem' }, state.statement)) : null,
    h('div', { class: 'grid cols-2' }, h('div', { class: 'card' }, h('h3', {}, 'Think-aloud notes'), notes), h('div', { class: 'card' }, h('h3', {}, 'Code'), code)),
    h('h2', {}, 'Follow-ups (from minute 35)'), h('div', { class: 'card' }, fus),
    h('h2', {}, 'Rubric — 0 none · 1 weak · 2 solid · 3 strong'), h('div', { class: 'card' }, ...rubricEls, h('div', { class: 'field', style: 'margin-top:.8rem' }, h('label', {}, 'Reflection'), reflection),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onClick: async () => toast((await copyText(text())) ? 'Copied — paste to Kiro for a second score.' : 'Copy failed.') }, 'Score → Kiro'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn primary', onClick: async () => {
          if (Object.values(state.rubric).some(v => v == null)) return toast('Score all five rubric lines first.');
          stopTick();
          const total = Object.values(state.rubric).reduce((a, b) => a + b, 0);
          await db.put('mocks', { id: state.id, date: state.date, problemTitle: state.problemTitle, problemUrl: state.problemUrl, patternId: state.patternId, totalSeconds: Math.round(state.elapsed), rubric: state.rubric, score: total, notes: state.notes, code: state.code, followups: state.followups, followupAnswers: state.followupAnswers, reflection: state.reflection });
          await db.del('settings', DRAFT_KEY); state = null; toast(`Saved. Score ${total}/15.`); location.hash = '#/log';
        } }, 'Save mock')))
  );
  let last = Date.now();
  tick = setInterval(() => { const now = Date.now(); if (!document.hidden) state.elapsed += (now - last) / 1000; last = now;
    const rem = state.limitSec - state.elapsed; timer.textContent = (rem < 0 ? '-' : '') + fmtSecs(Math.abs(rem)); timer.className = 'timer' + (rem < 0 ? ' bad' : rem < 600 ? ' warn' : ''); updatePhase();
    if (Math.round(state.elapsed) % 20 === 0) saveDraft(); }, 1000);
  document.addEventListener('visibilitychange', saveDraft, { once: true });
}

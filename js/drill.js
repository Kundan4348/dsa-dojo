// drill.js — the protocol as a guided, timed form. Code box is locked until steps 1–6 are written.
import { db, uid, today } from './db.js';
import { h, mount, toast, fmtSecs, copyText } from './app.js';

export const STEPS = [
  { key: 'restate', title: 'Restate', hint: 'One sentence, your own words. Include what is being minimised / maximised / counted and the answer type.' },
  { key: 'brute',   title: 'Brute force + complexity', hint: '3–4 lines of pseudocode and its Big-O. Never skip this, even when you "see" the answer. This is your first move on any hard problem.' },
  { key: 'waste',   title: 'Find the waste', hint: 'What exactly does the brute force recompute? ("for every i it rescans j..n", "re-sorts the same window").' },
  { key: 'twist',   title: 'Closest known problem + the twist', hint: '"This is like ___, except ___." The except is what is missing — it is what the interviewer is testing.' },
  { key: 'object',  title: 'Name the object + invariant', hint: 'Prefix sum, monotonic stack, sorted order + two pointers, hash of seen states, DP over suffix… Then one sentence: "the stack always holds …".' },
  { key: 'trace',   title: 'Hand-trace', hint: 'A 4–5 element example with your object, including one boundary (empty, size 1, all equal, first/last index).' },
  { key: 'code',    title: 'Code', hint: 'Separate small steps: helper arrays first, then the main loop. No fused clever conditions.', code: true },
];
const PRE_CODE = STEPS.filter(s => !s.code).map(s => s.key);
const DRAFT_KEY = 'drill:draft';

let state = null;        // active draft
let tick = null;         // interval id
let focusedStep = null;  // key of textarea with focus
let warned = false;
let root = null;

export async function renderDrill(container, params = {}) {
  root = container;
  stopTick();
  state = await db.setting(DRAFT_KEY, null);
  if (params.title && !state) {
    state = newDraft({ title: params.title, url: params.url || '', source: params.source || 'custom' });
    await saveDraft();
  }
  if (!state) return renderSetup();
  renderActive();
}

function newDraft({ title, url, source, statement = '', limitMin = 30 }) {
  return {
    id: uid(), date: today(), startedAt: Date.now(), source, problemTitle: title, problemUrl: url, statement,
    limitSec: limitMin * 60, steps: Object.fromEntries(STEPS.map(s => [s.key, ''])),
    stepSeconds: Object.fromEntries(STEPS.map(s => [s.key, 0])), hints: 0, hintLog: [], elapsed: 0,
  };
}

async function saveDraft() { if (state) await db.setSetting(DRAFT_KEY, state); }
async function clearDraft() { await db.del('settings', DRAFT_KEY); }

function renderSetup() {
  const title = h('input', { placeholder: 'e.g. Maximum Width Ramp', required: true, autofocus: true });
  const url = h('input', { placeholder: 'https://leetcode.com/problems/… (optional)', type: 'url' });
  const statement = h('textarea', { placeholder: 'Paste the problem statement here (kept only in your browser).', style: 'min-height:160px' });
  const source = h('select', {}, h('option', { value: 'custom' }, 'Custom / pasted'), h('option', { value: 'contest' }, 'Contest problem'), h('option', { value: 'pattern' }, 'Pattern canonical'));
  const limit = h('select', {}, ...[25, 30, 35, 45].map(m => h('option', { value: m, selected: m === 30 }, `${m} min`)));
  const form = h('form', { class: 'card', onSubmit: async (e) => {
    e.preventDefault();
    if (!title.value.trim()) { title.focus(); return; }
    state = newDraft({ title: title.value.trim(), url: url.value.trim(), source: source.value, statement: statement.value, limitMin: Number(limit.value) });
    await saveDraft();
    renderActive();
  } },
    h('div', { class: 'field' }, h('label', {}, 'Problem title'), title),
    h('div', { class: 'field' }, h('label', {}, 'Link'), url),
    h('div', { class: 'field' }, h('label', {}, 'Statement'), statement),
    h('div', { class: 'grid cols-2' },
      h('div', { class: 'field' }, h('label', {}, 'Source'), source),
      h('div', { class: 'field' }, h('label', {}, 'Time limit'), limit)),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Start timer'),
      h('span', { class: 'help' }, 'The clock starts now. Steps 1–6 must be written before the code box unlocks.')),
  );
  mount(root, h('h1', {}, 'Drill'), h('p', { class: 'muted' }, 'Timed derivation. You think, the app enforces the order and measures where you stall.'), form);
  title.focus();
}

function startTick() {
  stopTick();
  let last = Date.now();
  tick = setInterval(() => {
    const now = Date.now(); const dt = (now - last) / 1000; last = now;
    if (document.hidden) return;              // pause while tab hidden
    state.elapsed += dt;
    if (focusedStep) state.stepSeconds[focusedStep] += dt;
    updateTimerUI();
    if (Math.round(state.elapsed) % 15 === 0) saveDraft();
  }, 1000);
}
function stopTick() { if (tick) clearInterval(tick); tick = null; }

function updateTimerUI() {
  const el = root.querySelector('#total-timer'); if (!el) return;
  const remaining = state.limitSec - state.elapsed;
  el.textContent = (remaining < 0 ? '-' : '') + fmtSecs(Math.abs(remaining));
  el.className = 'timer' + (remaining < 0 ? ' bad' : remaining < state.limitSec * 0.25 ? ' warn' : '');
  for (const s of STEPS) {
    const t = root.querySelector(`[data-steptime="${s.key}"]`);
    if (t) t.textContent = fmtSecs(state.stepSeconds[s.key]);
  }
  if (!warned && state.elapsed > 600 && !state.steps.object.trim()) {
    warned = true;
    toast('10 minutes in and no object named yet — go back to the brute force and ask what it repeats.', 5000);
  }
}

function preCodeDone() { return PRE_CODE.every(k => state.steps[k].trim().length > 0); }

function renderActive() {
  warned = state.elapsed > 600;
  const timerbar = h('div', { class: 'timerbar' },
    h('span', { id: 'total-timer', class: 'timer' }, fmtSecs(state.limitSec - state.elapsed)),
    h('div', {}, h('div', { style: 'font-weight:700' }, state.problemTitle),
      h('div', { class: 'small muted' }, state.problemUrl ? h('a', { href: state.problemUrl, target: '_blank', rel: 'noopener' }, 'open problem') : `${state.source} · ${state.limitSec / 60} min`)),
    h('span', { class: 'spacer' }),
    h('span', { class: 'pill', id: 'hint-pill' }, `hints: ${state.hints}`),
    h('button', { class: 'btn sm', onClick: askHint, title: 'Copies your problem and steps so far; paste to Kiro in the dashboard' }, 'Hint → Kiro'),
    h('button', { class: 'btn sm danger', onClick: abandon }, 'Abandon'),
  );

  const statement = state.statement ? h('details', { class: 'card', style: 'margin-bottom:1rem' },
    h('summary', { style: 'cursor:pointer;font-weight:600' }, 'Problem statement'),
    h('pre', { style: 'white-space:pre-wrap;margin-top:.6rem' }, state.statement)) : null;

  const stepEls = STEPS.map((s, i) => {
    const ta = h('textarea', { class: s.code ? 'code' : '', dataset: { step: s.key }, placeholder: s.code ? '// helper arrays first, then the main loop' : '',
      onFocus: () => { focusedStep = s.key; markActive(s.key); },
      onBlur: () => { if (focusedStep === s.key) focusedStep = null; if (!state) return; saveDraft(); refreshLock(); },
      onInput: () => { state.steps[s.key] = ta.value; markDone(s.key); if (!s.code) refreshLock(); },
    });
    ta.value = state.steps[s.key];
    if (s.code) ta.addEventListener('keydown', codeTab);
    return h('section', { class: 'step' + (state.steps[s.key].trim() ? ' done' : ''), dataset: { stepbox: s.key } },
      h('div', { class: 'step-head' }, h('span', { class: 'step-num' }, String(i + 1)), h('span', { class: 'step-title' }, s.title),
        h('span', { class: 'step-time', dataset: { steptime: s.key } }, fmtSecs(state.stepSeconds[s.key]))),
      h('p', { class: 'step-hint' }, s.hint),
      s.code ? h('div', { class: 'lock-note', id: 'lock-note' }) : null,
      ta);
  });

  const pm = renderPostMortem();
  mount(root, h('h1', {}, 'Drill'), timerbar, statement, ...stepEls, pm);
  refreshLock();
  startTick();
  const first = STEPS.find(s => !state.steps[s.key].trim());
  root.querySelector(`textarea[data-step="${(first || STEPS[STEPS.length - 1]).key}"]`)?.focus();
}

function markActive(key) { root.querySelectorAll('.step').forEach(el => el.classList.toggle('active', el.dataset.stepbox === key)); }
function markDone(key) { root.querySelector(`[data-stepbox="${key}"]`)?.classList.toggle('done', state.steps[key].trim().length > 0); }

function refreshLock() {
  const ta = root.querySelector('textarea[data-step="code"]'); const box = root.querySelector('[data-stepbox="code"]');
  const note = root.querySelector('#lock-note'); if (!ta) return;
  const ok = preCodeDone();
  ta.disabled = !ok; box.classList.toggle('locked', !ok);
  const missing = PRE_CODE.filter(k => !state.steps[k].trim()).map(k => STEPS.findIndex(s => s.key === k) + 1);
  note.textContent = ok ? '' : `Locked until steps ${missing.join(', ')} are written.`;
}

function codeTab(e) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const ta = e.target, s = ta.selectionStart, en = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(en);
  ta.selectionStart = ta.selectionEnd = s + 4;
  state.steps.code = ta.value;
}

function drillText(includeCode = true) {
  const lines = [`Problem: ${state.problemTitle}${state.problemUrl ? ' — ' + state.problemUrl : ''}`];
  if (state.statement) lines.push('', 'Statement:', state.statement.trim());
  lines.push('', `Elapsed: ${fmtSecs(state.elapsed)} of ${fmtSecs(state.limitSec)} · hints so far: ${state.hints}`, '');
  for (const s of STEPS) {
    if (s.code && !includeCode) continue;
    const v = state.steps[s.key].trim();
    lines.push(`## ${s.title} (${fmtSecs(state.stepSeconds[s.key])})`, v || '(not written yet)', '');
  }
  return lines.join('\n');
}

async function askHint() {
  const stuck = STEPS.find(s => !state.steps[s.key].trim()) || STEPS[STEPS.length - 1];
  state.hints += 1;
  state.hintLog.push({ at: Math.round(state.elapsed), step: stuck.key });
  await saveDraft();
  root.querySelector('#hint-pill').textContent = `hints: ${state.hints}`;
  const text = `[DRILL HINT #${state.hints}] I am stuck at step "${stuck.title}". Act as a Google interviewer: give ONE hint, not the solution.\n\n${drillText(false)}`;
  toast((await copyText(text)) ? 'Copied — paste it to Kiro in the dashboard.' : 'Copy failed; select the text manually.');
}

async function abandon() {
  if (!confirm('Abandon this drill? Nothing will be logged.')) return;
  stopTick(); await clearDraft(); state = null; renderSetup();
}

function renderPostMortem() {
  const result = h('select', {}, h('option', { value: 'solved' }, 'Solved — optimal, tests pass'), h('option', { value: 'partial' }, 'Partial — reached the object / brute force only'), h('option', { value: 'fail' }, 'Fail — no real progress'));
  const stalled = h('select', {}, ...STEPS.map((s, i) => h('option', { value: s.key }, `${i + 1}. ${s.title}`)));
  const lesson = h('input', { placeholder: 'One sentence. What will you do differently next time?' });
  const suggest = () => { const k = Object.entries(state.stepSeconds).sort((a, b) => b[1] - a[1])[0]?.[0]; if (k) stalled.value = k; };
  const wrap = h('section', { class: 'card', style: 'margin-top:1.2rem' },
    h('h2', {}, 'Post-mortem'),
    h('p', { class: 'muted small' }, 'Two minutes. Which step ate the time? That is what we train next.'),
    h('div', { class: 'grid cols-2' },
      h('div', { class: 'field' }, h('label', {}, 'Result'), result),
      h('div', { class: 'field' }, h('label', {}, 'Stalled at'), stalled,
        h('div', { class: 'help' }, 'Pre-filled with your longest step. ', h('a', { href: '#', onClick: (e) => { e.preventDefault(); suggest(); } }, 'Re-suggest')))),
    h('div', { class: 'field' }, h('label', {}, 'Lesson'), lesson),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onClick: async () => toast((await copyText(`[DRILL REVIEW] Review this drill as a Google interviewer: correctness, complexity, code clarity, and which protocol step I should train.\n\n${drillText(true)}`)) ? 'Copied — paste to Kiro for review.' : 'Copy failed.') }, 'Review → Kiro'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn primary', onClick: async () => {
        stopTick();
        const rec = { id: state.id, date: state.date, source: state.source, problemTitle: state.problemTitle, problemUrl: state.problemUrl,
          steps: state.steps, stepSeconds: Object.fromEntries(Object.entries(state.stepSeconds).map(([k, v]) => [k, Math.round(v)])),
          totalSeconds: Math.round(state.elapsed), limitSec: state.limitSec, hints: state.hints, hintLog: state.hintLog,
          result: result.value, stalledAt: stalled.value, lesson: lesson.value.trim() };
        await db.put('drills', rec); await clearDraft(); state = null;
        toast('Saved to log.'); location.hash = '#/log';
      } }, 'Save drill')));
  setTimeout(suggest, 0);
  return wrap;
}

document.addEventListener('visibilitychange', () => { if (state) saveDraft(); });

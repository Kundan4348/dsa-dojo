// app.js — boot, hash router, shared UI helpers.
import { db } from './db.js';
import { renderDrill } from './drill.js';
import { renderLog } from './log.js';
import { renderPatterns } from './patterns.js';

export const INTERVIEW_DATE_KEY = 'interviewDate';
const DEFAULT_INTERVIEW = '2026-10-24';

const view = document.getElementById('view');
const toastEl = document.getElementById('toast');
let toastTimer = null;

export function toast(msg, ms = 2200) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function fmtSecs(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

function comingSoon(title, what) {
  return () => {
    view.replaceChildren(
      h('h1', {}, title),
      h('div', { class: 'card' },
        h('p', { class: 'muted' }, `${what} ships in build session 2.`),
        h('p', {}, 'Until then: ', h('a', { href: '#/drill' }, 'run a drill'), ' or ',
          h('a', { href: '#/patterns' }, 'read a pattern'), '.'))
    );
  };
}

const routes = {
  today: renderToday,
  drill: (params) => renderDrill(view, params),
  patterns: (params) => renderPatterns(view, params),
  recall: comingSoon('Recall', 'Spaced-repetition recall cards'),
  contests: comingSoon('Contests', 'The latest weekly/biweekly contest feed'),
  mock: comingSoon('Mock', 'The 45-minute mock interview flow'),
  log: (params) => renderLog(view, params),
};

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '') || 'today';
  const [path, qs] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  const [name, ...rest] = path.split('/');
  return { name, rest, params };
}

async function route() {
  const { name, rest, params } = parseHash();
  const fn = routes[name] || routes.today;
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  view.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
  try {
    await fn({ ...params, path: rest });
  } catch (e) {
    console.error(e);
    view.replaceChildren(h('h1', {}, 'Something broke'), h('pre', {}, String(e && e.stack || e)));
  }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function renderToday() {
  const drills = await db.all('drills');
  const todayStr = new Date().toISOString().slice(0, 10);
  const doneToday = drills.filter(d => d.date === todayStr);
  const streak = computeStreak(drills);
  view.replaceChildren(
    h('h1', {}, 'Today'),
    h('p', { class: 'muted' }, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })),
    h('div', { class: 'grid cols-3' },
      h('div', { class: 'card' }, h('h3', {}, 'Drill'),
        h('p', {}, doneToday.length ? `${doneToday.length} done today.` : 'One timed derivation, protocol enforced.'),
        h('a', { class: 'btn primary', href: '#/drill' }, doneToday.length ? 'Another drill' : 'Start drill')),
      h('div', { class: 'card' }, h('h3', {}, 'Recall'),
        h('p', { class: 'muted' }, 'Cards arrive in session 2. For now, pick a pattern and try its canonical problem from memory.'),
        h('a', { class: 'btn', href: '#/patterns' }, 'Patterns')),
      h('div', { class: 'card' }, h('h3', {}, 'Streak'),
        h('p', {}, h('span', { class: 'timer' }, String(streak)), ' day', streak === 1 ? '' : 's'),
        h('a', { class: 'btn', href: '#/log' }, 'Open log')),
    ),
    h('h2', {}, 'The protocol'),
    h('div', { class: 'card' }, h('ol', {},
      h('li', {}, h('b', {}, 'Restate'), ' in one sentence, your words.'),
      h('li', {}, h('b', {}, 'Brute force'), ' + its complexity. Always.'),
      h('li', {}, h('b', {}, 'Find the waste'), ' — what does the brute force recompute?'),
      h('li', {}, h('b', {}, 'Closest known problem + the twist'), ' — "like X, except …".'),
      h('li', {}, h('b', {}, 'Name the object'), ' that removes the waste, and its invariant.'),
      h('li', {}, h('b', {}, 'Hand-trace'), ' a 4–5 element example with a boundary.'),
      h('li', {}, h('b', {}, 'Code'), ' in separate small steps. ', h('b', {}, 'Post-mortem'), ' after.'),
    ))
  );
}

function computeStreak(drills) {
  const days = new Set(drills.map(d => d.date));
  let n = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!days.has(key)) { if (n === 0) { d.setDate(d.getDate() - 1); if (days.has(d.toISOString().slice(0, 10))) continue; } break; }
    n++; d.setDate(d.getDate() - 1);
  }
  return n;
}

async function updateDaysLeft() {
  const date = await db.setting(INTERVIEW_DATE_KEY, DEFAULT_INTERVIEW);
  const days = Math.ceil((new Date(date) - new Date()) / 86400000);
  const el = document.getElementById('days-left');
  el.textContent = days >= 0 ? `${days} days left` : 'Interview passed';
  el.className = 'pill ' + (days <= 7 ? 'bad' : days <= 14 ? 'warn' : 'ok');
  el.title = `Interview on ${date}. Change in Log → Settings.`;
}

window.addEventListener('hashchange', route);
window.addEventListener('load', () => {
  route();
  updateDaysLeft();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('sw', err));
  }
});
export { updateDaysLeft };

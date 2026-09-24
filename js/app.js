// app.js — boot, hash router, shared UI helpers.
import { db } from './db.js';
import { renderDrill } from './drill.js';
import { renderLog } from './log.js';
import { renderPatterns } from './patterns.js';
import { renderRecall, dueCards } from './recall.js';
import { renderContests } from './contests.js';
import { renderMock } from './mock.js';
import { todayPlan } from './schedule.js';

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

export function mount(el, ...kids) {
  el.replaceChildren(...kids.flat().filter(c => c != null && c !== false));
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

const routes = {
  today: renderToday,
  drill: (params) => renderDrill(view, params),
  patterns: (params) => renderPatterns(view, params),
  recall: () => renderRecall(view),
  contests: () => renderContests(view),
  mock: () => renderMock(view),
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
  const [drills, mocks, due] = await Promise.all([db.all('drills'), db.all('mocks'), dueCards(99)]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const drillsToday = drills.filter(d => d.date === todayStr).length;
  const mocksToday = mocks.filter(m => m.date === todayStr).length;
  const streak = computeStreak(drills.concat(mocks));
  const plan = await todayPlan(due.length, drillsToday, mocksToday);
  view.replaceChildren(
    h('div', { class: 'row between' }, h('h1', {}, 'Today'), h('span', { class: 'pill accent' }, `Week ${plan.weekNo} · day ${plan.dayIdx}`)),
    h('p', { class: 'muted' }, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), ' · ', plan.focus),
    h('div', { class: 'card' }, ...plan.tasks.map(t => h('div', { class: 'row', style: 'padding:.45rem 0;border-bottom:1px solid var(--line)' },
      h('span', { class: 'step-num', style: t.done ? 'background:var(--ok);color:#fff' : '' }, t.done ? '✓' : ''),
      h('span', { style: t.done ? 'text-decoration:line-through;color:var(--fg-3)' : '' }, t.label),
      h('span', { class: 'spacer' }),
      t.done ? null : h('a', { class: 'btn sm primary', href: t.href }, 'Go')))),
    h('div', { class: 'grid cols-3', style: 'margin-top:1rem' },
      h('div', { class: 'card' }, h('h3', {}, 'Streak'), h('p', {}, h('span', { class: 'timer' }, String(streak)), ' day', streak === 1 ? '' : 's')),
      h('div', { class: 'card' }, h('h3', {}, 'Drills'), h('p', {}, h('span', { class: 'timer' }, String(drills.length)), ' total · ', h('a', { href: '#/log' }, 'log'))),
      h('div', { class: 'card' }, h('h3', {}, 'Mocks'), h('p', {}, h('span', { class: 'timer' }, String(mocks.length)), mocks.length ? ` · last ${mocks[mocks.length - 1].score}/15` : ''))),
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

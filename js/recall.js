// recall.js — spaced repetition over the pattern deck. Leitner boxes: 1 → 1 day, 2 → 3 days, 3 → 7 days.
import { db, today } from './db.js';
import { h, mount, toast, copyText } from './app.js';

const INTERVAL = { 1: 1, 2: 3, 3: 7 };
const DAILY_CAP = 3;

function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

async function loadIndex() { return (await fetch('data/patterns/index.json')).json(); }
async function loadPattern(id) { try { return await (await fetch(`data/patterns/${id}.json`)).json(); } catch { return null; } }

/** Ensure every pattern has a card. New cards are due today, box 1. */
export async function ensureCards() {
  const index = await loadIndex();
  const cards = await db.all('cards');
  const have = new Set(cards.map(c => c.patternId));
  for (const p of index) if (!have.has(p.id)) await db.put('cards', { patternId: p.id, box: 1, due: today(), history: [] });
  return db.all('cards');
}

export async function dueCards(limit = DAILY_CAP) {
  const cards = await ensureCards();
  const t = today();
  return cards.filter(c => c.due <= t).sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box).slice(0, limit);
}

async function grade(card, ok) {
  const t = today();
  card.history.push({ date: t, ok });
  card.box = ok ? Math.min(3, card.box + 1) : 1;
  card.due = addDays(t, INTERVAL[card.box]);
  await db.put('cards', card);
}

export async function renderRecall(container) {
  const index = await loadIndex();
  const byId = Object.fromEntries(index.map(p => [p.id, p]));
  const cards = await ensureCards();
  const t = today();
  const order = Object.fromEntries(index.map((p, i) => [p.id, (p.ready ? 0 : 1000) + i]));
  const due = cards.filter(c => c.due <= t).sort((a, b) => a.due.localeCompare(b.due) || a.box - b.box || order[a.patternId] - order[b.patternId]);
  const shown = due.slice(0, DAILY_CAP);
  const boxes = [1, 2, 3].map(b => cards.filter(c => c.box === b).length);
  const mastered = cards.filter(c => c.box === 3 && c.history.length && c.history[c.history.length - 1].ok).length;

  const cardEls = await Promise.all(shown.map(async c => {
    const meta = byId[c.patternId]; const full = meta.ready ? await loadPattern(c.patternId) : null;
    const canon = full?.canonical?.[0];
    const revealed = h('div', { style: 'display:none' },
      full ? h('p', {}, h('b', {}, 'Invariant: '), full.invariant) : h('p', { class: 'muted' }, 'Full write-up not authored yet — judge yourself on whether you could state the invariant and write the template.'),
      full ? h('p', {}, h('b', {}, 'One-liner: '), full.oneLiner) : null,
      h('div', { class: 'row' },
        h('a', { class: 'btn sm', href: `#/patterns/${c.patternId}` }, 'Open pattern'),
        h('button', { class: 'btn sm', onClick: async () => toast((await copyText(`Rebuild the "${meta.name}" pattern with me in 15 minutes: start from the brute force on ${canon ? canon.title : 'its canonical problem'}, make me find the waste, then the invariant, then I write the template. Do not hand me the code.`)) ? 'Copied — paste to Kiro for a 15-min rebuild.' : 'Copy failed.') }, 'Rebuild → Kiro')));
    const el = h('div', { class: 'card', style: 'margin-bottom:.8rem' },
      h('div', { class: 'row between' }, h('b', {}, meta.name), h('span', { class: 'pill' }, `box ${c.box} · ${c.history.length} review${c.history.length === 1 ? '' : 's'}`)),
      h('p', { class: 'muted small', style: 'margin:.2rem 0 .5rem' }, 'Cues: ', meta.cues.slice(0, 4).join(' · ')),
      canon ? h('p', {}, 'From memory, solve: ', h('a', { href: `https://leetcode.com/problems/${canon.slug}/`, target: '_blank', rel: 'noopener' }, canon.title), ' ', h('span', { class: `tag ${(canon.difficulty || '').toLowerCase()}` }, canon.difficulty)) :
        h('p', {}, 'From memory: state the invariant and sketch the template for this pattern.'),
      h('p', { class: 'help' }, 'Set a 5-minute timer. Came back cleanly → it is fine. Fumbled → 15-minute rebuild, not a re-read.'),
      h('div', { class: 'row', style: 'margin:.6rem 0' },
        h('button', { class: 'btn sm', onClick: () => { revealed.style.display = revealed.style.display === 'none' ? '' : 'none'; } }, 'Reveal'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn sm', style: 'color:var(--ok)', onClick: async () => { await grade(c, true); toast(`Next review in ${INTERVAL[c.box]} day(s).`); renderRecall(container); } }, '✓ Came back < 5 min'),
        h('button', { class: 'btn sm', style: 'color:var(--warn)', onClick: async () => { await grade(c, false); toast('Back to box 1 — do the 15-minute rebuild now.'); renderRecall(container); } }, '✗ Needed rebuild')),
      revealed);
    return el;
  }));

  const upcoming = cards.filter(c => c.due > t).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8);

  mount(container, 
    h('div', { class: 'row between' }, h('h1', {}, 'Recall'), h('span', { class: 'muted small' }, `${due.length} due · box 1/2/3 = ${boxes.join('/')} · ${mastered} steady`)),
    h('p', { class: 'muted' }, 'Rust removal, not re-learning. One canonical problem per pattern; you attempt it from memory and grade yourself honestly.'),
    shown.length ? h('div', {}, ...cardEls) : h('div', { class: 'card empty' }, 'Nothing due today. ', upcoming.length ? `Next: ${byId[upcoming[0].patternId].name} on ${upcoming[0].due}.` : ''),
    due.length > DAILY_CAP ? h('p', { class: 'help' }, `${due.length - DAILY_CAP} more due — capped at ${DAILY_CAP} a day so it stays a warm-up, not a session.`) : null,
    upcoming.length ? h('div', {}, h('h2', {}, 'Upcoming'), h('div', { class: 'card', style: 'padding:0' }, h('table', {}, h('tbody', {}, ...upcoming.map(c => h('tr', {}, h('td', { class: 'mono small' }, c.due), h('td', {}, h('a', { href: `#/patterns/${c.patternId}` }, byId[c.patternId].name)), h('td', { class: 'small muted' }, `box ${c.box}`))))))) : null,
  );
}

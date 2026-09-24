// contests.js — latest contest problems as fresh, off-pattern drill material.
import { db } from './db.js';
import { h, mount } from './app.js';

export async function renderContests(container) {
  let data;
  try { data = await (await fetch('data/contests.json', { cache: 'no-cache' })).json(); }
  catch { mount(container, h('h1', {}, 'Contests'), h('div', { class: 'card empty' }, 'No contest data yet. Run ', h('code', {}, 'python3 tools/fetch_contests.py'), '.')); return; }

  const drills = await db.all('drills');
  const doneUrls = new Set(drills.map(d => (d.problemUrl || '').replace(/\/$/, '')));
  const filter = h('select', {}, h('option', { value: 'all' }, 'All'), h('option', { value: 'Q2Q3' }, 'Q2 + Q3 (Google-medium zone)'), h('option', { value: 'Q4' }, 'Q4 only (one Hard a week)'), h('option', { value: 'todo' }, 'Not yet drilled'));
  const list = h('div', {});

  const draw = () => {
    list.replaceChildren(...data.contests.map(c => {
      const probs = c.problems.filter(p => {
        if (filter.value === 'Q2Q3') return p.pos === 'Q2' || p.pos === 'Q3';
        if (filter.value === 'Q4') return p.pos === 'Q4';
        if (filter.value === 'todo') return !doneUrls.has(p.url.replace(/\/$/, ''));
        return true;
      });
      if (!probs.length) return null;
      return h('div', { class: 'card', style: 'margin-bottom:.8rem' },
        h('div', { class: 'row between' }, h('b', {}, c.contest), h('span', { class: 'muted small mono' }, c.date)),
        h('table', { style: 'margin-top:.4rem' }, h('tbody', {}, ...probs.map(p => {
          const done = doneUrls.has(p.url.replace(/\/$/, ''));
          return h('tr', {},
            h('td', { class: 'mono small', style: 'width:3ch' }, p.pos),
            h('td', {}, h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.title), p.paidOnly ? h('span', { class: 'tag' }, 'premium') : null),
            h('td', { style: 'width:90px' }, h('span', { class: `tag ${(p.difficulty || '').toLowerCase()}` }, p.difficulty || '?')),
            h('td', { class: 'small' }, ...(p.tags || []).slice(0, 3).map(t => h('span', { class: 'tag' }, t)),
              !(p.tags || []).length ? h('span', { class: 'muted small' }, 'tags not yet published — good: no hint') : null),
            h('td', { style: 'width:110px;text-align:right' }, done ? h('span', { class: 'pill ok' }, 'drilled') :
              h('a', { class: 'btn sm', href: `#/drill?title=${encodeURIComponent(p.title)}&url=${encodeURIComponent(p.url)}&source=contest` }, 'Drill →')));
        }))));
    }).filter(Boolean));
  };
  filter.addEventListener('change', draw);
  draw();

  mount(container, 
    h('div', { class: 'row between' }, h('h1', {}, 'Contests'), h('span', { class: 'muted small' }, `fetched ${new Date(data.fetchedAt).toLocaleString()}`)),
    h('p', { class: 'muted' }, 'The closest thing to a Google question is a contest problem you have never seen. Q2–Q3 is the interview zone; Q4 is the weekly Hard where reaching step 5 counts as a win.'),
    h('div', { class: 'row', style: 'margin-bottom:1rem' }, h('label', { style: 'margin:0' }, 'Show'), h('div', { style: 'max-width:320px;flex:1' }, filter)),
    list,
    h('p', { class: 'help' }, 'Refresh: ', h('code', {}, 'python3 tools/fetch_contests.py'), ' (a weekly job does this on Sunday mornings).'));
}

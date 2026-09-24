// patterns.js — the 25 core patterns: cues, invariant, explanation at 4 depths, template, twists, follow-ups.
import { h, mount, toast, copyText } from './app.js';
import { renderMarkdown } from './md.js';
import { highlightCpp } from './hl.js';

let indexCache = null;
const detailCache = new Map();

async function loadIndex() {
  if (!indexCache) indexCache = await (await fetch('data/patterns/index.json')).json();
  return indexCache;
}
async function loadPattern(id) {
  if (!detailCache.has(id)) detailCache.set(id, await (await fetch(`data/patterns/${id}.json`)).json());
  return detailCache.get(id);
}

export async function renderPatterns(container, params = {}) {
  const index = await loadIndex();
  const id = params.path && params.path[0];
  if (id) {
    const entry = index.find(p => p.id === id);
    if (!entry) { mount(container, h('h1', {}, 'Unknown pattern'), h('a', { href: '#/patterns' }, '← Patterns')); return; }
    if (!entry.ready) { mount(container, h('a', { href: '#/patterns', class: 'small' }, '← Patterns'), h('h1', {}, entry.name), h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Content for this pattern is being authored. Cue words so far: ', entry.cues.join(', '), '.'))); return; }
    return renderDetail(container, await loadPattern(id), params.depth || 'oneLiner');
  }

  const q = h('input', { placeholder: 'Filter by name or cue word… e.g. "next greater"', style: 'max-width:420px' });
  const list = h('div', { class: 'pattern-list' });
  const draw = () => {
    const needle = q.value.trim().toLowerCase();
    const items = index.filter(p => !needle || p.name.toLowerCase().includes(needle) || p.cues.some(c => c.toLowerCase().includes(needle)));
    list.replaceChildren(...items.map(p => h('a', { class: 'card pattern-card', href: `#/patterns/${p.id}`, style: 'color:inherit;text-decoration:none;display:block' },
      h('div', { class: 'row between' }, h('b', {}, p.name), p.ready ? h('span', { class: 'pill ok' }, 'ready') : h('span', { class: 'pill' }, 'soon')),
      h('p', { class: 'small muted', style: 'margin:.3rem 0 .5rem' }, p.summary),
      h('div', {}, ...p.cues.slice(0, 5).map(c => h('span', { class: 'tag' }, c))))));
    if (!items.length) list.replaceChildren(h('div', { class: 'empty' }, 'No pattern matches. That is a cue in itself — what is the brute force?'));
  };
  q.addEventListener('input', draw);
  draw();
  mount(container, 
    h('h1', {}, 'Patterns'),
    h('p', { class: 'muted' }, 'Read the cue words first. Recognition = statement words → pattern. Then the twist: how is this problem different from the canonical one?'),
    h('div', { class: 'field' }, q),
    list);
}

const DEPTHS = [['oneLiner', 'One-liner'], ['intuition', 'Intuition'], ['workedExample', 'Worked example'], ['template', 'Template']];

function renderDetail(container, p, depth) {
  const body = h('div', { class: 'md' });
  const tabs = h('div', { class: 'depth-tabs' }, ...DEPTHS.map(([k, label]) => h('button', { class: 'btn sm' + (k === depth ? ' active' : ''), onClick: () => { depth = k; tabs.querySelectorAll('.btn').forEach(b => b.classList.toggle('active', b.textContent === label)); show(); } }, label)));
  const show = () => {
    if (depth === 'template') body.innerHTML = `<pre><code>${highlightCpp(p.template || '// no template yet')}</code></pre>` + (p.templateNotes ? renderMarkdown(p.templateNotes) : '');
    else if (depth === 'oneLiner') body.innerHTML = `<p style="font-size:1.1rem">${renderMarkdown(p.oneLiner).replace(/^<p>|<\/p>$/g, '')}</p>`;
    else body.innerHTML = renderMarkdown(p[depth] || '_Not written yet._');
  };
  show();

  const section = (title, items, render) => items && items.length ? h('div', { class: 'card' }, h('h3', {}, title), h('ul', { style: 'padding-left:1.2rem;margin:.3rem 0' }, ...items.map(render))) : null;

  mount(container, 
    h('a', { href: '#/patterns', class: 'small' }, '← Patterns'),
    h('h1', {}, p.name),
    h('div', {}, ...p.cues.map(c => h('span', { class: 'tag' }, c))),
    h('div', { class: 'card', style: 'margin-top:1rem' },
      h('h3', {}, 'Invariant'), h('p', {}, p.invariant),
      h('div', { class: 'row', style: 'margin-top:.6rem' },
        h('button', { class: 'btn sm', onClick: async () => toast((await copyText(`Explain the "${p.name}" pattern to me from scratch with a small example, then ask me one question to check I got it. Do not give me a LeetCode solution.`)) ? 'Copied — paste to Kiro.' : 'Copy failed.') }, 'Explain → Kiro'))),
    h('h2', {}, 'Explanation'), tabs, h('div', { class: 'card' }, body),
    h('div', { class: 'grid cols-2', style: 'margin-top:1rem' },
      section('Canonical problems', p.canonical, c => h('li', {},
        h('a', { href: `https://leetcode.com/problems/${c.slug}/`, target: '_blank', rel: 'noopener' }, c.title), ' ',
        h('span', { class: `tag ${(c.difficulty || '').toLowerCase()}` }, c.difficulty || ''), ' ',
        h('a', { class: 'small', href: `#/drill?title=${encodeURIComponent(c.title)}&url=${encodeURIComponent('https://leetcode.com/problems/' + c.slug + '/')}&source=pattern` }, 'drill →'))),
      section('Common twists', p.twists, t => h('li', { html: renderMarkdown(t).replace(/^<p>|<\/p>$/g, '') })),
      section('Follow-ups an interviewer asks', p.followups, t => h('li', {}, t)),
      section('Pitfalls', p.pitfalls, t => h('li', { html: renderMarkdown(t).replace(/^<p>|<\/p>$/g, '') }))),
  );
}

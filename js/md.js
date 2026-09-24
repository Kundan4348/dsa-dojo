// md.js — minimal, safe-enough markdown → HTML for our own authored content.
// Supports: headings, paragraphs, **bold**, *italic*, `code`, fenced code (```cpp), - / 1. lists, > quotes, tables, links.
import { highlightCpp } from './hl.js';

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  const codes = [];
  s = esc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function renderMarkdown(src) {
  const lines = (src || '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  const flushList = (items, ordered) => out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(x => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln.trim()) { i++; continue; }
    let m;
    if ((m = ln.match(/^```(\w*)\s*$/))) {
      const lang = m[1]; const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      const code = buf.join('\n');
      out.push(`<pre><code class="lang-${lang}">${lang === 'cpp' || lang === 'c++' ? highlightCpp(code) : esc(code)}</code></pre>`);
      continue;
    }
    if ((m = ln.match(/^(#{1,4})\s+(.*)$/))) { out.push(`<h${m[1].length + 1}>${inline(m[2])}</h${m[1].length + 1}>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(ln)) { const items = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, '')); flushList(items, false); continue; }
    if (/^\s*\d+[.)]\s+/.test(ln)) { const items = []; while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, '')); flushList(items, true); continue; }
    if (ln.startsWith('>')) { const buf = []; while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`); continue; }
    if (ln.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+/.test(lines[i + 1])) {
      const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
      const head = cells(ln); i += 2; const rows = [];
      while (i < lines.length && lines[i].includes('|')) rows.push(cells(lines[i++]));
      out.push(`<table><thead><tr>${head.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+[.)]\s|>)/.test(lines[i]) && !(lines[i].includes('|') && /^\s*\|?\s*:?-+/.test(lines[i + 1] || ''))) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

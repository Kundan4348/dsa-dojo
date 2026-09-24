// hl.js — tiny C++ highlighter. Good enough for interview-sized snippets.
const KW = new Set('alignas alignof and asm auto bool break case catch char class const constexpr const_cast continue decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not nullptr operator or private protected public register reinterpret_cast return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile while'.split(' '));
const TY = new Set('vector string map unordered_map set unordered_set pair deque queue priority_queue stack array tuple optional size_t int64_t uint64_t ll long_long greater less function bitset list'.split(' '));

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function highlightCpp(src) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d[\dxXa-fA-F.]*(?:LL|ll|L|l|u|U)?\b)|(#\s*\w+)|(\b[A-Za-z_]\w*\b)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(last, m.index));
    const t = m[0];
    if (m[1]) out += `<span class="hl-c">${esc(t)}</span>`;
    else if (m[2]) out += `<span class="hl-s">${esc(t)}</span>`;
    else if (m[3]) out += `<span class="hl-n">${esc(t)}</span>`;
    else if (m[4]) out += `<span class="hl-k">${esc(t)}</span>`;
    else if (KW.has(t)) out += `<span class="hl-k">${t}</span>`;
    else if (TY.has(t)) out += `<span class="hl-t">${t}</span>`;
    else out += t;
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}

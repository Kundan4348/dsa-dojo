// tools/check_patterns.mjs — render every authored pattern at all 4 depths headlessly; fail on JS errors.
// Usage: node tools/check_patterns.mjs http://127.0.0.1:8765/ <profileDir>
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.argv[2] || 'http://127.0.0.1:8765/';
const profile = process.argv[3] || join(process.env.TMPDIR || '/tmp', 'dojo-pat-profile');
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const index = JSON.parse(readFileSync(join(root, 'data/patterns/index.json'), 'utf8'));
const ready = index.filter(p => p.ready).map(p => p.id);

const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--no-first-run', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const w = chrome.stdio[3], r = chrome.stdio[4];
let id = 0; const pending = new Map(); const errs = []; let buf = '';
r.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\0')) >= 0) { const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); } });
const send = (method, params = {}, sessionId) => new Promise(res => { const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId; pending.set(m.id, res); w.write(JSON.stringify(m) + '\0'); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId: s } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, s); await send('Page.enable', {}, s);
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }, s)).result.result?.value;

let bad = 0;
for (const p of ready) {
  await send('Page.navigate', { url: `${base}#/patterns/${p}` }, s); await sleep(600);
  const counts = []; let tables = 0;
  for (let t = 0; t < 4; t++) { await ev(`document.querySelectorAll('.depth-tabs .btn')[${t}].click()`); counts.push(await ev(`document.querySelector('.md').innerText.length`)); if (t === 2) tables = await ev(`document.querySelectorAll('.md table').length`); }
  const canonical = await ev(`document.querySelectorAll('.grid.cols-2 li a[target]').length`);
  const thin = counts.some(c => c < 80);
  if (thin || canonical < 2) bad++;
  console.log(p.padEnd(22), 'depth chars', counts.join('/').padEnd(22), 'tables', tables, 'canonical', canonical, thin ? 'THIN' : '');
}
console.log(`${ready.length} patterns checked, errors:`, errs);
chrome.kill();
process.exit(errs.length || bad ? 1 : 0);

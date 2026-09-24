// tools/check.mjs — headless Chrome smoke test with zero dependencies.
// Usage: node tools/check.mjs <baseUrl> <outDir>
// Loads each route, collects console errors, screenshots, and runs a scripted drill flow.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.argv[2] || 'http://127.0.0.1:8765/';
const out = process.argv[3] || '.';
mkdirSync(out, { recursive: true });

const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-pipe', '--window-size=1200,900', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${join(out, 'profile')}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const w = chrome.stdio[3], r = chrome.stdio[4];
let id = 0; const pending = new Map(); const listeners = [];
let buf = '';
r.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\0')) >= 0) { const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else if (msg.method) listeners.forEach(l => l(msg)); } });
const send = (method, params = {}, sessionId) => new Promise(res => { const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId; pending.set(m.id, res); w.write(JSON.stringify(m) + '\0'); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId: s } } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, s); await send('Runtime.enable', {}, s); await send('Log.enable', {}, s);
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false }, s);
const errors = [];
listeners.push(m => {
  if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('LOG ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
});
const evalJs = async (expr) => { const { result } = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, s); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ' ' + (result.exceptionDetails.exception?.description || '')); return result.result?.value; };
const shot = async (name) => { const { result } = await send('Page.captureScreenshot', { format: 'png' }, s); writeFileSync(join(out, name), Buffer.from(result.data, 'base64')); };
const go = async (hash) => { await send('Page.navigate', { url: base + hash }, s); await sleep(700); };

await go('#/today'); await shot('01-today.png');
await go('#/patterns'); await shot('02-patterns.png');
await go('#/patterns/monotonic-stack'); await sleep(300); await shot('03-pattern-detail.png');
await evalJs(`document.querySelectorAll('.depth-tabs .btn')[2].click()`); await sleep(200); await shot('04-pattern-worked.png');
await evalJs(`document.querySelectorAll('.depth-tabs .btn')[3].click()`); await sleep(200); await shot('05-pattern-template.png');

// Drill flow: set up, verify lock, fill steps, verify unlock, save, check log.
await go('#/drill');
await evalJs(`(() => { const f = document.querySelector('form'); f.querySelector('input').value = 'Maximum Width Ramp'; f.querySelectorAll('input')[1].value = 'https://leetcode.com/problems/maximum-width-ramp/'; f.querySelector('textarea').value = 'Given A, ramp (i,j) with i<j and A[i]<=A[j]; maximise j-i.'; f.requestSubmit(); })()`);
await sleep(500);
const lockedBefore = await evalJs(`document.querySelector('textarea[data-step="code"]').disabled`);
await shot('06-drill-locked.png');
const stepKeys = ['restate', 'brute', 'waste', 'twist', 'object', 'trace'];
for (const k of stepKeys) await evalJs(`(() => { const t = document.querySelector('textarea[data-step="${k}"]'); t.focus(); t.value = 'test ${k}'; t.dispatchEvent(new Event('input')); t.blur(); })()`);
await sleep(200);
const lockedAfter = await evalJs(`document.querySelector('textarea[data-step="code"]').disabled`);
await evalJs(`(() => { const t = document.querySelector('textarea[data-step="code"]'); t.focus(); t.value = 'int x = 1;'; t.dispatchEvent(new Event('input')); })()`);
await shot('07-drill-unlocked.png');
await evalJs(`(() => { const btns = [...document.querySelectorAll('button')]; btns.find(b => b.textContent === 'Save drill').click(); })()`);
await sleep(800);
const logRows = await evalJs(`document.querySelectorAll('tbody tr').length`);
await shot('08-log.png');
const histTop = await evalJs(`document.querySelector('.hist-row.top span')?.textContent || ''`);

// Mobile viewport
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, s);
await go('#/drill'); await sleep(300); await shot('09-mobile-drill.png');
await go('#/patterns/prefix-sum-hash'); await sleep(300); await shot('10-mobile-pattern.png');

const swState = await evalJs(`navigator.serviceWorker.getRegistration().then(r => r ? (r.active ? 'active' : 'registered') : 'none')`);
const manifestOk = await evalJs(`fetch('manifest.json').then(r => r.ok)`);

console.log(JSON.stringify({ lockedBefore, lockedAfter, logRows, histTop, swState, manifestOk, errors }, null, 2));
chrome.kill();
process.exit(errors.length || lockedBefore !== true || lockedAfter !== false || logRows !== 1 ? 1 : 0);

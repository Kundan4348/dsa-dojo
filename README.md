# DSA Dojo

Derivation-first interview training PWA. Enforces the 7-step protocol on every
problem, measures which step you stall on, and holds the 25 core patterns with
cue words, invariants, worked examples and C++ templates.

Design: [APP-DESIGN.md](../APP-DESIGN.md). Plan: [PLAN.md](../PLAN.md).

## Run

```bash
cd ~/Documents/Google-Prep/dsa-dojo
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/
```

No build step, no dependencies. Vanilla ES modules + IndexedDB + service worker.

## Verify

```bash
node tools/check.mjs http://127.0.0.1:8765/ /tmp/dojo-shots
```

Drives headless Chrome over CDP (no npm packages): loads every route, asserts
the code box is locked until steps 1–6 are written, saves a drill, checks it
appears in the Log with the stall histogram, and screenshots desktop + mobile.
Exit code 0 = green.

## The Kiro loop

The app never gives solutions. Two buttons hand off to Kiro in the dashboard:

- **Hint → Kiro** (during a drill) copies the problem + your steps so far with a
  request for ONE interviewer-style hint. Hint count is logged.
- **Review → Kiro** (post-mortem) copies the whole drill for a correctness /
  complexity / clarity review and a verdict on which step to train.
- **Explain → Kiro** (pattern page) asks for a from-scratch explanation with a
  check question.

Export the log (Log → Export JSON) into `~/Documents/Google-Prep/` when you want
Kiro to read the trend.

## Layout

```
index.html  manifest.json  sw.js
css/app.css
js/app.js       router, shared helpers, Today
js/db.js        IndexedDB wrapper (drills, mocks, cards, settings)
js/drill.js     protocol form, timers, code lock, hint hand-off, post-mortem
js/log.js       table, stall histogram, export/import, interview date
js/patterns.js  pattern list + detail (4 depths)
js/md.js        minimal markdown   js/hl.js  tiny C++ highlighter
data/patterns/index.json + <id>.json  authored content (no code change to add)
tools/check.mjs headless smoke test
```

Session 2 adds: Recall (Leitner cards), Contests (fetch script + weekly cron),
Mock (45-min flow + rubric), Today schedule, GitHub Pages deploy for iPhone.

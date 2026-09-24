// schedule.js — the 4-week plan as a function of (today, interview date). No data file needed.
import { db } from './db.js';

export const PLAN_START_KEY = 'planStart';
const DEFAULT_START = '2026-09-24';

const WEEKS = [
  { focus: 'Protocol becomes automatic. Quick recall pass over all 25 patterns.', drill: 'One Medium, protocol enforced, then explain-back in 3 plain sentences.', hard: false, mockDays: [] },
  { focus: 'Off-pattern Mediums — contest Q2/Q3. First Hard: reaching step 5 is the win.', drill: 'One contest Q2 or Q3 you have not seen.', hard: 'Sat', mockDays: ['Sun'] },
  { focus: 'Contest Q3/Q4 as drills; practise follow-ups out loud.', drill: 'One contest Q3 (or Q4 on Saturday).', hard: 'Sat', mockDays: ['Wed', 'Sun'] },
  { focus: 'Taper. Mocks every other day, redo failed cards, read the stall histogram.', drill: 'Easy-medium only on non-mock days. Last two days: recall only.', hard: false, mockDays: ['Mon', 'Wed', 'Fri', 'Sun'] },
];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export async function todayPlan(dueCardCount, drillsToday, mocksToday) {
  const start = await db.setting(PLAN_START_KEY, DEFAULT_START);
  const interview = await db.setting('interviewDate', '2026-10-24');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const dayIdx = Math.floor((now - new Date(start + 'T00:00:00')) / 86400000);
  const weekIdx = Math.min(WEEKS.length - 1, Math.max(0, Math.floor(dayIdx / 7)));
  const week = WEEKS[weekIdx];
  const dow = DOW[now.getDay()];
  const daysLeft = Math.ceil((new Date(interview + 'T00:00:00') - now) / 86400000);
  const taper = daysLeft <= 2 && daysLeft >= 0;

  const tasks = [];
  if (taper) tasks.push({ key: 'recall', label: 'Light recall only — no new problems in the last two days.', href: '#/recall', done: false });
  else {
    const isMock = week.mockDays.includes(dow);
    if (isMock) tasks.push({ key: 'mock', label: 'Mock interview, 45 minutes, one problem with follow-ups.', href: '#/mock', done: mocksToday > 0 });
    else tasks.push({ key: 'drill', label: week.hard === dow ? 'Weekly Hard: a contest Q4. Goal = reach step 5 (name the object). Solving is a bonus.' : week.drill, href: week.hard === dow || weekIdx >= 1 ? '#/contests' : '#/drill', done: drillsToday > 0 });
    tasks.push({ key: 'recall', label: dueCardCount ? `${dueCardCount} recall card${dueCardCount === 1 ? '' : 's'} due (5 min each).` : 'No recall cards due — you are ahead.', href: '#/recall', done: dueCardCount === 0 });
    if (!isMock) tasks.push({ key: 'explain', label: 'Explain-back: after the drill, explain why it works in 3 sentences to someone who does not code.', href: '#/drill', done: drillsToday > 0 && false });
  }
  return { weekNo: weekIdx + 1, focus: week.focus, dow, dayIdx: dayIdx + 1, daysLeft, tasks };
}

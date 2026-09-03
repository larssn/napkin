// Pure program + progression logic. No DOM. Imported by app.js and by the tests.

export const EXERCISES = {
  bench:    { name: 'Bench press',              sets: 3, min: 5,  max: 8,  step: 2.5, main: true, video: 'https://www.youtube.com/shorts/hWbUlkb5Ms4' },
  row:      { name: 'Barbell row',              sets: 3, min: 6,  max: 10, step: 2.5, main: true, video: 'https://www.youtube.com/watch?v=Ka-yi9zHp2Q' },
  dbpress:  { name: 'Dumbbell overhead press',  sets: 3, min: 8,  max: 12, step: 2, video: 'https://www.youtube.com/watch?v=1jYq9QQEWqE' },
  pulldown: { name: 'Lat pulldown',             sets: 3, min: 8,  max: 12, step: 5, video: 'https://www.youtube.com/watch?v=mUfNdKgsgHI' },
  squat:    { name: 'Back squat',               sets: 3, min: 5,  max: 8,  step: 2.5, main: true, video: 'https://www.youtube.com/shorts/AIZ8q1qruKw' },
  rdl:      { name: 'Romanian deadlift',        sets: 3, min: 8,  max: 10, step: 2.5, video: 'https://www.youtube.com/watch?v=amLSSb8cXok' },
  lunge:    { name: 'Walking lunge (per leg)',  sets: 2, min: 10, max: 10, step: 2, video: 'https://www.youtube.com/shorts/5eQd_hsXESI' },
  plank:    { name: 'Plank (seconds)',          sets: 3, min: 30, max: 60, step: 0, unit: 's', video: 'https://www.youtube.com/shorts/v25dawSzRTM' },
  ohp:      { name: 'Overhead press',           sets: 3, min: 5,  max: 8,  step: 2.5, main: true, video: 'https://www.youtube.com/watch?v=AhGW3XFG3M8' },
  pullup:   { name: 'Pull-up (added kg)',       sets: 3, min: 5,  max: 10, step: 2.5, main: true, video: 'https://www.youtube.com/watch?v=U6kJQ3CTGis' },
  incline:  { name: 'Incline dumbbell bench',   sets: 3, min: 8,  max: 12, step: 2, video: 'https://www.youtube.com/watch?v=PZecKOpWOrk' },
  dbrow:    { name: 'Single-arm row (per arm)', sets: 3, min: 10, max: 10, step: 2, video: 'https://www.youtube.com/shorts/aFtWSOruuhs' },
  deadlift: { name: 'Deadlift',                 sets: 3, min: 5,  max: 5,  step: 2.5, main: true, video: 'https://www.youtube.com/shorts/vgBAtiL3IRA' },
  goblet:   { name: 'Goblet squat',             sets: 3, min: 10, max: 12, step: 2, video: 'https://www.youtube.com/watch?v=k_EhLGvM8TQ' },
  stepup:   { name: 'Step-up (per leg)',        sets: 2, min: 10, max: 10, step: 2, video: 'https://www.youtube.com/watch?v=vLgNjXucUs0' },
};

export const TEMPLATES = {
  UA: { name: 'Upper A', weekday: 1, exercises: ['bench', 'row', 'dbpress', 'pulldown'] },
  LA: { name: 'Lower A', weekday: 2, exercises: ['squat', 'rdl', 'lunge', 'plank'] },
  UB: { name: 'Upper B', weekday: 4, exercises: ['ohp', 'pullup', 'incline', 'dbrow'] },
  LB: { name: 'Lower B', weekday: 5, exercises: ['deadlift', 'goblet', 'stepup', 'plank'] },
};

export function templateForWeekday(weekday) {
  const id = Object.keys(TEMPLATES).find((k) => TEMPLATES[k].weekday === weekday);
  return id === undefined ? null : id;
}

export function prescription(ex) {
  const e = EXERCISES[ex];
  const reps = e.min === e.max ? `${e.min}` : `${e.min}–${e.max}`;
  return `${e.sets} × ${reps}${e.unit === 's' ? ' s' : ''}`;
}

export function roundToStep(value, step) {
  if (step === 0) return value;
  return Math.round(value / step) * step;
}

// All prescribed sets logged and every set at or above the top of the range.
export function hitTop(ex, entry) {
  const e = EXERCISES[ex];
  return entry.reps.length === e.sets && entry.reps.every((r) => r >= e.max);
}

// Any set below the bottom of the range.
export function missedBottom(ex, entry) {
  const e = EXERCISES[ex];
  return entry.reps.length < e.sets || entry.reps.some((r) => r < e.min);
}

// history: entries for this exercise, most recent first.
// Returns { weight, reason } or null when there is no history.
export function suggest(ex, history) {
  if (history.length === 0) return null;
  const e = EXERCISES[ex];
  const last = history[0];
  if (hitTop(ex, last)) {
    return { weight: last.weight + e.step, reason: 'up' };
  }
  const prev = history[1];
  if (prev && prev.weight === last.weight && missedBottom(ex, last) && missedBottom(ex, prev)) {
    return { weight: roundToStep(last.weight * 0.9, e.step), reason: 'reset' };
  }
  return { weight: last.weight, reason: 'same' };
}

// Flatten sessions into per-exercise history, most recent first.
export function historyFor(sessions, ex) {
  return sessions
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .flatMap((s) => s.entries.filter((en) => en.ex === ex).map((en) => ({ ...en, date: s.date })));
}

export function weeklyAverage(body, endDate) {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const inWindow = body.filter((b) => {
    const d = new Date(b.date);
    return d >= start && d <= end && typeof b.bw === 'number';
  });
  if (inWindow.length === 0) return null;
  return inWindow.reduce((sum, b) => sum + b.bw, 0) / inWindow.length;
}

export function toCSV(data) {
  const lines = ['type,date,template,exercise,weight,set1,set2,set3,bodyweight,waist'];
  for (const s of data.sessions) {
    for (const en of s.entries) {
      lines.push(['set', s.date, s.template, en.ex, en.weight, ...en.reps, '', ''].join(','));
    }
  }
  for (const b of data.body) {
    lines.push(['body', b.date, '', '', '', '', '', '', b.bw ?? '', b.waist ?? ''].join(','));
  }
  return lines.join('\n') + '\n';
}

export function emptyData() {
  return { version: 1, sessions: [], body: [] };
}

export function validateData(obj) {
  if (!obj || obj.version !== 1) throw new Error('Not a Napkin backup (missing version 1)');
  if (!Array.isArray(obj.sessions) || !Array.isArray(obj.body)) throw new Error('Backup is missing sessions or body arrays');
  for (const s of obj.sessions) {
    if (!TEMPLATES[s.template]) throw new Error(`Unknown template "${s.template}" in session ${s.date}`);
    for (const en of s.entries) {
      if (!EXERCISES[en.ex]) throw new Error(`Unknown exercise "${en.ex}" in session ${s.date}`);
      if (typeof en.weight !== 'number' || !Array.isArray(en.reps)) throw new Error(`Bad entry for ${en.ex} in session ${s.date}`);
    }
  }
  return obj;
}

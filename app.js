import { EXERCISES, TEMPLATES, templateForWeekday, prescription, suggest, historyFor, weeklyAverage, toCSV, emptyData, validateData } from './logic.js';

const KEY = 'napkin.v1';

function load() {
  const raw = localStorage.getItem(KEY);
  return raw === null ? emptyData() : validateData(JSON.parse(raw));
}
function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

let data = load();
let view = { name: 'home' };

const $app = document.getElementById('app');
const $nav = document.getElementById('nav');

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtW = (w, ex) => EXERCISES[ex].step === 0 ? '—' : `${w} kg`;

function go(v) { view = v; render(); window.scrollTo(0, 0); }

function render() {
  const tabs = [['home', 'Lift'], ['body', 'Body'], ['progress', 'Progress'], ['backup', 'Backup']];
  const active = view.name === 'session' ? 'home' : view.name;
  $nav.innerHTML = tabs.map(([id, label]) => `<button data-tab="${id}" class="${id === active ? 'on' : ''}">${label}</button>`).join('');
  $nav.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => go({ name: b.dataset.tab })));
  ({ home: renderHome, session: renderSession, body: renderBody, progress: renderProgress, backup: renderBackup })[view.name]();
}

// ---------- Home ----------
function renderHome() {
  const today = todayISO();
  const weekday = new Date().getDay();
  const todayTpl = templateForWeekday(weekday);
  const doneToday = data.sessions.filter((s) => s.date === today);
  const isFirst = new Date().getDate() === 1;

  const tiles = Object.keys(TEMPLATES).map((id) => {
    const t = TEMPLATES[id];
    const last = data.sessions.filter((s) => s.template === id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const done = doneToday.find((s) => s.template === id);
    const sub = done ? 'Logged today · tap to edit' : last ? `Last: ${fmtDate(last.date)}` : 'Never done';
    return `<button class="tile ${id === todayTpl ? 'today' : ''}" data-tpl="${id}">
      <span><span class="n">${t.name}</span><br><span class="s">${esc(sub)}</span></span>
      <span class="arrow">${done ? '✓' : '→'}</span></button>`;
  }).join('');

  $app.innerHTML = `
    <div class="eyebrow">${fmtDate(today)}</div>
    <h1>${todayTpl ? TEMPLATES[todayTpl].name + ' day' : weekday === 3 ? 'Rest day' : 'Weekend'}</h1>
    ${isFirst ? '<div class="notice">Photo day. Same spot, same light, front and side, relaxed.</div>' : ''}
    ${!todayTpl ? `<p class="muted">Nothing scheduled. ${weekday === 3 ? 'Go for a walk.' : 'Weekends are hers.'} You can still log a session below.</p>` : ''}
    <h2>Sessions</h2>${tiles}`;
  $app.querySelectorAll('[data-tpl]').forEach((b) => b.addEventListener('click', () => {
    const existing = doneToday.find((s) => s.template === b.dataset.tpl);
    go({ name: 'session', template: b.dataset.tpl, id: existing ? existing.id : null });
  }));
}

// ---------- Session ----------
function renderSession() {
  const tpl = TEMPLATES[view.template];
  const existing = view.id ? data.sessions.find((s) => s.id === view.id) : null;
  const others = data.sessions.filter((s) => !existing || s.id !== existing.id);

  const blocks = tpl.exercises.map((ex) => {
    const e = EXERCISES[ex];
    const hist = historyFor(others, ex);
    const sug = suggest(ex, hist);
    const saved = existing ? existing.entries.find((en) => en.ex === ex) : null;
    const weight = saved ? saved.weight : sug ? sug.weight : 0;
    const last = hist[0];
    const firstMsg = e.step === 0 ? 'First time — see how long you can hold it' : 'First time — pick a weight you could do 12 times';
    const badge = saved ? '' : !sug ? `<span class="badge">${firstMsg}</span>`
      : sug.reason === 'up' ? `<span class="badge up">↑ Add weight</span>`
      : sug.reason === 'reset' ? `<span class="badge reset">↓ Reset −10%</span>`
      : `<span class="badge">Last: ${esc(last.reps.join(' · '))}</span>`;
    const effort = e.main
      ? '<span class="effort main">Main lift · stop 1–2 reps short · rest 2–3 min</span>'
      : '<span class="effort acc">Last set to failure · rest 60–90 s</span>';
    const sets = Array.from({ length: e.sets }, (_, i) => {
      const v = saved && saved.reps[i] !== undefined ? saved.reps[i] : '';
      const ph = last && last.reps[i] !== undefined ? last.reps[i] : e.min;
      return `<input type="number" inputmode="numeric" pattern="[0-9]*" data-ex="${ex}" data-set="${i}" value="${v}" placeholder="${ph}" aria-label="Set ${i + 1} reps">`;
    }).join('');
    const stepper = e.step === 0 ? '' : `
      <div class="stepper">
        <button type="button" data-dec="${ex}" aria-label="Decrease weight">−</button>
        <input type="number" inputmode="decimal" step="${e.step}" data-w="${ex}" value="${weight}" aria-label="Weight in kg">
        <button type="button" data-inc="${ex}" aria-label="Increase weight">+</button>
      </div>`;
    return `<section class="card${e.main ? ' mainlift' : ''}" data-card="${ex}">
      <div class="row"><h3>${e.name} <a class="vid" href="${e.video}" target="_blank" rel="noopener" aria-label="Form video for ${e.name}">form ↗</a></h3><span class="muted small mono">${prescription(ex)}</span></div>
      ${effort}
      <div style="margin:6px 0 10px">${badge}</div>
      ${stepper}
      <div class="sets">${sets}</div>
    </section>`;
  }).join('');

  $app.innerHTML = `
    <div class="eyebrow">${existing ? 'Editing · ' : ''}${fmtDate(existing ? existing.date : todayISO())}</div>
    <h1>${tpl.name}</h1>
    <p class="muted small">Weight is prefilled from your last session. Type reps for each set; leave a set empty if you skipped it.</p>
    ${blocks}
    <button class="btn primary" id="save">Save session</button>
    ${existing ? '<button class="btn quiet" id="delete">Delete this session</button>' : ''}
    <button class="btn quiet" id="cancel">Back</button>`;

  const markSets = () => {
    $app.querySelectorAll('input[data-set]').forEach((inp) => {
      const e = EXERCISES[inp.dataset.ex];
      const v = inp.value === '' ? null : Number(inp.value);
      inp.classList.toggle('top', v !== null && v >= e.max);
      inp.classList.toggle('low', v !== null && v < e.min);
    });
    tpl.exercises.forEach((ex) => {
      const e = EXERCISES[ex];
      const vals = [...$app.querySelectorAll(`input[data-ex="${ex}"]`)].map((i) => i.value === '' ? null : Number(i.value));
      const hit = vals.length === e.sets && vals.every((v) => v !== null && v >= e.max);
      $app.querySelector(`[data-card="${ex}"]`).classList.toggle('hit', hit);
    });
  };
  markSets();
  $app.querySelectorAll('input[data-set]').forEach((inp) => inp.addEventListener('input', markSets));
  $app.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', () => bump(b.dataset.dec, -1)));
  $app.querySelectorAll('[data-inc]').forEach((b) => b.addEventListener('click', () => bump(b.dataset.inc, 1)));
  function bump(ex, dir) {
    const inp = $app.querySelector(`input[data-w="${ex}"]`);
    const step = EXERCISES[ex].step;
    inp.value = Math.round((Number(inp.value) + dir * step) * 100) / 100;
  }

  document.getElementById('save').addEventListener('click', () => {
    const entries = tpl.exercises.map((ex) => {
      const wInp = $app.querySelector(`input[data-w="${ex}"]`);
      const weight = wInp ? Number(wInp.value) : 0;
      const reps = [...$app.querySelectorAll(`input[data-ex="${ex}"]`)].map((i) => i.value).filter((v) => v !== '').map(Number);
      return { ex, weight, reps };
    }).filter((en) => en.reps.length > 0);
    if (entries.length === 0) { alert('Nothing logged yet — enter reps for at least one exercise.'); return; }
    if (existing) {
      existing.entries = entries;
    } else {
      data.sessions.push({ id: crypto.randomUUID(), date: todayISO(), template: view.template, entries });
    }
    save(data);
    go({ name: 'home' });
  });
  const del = document.getElementById('delete');
  if (del) del.addEventListener('click', () => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    data.sessions = data.sessions.filter((s) => s.id !== existing.id);
    save(data);
    go({ name: 'home' });
  });
  document.getElementById('cancel').addEventListener('click', () => go({ name: 'home' }));
}

// ---------- Body ----------
function renderBody() {
  const today = todayISO();
  const avg = weeklyAverage(data.body, today);
  const rows = data.body.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
  const lastWaist = rows.find((b) => typeof b.waist === 'number');
  $app.innerHTML = `
    <div class="eyebrow">Body</div>
    <h1>Numbers</h1>
    <div class="grid2" style="margin:12px 0 18px">
      <div class="card"><div class="eyebrow">7-day avg weight</div><div class="hero">${avg === null ? '—' : avg.toFixed(1)}<small>kg</small></div></div>
      <div class="card"><div class="eyebrow">Last waist</div><div class="hero">${lastWaist ? lastWaist.waist : '—'}<small>cm</small></div></div>
    </div>
    <div class="card">
      <div class="field"><label for="bdate">Date</label><input type="date" id="bdate" value="${today}"></div>
      <div class="grid2">
        <div class="field"><label for="bw">Bodyweight (kg)</label><input type="number" inputmode="decimal" step="0.1" id="bw" placeholder="78.4"></div>
        <div class="field"><label for="waist">Waist at navel (cm)</label><input type="number" inputmode="decimal" step="0.5" id="waist" placeholder="Mondays only"></div>
      </div>
      <button class="btn primary" id="bsave">Save</button>
      <div class="err" id="berr"></div>
    </div>
    <p class="muted small">Weigh in 3 mornings a week, after the toilet, before food. Only the weekly average means anything. Waist every Monday, relaxed, tape snug.</p>
    <h2>History</h2>
    <table><thead><tr><th>Date</th><th style="text-align:right">kg</th><th style="text-align:right">Waist</th></tr></thead><tbody>
      ${rows.map((b) => `<tr><td>${fmtDate(b.date)}</td><td class="num">${b.bw ?? ''}</td><td class="num">${b.waist ?? ''}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Nothing yet.</td></tr>'}
    </tbody></table>`;
  document.getElementById('bsave').addEventListener('click', () => {
    const date = document.getElementById('bdate').value;
    const bwRaw = document.getElementById('bw').value;
    const waistRaw = document.getElementById('waist').value;
    const err = document.getElementById('berr');
    if (!date) { err.textContent = 'Pick a date.'; return; }
    if (bwRaw === '' && waistRaw === '') { err.textContent = 'Enter a bodyweight or a waist measurement.'; return; }
    const entry = { date };
    if (bwRaw !== '') entry.bw = Number(bwRaw);
    if (waistRaw !== '') entry.waist = Number(waistRaw);
    const existing = data.body.find((b) => b.date === date);
    if (existing) Object.assign(existing, entry); else data.body.push(entry);
    save(data);
    render();
  });
}

// ---------- Progress ----------
function renderProgress() {
  const ex = view.ex || 'bench';
  const hist = historyFor(data.sessions, ex).reverse(); // oldest first for the chart
  const e = EXERCISES[ex];
  const chips = Object.keys(EXERCISES).map((id) => `<button class="chip ${id === ex ? 'on' : ''}" data-ex="${id}">${EXERCISES[id].name.replace(/ \(.*\)/, '')}</button>`).join('');
  const rows = hist.slice().reverse().map((h) => `<tr><td>${fmtDate(h.date)}</td><td class="num">${fmtW(h.weight, ex)}</td><td class="num">${h.reps.join(' · ')}</td></tr>`).join('');
  $app.innerHTML = `
    <div class="eyebrow">Progress</div>
    <h1>${e.name.replace(/ \(.*\)/, '')} <a class="vid" href="${e.video}" target="_blank" rel="noopener">form ↗</a></h1>
    <div class="chips" style="margin-top:12px">${chips}</div>
    <div class="card">${sparkline(hist, e)}</div>
    <table><thead><tr><th>Date</th><th style="text-align:right">${e.step === 0 ? '' : 'Weight'}</th><th style="text-align:right">${e.unit === 's' ? 'Seconds' : 'Reps'}</th></tr></thead><tbody>
      ${rows || '<tr><td colspan="3" class="muted">No sessions logged with this exercise yet.</td></tr>'}
    </tbody></table>`;
  $app.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => go({ name: 'progress', ex: c.dataset.ex })));
}

function sparkline(hist, e) {
  // Series: weight per session, or seconds (first set) when the exercise has no weight.
  const ys = hist.map((h) => e.step === 0 ? h.reps[0] : h.weight);
  if (ys.length < 2) return `<p class="muted small" style="margin:0">Log at least two sessions to see a trend.</p>`;
  const W = 320, H = 110, padL = 10, padR = 44, padT = 14, padB = 18;
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const x = (i) => padL + (i / (ys.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / span) * (H - padT - padB);
  const pts = ys.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = ys.length - 1;
  const gridY = [min, max].map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`).join('');
  const unit = e.step === 0 ? 's' : 'kg';
  return `<div class="eyebrow" style="margin-bottom:4px">${e.step === 0 ? 'First-set seconds' : 'Working weight'} · ${ys.length} sessions</div>
  <svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${ys.length} sessions, from ${ys[0]} to ${ys[last]} ${unit}">
    ${gridY}
    <polyline fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>
    <circle cx="${x(last).toFixed(1)}" cy="${y(ys[last]).toFixed(1)}" r="4.5" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>
    <text x="${(x(last) + 8).toFixed(1)}" y="${(y(ys[last]) + 4).toFixed(1)}" font-size="12" font-weight="700" fill="var(--ink)">${ys[last]} ${unit}</text>
    <text x="${padL}" y="${H - 4}" font-size="10" fill="var(--muted)">${fmtDate(hist[0].date)}</text>
    <text x="${(W - padR).toFixed(1)}" y="${H - 4}" font-size="10" fill="var(--muted)" text-anchor="end">${fmtDate(hist[last].date)}</text>
  </svg>`;
}

// ---------- Backup ----------
function renderBackup() {
  const n = data.sessions.length;
  $app.innerHTML = `
    <div class="eyebrow">Backup</div>
    <h1>Your data</h1>
    <p class="muted small">${n} session${n === 1 ? '' : 's'}, ${data.body.length} body entr${data.body.length === 1 ? 'y' : 'ies'}. Everything lives on this phone only. Export a backup now and then — share it to Files, Notes or email.</p>
    <button class="btn primary" id="expjson">Export backup (JSON)</button>
    <button class="btn" id="expcsv">Export spreadsheet (CSV)</button>
    <h2>Restore</h2>
    <p class="muted small">Paste a JSON backup below. This replaces everything currently in the app.</p>
    <textarea id="imp" placeholder='{"version":1,"sessions":[...],"body":[...]}'></textarea>
    <button class="btn" id="impbtn">Restore from JSON</button>
    <div class="err" id="imperr"></div>
    <h2>Danger</h2>
    <button class="btn quiet" id="wipe">Delete all data</button>`;
  document.getElementById('expjson').addEventListener('click', () => shareText(JSON.stringify(data, null, 2), `napkin-${todayISO()}.json`, 'application/json'));
  document.getElementById('expcsv').addEventListener('click', () => shareText(toCSV(data), `napkin-${todayISO()}.csv`, 'text/csv'));
  document.getElementById('impbtn').addEventListener('click', () => {
    const err = document.getElementById('imperr');
    try {
      const parsed = validateData(JSON.parse(document.getElementById('imp').value));
      if (!confirm(`Replace current data with ${parsed.sessions.length} sessions and ${parsed.body.length} body entries?`)) return;
      data = parsed;
      save(data);
      go({ name: 'home' });
    } catch (ex) {
      err.textContent = ex instanceof SyntaxError ? "That isn't valid JSON — paste the whole backup file, including the { and }." : ex.message;
    }
  });
  document.getElementById('wipe').addEventListener('click', () => {
    if (!confirm('Delete ALL sessions and body entries? Export a backup first if you want to keep them.')) return;
    data = emptyData();
    save(data);
    go({ name: 'home' });
  });
}

async function shareText(text, filename, type) {
  const file = new File([text], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
render();

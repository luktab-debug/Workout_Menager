// ============================================================
// Trening — appka do planu treningowego z edycją i historią
// Vanilla JS, bez frameworków i bez bundlera (Capacitor WebView)
// ============================================================

let DATA = loadData();
let VIEW = { screen: 'home' };
let timerInterval = null;

const screenEl = document.getElementById('screen');
const topbarTitle = document.getElementById('topbar-title');
const backBtn = document.getElementById('back-btn');
const navButtons = document.querySelectorAll('#navbar button');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtDate(iso) {
  const d = new Date(iso);
  const months = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
  return { day: d.getDate(), month: months[d.getMonth()], full: d.toLocaleDateString('pl-PL') };
}

function findPlan(planId) {
  return DATA.plans.find(p => p.id === planId);
}

function findExercise(planId, exId) {
  const plan = findPlan(planId);
  if (!plan) return null;
  return plan.exercises.find(e => e.id === exId);
}

// ---------- Toast ----------
let toastTimeout = null;
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 1800);
}

// ---------- Modal helper ----------
function closeModal() {
  const b = document.getElementById('modal-backdrop');
  if (b) b.remove();
}

function openModal(innerHtml) {
  closeModal();
  const backdrop = document.createElement('div');
  backdrop.id = 'modal-backdrop';
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal-sheet" onclick="event.stopPropagation()">${innerHtml}</div>`;
  backdrop.addEventListener('click', closeModal);
  document.body.appendChild(backdrop);
}

function confirmDialog(message, onYes) {
  openModal(`
    <h3>${esc(message)}</h3>
    <div class="row" style="margin-top:14px;">
      <button class="btn secondary" onclick="closeModal()">Anuluj</button>
      <button class="btn danger" id="confirm-yes-btn">Tak, usuń</button>
    </div>
  `);
  document.getElementById('confirm-yes-btn').addEventListener('click', () => { closeModal(); onYes(); });
}

// ============================================================
// NAWIGACJA / RENDER GŁÓWNY
// ============================================================

function setView(screen, params) {
  VIEW = Object.assign({ screen }, params || {});
  render();
}

function render() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

  navButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabForScreen(VIEW.screen)));

  let title = 'Trening';
  let showBack = false;

  switch (VIEW.screen) {
    case 'home': title = 'Trening'; screenEl.innerHTML = renderHome(); break;
    case 'session': title = sessionTitle(); showBack = true; screenEl.innerHTML = renderSession(); startTimerIfNeeded(); break;
    case 'history': title = 'Historia'; screenEl.innerHTML = renderHistory(); break;
    case 'historyDetail': title = 'Podsumowanie'; showBack = true; screenEl.innerHTML = renderHistoryDetail(); break;
    case 'progressPick': title = 'Postępy'; showBack = true; screenEl.innerHTML = renderProgressPick(); break;
    case 'progressExercise': title = 'Postępy'; showBack = true; screenEl.innerHTML = renderProgressExercise(); break;
    case 'edit': title = 'Edycja planu'; screenEl.innerHTML = renderEditList(); break;
    case 'editDay': title = 'Edycja dnia'; showBack = true; screenEl.innerHTML = renderEditDay(); break;
    default: screenEl.innerHTML = '';
  }

  topbarTitle.textContent = title;
  backBtn.style.visibility = showBack ? 'visible' : 'hidden';
  screenEl.scrollTop = 0;
}

function tabForScreen(screen) {
  if (['home', 'session'].includes(screen)) return 'home';
  if (['history', 'historyDetail', 'progressPick', 'progressExercise'].includes(screen)) return 'history';
  if (['edit', 'editDay'].includes(screen)) return 'edit';
  return 'home';
}

function goBack() {
  if (VIEW.screen === 'session') { setView('home'); return; }
  if (VIEW.screen === 'historyDetail' || VIEW.screen === 'progressPick') { setView('history'); return; }
  if (VIEW.screen === 'progressExercise') { setView('progressPick'); return; }
  if (VIEW.screen === 'editDay') { setView('edit'); return; }
  setView('home');
}

backBtn.addEventListener('click', goBack);
navButtons.forEach(b => b.addEventListener('click', () => {
  const tab = b.dataset.tab;
  if (tab === 'home') setView(DATA.activeSession ? 'session' : 'home');
  if (tab === 'history') setView('history');
  if (tab === 'edit') setView('edit');
}));

// ============================================================
// EKRAN GŁÓWNY — wybór dnia treningowego
// ============================================================

function renderHome() {
  if (DATA.activeSession) {
    const plan = findPlan(DATA.activeSession.planId);
    return `
      <div class="card" style="border-color:var(--accent);">
        <div style="font-weight:700;margin-bottom:6px;">Masz trening w trakcie</div>
        <div class="section-note" style="margin:0 0 10px;">Plan ${esc(plan ? plan.name : '?')} — wróć do niego albo zacznij od nowa.</div>
        <button class="btn" onclick="setView('session')">Wróć do treningu</button>
      </div>`;
  }

  const cards = DATA.plans.map(p => `
    <div class="card plan-card" onclick="confirmStart('${p.id}')">
      <div class="plan-badge">${esc(p.name)}</div>
      <div class="meta">
        <div class="name">Plan ${esc(p.name)}</div>
        <div class="sub">${p.subtitle ? esc(p.subtitle) + ' • ' : ''}${p.exercises.length} ćwiczeń</div>
      </div>
      <div class="chev">›</div>
    </div>
  `).join('');

  return `
    <h2>Wybierz dzień treningowy</h2>
    ${cards || '<div class="empty-state">Brak planów. Dodaj dzień w zakładce Edycja.</div>'}
  `;
}

function confirmStart(planId) {
  startSession(planId);
}

// ============================================================
// SESJA TRENINGOWA
// ============================================================

function startSession(planId) {
  const plan = findPlan(planId);
  if (!plan) return;
  const entries = {};
  plan.exercises.forEach(e => {
    entries[e.id] = e.sets.map(target => ({ reps: '', kg: '', done: false }));
  });
  DATA.activeSession = {
    planId,
    date: new Date().toISOString(),
    started: false,
    startedAt: null,
    warmupDone: plan.warmup.map(() => false),
    entries,
    notes: '',
    kcal: ''
  };
  saveData(DATA);
  setView('session');
}

function beginWorkoutTimer() {
  const s = DATA.activeSession;
  if (!s || s.started) return;
  s.started = true;
  s.startedAt = Date.now();
  saveData(DATA);
  render();
}

function sessionTitle() {
  const plan = findPlan(DATA.activeSession ? DATA.activeSession.planId : null);
  return plan ? 'Trening ' + plan.name : 'Trening';
}

function getLastCompletedEntry(exId, beforeDate) {
  const sessions = DATA.sessions
    .filter(s => s.entries && s.entries[exId])
    .filter(s => !beforeDate || new Date(s.date) < new Date(beforeDate))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const s of sessions) {
    const arr = s.entries[exId];
    if (arr && arr.some(x => x.kg !== '' && x.kg != null)) {
      return { date: s.date, sets: arr };
    }
  }
  return null;
}

function renderSession() {
  const s = DATA.activeSession;
  if (!s) return '<div class="empty-state">Brak aktywnego treningu.</div>';
  const plan = findPlan(s.planId);
  if (!plan) return '<div class="empty-state">Nie znaleziono planu.</div>';

  const elapsed = s.started ? Math.max(0, Date.now() - s.startedAt) : 0;
  const mm = Math.floor(elapsed / 60000);
  const ss = Math.floor((elapsed % 60000) / 1000);

  const warmupHtml = plan.warmup.map((w, i) => `
    <div class="warmup-item">
      <div class="checkbox ${s.warmupDone[i] ? 'checked' : ''}" onclick="toggleWarmup(${i})">${s.warmupDone[i] ? '✓' : ''}</div>
      <div class="wu-name">${esc(w.name)}</div>
      <div class="wu-target">${esc(w.target)}</div>
    </div>
  `).join('');

  const exercisesHtml = plan.exercises.map(e => {
    const entry = s.entries[e.id] || [];
    const allDone = entry.length > 0 && entry.every(x => x.done);
    const last = getLastCompletedEntry(e.id, s.date);
    const lastText = last
      ? `Ostatnio (${fmtDate(last.date).full}): ` + last.sets.map(x => (x.reps || '?') + '×' + (x.kg || '?') + 'kg').join(', ')
      : 'Brak wcześniejszych wyników';

    const rows = e.sets.map((target, i) => {
      const lastKg = last && last.sets[i] && last.sets[i].kg !== '' ? last.sets[i].kg : null;
      return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <div class="set-suggest">${target}</div>
          <input class="num-input" type="number" inputmode="numeric" placeholder="wpisz" value="${entry[i] && entry[i].reps !== '' ? entry[i].reps : ''}" onchange="updateSetField('${e.id}',${i},'reps',this.value)">
        </td>
        <td>
          <div class="set-suggest">${lastKg != null ? esc(lastKg) + ' kg' : '—'}</div>
          <input class="num-input" type="number" inputmode="decimal" step="0.5" placeholder="kg" value="${entry[i] && entry[i].kg !== '' ? entry[i].kg : ''}" onchange="updateSetField('${e.id}',${i},'kg',this.value)">
        </td>
      </tr>
    `;
    }).join('');

    return `
      <div class="card exercise-card">
        <div class="exercise-head">
          <span class="group-tag" style="background:${e.color}">${esc(e.group)}</span>
          <div class="ex-name">${esc(e.name)}</div>
          <div class="ex-check ${allDone ? 'done' : ''}" onclick="toggleExerciseDone('${e.id}')">${allDone ? '✓' : ''}</div>
        </div>
        <div class="last-time">${esc(lastText)}</div>
        <table class="sets-table">
          <tr><th>#</th><th>Powt. cel / wykonano</th><th>Kg poprz. / dziś</th></tr>
          ${rows}
        </table>
      </div>
    `;
  }).join('');

  return `
    ${!s.started ? `<button class="btn" style="margin-bottom:14px;" onclick="beginWorkoutTimer()">▶ Zacznij trening</button>` : ''}
    <div class="session-stats">
      <div class="stat-box"><div class="v" id="session-timer">${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</div><div class="l">${s.started ? 'Czas' : 'Czas (nie wystartował)'}</div></div>
      <div class="stat-box"><div class="v">${plan.exercises.filter(e => (s.entries[e.id]||[]).every(x=>x.done)).length}/${plan.exercises.length}</div><div class="l">Ćwiczenia</div></div>
    </div>

    <h2>Rozgrzewka <span style="color:var(--text-dim);font-weight:400;font-size:12px;">(przerwy ${esc(plan.warmupRest || '')})</span></h2>
    <div class="card" style="padding:4px 12px;">${warmupHtml}</div>

    <h2>Ćwiczenia <span style="color:var(--text-dim);font-weight:400;font-size:12px;">(przerwy ${esc(plan.restBetweenSets || '')})</span></h2>
    ${exercisesHtml}

    <h2>Notatki</h2>
    <div class="card">
      <textarea placeholder="Jak poszło, samopoczucie, uwagi..." onchange="updateSessionField('notes', this.value)">${esc(s.notes)}</textarea>
      <label class="field-label">Spalone kcal</label>
      <input type="number" inputmode="numeric" placeholder="np. 350" value="${esc(s.kcal)}" onchange="updateSessionField('kcal', this.value)">
    </div>

    <button class="btn" style="margin-top:6px;" onclick="finishSession()">Zakończ trening</button>
    <button class="btn ghost" style="margin-top:10px;" onclick="cancelSession()">Anuluj trening (bez zapisu)</button>
  `;
}

function startTimerIfNeeded() {
  if (VIEW.screen !== 'session' || !DATA.activeSession || !DATA.activeSession.started) return;
  timerInterval = setInterval(() => {
    const el = document.getElementById('session-timer');
    if (!el || !DATA.activeSession) { clearInterval(timerInterval); return; }
    const elapsed = Math.max(0, Date.now() - DATA.activeSession.startedAt);
    const mm = Math.floor(elapsed / 60000);
    const ss = Math.floor((elapsed % 60000) / 1000);
    el.textContent = String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
  }, 1000);
}

function toggleWarmup(i) {
  const s = DATA.activeSession;
  s.warmupDone[i] = !s.warmupDone[i];
  saveData(DATA);
  render();
}

function toggleExerciseDone(exId) {
  const s = DATA.activeSession;
  const entry = s.entries[exId];
  const allDone = entry.every(x => x.done);
  entry.forEach(x => { x.done = !allDone; });
  saveData(DATA);
  render();
}

function updateSetField(exId, i, field, value) {
  const s = DATA.activeSession;
  const entry = s.entries[exId];
  entry[i][field] = value;
  if (value !== '' && entry[i].reps !== '') entry[i].done = true;
  saveData(DATA);
}

function updateSessionField(field, value) {
  DATA.activeSession[field] = value;
  saveData(DATA);
}

function cancelSession() {
  confirmDialog('Anulować trening bez zapisywania?', () => {
    DATA.activeSession = null;
    saveData(DATA);
    setView('home');
  });
}

function finishSession() {
  const s = DATA.activeSession;
  const plan = findPlan(s.planId);
  const durationMin = s.started ? Math.max(1, Math.round((Date.now() - s.startedAt) / 60000)) : 0;
  const record = {
    id: uid('sess'),
    planId: s.planId,
    planName: plan ? plan.name : '?',
    date: s.date,
    durationMin,
    kcal: s.kcal,
    notes: s.notes,
    warmupDone: s.warmupDone,
    entries: s.entries
  };
  DATA.sessions.push(record);
  DATA.activeSession = null;
  saveData(DATA);
  toast('Trening zapisany 💪');
  setView('historyDetail', { sessionId: record.id });
}

// ============================================================
// HISTORIA
// ============================================================

function renderHistory() {
  const sessions = [...DATA.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const list = sessions.map(s => {
    const d = fmtDate(s.date);
    return `
      <div class="card history-item" onclick="setView('historyDetail',{sessionId:'${s.id}'})">
        <div class="date-badge"><div class="d">${d.day}</div><div class="m">${d.month}</div></div>
        <div class="meta">
          <div class="name">Trening ${esc(s.planName)}</div>
          <div class="sub">${s.durationMin} min${s.kcal ? ' • ' + esc(s.kcal) + ' kcal' : ''}</div>
        </div>
        <div class="chev">›</div>
      </div>
    `;
  }).join('');

  return `
    <button class="btn secondary" onclick="setView('progressPick')">📈 Postępy w ćwiczeniach</button>
    <h2 style="margin-top:18px;">Zapisane treningi</h2>
    ${list || '<div class="empty-state">Nie masz jeszcze żadnych zapisanych treningów.</div>'}
  `;
}

function renderHistoryDetail() {
  const s = DATA.sessions.find(x => x.id === VIEW.sessionId);
  if (!s) return '<div class="empty-state">Nie znaleziono treningu.</div>';
  const plan = findPlan(s.planId);
  const d = fmtDate(s.date);

  const exercisesHtml = (plan ? plan.exercises : []).map(e => {
    const entry = s.entries[e.id];
    if (!entry) return '';
    const rows = entry.map((x, i) => `
      <tr><td>${i+1}</td><td>${esc(x.reps || '—')}</td><td>${esc(x.kg || '—')}</td></tr>
    `).join('');
    return `
      <div class="card exercise-card">
        <div class="exercise-head">
          <span class="group-tag" style="background:${e.color}">${esc(e.group)}</span>
          <div class="ex-name">${esc(e.name)}</div>
        </div>
        <table class="sets-table">
          <tr><th>#</th><th>Powt.</th><th>Kg</th></tr>
          ${rows}
        </table>
      </div>
    `;
  }).join('');

  return `
    <div class="session-stats">
      <div class="stat-box"><div class="v">${d.full}</div><div class="l">Data</div></div>
      <div class="stat-box"><div class="v">${s.durationMin} min</div><div class="l">Czas trwania</div></div>
      <div class="stat-box"><div class="v">${esc(s.kcal || '—')}</div><div class="l">Kcal</div></div>
    </div>
    <h2>Trening ${esc(s.planName)}</h2>
    ${exercisesHtml}
    ${s.notes ? `<h2>Notatki</h2><div class="card">${esc(s.notes)}</div>` : ''}
    <button class="btn danger" style="margin-top:10px;" onclick="deleteSession('${s.id}')">Usuń ten wpis</button>
  `;
}

function deleteSession(id) {
  confirmDialog('Usunąć ten zapisany trening?', () => {
    DATA.sessions = DATA.sessions.filter(s => s.id !== id);
    saveData(DATA);
    setView('history');
  });
}

// ---------- Postępy ----------

function renderProgressPick() {
  const groups = DATA.plans.map(plan => {
    const items = plan.exercises.map(e => `
      <div class="day-edit-row" style="cursor:pointer;" onclick="setView('progressExercise',{planId:'${plan.id}',exId:'${e.id}'})">
        <span class="group-tag" style="background:${e.color}">${esc(e.group)}</span>
        <div class="info"><div class="n">${esc(e.name)}</div></div>
        <div class="chev">›</div>
      </div>
    `).join('');
    return `<h2>Plan ${esc(plan.name)}</h2><div class="card" style="padding:4px 12px;">${items}</div>`;
  }).join('');
  return groups || '<div class="empty-state">Brak ćwiczeń w planach.</div>';
}

function renderProgressExercise() {
  const e = findExercise(VIEW.planId, VIEW.exId);
  if (!e) return '<div class="empty-state">Nie znaleziono ćwiczenia.</div>';

  const points = DATA.sessions
    .filter(s => s.entries && s.entries[e.id])
    .map(s => {
      const arr = s.entries[e.id];
      const kgVals = arr.map(x => parseFloat(x.kg)).filter(v => !isNaN(v));
      const maxKg = kgVals.length ? Math.max(...kgVals) : null;
      return { date: s.date, sets: arr, maxKg };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const withWeight = points.filter(p => p.maxKg != null);
  let sparkline = '';
  if (withWeight.length >= 2) {
    const w = 300, h = 70, pad = 8;
    const vals = withWeight.map(p => p.maxKg);
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = (max - min) || 1;
    const stepX = (w - pad * 2) / (withWeight.length - 1);
    const pts = withWeight.map((p, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((p.maxKg - min) / range) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    sparkline = `
      <div class="spark-wrap">
        <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
          <polyline points="${pts}" fill="none" stroke="${e.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>
      </div>`;
  }

  const rowsHtml = [...points].reverse().map(p => {
    const d = fmtDate(p.date);
    const setsStr = p.sets.map(x => (x.kg || '—')).join(' / ');
    return `<tr><td>${d.full}</td><td>${esc(setsStr)}</td></tr>`;
  }).join('');

  return `
    <h2>${esc(e.name)}</h2>
    <div class="card">
      <span class="group-tag" style="background:${e.color}">${esc(e.group)}</span>
      ${sparkline || '<div class="section-note">Potrzeba co najmniej 2 zapisanych treningów z wagą, żeby pokazać wykres.</div>'}
      <table class="progress-table">
        <tr><th>Data</th><th>Kg (serie)</th></tr>
        ${rowsHtml || '<tr><td colspan="2" style="color:var(--text-dim);padding:14px;">Brak historii</td></tr>'}
      </table>
    </div>
  `;
}

// ============================================================
// EDYCJA PLANU
// ============================================================

function renderEditList() {
  const rows = DATA.plans.map((p, idx) => `
    <div class="day-edit-row">
      <div class="info" style="cursor:pointer;" onclick="setView('editDay',{planId:'${p.id}'})">
        <div class="n">Plan ${esc(p.name)}</div>
        <div class="section-note" style="margin:2px 0 0;">${p.exercises.length} ćwiczeń${p.subtitle ? ' • ' + esc(p.subtitle) : ''}</div>
      </div>
      <div class="actions">
        <button class="icon-btn" title="Duplikuj" onclick="duplicateDay('${p.id}')">⧉</button>
        <button class="icon-btn" title="Przesuń w górę" ${idx===0?'disabled':''} onclick="moveDay('${p.id}',-1)">↑</button>
        <button class="icon-btn" title="Przesuń w dół" ${idx===DATA.plans.length-1?'disabled':''} onclick="moveDay('${p.id}',1)">↓</button>
        <button class="icon-btn danger" title="Usuń" onclick="deleteDay('${p.id}')">✕</button>
      </div>
    </div>
  `).join('');

  return `
    <h2>Dni treningowe</h2>
    <div class="card" style="padding:4px 12px;">${rows || '<div class="empty-state">Brak dni.</div>'}</div>
    <div class="fab-add" onclick="addDay()">＋ Dodaj dzień treningowy</div>

    <h2>Kopia zapasowa</h2>
    <div class="row">
      <button class="btn secondary" onclick="showExport()">Eksportuj dane</button>
      <button class="btn secondary" onclick="showImport()">Importuj dane</button>
    </div>
    <div class="section-note">Wszystkie dane (plany, historia) trzymane są tylko na tym urządzeniu. Eksport przyda się jako kopia zapasowa przed zmianą telefonu.</div>
  `;
}

function addDay() {
  const id = uid('day');
  DATA.plans.push({
    id, name: 'Nowy', subtitle: '', restBetweenSets: '60s - 90s', warmupRest: '30s - 45s',
    warmup: DEFAULT_WARMUP.map(w => ({ ...w })), exercises: []
  });
  saveData(DATA);
  setView('editDay', { planId: id });
}

function duplicateDay(planId) {
  const p = findPlan(planId);
  if (!p) return;
  const copy = deepClone(p);
  copy.id = uid('day');
  copy.name = p.name + ' (kopia)';
  copy.exercises.forEach(e => e.id = uid('ex'));
  const idx = DATA.plans.findIndex(x => x.id === planId);
  DATA.plans.splice(idx + 1, 0, copy);
  saveData(DATA);
  render();
  toast('Zduplikowano dzień');
}

function moveDay(planId, dir) {
  const idx = DATA.plans.findIndex(p => p.id === planId);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= DATA.plans.length) return;
  const [item] = DATA.plans.splice(idx, 1);
  DATA.plans.splice(newIdx, 0, item);
  saveData(DATA);
  render();
}

function deleteDay(planId) {
  confirmDialog('Usunąć ten dzień treningowy razem z jego ćwiczeniami?', () => {
    DATA.plans = DATA.plans.filter(p => p.id !== planId);
    saveData(DATA);
    render();
  });
}

// ---------- Edycja jednego dnia ----------

function renderEditDay() {
  const p = findPlan(VIEW.planId);
  if (!p) return '<div class="empty-state">Nie znaleziono dnia.</div>';

  const warmupRows = p.warmup.map((w, i) => `
    <div class="day-edit-row">
      <div class="info"><div class="n">${esc(w.name)}</div><div class="section-note" style="margin:2px 0 0;">${esc(w.target)}</div></div>
      <div class="actions">
        <button class="icon-btn" onclick="editWarmupItem('${p.id}',${i})">✎</button>
        <button class="icon-btn danger" onclick="deleteWarmupItem('${p.id}',${i})">✕</button>
      </div>
    </div>
  `).join('');

  const exRows = p.exercises.map((e, idx) => `
    <div class="day-edit-row">
      <span class="group-tag" style="background:${e.color}">${esc(e.group)}</span>
      <div class="info">
        <div class="n">${esc(e.name)}</div>
        <div class="section-note" style="margin:2px 0 0;">${e.sets.length} serie × ${e.sets.join('/')} powt.</div>
      </div>
      <div class="actions">
        <button class="icon-btn" ${idx===0?'disabled':''} onclick="moveExercise('${p.id}','${e.id}',-1)">↑</button>
        <button class="icon-btn" ${idx===p.exercises.length-1?'disabled':''} onclick="moveExercise('${p.id}','${e.id}',1)">↓</button>
        <button class="icon-btn" onclick="editExercise('${p.id}','${e.id}')">✎</button>
        <button class="icon-btn danger" onclick="deleteExercise('${p.id}','${e.id}')">✕</button>
      </div>
    </div>
  `).join('');

  return `
    <h2>Nazwa dnia</h2>
    <div class="card">
      <label class="field-label">Nazwa (np. A, Nogi, Push...)</label>
      <input type="text" value="${esc(p.name)}" onchange="updateDayField('${p.id}','name',this.value)">
      <label class="field-label">Podtytuł (opcjonalnie)</label>
      <input type="text" value="${esc(p.subtitle)}" placeholder="np. alternatywa w domu" onchange="updateDayField('${p.id}','subtitle',this.value)">
      <label class="field-label">Przerwa między seriami</label>
      <input type="text" value="${esc(p.restBetweenSets)}" onchange="updateDayField('${p.id}','restBetweenSets',this.value)">
    </div>

    <h2>Rozgrzewka</h2>
    <div class="card" style="padding:4px 12px;">${warmupRows || '<div class="empty-state">Brak</div>'}</div>
    <div class="fab-add" onclick="editWarmupItem('${p.id}', -1)">＋ Dodaj element rozgrzewki</div>

    <h2>Ćwiczenia</h2>
    <div class="card" style="padding:4px 12px;">${exRows || '<div class="empty-state">Brak ćwiczeń</div>'}</div>
    <div class="fab-add" onclick="editExercise('${p.id}', null)">＋ Dodaj ćwiczenie</div>
  `;
}

function updateDayField(planId, field, value) {
  const p = findPlan(planId);
  p[field] = value;
  saveData(DATA);
}

function editWarmupItem(planId, index) {
  const p = findPlan(planId);
  const isNew = index === -1;
  const item = isNew ? { name: '', target: '' } : p.warmup[index];
  openModal(`
    <h3>${isNew ? 'Nowy element rozgrzewki' : 'Edytuj element rozgrzewki'}</h3>
    <label class="field-label">Nazwa</label>
    <input type="text" id="wu-name" value="${esc(item.name)}" placeholder="np. Kręcenie biodrami">
    <label class="field-label">Cel (czas / powtórzenia)</label>
    <input type="text" id="wu-target" value="${esc(item.target)}" placeholder="np. 1 x 25 albo 60s - 90s">
    <button class="btn" style="margin-top:16px;" id="wu-save-btn">Zapisz</button>
  `);
  document.getElementById('wu-save-btn').addEventListener('click', () => {
    const name = document.getElementById('wu-name').value.trim();
    const target = document.getElementById('wu-target').value.trim();
    if (!name) { toast('Podaj nazwę'); return; }
    if (isNew) p.warmup.push({ name, target });
    else { p.warmup[index].name = name; p.warmup[index].target = target; }
    saveData(DATA);
    closeModal();
    render();
  });
}

function deleteWarmupItem(planId, index) {
  const p = findPlan(planId);
  p.warmup.splice(index, 1);
  saveData(DATA);
  render();
}

function moveExercise(planId, exId, dir) {
  const p = findPlan(planId);
  const idx = p.exercises.findIndex(e => e.id === exId);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= p.exercises.length) return;
  const [item] = p.exercises.splice(idx, 1);
  p.exercises.splice(newIdx, 0, item);
  saveData(DATA);
  render();
}

function deleteExercise(planId, exId) {
  confirmDialog('Usunąć to ćwiczenie z planu?', () => {
    const p = findPlan(planId);
    p.exercises = p.exercises.filter(e => e.id !== exId);
    saveData(DATA);
    render();
  });
}

function editExercise(planId, exId) {
  const p = findPlan(planId);
  const isNew = !exId;
  const e = isNew
    ? { id: uid('ex'), group: 'NOGI', color: GROUP_COLORS['NOGI'], name: '', sets: [12, 12, 12] }
    : p.exercises.find(x => x.id === exId);

  const groupOptions = Object.keys(GROUP_COLORS).map(g =>
    `<option value="${g}" ${g === e.group ? 'selected' : ''}>${g}</option>`
  ).join('');

  openModal(`
    <h3>${isNew ? 'Nowe ćwiczenie' : 'Edytuj ćwiczenie'}</h3>
    <label class="field-label">Nazwa ćwiczenia</label>
    <input type="text" id="ex-name" value="${esc(e.name)}" placeholder="np. Wyciskanie hantli na ławce">
    <label class="field-label">Grupa mięśniowa</label>
    <select id="ex-group" style="width:100%;background:var(--card-2);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;">
      ${groupOptions}
    </select>
    <label class="field-label">Serie i docelowe powtórzenia (oddziel przecinkami)</label>
    <input type="text" id="ex-sets" value="${e.sets.join(',')}" placeholder="np. 12,12,12">
    <button class="btn" style="margin-top:16px;" id="ex-save-btn">Zapisz</button>
  `);

  document.getElementById('ex-save-btn').addEventListener('click', () => {
    const name = document.getElementById('ex-name').value.trim();
    const group = document.getElementById('ex-group').value;
    const setsRaw = document.getElementById('ex-sets').value;
    const sets = setsRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    if (!name) { toast('Podaj nazwę ćwiczenia'); return; }
    if (!sets.length) { toast('Podaj przynajmniej jedną serię'); return; }

    if (isNew) {
      p.exercises.push({ id: e.id, group, color: GROUP_COLORS[group], name, sets });
    } else {
      e.name = name; e.group = group; e.color = GROUP_COLORS[group]; e.sets = sets;
    }
    saveData(DATA);
    closeModal();
    render();
  });
}

// ---------- Eksport / Import ----------

function showExport() {
  const json = JSON.stringify(DATA, null, 2);
  openModal(`
    <h3>Eksport danych</h3>
    <div class="section-note">Zaznacz cały tekst i skopiuj go w bezpieczne miejsce (np. notatki, e-mail do siebie).</div>
    <textarea id="export-area" style="min-height:220px;font-size:11px;" readonly>${esc(json)}</textarea>
    <button class="btn secondary" style="margin-top:10px;" onclick="document.getElementById('export-area').select();document.execCommand('copy');toast('Skopiowano')">Kopiuj</button>
  `);
}

function showImport() {
  openModal(`
    <h3>Import danych</h3>
    <div class="section-note">Wklej wcześniej wyeksportowany tekst. To nadpisze obecne dane w appce.</div>
    <textarea id="import-area" style="min-height:220px;font-size:11px;" placeholder="Wklej tutaj..."></textarea>
    <button class="btn" style="margin-top:10px;" id="import-btn">Importuj i nadpisz</button>
  `);
  document.getElementById('import-btn').addEventListener('click', () => {
    const raw = document.getElementById('import-area').value;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.plans)) throw new Error('bad shape');
      DATA = parsed;
      if (!Array.isArray(DATA.sessions)) DATA.sessions = [];
      saveData(DATA);
      closeModal();
      setView('home');
      toast('Zaimportowano dane');
    } catch (err) {
      toast('Nieprawidłowy format danych');
    }
  });
}

// ============================================================
// START
// ============================================================

render();

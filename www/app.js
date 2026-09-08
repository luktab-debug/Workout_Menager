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

// ---------- Tłumaczenia (PL / EN) ----------
function t(key, vars) {
  const lang = (DATA && DATA.lang) || 'pl';
  let text = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.pl[key] || key;
  if (vars) {
    Object.keys(vars).forEach(k => { text = text.replace('{' + k + '}', vars[k]); });
  }
  return text;
}

function groupLabel(code) {
  const lang = (DATA && DATA.lang) || 'pl';
  return (GROUP_LABELS[lang] && GROUP_LABELS[lang][code]) || code;
}

function toggleLang() {
  DATA.lang = DATA.lang === 'en' ? 'pl' : 'en';
  saveData(DATA);
  render();
}

function fmtDate(iso) {
  const d = new Date(iso);
  const lang = (DATA && DATA.lang) || 'pl';
  const months = MONTHS[lang] || MONTHS.pl;
  return { day: d.getDate(), month: months[d.getMonth()], full: d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'pl-PL') };
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
      <button class="btn secondary" onclick="closeModal()">${t('confirm_cancel')}</button>
      <button class="btn danger" id="confirm-yes-btn">${t('confirm_yes_delete')}</button>
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
  document.querySelector('[data-nav="home"]').textContent = t('nav_trening');
  document.querySelector('[data-nav="history"]').textContent = t('nav_historia');
  document.querySelector('[data-nav="edit"]').textContent = t('nav_edycja');
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.textContent = DATA.lang === 'en' ? 'PL' : 'EN';

  let title = t('title_trening');
  let showBack = false;

  switch (VIEW.screen) {
    case 'home': title = t('title_trening'); screenEl.innerHTML = renderHome(); break;
    case 'session': title = sessionTitle(); showBack = true; screenEl.innerHTML = renderSession(); startTimerIfNeeded(); break;
    case 'history': title = t('title_historia'); screenEl.innerHTML = renderHistory(); break;
    case 'historyDetail': title = t('title_podsumowanie'); showBack = true; screenEl.innerHTML = renderHistoryDetail(); break;
    case 'progressPick': title = t('title_postepy'); showBack = true; screenEl.innerHTML = renderProgressPick(); break;
    case 'progressExercise': title = t('title_postepy'); showBack = true; screenEl.innerHTML = renderProgressExercise(); break;
    case 'edit': title = t('title_edycja'); screenEl.innerHTML = renderEditList(); break;
    case 'editDay': title = t('title_edycja_dnia'); showBack = true; screenEl.innerHTML = renderEditDay(); break;
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
        <div style="font-weight:700;margin-bottom:6px;">${t('home_active_title')}</div>
        <div class="section-note" style="margin:0 0 10px;">${esc(t('home_active_sub', { name: plan ? plan.name : '?' }))}</div>
        <button class="btn" onclick="setView('session')">${t('home_active_btn')}</button>
      </div>`;
  }

  const cards = DATA.plans.map(p => `
    <div class="card plan-card" onclick="confirmStart('${p.id}')">
      <div class="plan-badge">${esc(p.name)}</div>
      <div class="meta">
        <div class="name">${t('plan_prefix')} ${esc(p.name)}</div>
        <div class="sub">${p.subtitle ? esc(p.subtitle) + ' • ' : ''}${t('plan_ex_count', { n: p.exercises.length })}</div>
      </div>
      <div class="chev">›</div>
    </div>
  `).join('');

  return `
    <h2>${t('home_choose_day')}</h2>
    ${cards || `<div class="empty-state">${t('home_no_plans')}</div>`}
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
    kcal: '',
    warmupTimer: { seconds: 60, endAt: null },
    exerciseTimer: { seconds: 60, endAt: null }
  };
  saveData(DATA);
  setView('session');
}

// ---------- Stopery przerw (rozgrzewka / między ćwiczeniami) ----------

function mmss(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

function restOptionsHtml(selected) {
  let html = '';
  for (let sec = 15; sec <= 300; sec += 15) {
    html += `<option value="${sec}" ${sec === selected ? 'selected' : ''}>${mmss(sec)}</option>`;
  }
  return html;
}

function isWarmupAllDone(s) {
  return s.warmupDone.length > 0 && s.warmupDone.every(Boolean);
}

// ---------- Dźwięk + wibracja po zakończeniu przerwy ----------
let audioCtx = null;
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* Web Audio niedostępne — ignorujemy */ }
}

function playBeep() {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime;
    [0, 0.28, 0.56].forEach(offset => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.24);
    });
  } catch (e) { /* ignorujemy błędy audio */ }
}

function notifyRestDone() {
  playBeep();
  if (navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200, 100, 200]); } catch (e) { /* ignorujemy */ }
  }
  toast(t('rest_done_toast'));
}

function renderRestTimer(opts) {
  // opts: { id, timer, disabled, label, onSelect, onStart, onStop, disabledNote }
  const running = !!opts.timer.endAt;
  const remaining = running ? Math.max(0, Math.round((opts.timer.endAt - Date.now()) / 1000)) : opts.timer.seconds;
  return `
    <div class="card rest-timer-card ${opts.disabled ? 'disabled' : ''}">
      <div class="rt-label">${esc(opts.label)}</div>
      <div class="rt-row">
        <select class="rt-select" ${opts.disabled || running ? 'disabled' : ''} onchange="${opts.onSelect}(this.value)">
          ${restOptionsHtml(opts.timer.seconds)}
        </select>
        ${running
          ? `<div class="rt-display" id="${opts.id}">${mmss(remaining)}</div><button class="btn small danger" onclick="${opts.onStop}()">${t('rest_stop_btn')}</button>`
          : `<button class="btn small" ${opts.disabled ? 'disabled' : ''} onclick="${opts.onStart}()">${t('rest_start_btn')}</button>`}
      </div>
      ${opts.disabled && opts.disabledNote ? `<div class="section-note" style="margin:6px 0 0;">${esc(opts.disabledNote)}</div>` : ''}
    </div>
  `;
}

function setWarmupRestSeconds(val) {
  DATA.activeSession.warmupTimer.seconds = parseInt(val, 10);
  saveData(DATA);
}

function startWarmupRest() {
  const s = DATA.activeSession;
  if (isWarmupAllDone(s)) return;
  unlockAudio();
  s.warmupTimer.endAt = Date.now() + s.warmupTimer.seconds * 1000;
  saveData(DATA);
  render();
}

function stopWarmupRest() {
  DATA.activeSession.warmupTimer.endAt = null;
  saveData(DATA);
  render();
}

function setExerciseRestSeconds(val) {
  DATA.activeSession.exerciseTimer.seconds = parseInt(val, 10);
  saveData(DATA);
}

function startExerciseRest() {
  const s = DATA.activeSession;
  unlockAudio();
  s.exerciseTimer.endAt = Date.now() + s.exerciseTimer.seconds * 1000;
  saveData(DATA);
  render();
}

function stopExerciseRest() {
  DATA.activeSession.exerciseTimer.endAt = null;
  saveData(DATA);
  render();
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
  return plan ? t('title_trening_session', { name: plan.name }) : t('title_trening');
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
  if (!s) return `<div class="empty-state">${t('no_active_session')}</div>`;
  const plan = findPlan(s.planId);
  if (!plan) return `<div class="empty-state">${t('no_plan_found')}</div>`;
  if (!s.warmupTimer) s.warmupTimer = { seconds: 60, endAt: null };
  if (!s.exerciseTimer) s.exerciseTimer = { seconds: 60, endAt: null };

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

  const warmupAllDone = isWarmupAllDone(s);
  const warmupTimerHtml = renderRestTimer({
    id: 'warmup-rest-display',
    timer: s.warmupTimer,
    disabled: warmupAllDone,
    label: t('warmup_rest_label'),
    onSelect: 'setWarmupRestSeconds',
    onStart: 'startWarmupRest',
    onStop: 'stopWarmupRest',
    disabledNote: t('warmup_rest_disabled_note')
  });

  const doneFlags = plan.exercises.map(e => {
    const en = s.entries[e.id] || [];
    return en.length > 0 && en.every(x => x.done);
  });
  const lastCompletedIdx = doneFlags.lastIndexOf(true);
  const exerciseTimerHtml = renderRestTimer({
    id: 'exercise-rest-display',
    timer: s.exerciseTimer,
    disabled: false,
    label: t('exercise_rest_label'),
    onSelect: 'setExerciseRestSeconds',
    onStart: 'startExerciseRest',
    onStop: 'stopExerciseRest'
  });

  const exercisesHtml = plan.exercises.map((e, idx) => {
    const entry = s.entries[e.id] || [];
    const allDone = entry.length > 0 && entry.every(x => x.done);
    const last = getLastCompletedEntry(e.id, s.date);
    const lastText = last
      ? t('last_time_prefix', { date: fmtDate(last.date).full }) + last.sets.map(x => (x.reps || '?') + '×' + (x.kg || '?') + 'kg').join(', ')
      : t('last_time_none');

    const rows = e.sets.map((target, i) => {
      const lastKg = last && last.sets[i] && last.sets[i].kg !== '' ? last.sets[i].kg : null;
      return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <div class="set-suggest">${target}</div>
          <input class="num-input" type="number" inputmode="numeric" placeholder="${esc(t('input_reps_placeholder'))}" value="${entry[i] && entry[i].reps !== '' ? entry[i].reps : ''}" onchange="updateSetField('${e.id}',${i},'reps',this.value)">
        </td>
        <td>
          <div class="set-suggest">${lastKg != null ? esc(lastKg) + ' kg' : '—'}</div>
          <input class="num-input" type="number" inputmode="decimal" step="0.5" placeholder="${esc(t('input_kg_placeholder'))}" value="${entry[i] && entry[i].kg !== '' ? entry[i].kg : ''}" onchange="updateSetField('${e.id}',${i},'kg',this.value)">
        </td>
      </tr>
    `;
    }).join('');

    return `
      <div class="card exercise-card">
        <div class="exercise-head">
          <span class="group-tag" style="background:${e.color}">${esc(groupLabel(e.group))}</span>
          <div class="ex-name">${esc(e.name)}</div>
          <div class="ex-check ${allDone ? 'done' : ''}" onclick="toggleExerciseDone('${e.id}')">${allDone ? '✓' : ''}</div>
        </div>
        <div class="last-time">${esc(lastText)}</div>
        <table class="sets-table">
          <tr><th>#</th><th>${t('table_reps')}</th><th>${t('table_kg')}</th></tr>
          ${rows}
        </table>
      </div>
      ${(warmupAllDone && idx === lastCompletedIdx) ? exerciseTimerHtml : ''}
    `;
  }).join('');

  return `
    ${!s.started ? `<button class="btn" style="margin-bottom:14px;" onclick="beginWorkoutTimer()">${t('session_start_btn')}</button>` : ''}
    <div class="session-stats">
      <div class="stat-box"><div class="v" id="session-timer">${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</div><div class="l">${s.started ? t('stat_time') : t('stat_time_not_started')}</div></div>
      <div class="stat-box"><div class="v">${plan.exercises.filter(e => (s.entries[e.id]||[]).every(x=>x.done)).length}/${plan.exercises.length}</div><div class="l">${t('stat_exercises')}</div></div>
    </div>

    <h2>${t('warmup_header')} <span style="color:var(--text-dim);font-weight:400;font-size:12px;">(${esc(t('rest_label', { x: plan.warmupRest || '' }))})</span></h2>
    <div class="card" style="padding:4px 12px;">${warmupHtml}</div>
    ${warmupTimerHtml}

    <h2>${t('exercises_header')} <span style="color:var(--text-dim);font-weight:400;font-size:12px;">(${esc(t('rest_label', { x: plan.restBetweenSets || '' }))})</span></h2>
    ${exercisesHtml}

    <h2>${t('notes_header')}</h2>
    <div class="card">
      <textarea placeholder="${esc(t('notes_placeholder'))}" onchange="updateSessionField('notes', this.value)">${esc(s.notes)}</textarea>
      <label class="field-label">${t('kcal_label')}</label>
      <input type="number" inputmode="numeric" placeholder="${esc(t('kcal_placeholder'))}" value="${esc(s.kcal)}" onchange="updateSessionField('kcal', this.value)">
    </div>

    <button class="btn" style="margin-top:6px;" onclick="finishSession()">${t('finish_btn')}</button>
    <button class="btn ghost" style="margin-top:10px;" onclick="cancelSession()">${t('cancel_session_btn')}</button>
  `;
}

function startTimerIfNeeded() {
  if (VIEW.screen !== 'session' || !DATA.activeSession) return;
  timerInterval = setInterval(() => {
    const s = DATA.activeSession;
    if (!s) { clearInterval(timerInterval); return; }

    if (s.started) {
      const el = document.getElementById('session-timer');
      if (el) {
        const elapsed = Math.max(0, Date.now() - s.startedAt);
        const mm = Math.floor(elapsed / 60000);
        const ss = Math.floor((elapsed % 60000) / 1000);
        el.textContent = String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
      }
    }

    tickRestTimer(s.warmupTimer, 'warmup-rest-display');
    tickRestTimer(s.exerciseTimer, 'exercise-rest-display');
  }, 1000);
}

function tickRestTimer(timer, elId) {
  if (!timer || !timer.endAt) return;
  const remaining = Math.round((timer.endAt - Date.now()) / 1000);
  if (remaining <= 0) {
    timer.endAt = null;
    saveData(DATA);
    notifyRestDone();
    render();
    return;
  }
  const el = document.getElementById(elId);
  if (el) el.textContent = mmss(remaining);
}

function toggleWarmup(i) {
  const s = DATA.activeSession;
  s.warmupDone[i] = !s.warmupDone[i];
  if (isWarmupAllDone(s) && s.warmupTimer) {
    s.warmupTimer.endAt = null;
  }
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
  confirmDialog(t('cancel_session_confirm'), () => {
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
  toast(t('session_saved_toast'));
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
          <div class="name">${t('title_trening_session', { name: esc(s.planName) })}</div>
          <div class="sub">${s.durationMin} ${t('history_min')}${s.kcal ? ' • ' + esc(s.kcal) + ' kcal' : ''}</div>
        </div>
        <div class="chev">›</div>
      </div>
    `;
  }).join('');

  return `
    <button class="btn secondary" onclick="setView('progressPick')">${t('history_progress_btn')}</button>
    <h2 style="margin-top:18px;">${t('history_saved_header')}</h2>
    ${list || `<div class="empty-state">${t('history_empty')}</div>`}
  `;
}

function renderHistoryDetail() {
  const s = DATA.sessions.find(x => x.id === VIEW.sessionId);
  if (!s) return `<div class="empty-state">${t('no_session_found')}</div>`;
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
          <span class="group-tag" style="background:${e.color}">${esc(groupLabel(e.group))}</span>
          <div class="ex-name">${esc(e.name)}</div>
        </div>
        <table class="sets-table">
          <tr><th>#</th><th>${t('table_reps_short')}</th><th>Kg</th></tr>
          ${rows}
        </table>
      </div>
    `;
  }).join('');

  return `
    <div class="session-stats">
      <div class="stat-box"><div class="v">${d.full}</div><div class="l">${t('detail_data')}</div></div>
      <div class="stat-box"><div class="v">${s.durationMin} ${t('history_min')}</div><div class="l">${t('detail_duration')}</div></div>
      <div class="stat-box"><div class="v">${esc(s.kcal || '—')}</div><div class="l">${t('detail_kcal')}</div></div>
    </div>
    <h2>${t('title_trening_session', { name: esc(s.planName) })}</h2>
    ${exercisesHtml}
    ${s.notes ? `<h2>${t('notes_header')}</h2><div class="card">${esc(s.notes)}</div>` : ''}
    <button class="btn danger" style="margin-top:10px;" onclick="deleteSession('${s.id}')">${t('detail_delete_btn')}</button>
  `;
}

function deleteSession(id) {
  confirmDialog(t('detail_delete_confirm'), () => {
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
        <span class="group-tag" style="background:${e.color}">${esc(groupLabel(e.group))}</span>
        <div class="info"><div class="n">${esc(e.name)}</div></div>
        <div class="chev">›</div>
      </div>
    `).join('');
    return `<h2>${t('plan_prefix')} ${esc(plan.name)}</h2><div class="card" style="padding:4px 12px;">${items}</div>`;
  }).join('');
  return groups || `<div class="empty-state">${t('progress_no_exercises')}</div>`;
}

function renderProgressExercise() {
  const e = findExercise(VIEW.planId, VIEW.exId);
  if (!e) return `<div class="empty-state">${t('no_exercise_found')}</div>`;

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
      <span class="group-tag" style="background:${e.color}">${esc(groupLabel(e.group))}</span>
      ${sparkline || `<div class="section-note">${t('progress_need_two')}</div>`}
      <table class="progress-table">
        <tr><th>${t('progress_table_date')}</th><th>${t('progress_table_kg')}</th></tr>
        ${rowsHtml || `<tr><td colspan="2" style="color:var(--text-dim);padding:14px;">${t('progress_no_history')}</td></tr>`}
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
        <div class="n">${t('plan_prefix')} ${esc(p.name)}</div>
        <div class="section-note" style="margin:2px 0 0;">${t('plan_ex_count', { n: p.exercises.length })}${p.subtitle ? ' • ' + esc(p.subtitle) : ''}</div>
      </div>
      <div class="actions">
        <button class="icon-btn" title="${esc(t('tt_duplicate'))}" onclick="duplicateDay('${p.id}')">⧉</button>
        <button class="icon-btn" title="${esc(t('tt_move_up'))}" ${idx===0?'disabled':''} onclick="moveDay('${p.id}',-1)">↑</button>
        <button class="icon-btn" title="${esc(t('tt_move_down'))}" ${idx===DATA.plans.length-1?'disabled':''} onclick="moveDay('${p.id}',1)">↓</button>
        <button class="icon-btn danger" title="${esc(t('tt_delete'))}" onclick="deleteDay('${p.id}')">✕</button>
      </div>
    </div>
  `).join('');

  return `
    <h2>${t('edit_days_header')}</h2>
    <div class="card" style="padding:4px 12px;">${rows || `<div class="empty-state">${t('edit_no_days')}</div>`}</div>
    <div class="fab-add" onclick="addDay()">${t('edit_add_day')}</div>

    <h2>${t('edit_backup_header')}</h2>
    <div class="row">
      <button class="btn secondary" onclick="showExport()">${t('edit_export_btn')}</button>
      <button class="btn secondary" onclick="showImport()">${t('edit_import_btn')}</button>
    </div>
    <div class="section-note">${t('edit_backup_note')}</div>
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
  copy.name = p.name + t('day_copy_suffix');
  copy.exercises.forEach(e => e.id = uid('ex'));
  const idx = DATA.plans.findIndex(x => x.id === planId);
  DATA.plans.splice(idx + 1, 0, copy);
  saveData(DATA);
  render();
  toast(t('day_duplicated_toast'));
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
  confirmDialog(t('edit_delete_day_confirm'), () => {
    DATA.plans = DATA.plans.filter(p => p.id !== planId);
    saveData(DATA);
    render();
  });
}

// ---------- Edycja jednego dnia ----------

function renderEditDay() {
  const p = findPlan(VIEW.planId);
  if (!p) return `<div class="empty-state">${t('no_day_found')}</div>`;

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
      <span class="group-tag" style="background:${e.color}">${esc(groupLabel(e.group))}</span>
      <div class="info">
        <div class="n">${esc(e.name)}</div>
        <div class="section-note" style="margin:2px 0 0;">${esc(t('day_sets_summary', { n: e.sets.length, sets: e.sets.join('/') }))}</div>
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
    <h2>${t('day_name_header')}</h2>
    <div class="card">
      <label class="field-label">${t('day_name_label')}</label>
      <input type="text" value="${esc(p.name)}" onchange="updateDayField('${p.id}','name',this.value)">
      <label class="field-label">${t('day_subtitle_label')}</label>
      <input type="text" value="${esc(p.subtitle)}" placeholder="${esc(t('day_subtitle_placeholder'))}" onchange="updateDayField('${p.id}','subtitle',this.value)">
      <label class="field-label">${t('day_rest_label')}</label>
      <input type="text" value="${esc(p.restBetweenSets)}" onchange="updateDayField('${p.id}','restBetweenSets',this.value)">
    </div>

    <h2>${t('day_warmup_header')}</h2>
    <div class="card" style="padding:4px 12px;">${warmupRows || `<div class="empty-state">${t('day_warmup_empty')}</div>`}</div>
    <div class="fab-add" onclick="editWarmupItem('${p.id}', -1)">${t('day_add_warmup')}</div>

    <h2>${t('day_exercises_header')}</h2>
    <div class="card" style="padding:4px 12px;">${exRows || `<div class="empty-state">${t('day_exercises_empty')}</div>`}</div>
    <div class="fab-add" onclick="editExercise('${p.id}', null)">${t('day_add_exercise')}</div>
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
    <h3>${isNew ? t('warmup_new_title') : t('warmup_edit_title')}</h3>
    <label class="field-label">${t('warmup_name_label')}</label>
    <input type="text" id="wu-name" value="${esc(item.name)}" placeholder="${esc(t('warmup_name_placeholder'))}">
    <label class="field-label">${t('warmup_target_label')}</label>
    <input type="text" id="wu-target" value="${esc(item.target)}" placeholder="${esc(t('warmup_target_placeholder'))}">
    <button class="btn" style="margin-top:16px;" id="wu-save-btn">${t('save_btn')}</button>
  `);
  document.getElementById('wu-save-btn').addEventListener('click', () => {
    const name = document.getElementById('wu-name').value.trim();
    const target = document.getElementById('wu-target').value.trim();
    if (!name) { toast(t('warmup_name_required')); return; }
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
  confirmDialog(t('day_delete_exercise_confirm'), () => {
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
    `<option value="${g}" ${g === e.group ? 'selected' : ''}>${esc(groupLabel(g))}</option>`
  ).join('');

  openModal(`
    <h3>${isNew ? t('ex_new_title') : t('ex_edit_title')}</h3>
    <label class="field-label">${t('ex_name_label')}</label>
    <input type="text" id="ex-name" value="${esc(e.name)}" placeholder="${esc(t('ex_name_placeholder'))}">
    <label class="field-label">${t('ex_group_label')}</label>
    <select id="ex-group" style="width:100%;background:var(--card-2);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:10px 12px;font-size:14px;">
      ${groupOptions}
    </select>
    <label class="field-label">${t('ex_sets_label')}</label>
    <input type="text" id="ex-sets" value="${e.sets.join(',')}" placeholder="${esc(t('ex_sets_placeholder'))}">
    <button class="btn" style="margin-top:16px;" id="ex-save-btn">${t('save_btn')}</button>
  `);

  document.getElementById('ex-save-btn').addEventListener('click', () => {
    const name = document.getElementById('ex-name').value.trim();
    const group = document.getElementById('ex-group').value;
    const setsRaw = document.getElementById('ex-sets').value;
    const sets = setsRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    if (!name) { toast(t('ex_name_required')); return; }
    if (!sets.length) { toast(t('ex_sets_required')); return; }

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
    <h3>${t('export_title')}</h3>
    <div class="section-note">${t('export_note')}</div>
    <textarea id="export-area" style="min-height:220px;font-size:11px;" readonly>${esc(json)}</textarea>
    <button class="btn secondary" style="margin-top:10px;" onclick="document.getElementById('export-area').select();document.execCommand('copy');toast('${esc(t('copied_toast'))}')">${t('copy_btn')}</button>
  `);
}

function showImport() {
  openModal(`
    <h3>${t('import_title')}</h3>
    <div class="section-note">${t('import_note')}</div>
    <textarea id="import-area" style="min-height:220px;font-size:11px;" placeholder="${esc(t('import_placeholder'))}"></textarea>
    <button class="btn" style="margin-top:10px;" id="import-btn">${t('import_btn')}</button>
  `);
  document.getElementById('import-btn').addEventListener('click', () => {
    const raw = document.getElementById('import-area').value;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.plans)) throw new Error('bad shape');
      const keepLang = DATA.lang;
      DATA = parsed;
      if (!Array.isArray(DATA.sessions)) DATA.sessions = [];
      if (DATA.lang !== 'pl' && DATA.lang !== 'en') DATA.lang = keepLang || 'pl';
      saveData(DATA);
      closeModal();
      setView('home');
      toast(t('import_success'));
    } catch (err) {
      toast(t('import_error'));
    }
  });
}

// ============================================================
// START
// ============================================================

render();

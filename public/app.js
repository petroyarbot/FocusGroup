const tg = window.Telegram?.WebApp;
if (tg) tg.ready();

const qs = new URLSearchParams(window.location.search);
const telegramId = qs.get('tgUserId') || tg?.initDataUnsafe?.user?.id?.toString() || 'demo-user';
const initialName = qs.get('name') || tg?.initDataUnsafe?.user?.first_name || 'Demo User';

let user;
let runningSession = null;
let timerInterval;

const el = {
  userName: document.getElementById('userName'),
  profileBtn: document.getElementById('profileBtn'),
  timer: document.getElementById('timer'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  timerMode: document.getElementById('timerMode'),
  activitySelect: document.getElementById('activitySelect'),
  newActivity: document.getElementById('newActivity'),
  addActivityBtn: document.getElementById('addActivityBtn'),
  roomSelect: document.getElementById('roomSelect'),
  periodSelect: document.getElementById('periodSelect'),
  summary: document.getElementById('summary'),
  timeline: document.getElementById('timeline'),
  kpiToday: document.getElementById('kpiToday'),
  kpiWeek: document.getElementById('kpiWeek'),
  newRoom: document.getElementById('newRoom'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  joinRoomId: document.getElementById('joinRoomId'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  roomsList: document.getElementById('roomsList'),
  leaderboardRoom: document.getElementById('leaderboardRoom'),
  leaderboard: document.getElementById('leaderboard'),
  themeToggle: document.getElementById('themeToggle'),
  navBtns: [...document.querySelectorAll('.nav-btn')],
  panels: [...document.querySelectorAll('.panel')]
};

function formatSec(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return response.json();
}

function switchPanel(name) {
  el.navBtns.forEach((b) => b.classList.toggle('active', b.dataset.target === name));
  el.panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === name));
}

async function loadUser() {
  user = await api('/api/users/upsert', {
    method: 'POST',
    body: JSON.stringify({ telegramId, name: initialName })
  });
  el.userName.textContent = user.name;
}

async function loadActivities() {
  const activities = await api(`/api/activities?userId=${user.id}`);
  if (!activities.length) {
    await api('/api/activities', {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, title: 'Deep Work' })
    });
  }
  const refreshed = await api(`/api/activities?userId=${user.id}`);
  el.activitySelect.innerHTML = refreshed.map((a) => `<option value="${a.id}">${a.title}</option>`).join('');
}

async function loadRunningSession() {
  runningSession = await api(`/api/sessions/running?userId=${user.id}`);
  clearInterval(timerInterval);

  if (!runningSession) {
    el.timer.textContent = '00:00:00';
    el.startBtn.textContent = 'СТАРТ';
    return;
  }

  el.startBtn.textContent = 'ПАУЗА';
  timerInterval = setInterval(() => {
    const sec = Math.round((Date.now() - new Date(runningSession.startedAt).getTime()) / 1000);
    el.timer.textContent = formatSec(sec);
  }, 1000);
}

async function loadSummary() {
  const period = el.periodSelect.value;
  const summary = await api(`/api/stats/summary?userId=${user.id}&period=${period}`);
  el.summary.textContent = `Сессий: ${summary.sessionsCount} • всего: ${formatSec(summary.totalSec)}`;
  const timeline = await api(`/api/stats/timeline?userId=${user.id}&period=${period}`);
  el.timeline.innerHTML = timeline.map((t) => `<li>${t.date}: ${formatSec(t.durationSec)}</li>`).join('');

  const today = await api(`/api/stats/summary?userId=${user.id}&period=today`);
  const week = await api(`/api/stats/summary?userId=${user.id}&period=week`);
  el.kpiToday.textContent = formatSec(today.totalSec);
  el.kpiWeek.textContent = formatSec(week.totalSec);
}

async function loadRooms() {
  const rooms = await api(`/api/rooms?userId=${user.id}`);
  el.roomsList.innerHTML = rooms.map((r) => `<li>${r.name} <small>${r.id}</small></li>`).join('');
  const options = rooms.map((r) => `<option value="${r.id}">${r.name}</option>`).join('');
  el.roomSelect.innerHTML = `<option value="">Личный режим</option>${options}`;
  el.leaderboardRoom.innerHTML = options;
  await loadLeaderboard();
}

async function loadLeaderboard() {
  const roomId = el.leaderboardRoom.value;
  if (!roomId) {
    el.leaderboard.innerHTML = '';
    return;
  }
  const list = await api(`/api/rooms/${roomId}/leaderboard?period=${el.periodSelect.value}`);
  el.leaderboard.innerHTML = list.map((x, i) => `<li>${i + 1}. ${x.name} — ${formatSec(x.durationSec)}</li>`).join('');
}

async function startSession() {
  if (!el.activitySelect.value) return;

  if (el.timerMode.value === 'pomodoro') {
    alert('Pomodoro UI-режим будет расширен в следующей итерации. Сейчас работает секундомер.');
  }

  const response = await api('/api/sessions/start', {
    method: 'POST',
    body: JSON.stringify({ userId: user.id, activityId: el.activitySelect.value, roomId: el.roomSelect.value || null })
  });
  if (response.message) {
    alert(response.message);
    return;
  }
  await loadRunningSession();
}

async function stopSession() {
  if (!runningSession?.id) return;
  await api('/api/sessions/stop', {
    method: 'POST',
    body: JSON.stringify({ sessionId: runningSession.id })
  });
  await loadRunningSession();
  await loadSummary();
  await loadLeaderboard();
}

el.navBtns.forEach((btn) => {
  btn.onclick = () => switchPanel(btn.dataset.target);
});

el.profileBtn.onclick = () => switchPanel('profile');

el.themeToggle.onclick = () => {
  document.documentElement.classList.toggle('light');
};

el.addActivityBtn.onclick = async () => {
  if (!el.newActivity.value) return;
  await api('/api/activities', {
    method: 'POST',
    body: JSON.stringify({ userId: user.id, title: el.newActivity.value })
  });
  el.newActivity.value = '';
  await loadActivities();
};

el.startBtn.onclick = async () => {
  if (runningSession?.id) {
    await stopSession();
    return;
  }
  await startSession();
};

el.stopBtn.onclick = stopSession;
el.periodSelect.onchange = async () => {
  await loadSummary();
  await loadLeaderboard();
};
el.leaderboardRoom.onchange = loadLeaderboard;

el.createRoomBtn.onclick = async () => {
  if (!el.newRoom.value) return;
  await api('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ ownerId: user.id, name: el.newRoom.value })
  });
  el.newRoom.value = '';
  await loadRooms();
};

el.joinRoomBtn.onclick = async () => {
  if (!el.joinRoomId.value) return;
  await api(`/api/rooms/${el.joinRoomId.value}/join`, {
    method: 'POST',
    body: JSON.stringify({ userId: user.id })
  });
  el.joinRoomId.value = '';
  await loadRooms();
};

async function bootstrap() {
  await loadUser();
  await loadActivities();
  await loadRunningSession();
  await loadSummary();
  await loadRooms();
}

bootstrap();

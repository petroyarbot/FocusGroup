import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve('data/store.json');

const defaultState = {
  users: [],
  activities: [],
  rooms: [],
  memberships: [],
  sessions: []
};

function ensureFile() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultState, null, 2));
  }
}

function readState() {
  ensureFile();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw || JSON.stringify(defaultState));
}

function writeState(state) {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

export function upsertUser({ telegramId, name }) {
  const state = readState();
  let user = state.users.find((u) => u.telegramId === telegramId);

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      telegramId,
      name: name || `User ${telegramId}`,
      createdAt: new Date().toISOString()
    };
    state.users.push(user);
  } else if (name && user.name !== name) {
    user.name = name;
    user.updatedAt = new Date().toISOString();
  }

  writeState(state);
  return user;
}

export function listActivities(userId) {
  const state = readState();
  return state.activities.filter((a) => a.userId === userId);
}

export function createActivity({ userId, title, color }) {
  const state = readState();
  const activity = {
    id: crypto.randomUUID(),
    userId,
    title,
    color: color || '#7dd3fc',
    createdAt: new Date().toISOString()
  };
  state.activities.push(activity);
  writeState(state);
  return activity;
}

export function startSession({ userId, activityId, roomId }) {
  const state = readState();

  const alreadyRunning = state.sessions.find((s) => s.userId === userId && !s.endedAt);
  if (alreadyRunning) {
    throw new Error('У вас уже запущен таймер.');
  }

  const session = {
    id: crypto.randomUUID(),
    userId,
    activityId,
    roomId: roomId || null,
    startedAt: new Date().toISOString(),
    endedAt: null,
    durationSec: 0
  };
  state.sessions.push(session);
  writeState(state);
  return session;
}

export function stopSession(sessionId) {
  const state = readState();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error('Сессия не найдена.');
  }
  if (session.endedAt) {
    return session;
  }

  const end = new Date();
  const durationSec = Math.max(0, Math.round((end.getTime() - new Date(session.startedAt).getTime()) / 1000));

  session.endedAt = end.toISOString();
  session.durationSec = durationSec;

  writeState(state);
  return session;
}

export function getRunningSession(userId) {
  const state = readState();
  return state.sessions.find((s) => s.userId === userId && !s.endedAt) || null;
}

function getPeriodStart(period) {
  const now = new Date();
  const d = new Date(now);
  switch (period) {
    case 'today':
      d.setHours(0, 0, 0, 0);
      return d;
    case 'week': {
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case 'year':
      return new Date(d.getFullYear(), 0, 1);
    default:
      return new Date(0);
  }
}

export function getUserSummary(userId, period = 'today') {
  const state = readState();
  const start = getPeriodStart(period);
  const sessions = state.sessions.filter((s) => s.userId === userId && s.endedAt && new Date(s.startedAt) >= start);
  const activityMap = new Map(state.activities.map((a) => [a.id, a]));

  const totalSec = sessions.reduce((acc, s) => acc + s.durationSec, 0);
  const byActivity = sessions.reduce((acc, s) => {
    const activity = activityMap.get(s.activityId);
    const key = activity?.title || 'Без категории';
    acc[key] = (acc[key] || 0) + s.durationSec;
    return acc;
  }, {});

  return {
    period,
    totalSec,
    sessionsCount: sessions.length,
    byActivity
  };
}

export function getUserTimeline(userId, period = 'week') {
  const state = readState();
  const start = getPeriodStart(period);
  const sessions = state.sessions.filter((s) => s.userId === userId && s.endedAt && new Date(s.startedAt) >= start);

  const grouped = {};
  sessions.forEach((s) => {
    const key = s.startedAt.slice(0, 10);
    grouped[key] = (grouped[key] || 0) + s.durationSec;
  });

  return Object.entries(grouped)
    .map(([date, durationSec]) => ({ date, durationSec }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function createRoom({ ownerId, name }) {
  const state = readState();
  const room = {
    id: crypto.randomUUID(),
    name,
    ownerId,
    createdAt: new Date().toISOString()
  };
  state.rooms.push(room);
  state.memberships.push({ roomId: room.id, userId: ownerId, joinedAt: new Date().toISOString() });
  writeState(state);
  return room;
}

export function joinRoom({ roomId, userId }) {
  const state = readState();
  const exists = state.memberships.find((m) => m.roomId === roomId && m.userId === userId);
  if (!exists) {
    state.memberships.push({ roomId, userId, joinedAt: new Date().toISOString() });
    writeState(state);
  }
  return { roomId, userId };
}

export function listUserRooms(userId) {
  const state = readState();
  const roomIds = state.memberships.filter((m) => m.userId === userId).map((m) => m.roomId);
  return state.rooms.filter((r) => roomIds.includes(r.id));
}

export function roomLeaderboard(roomId, period = 'week') {
  const state = readState();
  const start = getPeriodStart(period);
  const memberIds = state.memberships.filter((m) => m.roomId === roomId).map((m) => m.userId);
  const sessions = state.sessions.filter(
    (s) => s.roomId === roomId && s.endedAt && new Date(s.startedAt) >= start && memberIds.includes(s.userId)
  );

  const userMap = new Map(state.users.map((u) => [u.id, u]));
  const score = {};
  sessions.forEach((s) => {
    score[s.userId] = (score[s.userId] || 0) + s.durationSec;
  });

  return Object.entries(score)
    .map(([userId, durationSec]) => ({
      userId,
      name: userMap.get(userId)?.name || 'Unknown',
      durationSec
    }))
    .sort((a, b) => b.durationSec - a.durationSec);
}

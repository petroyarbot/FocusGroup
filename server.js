import http from 'http';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';
import {
  createActivity,
  createRoom,
  getRunningSession,
  getUserSummary,
  getUserTimeline,
  joinRoom,
  listActivities,
  listUserRooms,
  roomLeaderboard,
  startSession,
  stopSession,
  upsertUser
} from './src/store.js';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve('public');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function serveStatic(res, pathname) {
  const filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath)) return false;

  const ext = path.extname(filePath);
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
  };
  res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(filePath));
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/api/')) {
    const method = req.method;
    const q = url.searchParams;
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await parseBody(req) : {};

    try {
      if (method === 'POST' && pathname === '/api/users/upsert') return sendJson(res, 200, upsertUser(body));
      if (method === 'GET' && pathname === '/api/activities') return sendJson(res, 200, listActivities(q.get('userId')));
      if (method === 'POST' && pathname === '/api/activities') return sendJson(res, 200, createActivity(body));
      if (method === 'GET' && pathname === '/api/sessions/running') return sendJson(res, 200, getRunningSession(q.get('userId')));
      if (method === 'POST' && pathname === '/api/sessions/start') return sendJson(res, 200, startSession(body));
      if (method === 'POST' && pathname === '/api/sessions/stop') return sendJson(res, 200, stopSession(body.sessionId));
      if (method === 'GET' && pathname === '/api/stats/summary') {
        return sendJson(res, 200, getUserSummary(q.get('userId'), q.get('period')));
      }
      if (method === 'GET' && pathname === '/api/stats/timeline') {
        return sendJson(res, 200, getUserTimeline(q.get('userId'), q.get('period')));
      }
      if (method === 'POST' && pathname === '/api/rooms') return sendJson(res, 200, createRoom(body));
      if (method === 'GET' && pathname === '/api/rooms') return sendJson(res, 200, listUserRooms(q.get('userId')));

      const joinMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/join$/);
      if (method === 'POST' && joinMatch) return sendJson(res, 200, joinRoom({ roomId: joinMatch[1], userId: body.userId }));

      const leaderboardMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/leaderboard$/);
      if (method === 'GET' && leaderboardMatch) {
        return sendJson(res, 200, roomLeaderboard(leaderboardMatch[1], q.get('period')));
      }

      return sendJson(res, 404, { message: 'Not found' });
    } catch (error) {
      return sendJson(res, 400, { message: error.message });
    }
  }

  if (!serveStatic(res, pathname)) {
    sendJson(res, 404, { message: 'Not found' });
  }
});

server.listen(PORT, () => {
  console.log(`FocusGroup app running on http://localhost:${PORT}`);
});

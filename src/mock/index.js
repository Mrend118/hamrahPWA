import { ApiError, ERROR_KINDS, kindFromStatus } from "../api/errors.js";
import { mockUser, mockSubjects } from "./user.js";
import { mockStudyStats, mockSubjectStats } from "./study-stats.js";
import { mockLeaderboard } from "./leaderboard.js";
import { mockAnnouncements } from "./announcements.js";
import { mockMessages } from "./chat.js";

const LATENCY = [220, 620];
const SESSION_KEY = "hamrah:mock:session";
const CHAT_KEY = "hamrah:mock:chat";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const randomLatency = () =>
  LATENCY[0] + Math.random() * (LATENCY[1] - LATENCY[0]);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}
function writeSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  return session;
}

function accumulate(session, now = Date.now()) {
  if (!session) return 0;
  const base = Number(session.accumulatedSeconds || 0);
  if (session.status !== "running" || !session.lastResumedAt) return base;
  return (
    base + Math.floor((now - new Date(session.lastResumedAt).getTime()) / 1000)
  );
}

function readChat() {
  try {
    const stored = JSON.parse(localStorage.getItem(CHAT_KEY));
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {}
  return [...mockMessages];
}
function writeChat(items) {
  localStorage.setItem(CHAT_KEY, JSON.stringify(items));
  return items;
}

const handlers = {
  "POST /auth/login": ({ body }) => {
    const code = String(body?.code ?? body?.password ?? "").trim();
    if (!code) throw new ApiError(ERROR_KINDS.validation, { status: 422 });
    if (code === "wrong")
      throw new ApiError(ERROR_KINDS.unauthorized, { status: 401 });
    return { token: "mock-token-1234", user: mockUser };
  },

  "POST /auth/logout": () => {
    writeSession(null);
    return { ok: true };
  },

  "GET /auth/me": () => mockUser,
  "GET /profile": () => mockUser,

  "GET /study-stats": () => {
    const session = readSession();
    const live =
      session && session.status !== "saved"
        ? Math.floor(accumulate(session) / 60)
        : 0;
    return {
      ...mockStudyStats,
      todayMinutes: mockStudyStats.todayMinutes + live,
    };
  },

  "GET /subjects": () => mockSubjects,
  "GET /subjects/stats": () => ({ items: mockSubjectStats }),

  "POST /study-sessions/start": ({ body }) => {
    const existing = readSession();
    if (existing && ["running", "paused"].includes(existing.status)) {
      throw new ApiError(ERROR_KINDS.conflict, { status: 409 });
    }
    const now = new Date().toISOString();
    const subject = mockSubjects.find(
      (s) => String(s.id) === String(body?.subjectId),
    );
    return writeSession({
      id: Math.floor(Date.now() / 1000),
      status: "running",
      subjectId: subject?.id ?? null,
      subjectTitle: subject?.title ?? null,
      startedAt: now,
      lastResumedAt: now,
      accumulatedSeconds: 0,
    });
  },

  "POST /study-sessions/pause": () => {
    const session = readSession();
    if (!session) throw new ApiError(ERROR_KINDS.notFound, { status: 404 });
    return writeSession({
      ...session,
      status: "paused",
      accumulatedSeconds: accumulate(session),
      lastResumedAt: null,
      pausedAt: new Date().toISOString(),
    });
  },

  "POST /study-sessions/resume": () => {
    const session = readSession();
    if (!session) throw new ApiError(ERROR_KINDS.notFound, { status: 404 });
    return writeSession({
      ...session,
      status: "running",
      lastResumedAt: new Date().toISOString(),
      pausedAt: null,
    });
  },

  "POST /study-sessions/end": () => {
    const session = readSession();
    if (!session) throw new ApiError(ERROR_KINDS.notFound, { status: 404 });
    return writeSession({
      ...session,
      status: "ended",
      accumulatedSeconds: accumulate(session),
      lastResumedAt: null,
      endedAt: new Date().toISOString(),
    });
  },

  "POST /study-sessions/save": ({ body }) => {
    const session = readSession();
    if (!session) throw new ApiError(ERROR_KINDS.notFound, { status: 404 });
    if (session.status === "saved")
      throw new ApiError(ERROR_KINDS.conflict, { status: 409 });
    const minutes = Math.max(1, Math.round(accumulate(session) / 60));
    const subjectId = body?.subjectId ?? session.subjectId;
    const entry = mockSubjectStats.find(
      (s) => String(s.subjectId) === String(subjectId),
    );
    if (entry) entry.minutes += minutes;
    mockStudyStats.totalMinutes += minutes;
    mockStudyStats.weekMinutes += minutes;
    writeSession(null);
    return { saved: true, minutes, sessionId: session.id };
  },

  "GET /study-sessions/active": () => {
    const session = readSession();
    if (!session || session.status === "saved") return null;
    return session;
  },

  "DELETE /study-sessions/discard": () => {
    writeSession(null);
    return { discarded: true };
  },

  "GET /leaderboard": () => ({
    items: mockLeaderboard.filter((item) => !item.isMe),
    me: mockLeaderboard.find((item) => item.isMe) ?? null,
  }),

  "GET /announcements": () => ({ items: mockAnnouncements }),

  "GET /chat/messages": () => ({ items: readChat() }),

  "POST /chat/messages": ({ body }) => {
    const text = String(body?.text ?? "").trim();
    if (!text) throw new ApiError(ERROR_KINDS.validation, { status: 422 });
    const items = readChat();
    const message = {
      id: Date.now(),
      from: "me",
      text,
      createdAt: new Date().toISOString(),
    };
    writeChat([...items, message]);
    return message;
  },
};

export async function mockRequest(method, endpoint, { body, params } = {}) {
  await wait(randomLatency());

  const fail = typeof window !== "undefined" ? window.__MOCK_FAIL__ : undefined;
  if (fail && (fail === true || fail === endpoint || Number(fail) > 0)) {
    const status = Number(fail) > 0 ? Number(fail) : 500;
    if (status === 0) throw new ApiError(ERROR_KINDS.offline, { endpoint });
    throw new ApiError(kindFromStatus(status), { status, endpoint });
  }

  const key = `${method.toUpperCase()} ${endpoint}`;
  const handler =
    handlers[key] ??
    (key.startsWith("DELETE /study-sessions/")
      ? handlers["DELETE /study-sessions/discard"]
      : null);
  if (!handler) {
    console.warn(`[mock] پاسخ آزمایشی برای «${key}» تعریف نشده است.`);
    throw new ApiError(ERROR_KINDS.notFound, { status: 404, endpoint });
  }

  let data = handler({ body, params });

  if (
    typeof window !== "undefined" &&
    window.__MOCK_EMPTY__ &&
    method === "GET"
  ) {
    data = Array.isArray(data)
      ? []
      : data && typeof data === "object" && "items" in data
        ? { items: [], me: null }
        : null;
  }

  return { data, status: 200, serverTime: Date.now() };
}

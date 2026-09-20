import { createStore } from "./store.js";
import { CONFIG } from "../config.js";
import { networkStore } from "./network.js";
import { handleAuthError } from "./auth.js";
import {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  saveSession,
  getActiveSession,
  readCachedSession,
  cacheActiveSession,
  discardSession,
} from "../api/study-sessions.js";

export const SESSION_STATES = {
  idle: "idle",
  running: "running",
  paused: "paused",
  ended: "ended",
  saved: "saved",
};

export const sessionStore = createStore({
  status: SESSION_STATES.idle,
  session: null,
  elapsedMs: 0,
  subjectId: null,
  loading: true,
  pending: null,
  saving: false,
  syncing: false,
  stale: false,
  error: null,
});

let clockSkew = 0;
let ticker = null;
let syncTimer = null;

const serverNow = () => Date.now() + clockSkew;
export function computeElapsedMs(session, now = serverNow()) {
  if (!session) return 0;
  const base = Number(session.accumulatedSeconds || 0) * 1000;
  if (session.status !== SESSION_STATES.running || !session.lastResumedAt)
    return base;
  const since = now - new Date(session.lastResumedAt).getTime();
  return base + Math.max(0, since);
}

function applySession(session, { stale = false } = {}) {
  if (session?.serverTime) clockSkew = session.serverTime - Date.now();

  sessionStore.set({
    session,
    status: session ? session.status : SESSION_STATES.idle,
    subjectId: session?.subjectId ?? sessionStore.get().subjectId,
    elapsedMs: computeElapsedMs(session),
    stale,
    error: null,
  });

  manageTicker();
  return session;
}

function manageTicker() {
  const { status } = sessionStore.get();
  const shouldTick = status === SESSION_STATES.running;

  if (shouldTick && !ticker) {
    ticker = setInterval(() => {
      const { session } = sessionStore.get();
      sessionStore.set({ elapsedMs: computeElapsedMs(session) });
    }, 1000);
  } else if (!shouldTick && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

export async function restoreActiveSession({ silent = false } = {}) {
  if (!silent) sessionStore.set({ loading: true });
  sessionStore.set({ syncing: true });

  try {
    const session = await getActiveSession();
    applySession(session);
    sessionStore.set({ loading: false, syncing: false });
    return session;
  } catch (error) {
    sessionStore.set({ loading: false, syncing: false });

    if (error?.isAuthError) {
      await handleAuthError();
      return null;
    }

    const cached = readCachedSession();
    if (cached) {
      applySession(cached, { stale: true });
      sessionStore.set({ error: error.userMessage });
      return cached;
    }

    sessionStore.set({
      error: error.userMessage ?? "دریافت اطلاعات با مشکل مواجه شد.",
    });
    return null;
  }
}

function startPeriodicSync() {
  stopPeriodicSync();
  syncTimer = setInterval(() => {
    const { status } = sessionStore.get();
    if (status === SESSION_STATES.running || status === SESSION_STATES.paused) {
      restoreActiveSession({ silent: true });
    }
  }, CONFIG.timerSyncInterval);
}

function stopPeriodicSync() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = null;
}

export function initSessionLifecycle() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const { status } = sessionStore.get();
    if (status !== SESSION_STATES.idle) restoreActiveSession({ silent: true });
  });

  networkStore.subscribe(({ online }) => {
    if (online && sessionStore.get().stale)
      restoreActiveSession({ silent: true });
  });

  startPeriodicSync();
  window.addEventListener("pagehide", () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
    stopPeriodicSync();
  });
}

async function runAction(name, fn) {
  const state = sessionStore.get();
  if (state.pending) return { ok: false, reason: "busy" };

  sessionStore.set({ pending: name, error: null });
  try {
    const result = await fn();
    return { ok: true, result };
  } catch (error) {
    if (error?.isAuthError) {
      await handleAuthError();
      return { ok: false, error };
    }
    sessionStore.set({
      error: error?.userMessage ?? "انجام نشد. دوباره تلاش کنید.",
    });
    return { ok: false, error };
  } finally {
    sessionStore.set({ pending: null });
  }
}

export const selectSubject = (subjectId) => sessionStore.set({ subjectId });

export function start(subjectId) {
  return runAction("start", async () => {
    const session = await startSession(subjectId);
    return applySession(session);
  });
}

export function pause() {
  return runAction("pause", async () => {
    const { session } = sessionStore.get();
    if (!session) return null;
    return applySession(await pauseSession(session.id));
  });
}

export function resume() {
  return runAction("resume", async () => {
    const { session } = sessionStore.get();
    if (!session) return null;
    return applySession(await resumeSession(session.id));
  });
}

export function end() {
  return runAction("end", async () => {
    const { session } = sessionStore.get();
    if (!session) return null;
    return applySession(await endSession(session.id));
  });
}

export function save({ subjectId } = {}) {
  const state = sessionStore.get();
  if (state.saving || !state.session)
    return Promise.resolve({ ok: false, reason: "busy" });

  sessionStore.set({ saving: true });
  return runAction("save", async () => {
    const result = await saveSession({
      sessionId: state.session.id,
      subjectId: subjectId ?? state.subjectId ?? state.session.subjectId,
    });
    cacheActiveSession(null);
    sessionStore.set({
      session: null,
      status: SESSION_STATES.idle,
      elapsedMs: 0,
      stale: false,
    });
    manageTicker();
    return result;
  }).finally(() => sessionStore.set({ saving: false }));
}

export function discard() {
  return runAction("discard", async () => {
    const { session } = sessionStore.get();
    if (session) await discardSession(session.id);
    cacheActiveSession(null);
    sessionStore.set({
      session: null,
      status: SESSION_STATES.idle,
      elapsedMs: 0,
      stale: false,
      error: null,
    });
    manageTicker();
    return true;
  });
}

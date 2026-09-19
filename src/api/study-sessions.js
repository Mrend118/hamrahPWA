import { ENDPOINTS, http } from "./api.js";
import { storage, STORAGE_KEYS } from "../utils/storage.js";

export function normalizeSession(raw, serverTime = Date.now()) {
  if (!raw) return null;
  const s = raw.session ?? raw.data ?? raw;
  if (!s || !s.id) return null;
  return {
    id: s.id,
    status: s.status ?? "running",
    subjectId: s.subjectId ?? s.subject_id ?? null,
    subjectTitle: s.subjectTitle ?? s.subject_title ?? null,
    startedAt: s.startedAt ?? s.started_at ?? null,
    lastResumedAt: s.lastResumedAt ?? s.last_resumed_at ?? null,
    pausedAt: s.pausedAt ?? s.paused_at ?? null,
    endedAt: s.endedAt ?? s.ended_at ?? null,
    accumulatedSeconds: Number(
      s.accumulatedSeconds ?? s.accumulated_seconds ?? 0,
    ),
    serverTime,
  };
}

/** کش موقت نشست فعالع UI در حالت آفلاین */
export function cacheActiveSession(session) {
  if (session)
    storage.set(STORAGE_KEYS.activeSession, {
      ...session,
      cachedAt: Date.now(),
    });
  else storage.remove(STORAGE_KEYS.activeSession);
}

export function readCachedSession() {
  return storage.get(STORAGE_KEYS.activeSession, null);
}

/**
 * API Name: شروع نشست مطالعه
 */
export async function startSession(subjectId) {
  const { data, serverTime } = await http.post(ENDPOINTS.sessionStart, {
    subjectId,
  });
  const session = normalizeSession(data, serverTime);
  cacheActiveSession(session);
  return session;
}

/**
 * API Name: توقف موقت
 */
export async function pauseSession(sessionId) {
  const { data, serverTime } = await http.post(ENDPOINTS.sessionPause, {
    sessionId,
  });
  const session = normalizeSession(data, serverTime);
  cacheActiveSession(session);
  return session;
}

/**
 * API Name: ادامه
 */
export async function resumeSession(sessionId) {
  const { data, serverTime } = await http.post(ENDPOINTS.sessionResume, {
    sessionId,
  });
  const session = normalizeSession(data, serverTime);
  cacheActiveSession(session);
  return session;
}

/**
 * API Name: پایان نشست
 */
export async function endSession(sessionId) {
  const { data, serverTime } = await http.post(ENDPOINTS.sessionEnd, {
    sessionId,
  });
  const session = normalizeSession(data, serverTime);
  cacheActiveSession(session);
  return session;
}

/**
 * API Name: ثبت نهایی مطالعه
 */
export async function saveSession({ sessionId, subjectId, note }) {
  const payload = { sessionId, subjectId };
  if (note) payload.note = note; // اختیاری؛ اگر بک‌اند پشتیبانی کند
  const { data } = await http.post(ENDPOINTS.sessionSave, payload);
  cacheActiveSession(null);
  return data;
}

/**
 * API Name: نشست فعال
 */
export async function getActiveSession() {
  const { data, serverTime } = await http.get(ENDPOINTS.sessionActive);
  const session = normalizeSession(data, serverTime);
  cacheActiveSession(session);
  return session;
}

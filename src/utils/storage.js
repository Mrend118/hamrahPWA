/* (کش موقت / فالبک آفلاین)*/

const PREFIX = 'hamrah:';

function available() {
  try {
    const k = `${PREFIX}__test`;
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const canUse = available();
const memory = new Map(); // فالبک برای حالت‌های private browsing

export const storage = {
  get(key, fallback = null) {
    const full = PREFIX + key;
    try {
      const raw = canUse ? window.localStorage.getItem(full) : memory.get(full);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    const full = PREFIX + key;
    try {
      const raw = JSON.stringify(value);
      if (canUse) window.localStorage.setItem(full, raw);
      else memory.set(full, raw);
      return true;
    } catch {
      return false;
    }
  },

  remove(key) {
    const full = PREFIX + key;
    if (canUse) window.localStorage.removeItem(full);
    else memory.delete(full);
  },

  clearAll() {
    if (!canUse) { memory.clear(); return; }
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => window.localStorage.removeItem(k));
  },
};

export const STORAGE_KEYS = {
  authToken: 'auth.token',
  authUser: 'auth.user',
  activeSession: 'session.active', 
  lastSubject: 'timer.lastSubject',
  cachedStats: 'cache.studyStats',
  cachedLeaderboard: 'cache.leaderboard',
  cachedAnnouncements: 'cache.announcements',
  seenAnnouncements: 'announcements.seen',
};

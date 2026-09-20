const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i],
  get length() {
    return store.size;
  },
};
globalThis.localStorage = localStorage;
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
globalThis.window = {
  localStorage,
  addEventListener() {},
  location: { hash: "", hostname: "localhost", protocol: "http:" },
  navigator: globalThis.navigator,
};
globalThis.document = {
  addEventListener() {},
  getElementById: () => null,
  dispatchEvent() {},
  visibilityState: "visible",
  body: { dataset: {}, classList: { toggle() {} } },
};
globalThis.CustomEvent = class {
  constructor(t, o) {
    this.type = t;
    Object.assign(this, o);
  }
};

const fmt = await import("./src/utils/format-time.js");
const ss = await import("./src/core/study-session.js");
const api = await import("./src/api/study-sessions.js");

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${label} → ${actual}${ok ? "" : ` (expected ${expected})`}`,
  );
};

check("formatClock 5227s", fmt.formatClock(5227000), "۰۱:۲۷:۰۷");
check(
  "formatDuration 510m",
  fmt.formatDuration(510 * 60000),
  "۸ ساعت و ۳۰ دقیقه",
);
check("formatDuration 0", fmt.formatDuration(0), "بدون مطالعه");
check("toEn", fmt.toEn("۱۲۳۴"), "1234");
check("greeting 13", fmt.greetingForHour(13), "ظهر بخیر");

const started = await ss.start(2);
check("start ok", started.ok, true);
check("status running", ss.sessionStore.get().status, "running");

const raw = JSON.parse(localStorage.getItem("hamrah:mock:session"));
const past = new Date(Date.now() - 90 * 60000).toISOString();
localStorage.setItem(
  "hamrah:mock:session",
  JSON.stringify({ ...raw, startedAt: past, lastResumedAt: past }),
);
await ss.restoreActiveSession({ silent: true });
const elapsedMin = Math.round(ss.sessionStore.get().elapsedMs / 60000);
check("recovered elapsed ≈ 90m", elapsedMin, 90);

check("pause ok", (await ss.pause()).ok, true);
check("status paused", ss.sessionStore.get().status, "paused");
const pausedMs = ss.sessionStore.get().elapsedMs;
await new Promise((r) => setTimeout(r, 1200));
check("paused clock frozen", ss.sessionStore.get().elapsedMs, pausedMs);

check("resume ok", (await ss.resume()).ok, true);
check("status running again", ss.sessionStore.get().status, "running");
check("end ok", (await ss.end()).ok, true);
check("status ended", ss.sessionStore.get().status, "ended");

const saved = await ss.save({ subjectId: 2 });
check("save ok", saved.ok, true);
check("saved minutes ≈ 90", saved.result.minutes, 90);
check("status back to idle", ss.sessionStore.get().status, "idle");
check("no active session", await api.getActiveSession(), null);

await ss.start(1);
globalThis.window.__MOCK_FAIL__ = 500;
await ss.restoreActiveSession({ silent: true });
check("offline fallback marks stale", ss.sessionStore.get().stale, true);
delete globalThis.window.__MOCK_FAIL__;
await ss.restoreActiveSession({ silent: true });
check("resync clears stale", ss.sessionStore.get().stale, false);
await ss.discard();

console.log(failures ? `\n${failures} تست ناموفق` : "\nهمه تست‌ها موفق");
process.exit(failures ? 1 : 0);

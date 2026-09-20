import { icon } from "../assets/icons/index.js";
import { formatClock, formatDuration } from "../utils/format-time.js";
import {
  SESSION_STATES,
  sessionStore,
  start,
  pause,
  resume,
  end,
  save,
  discard,
} from "../core/study-session.js";
import { toastError, toastSuccess } from "./toast.js";
import { confirmAction } from "./confirm.js";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const STATE_LABELS = {
  idle: "آماده شروع",
  running: "در حال مطالعه",
  paused: "متوقف شده",
  ended: "پایان یافته — ثبت نشده",
};

export function mountTimer(host, { getSubjectTitle = () => "" } = {}) {
  host.innerHTML = `
    <div class="timer-dial" data-state="idle">
      <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ring-track" cx="50" cy="50" r="${RADIUS}"></circle>
        <circle class="ring-progress" cx="50" cy="50" r="${RADIUS}"
          stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="${CIRCUMFERENCE}"></circle>
      </svg>
      <div class="timer-readout">
        <p class="timer-subject-label" data-part="subject">درسی انتخاب نشده</p>
        <p class="timer-time num" data-part="time" role="timer" aria-live="off">۰۰:۰۰:۰۰</p>
        <p class="timer-state-label" data-part="state">آماده شروع</p>
      </div>
    </div>

    <p class="timer-sync" data-part="sync"></p>
    <div class="timer-controls" data-part="controls"></div>
    <p class="sr-only" aria-live="polite" data-part="announce"></p>`;

  const dial = host.querySelector(".timer-dial");
  const ring = host.querySelector(".ring-progress");
  const timeEl = host.querySelector('[data-part="time"]');
  const stateEl = host.querySelector('[data-part="state"]');
  const subjectEl = host.querySelector('[data-part="subject"]');
  const syncEl = host.querySelector('[data-part="sync"]');
  const controls = host.querySelector('[data-part="controls"]');
  const announce = host.querySelector('[data-part="announce"]');

  let signature = "";

  const renderTime = (state) => {
    timeEl.textContent = formatClock(state.elapsedMs);
    const ratio = (state.elapsedMs % 3_600_000) / 3_600_000;
    ring.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - ratio));
  };

  const renderControls = (state) => {
    const busy = Boolean(state.pending);
    const disabled = busy ? "disabled" : "";
    const spin = (label) =>
      `<span class="spinner" aria-hidden="true"></span><span>${label}</span>`;

    if (state.status === SESSION_STATES.idle) {
      const noSubject = !state.subjectId;
      controls.innerHTML = `
        <button class="btn btn-primary btn-lg btn-block" type="button" data-action="start"
          ${noSubject || busy ? "disabled" : ""}>
          ${state.pending === "start" ? spin("در حال شروع…") : `${icon("play", { size: 18 })}<span>شروع</span>`}
        </button>
        ${noSubject ? '<p class="timer-sync">برای شروع، یک درس انتخاب کنید.</p>' : ""}`;
      return;
    }

    if (state.status === SESSION_STATES.running) {
      controls.innerHTML = `
        <div class="timer-controls-row">
          <button class="btn btn-outline" type="button" data-action="pause" ${disabled}>
            ${state.pending === "pause" ? spin("…") : `${icon("pause", { size: 17 })}<span>توقف موقت</span>`}
          </button>
          <button class="btn btn-gold" type="button" data-action="end" ${disabled}>
            ${state.pending === "end" ? spin("…") : `${icon("stop", { size: 17 })}<span>پایان</span>`}
          </button>
        </div>`;
      return;
    }

    if (state.status === SESSION_STATES.paused) {
      controls.innerHTML = `
        <div class="timer-controls-row">
          <button class="btn btn-primary" type="button" data-action="resume" ${disabled}>
            ${state.pending === "resume" ? spin("…") : `${icon("play", { size: 17 })}<span>ادامه</span>`}
          </button>
          <button class="btn btn-gold" type="button" data-action="end" ${disabled}>
            ${state.pending === "end" ? spin("…") : `${icon("stop", { size: 17 })}<span>پایان</span>`}
          </button>
        </div>`;
      return;
    }
    controls.innerHTML = `
      <button class="btn btn-gold btn-lg btn-block" type="button" data-action="save"
        ${state.saving || busy ? "disabled" : ""}>
        ${state.saving ? spin("در حال ثبت…") : `${icon("save", { size: 18 })}<span>ثبت مطالعه</span>`}
      </button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="discard" ${state.saving ? "disabled" : ""}>
        ${icon("close", { size: 16 })}<span>بی‌خیال، ثبت نکن</span>
      </button>`;
  };

  const renderSync = (state) => {
    if (state.stale) {
      syncEl.dataset.syncing = "false";
      syncEl.innerHTML = `${icon("wifiOff", { size: 14 })}<span>زمان تأیید‌نشده — پس از وصل شدن اینترنت با سرور همگام می‌شود.</span>`;
      return;
    }
    if (state.syncing) {
      syncEl.dataset.syncing = "true";
      syncEl.innerHTML = `${icon("cloud", { size: 14 })}<span>همگام‌سازی با سرور…</span>`;
      return;
    }
    if (state.status === SESSION_STATES.idle) {
      syncEl.innerHTML = "";
      return;
    }
    syncEl.dataset.syncing = "false";
    syncEl.innerHTML = `${icon("check", { size: 14 })}<span>زمان ثبت‌شده در سرور تأیید شد.</span>`;
  };

  const render = (state) => {
    dial.dataset.state = state.status;
    stateEl.textContent = STATE_LABELS[state.status] ?? "";

    const title =
      state.session?.subjectTitle || getSubjectTitle(state.subjectId);
    subjectEl.textContent = title || "درسی انتخاب نشده";

    renderTime(state);
    renderSync(state);
    const next = `${state.status}|${state.pending}|${state.saving}|${state.subjectId}`;
    if (next !== signature) {
      signature = next;
      renderControls(state);
    }
  };

  const unsubscribe = sessionStore.subscribe(
    (state) => {
      render(state);
    },
    { immediate: true },
  );

  const onClick = async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const state = sessionStore.get();

    switch (button.dataset.action) {
      case "start": {
        const result = await start(state.subjectId);
        if (result.ok) {
          announce.textContent = "تایمر شروع شد.";
          toastSuccess("تایمر شروع شد.");
        } else if (result.error) toastError(result.error.userMessage);
        break;
      }
      case "pause": {
        const result = await pause();
        if (result.ok) announce.textContent = "تایمر متوقف شد.";
        else if (result.error) toastError(result.error.userMessage);
        break;
      }
      case "resume": {
        const result = await resume();
        if (result.ok) announce.textContent = "تایمر ادامه یافت.";
        else if (result.error) toastError(result.error.userMessage);
        break;
      }
      case "end": {
        const confirmed = await confirmAction({
          title: "نشست مطالعه را تمام می‌کنید؟",
          text: `زمان فعلی: ${formatDuration(sessionStore.get().elapsedMs)}. بعد از پایان باید آن را ثبت کنید.`,
          confirmLabel: "پایان نشست",
        });
        if (!confirmed) break;
        const result = await end();
        if (result.ok)
          announce.textContent =
            "نشست پایان یافت. برای ذخیره، ثبت مطالعه را بزنید.";
        else if (result.error) toastError(result.error.userMessage);
        break;
      }
      case "save": {
        const result = await save({ subjectId: state.subjectId });
        if (result.ok) {
          const seconds = result.result?.seconds;
          const minutes = result.result?.minutes;
          toastSuccess(
            seconds != null
              ? `مطالعه ثبت شد: ${formatDuration(seconds * 1000)}`
              : minutes
                ? `مطالعه ثبت شد: ${formatDuration(minutes * 60000)}`
                : "مطالعه ثبت شد.",
          );
          host.dispatchEvent(
            new CustomEvent("session:saved", {
              bubbles: true,
              detail: result.result,
            }),
          );
        } else if (result.error) {
          toastError(result.error.userMessage);
        }
        break;
      }
      case "discard": {
        const confirmed = await confirmAction({
          title: "این نشست ثبت نشود؟",
          text: "زمان این نشست از بین می‌رود و در آمار شما حساب نمی‌شود.",
          confirmLabel: "ثبت نکن",
          danger: true,
        });
        if (confirmed) {
          const result = await discard();
          if (result.ok)
            toastSuccess("نشست حذف شد و می‌توانی دوباره شروع کنی.");
          else if (result.error) toastError(result.error.userMessage);
        }
        break;
      }
      default:
        break;
    }
  };

  host.addEventListener("click", onClick);

  return {
    destroy() {
      unsubscribe();
      host.removeEventListener("click", onClick);
    },
  };
}

export { STATE_LABELS };

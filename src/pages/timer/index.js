import { icon } from "../../assets/icons/index.js";
import { getSubjects } from "../../api/user.js";
import { mountTimer } from "../../components/timer.js";
import { renderSubjectPicker } from "../../components/subject-picker.js";
import { bindRetry, errorState, emptyState } from "../../components/loading.js";
import {
  SESSION_STATES,
  restoreActiveSession,
  selectSubject,
  sessionStore,
} from "../../core/study-session.js";
import { storage, STORAGE_KEYS } from "../../utils/storage.js";

export async function render(outlet) {
  outlet.innerHTML = `
    <header class="page-head">
      <h1>تایمر مطالعه</h1>
      <p>یک درس را انتخاب کن و تایمر را شروع کن. زمان روی سرور ثبت می‌شود، پس با بستن برنامه از بین نمی‌رود.</p>
    </header>

    <div class="timer-layout">
      <section aria-label="تایمر" data-part="timer"></section>

      <div class="timer-side">
        <section aria-labelledby="subject-title">
          <div class="section-head" style="margin-block-end:var(--space-sm)">
            <h2 id="subject-title" style="font-size:var(--text-base)">${icon("book", { size: 16 })} انتخاب درس</h2>
            <span class="hint" data-part="lock-hint"></span>
          </div>
          <div data-part="subjects"></div>
        </section>

        <section class="panel panel-sunken" aria-label="راهنما">
          <p class="eyebrow" style="margin-block-end:var(--space-xs)">یادآوری</p>
          <p style="font-size:var(--text-sm);color:var(--text-muted)">
            بعد از زدن «پایان»، تا وقتی «ثبت مطالعه» را نزنی زمان در آمار و رتبه‌بندی حساب نمی‌شود.
          </p>
        </section>
      </div>
    </div>`;

  const timerHost = outlet.querySelector('[data-part="timer"]');
  const subjectsHost = outlet.querySelector('[data-part="subjects"]');
  const lockHint = outlet.querySelector('[data-part="lock-hint"]');

  let subjects = [];
  let aborted = false;

  const getSubjectTitle = (id) =>
    subjects.find((subject) => String(subject.id) === String(id))?.title ?? "";

  const timer = mountTimer(timerHost, { getSubjectTitle });

  const remembered = storage.get(STORAGE_KEYS.lastSubject, null);
  if (remembered && !sessionStore.get().subjectId) selectSubject(remembered);

  async function loadSubjects() {
    subjectsHost.innerHTML = `<div class="subject-picker">
      ${Array.from({ length: 6 }, () => '<div class="skeleton" style="width:88px;height:40px;border-radius:999px"></div>').join("")}
    </div>`;

    try {
      subjects = await getSubjects();
      if (aborted) return;

      if (!subjects.length) {
        subjectsHost.innerHTML = emptyState({
          title: "درسی برای انتخاب وجود ندارد.",
          text: "فهرست درس‌ها از سمت مدیر سیستم تنظیم می‌شود.",
          iconName: "book",
        });
        return;
      }
      paintPicker();
    } catch (error) {
      if (aborted) return;
      subjectsHost.innerHTML = errorState({
        title: "فهرست درس‌ها دریافت نشد.",
        text: error.userMessage ?? "دوباره تلاش کنید.",
      });
      bindRetry(subjectsHost, loadSubjects);
    }
  }

  function paintPicker() {
    const state = sessionStore.get();
    const locked = state.status !== SESSION_STATES.idle;
    lockHint.textContent = locked ? "در طول نشست، درس قابل تغییر نیست." : "";

    renderSubjectPicker(subjectsHost, {
      subjects,
      selectedId: state.session?.subjectId ?? state.subjectId,
      disabled: locked,
      onSelect: (id) => {
        selectSubject(id);
        storage.set(STORAGE_KEYS.lastSubject, id);
      },
    });
  }

  let lastStatus = sessionStore.get().status;
  const unsubscribe = sessionStore.subscribe((state) => {
    if (state.status !== lastStatus) {
      lastStatus = state.status;
      if (subjects.length) paintPicker();
    }
  });

  await Promise.all([loadSubjects(), restoreActiveSession()]);

  return {
    destroy() {
      aborted = true;
      unsubscribe();
      timer.destroy();
    },
  };
}

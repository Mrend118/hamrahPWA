/* صفحه خانه */

import { icon } from '../../assets/icons/index.js';
import { getProfile, getStudyStats, getSubjectStats } from '../../api/user.js';
import { currentUser } from '../../core/auth.js';
import { ROUTES } from '../../config.js';
import { formatDuration, greetingForHour, minutesToMs, toFa } from '../../utils/format-time.js';
import { escapeHtml, subjectColor } from '../../utils/helpers.js';
import { bindRetry, emptyState, errorState, skeletonRows } from '../../components/loading.js';

export async function render(outlet) {
  const user = currentUser();

  outlet.innerHTML = `
    <header class="page-head">
      <h1>${escapeHtml(greetingForHour())}، ${escapeHtml(user?.name ?? 'دانش‌آموز')} <span class="wave">👋</span></h1>
      <p>این خلاصه مطالعه‌ی توست.</p>
    </header>

    <div class="home-grid">
      <section class="section" aria-labelledby="stats-title" data-part="stats-section" style="margin-block:0">
        <h2 id="stats-title" class="sr-only">آمار مطالعه</h2>
        <div data-part="stats">${statsSkeleton()}</div>

        <div class="quick-actions">
          <a class="btn btn-primary" href="#${ROUTES.timer}">${icon('play', { size: 17 })}<span>شروع مطالعه</span></a>
          <a class="btn btn-outline" href="#${ROUTES.leaderboard}">${icon('ranking', { size: 17 })}<span>رتبه‌بندی</span></a>
        </div>
      </section>

      <section class="section" aria-labelledby="subjects-title" style="margin-block:var(--space-xl) 0,top:-80px;">
        <div class="section-head">
          <h2 id="subjects-title">مطالعه به تفکیک درس</h2>
          <span class="hint">مجموع از ابتدا</span>
        </div>
        <div data-part="subjects">${skeletonRows(5, 52)}</div>
      </section>
    </div>`;

  const statsHost = outlet.querySelector('[data-part="stats"]');
  const subjectsHost = outlet.querySelector('[data-part="subjects"]');

  let aborted = false;

  async function loadStats() {
    statsHost.innerHTML = statsSkeleton();
    try {
      // نام/سطح از پروفایل، زمان‌ها از آمار
      const [profile, stats] = await Promise.all([getProfile(), getStudyStats()]);
      if (aborted) return;
      statsHost.innerHTML = renderStats(profile, stats);
    } catch (error) {
      if (aborted) return;
      statsHost.innerHTML = errorState({ text: error.userMessage ?? 'دوباره تلاش کنید.' });
      bindRetry(statsHost, loadStats);
    }
  }

  async function loadSubjects() {
    subjectsHost.innerHTML = skeletonRows(5, 52);
    try {
      const items = await getSubjectStats();
      if (aborted) return;
      if (!items.length) {
        subjectsHost.innerHTML = emptyState({
          title: 'هنوز اطلاعاتی برای نمایش وجود ندارد.',
          text: 'با اولین نشست مطالعه، آمار درس‌ها اینجا ساخته می‌شود.',
          iconName: 'book',
          actionLabel: 'شروع تایمر',
          actionHref: `#${ROUTES.timer}`,
        });
        return;
      }
      subjectsHost.innerHTML = renderSubjects(items);
    } catch (error) {
      if (aborted) return;
      subjectsHost.innerHTML = errorState({ text: error.userMessage ?? 'دوباره تلاش کنید.' });
      bindRetry(subjectsHost, loadSubjects);
    }
  }

  await Promise.all([loadStats(), loadSubjects()]);

  return {
    destroy() { aborted = true; },
  };
}

/* ---------------- بخش‌های نمایشی ---------------- */

function statsSkeleton() {
  return `<div class="stat-rail">
    <div class="stat-primary">
      <div class="skeleton" style="width:62px;height:62px;border-radius:50%"></div>
      <div style="flex:1;display:grid;gap:8px">
        <div class="skeleton" style="width:60%;height:28px"></div>
        <div class="skeleton" style="width:40%;height:14px"></div>
      </div>
    </div>
    <div class="stat-secondary">
      ${Array.from({ length: 3 }, () => '<div class="skeleton" style="height:44px"></div>').join('')}
    </div>
  </div>`;
}

function renderStats(profile, stats) {
  const total = minutesToMs(stats?.totalMinutes);
  const week = minutesToMs(stats?.weekMinutes);
  const today = minutesToMs(stats?.todayMinutes);
  const level = stats?.level ?? profile?.level;
  const rank = stats?.rank ?? profile?.rank;

  return `<div class="stat-rail">
    <div class="stat-primary">
      <span class="medal">${icon('trophy', { size: 26 })}</span>
      <div>
        <p class="value num">${escapeHtml(formatDuration(total))}</p>
        <p class="label">مجموع ساعت مطالعه شما</p>
      </div>
    </div>

    <div class="stat-secondary">
      <div class="stat-cell">
        <p class="label">${icon('calendar', { size: 13 })}<span>این هفته</span></p>
        <p class="value num">${escapeHtml(formatDuration(week))}</p>
      </div>
      <div class="stat-cell">
        <p class="label">${icon('clock', { size: 13 })}<span>امروز</span></p>
        <p class="value num">${escapeHtml(formatDuration(today, { short: true }))}</p>
      </div>
      <div class="stat-cell">
        <p class="label">${icon('stats', { size: 13 })}<span>سطح و رتبه</span></p>
        <p class="value num">${toFa(level ?? '—')} <small>/ رتبه ${toFa(rank ?? '—')}</small></p>
      </div>
    </div>
  </div>`;
}

function renderSubjects(items) {
  const max = Math.max(...items.map((item) => item.minutes || 0), 1);
  const sorted = [...items].sort((a, b) => (b.minutes || 0) - (a.minutes || 0));

  return `<div class="subject-list">
    ${sorted.map((item) => {
      const ratio = Math.round(((item.minutes || 0) / max) * 100);
      const color = subjectColor(item.title ?? item.subjectId);
      return `<div class="subject-row">
        <span class="subject-name">
          <span class="subject-dot" style="background:${color}"></span>
          ${escapeHtml(item.title ?? 'بدون نام')}
        </span>
        <span class="subject-time">${escapeHtml(formatDuration(minutesToMs(item.minutes)))}</span>
        <span class="subject-bar"><span style="width:${ratio}%;background:${color}"></span></span>
      </div>`;
    }).join('')}
  </div>`;
}

/*صفحه رتبه‌بندی*/

import { getLeaderboard } from '../../api/leaderboard.js';
import { renderPodium, renderRankTable, renderRankRow } from '../../components/leaderboard.js';
import { bindRetry, emptyState, errorState, skeletonRows } from '../../components/loading.js';

const PERIODS = [
  { key: 'week', label: 'این هفته' },
  { key: 'month', label: 'این ماه' },
  { key: 'all', label: 'کل دوره' },
];

export async function render(outlet) {
  let period = 'week';
  let aborted = false;

  outlet.innerHTML = `
    <header class="page-head">
      <h1>لیگ رتبه‌بندی</h1>
      <p>رتبه‌بندی بر اساس مجموع ساعت مطالعه ثبت‌شده.</p>
    </header>

    <div class="subject-picker" role="tablist" aria-label="بازه زمانی" data-part="periods" style="margin-block-end:var(--space-lg)">
      ${PERIODS.map((item) => `
        <button class="subject-chip" type="button" role="tab" data-period="${item.key}"
          aria-pressed="${item.key === period}">${item.label}</button>`).join('')}
    </div>

    <div data-part="board">${skeletonRows(6, 56)}</div>`;

  const board = outlet.querySelector('[data-part="board"]');
  const periodsHost = outlet.querySelector('[data-part="periods"]');

  async function load() {
    board.innerHTML = `
      <div class="podium">
        ${Array.from({ length: 3 }, () => '<div class="skeleton" style="height:128px;border-radius:var(--radius-lg)"></div>').join('')}
      </div>
      ${skeletonRows(6, 56)}`;

    try {
      const { items, me } = await getLeaderboard({ period });
      if (aborted) return;

      if (!items.length) {
        board.innerHTML = emptyState({
          title: 'هنوز اطلاعاتی برای نمایش وجود ندارد.',
          text: 'به‌محض ثبت مطالعه دانش‌آموزان، رتبه‌بندی این بازه ساخته می‌شود.',
          iconName: 'ranking',
        });
        return;
      }

      const sorted = [...items].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      const top3 = sorted.slice(0, 3);
      const rest = sorted.slice(3);

      board.innerHTML = `
        ${renderPodium(top3)}
        ${rest.length ? renderRankTable(rest) : ''}
        ${me ? `<div class="my-rank-sticky">${renderRankRow(me, { me: true })}</div>` : ''}`;
    } catch (error) {
      if (aborted) return;
      board.innerHTML = errorState({
        title: 'دریافت رتبه‌بندی با مشکل مواجه شد.',
        text: error.userMessage ?? 'دوباره تلاش کنید.',
      });
      bindRetry(board, load);
    }
  }

  periodsHost.addEventListener('click', (event) => {
    const button = event.target.closest('[data-period]');
    if (!button || button.dataset.period === period) return;
    period = button.dataset.period;
    periodsHost.querySelectorAll('[data-period]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip === button));
    });
    load();
  });

  await load();

  return { destroy() { aborted = true; } };
}

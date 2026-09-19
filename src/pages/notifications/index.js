/*صفحه اطلاعیه‌ها*/

import { getAnnouncements } from '../../api/announcements.js';
import { renderAnnouncement } from '../../components/notification-card.js';
import { bindRetry, emptyState, errorState, skeletonRows } from '../../components/loading.js';
import { storage, STORAGE_KEYS } from '../../utils/storage.js';
import { icon } from '../../assets/icons/index.js';

export async function render(outlet) {
  let aborted = false;

  outlet.innerHTML = `
    <header class="page-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-md)">
      <div>
        <h1>اطلاعیه‌ها</h1>
        <p>پیام‌ها و اطلاعیه‌های مدیر مجموعه.</p>
      </div>
      <button class="btn btn-ghost btn-icon" type="button" data-part="refresh" aria-label="به‌روزرسانی اطلاعیه‌ها" title="به‌روزرسانی">
        ${icon('refresh', { size: 18 })}
      </button>
    </header>

    <div data-part="list">${skeletonRows(4, 96)}</div>`;

  const list = outlet.querySelector('[data-part="list"]');
  const refresh = outlet.querySelector('[data-part="refresh"]');

  async function load() {
    list.innerHTML = skeletonRows(4, 96);
    try {
      const items = await getAnnouncements();
      if (aborted) return;

      if (!items.length) {
        list.innerHTML = emptyState({
          title: 'هنوز اطلاعیه‌ای منتشر نشده است.',
          text: 'وقتی مدیر یا مشاور اطلاعیه‌ای بفرستد، همین‌جا نمایش داده می‌شود.',
          iconName: 'megaphone',
        });
        return;
      }

      const seen = new Set(storage.get(STORAGE_KEYS.seenAnnouncements, []));
      list.innerHTML = `<div class="announcement-list">
        ${items.map((item) => renderAnnouncement(item, { unread: !seen.has(item.id) })).join('')}
      </div>`;
      storage.set(STORAGE_KEYS.seenAnnouncements, items.map((item) => item.id));
    } catch (error) {
      if (aborted) return;
      list.innerHTML = errorState({
        title: 'دریافت اطلاعیه‌ها با مشکل مواجه شد.',
        text: error.userMessage ?? 'دوباره تلاش کنید.',
      });
      bindRetry(list, load);
    }
  }

  refresh.addEventListener('click', load);
  await load();

  return { destroy() { aborted = true; } };
}


import { icon } from '../assets/icons/index.js';
import { escapeHtml } from '../utils/helpers.js';

/** اسکلتون */
export function skeletonRows(count = 5, height = 58) {
  return `<div class="skeleton-rows" role="status" aria-live="polite">
    <span class="sr-only">در حال دریافت اطلاعات…</span>
    ${Array.from({ length: count }, () => `<div class="skeleton skeleton-row" style="height:${height}px"></div>`).join('')}
  </div>`;
}

export function loadingState(message = 'در حال دریافت اطلاعات…') {
  return `<div class="state" role="status" aria-live="polite">
    <span class="spinner" style="width:22px;height:22px" aria-hidden="true"></span>
    <p class="state-text">${escapeHtml(message)}</p>
  </div>`;
}

export function emptyState({
  title = 'هنوز اطلاعاتی برای نمایش وجود ندارد.',
  text = '',
  iconName = 'inbox',
  actionLabel = '',
  actionHref = '',
} = {}) {
  return `<div class="state">
    <span class="state-icon">${icon(iconName, { size: 24 })}</span>
    <p class="state-title">${escapeHtml(title)}</p>
    ${text ? `<p class="state-text">${escapeHtml(text)}</p>` : ''}
    ${actionLabel && actionHref ? `<a class="btn btn-outline btn-sm" href="${actionHref}">${escapeHtml(actionLabel)}</a>` : ''}
  </div>`;
}

export function errorState({
  title = 'دریافت اطلاعات با مشکل مواجه شد.',
  text = 'دوباره تلاش کنید.',
  retry = true,
} = {}) {
  return `<div class="state state-error" role="alert">
    <span class="state-icon">${icon('alert', { size: 24 })}</span>
    <p class="state-title">${escapeHtml(title)}</p>
    <p class="state-text">${escapeHtml(text)}</p>
    ${retry ? `<button class="btn btn-outline btn-sm" type="button" data-retry>
      ${icon('refresh', { size: 16 })}<span>تلاش دوباره</span>
    </button>` : ''}
  </div>`;
}

export function bindRetry(container, handler) {
  const button = container.querySelector('[data-retry]');
  if (button) button.addEventListener('click', handler, { once: true });
}


import { icon } from '../assets/icons/index.js';
import { formatRelative, formatDateFull, formatTime } from '../utils/format-time.js';
import { escapeHtml } from '../utils/helpers.js';

const TONE_ICON = { info: 'megaphone', warning: 'calendar', danger: 'bell' };

export function renderAnnouncement(item, { unread = false } = {}) {
  const tone = TONE_ICON[item.tone] ? item.tone : 'info';
  const body = linkify(escapeHtml(item.body ?? ''));

  return `<article class="announcement" data-tone="${tone}" data-unread="${unread}">
    <span class="announcement-icon">${icon(TONE_ICON[tone], { size: 20 })}</span>
    <div>
      <div class="announcement-head">
        <h3 class="announcement-title">${escapeHtml(item.title ?? 'بدون عنوان')}</h3>
        <time class="announcement-date" datetime="${escapeHtml(item.createdAt ?? '')}"
          title="${escapeHtml(`${formatDateFull(item.createdAt)} ساعت ${formatTime(item.createdAt)}`)}">
          ${escapeHtml(formatRelative(item.createdAt))}
        </time>
      </div>
      <p class="announcement-body">${body}</p>
    </div>
  </article>`;
}

function linkify(text) {
  return text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

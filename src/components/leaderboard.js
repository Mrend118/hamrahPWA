import { icon } from "../assets/icons/index.js";
import {
  formatDuration,
  minutesToMs,
  secondsToMs,
  toFa,
} from "../utils/format-time.js";
import { escapeHtml, initials } from "../utils/helpers.js";

const MEDALS = { 1: "trophy", 2: "medal", 3: "award" };
const PLACE_LABEL = { 1: "نفر اول", 2: "نفر دوم", 3: "نفر سوم" };

export function renderPodium(top3 = []) {
  if (!top3.length) return "";
  return `<div class="podium">
    ${top3
      .map((item, index) => {
        const place = index + 1;
        return `<div class="podium-slot" data-place="${place}">
        <span class="rank-medal">${icon(MEDALS[place], { size: place === 1 ? 24 : 20 })}</span>
        <span class="eyebrow">${PLACE_LABEL[place]}</span>
        <span class="who">${escapeHtml(item.name ?? "بی‌نام")}</span>
        <span class="time num">${formatItemDuration(item)}</span>
      </div>`;
      })
      .join("")}
  </div>`;
}

export function renderRankRow(item, { me = false } = {}) {
  return `<div class="rank-row" data-me="${me}">
    <span class="rank-number num">${toFa(item.rank)}</span>
    <span class="rank-person">
      <span class="avatar" aria-hidden="true" style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--surface-3);font-size:.75rem">${escapeHtml(initials(item.name))}</span>
      <span class="name">${escapeHtml(item.name ?? "بی‌نام")}${me ? ' <span class="badge badge-primary">شما</span>' : ""}</span>
    </span>
    <span class="rank-meta">
      <span>${formatItemDuration(item)}</span>
      ${item.level != null ? `<span class="badge">${icon("stats", { size: 13 })} سطح ${toFa(item.level)}</span>` : ""}
    </span>
  </div>`;
}

function formatItemDuration(item) {
  return formatDuration(
    item.seconds != null
      ? secondsToMs(item.seconds)
      : minutesToMs(item.minutes),
  );
}

export function renderRankTable(items = [], meId = null) {
  return `<div class="rank-table">
    ${items.map((item) => renderRankRow(item, { me: item.isMe || (meId != null && item.userId === meId) })).join("")}
  </div>`;
}

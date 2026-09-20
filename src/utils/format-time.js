const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(value) {
  return String(value ?? "").replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function toEn(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

const pad2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");

export function formatClock(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return toFa(`${pad2(h)}:${pad2(m)}:${pad2(s)}`);
}

export function formatDuration(ms, { short = false } = {}) {
  const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (totalSeconds === 0) return short ? "۰ ثانیه" : "بدون مطالعه";
  const parts = [];
  if (h > 0) parts.push(`${toFa(h)} ساعت`);
  if (m > 0) parts.push(`${toFa(m)} دقیقه`);
  if (h === 0 && s > 0) parts.push(`${toFa(s)} ثانیه`);
  return parts.join(" و ");
}

export const minutesToMs = (min) => (Number(min) || 0) * 60000;
export const secondsToMs = (sec) => (Number(sec) || 0) * 1000;

const faDate = new Intl.DateTimeFormat("fa-IR", {
  day: "numeric",
  month: "long",
});
const faDateFull = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const faTime = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(input) {
  const d = toDate(input);
  return d ? faDate.format(d) : "";
}

export function formatDateFull(input) {
  const d = toDate(input);
  return d ? faDateFull.format(d) : "";
}

export function formatTime(input) {
  const d = toDate(input);
  return d ? faTime.format(d) : "";
}

export function formatRelative(input, now = Date.now()) {
  const d = toDate(input);
  if (!d) return "";
  const diff = now - d.getTime();
  const min = Math.round(diff / 60000);

  if (min < 1) return "همین حالا";
  if (min < 60) return `${toFa(min)} دقیقه پیش`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${toFa(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  if (days === 1) return "دیروز";
  if (days < 7) return `${toFa(days)} روز پیش`;
  return formatDate(d);
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 5) return "شب بخیر";
  if (hour < 12) return "صبح بخیر";
  if (hour < 16) return "ظهر بخیر";
  if (hour < 20) return "عصر بخیر";
  return "شب بخیر";
}

function toDate(input) {
  if (!input) return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

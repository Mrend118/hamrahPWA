export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function fromHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? "" : value);
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child == null) return;
    node.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  });
  return node;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function debounce(fn, wait = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  return parts.length === 1
    ? parts[0].slice(0, 1)
    : `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
}

const SUBJECT_HUES = [188, 84, 158, 300, 24, 260, 120, 52];
export function subjectColor(key = "") {
  let sum = 0;
  for (const ch of String(key)) sum += ch.codePointAt(0);
  const hue = SUBJECT_HUES[sum % SUBJECT_HUES.length];
  return `oklch(74% 0.11 ${hue})`;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function setButtonLoading(
  button,
  loading,
  loadingLabel = "در حال انجام…",
) {
  if (!button) return;
  if (loading) {
    button.dataset.loading = "true";
    button.dataset.originalHtml ??= button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${escapeHtml(loadingLabel)}</span>`;
  } else {
    button.dataset.loading = "false";
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

export function readEnv(key, fallback) {
  try {
    const env = import.meta.env;
    const value = env ? env[key] : undefined;
    return value === undefined || value === "" ? fallback : value;
  } catch {
    return fallback;
  }
}

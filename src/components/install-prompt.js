import { icon } from "../assets/icons/index.js";

const DISMISS_KEY = "hamrah:pwa-install-dismissed";
let deferredPrompt = null;
let promptNode = null;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const isMobile = () =>
  window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function recentlyDismissed() {
  const timestamp = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000;
}

export function initInstallPrompt() {
  if (isStandalone() || !isMobile() || recentlyDismissed()) return;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    window.setTimeout(showPrompt, 900);
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hidePrompt();
    localStorage.removeItem(DISMISS_KEY);
  });

  if (isIOS()) window.setTimeout(showPrompt, 1200);
}

function showPrompt() {
  if (promptNode || isStandalone() || recentlyDismissed()) return;
  const ios = isIOS();
  promptNode = document.createElement("div");
  promptNode.className = "install-prompt-backdrop";
  promptNode.innerHTML = `
    <section class="install-prompt" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <button class="install-close" type="button" data-install-action="dismiss" aria-label="فعلاً نه">${icon("close", { size: 18 })}</button>
      <img class="install-app-icon" src="./icons/icon-192.png" alt="آیکون همراه">
      <div class="install-copy">
        <span class="eyebrow">تجربه سریع‌تر و تمام‌صفحه</span>
        <h2 id="install-title">همراه را روی گوشی نصب کن</h2>
        <p>${ios ? "از منوی اشتراک‌گذاری، گزینه «افزودن به صفحه اصلی» را انتخاب کن." : "مثل یک اپ واقعی، همراه را از صفحه اصلی گوشی باز کن و سریع‌تر به تایمر و مشاوره برس."}</p>
      </div>
      <div class="install-benefits">
        <span>${icon("timer", { size: 17 })} دسترسی سریع به تایمر</span>
        <span>${icon("bell", { size: 17 })} اجرای تمام‌صفحه</span>
        <span>${icon("cloud", { size: 17 })} بازیابی نشست مطالعه</span>
      </div>
      ${ios ? `<div class="ios-install-guide"><b>۱.</b> روی Share مرورگر بزن <b>۲.</b> Add to Home Screen را انتخاب کن</div>` : ""}
      <div class="install-actions">
        <button class="btn btn-primary btn-lg" type="button" data-install-action="install">${icon("plus", { size: 18 })}<span>${ios ? "متوجه شدم" : "نصب وب‌اپلیکیشن"}</span></button>
        <button class="btn btn-ghost" type="button" data-install-action="dismiss">بعداً</button>
      </div>
    </section>`;
  document.body.append(promptNode);
  requestAnimationFrame(() => promptNode?.classList.add("is-visible"));
  promptNode.addEventListener("click", handleAction);
}

async function handleAction(event) {
  const button = event.target.closest("[data-install-action]");
  if (!button) return;
  if (button.dataset.installAction === "dismiss") {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    hidePrompt();
    return;
  }
  if (isIOS()) {
    hidePrompt();
    return;
  }
  if (!deferredPrompt) return;
  button.disabled = true;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  hidePrompt();
}

function hidePrompt() {
  if (!promptNode) return;
  const node = promptNode;
  promptNode = null;
  node.classList.remove("is-visible");
  window.setTimeout(() => node.remove(), 220);
}

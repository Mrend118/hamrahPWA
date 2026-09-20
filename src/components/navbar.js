import { NAV_ITEMS } from "./nav-items.js";
import { icon } from "../assets/icons/index.js";
import { authStore, logout } from "../core/auth.js";
import { currentRoute } from "../core/router.js";
import { CONFIG, ROUTES } from "../config.js";
import { escapeHtml, initials } from "../utils/helpers.js";
import { confirmAction } from "./confirm.js";

export function mountNavbar(host) {
  const render = () => {
    const { user, status } = authStore.get();
    const authed = status === "authenticated";
    const navItems =
      user?.role === "student"
        ? NAV_ITEMS
        : [{ label: "مدیریت", path: ROUTES.admin, icon: "stats" }];
    const homePath = user?.role === "student" ? ROUTES.home : ROUTES.admin;

    host.innerHTML = `
      <div class="header-inner">
        <a class="brand" href="#${homePath}" aria-label="${CONFIG.appName}">
          <span class="brand-mark"><img src="./icons/logo.webp" alt="همراه" width="40" height="40"></span>
        </a>

        ${
          authed
            ? `
        <nav class="top-nav" aria-label="ناوبری اصلی">
          <ul class="top-nav-list">
            ${navItems
              .map(
                (item) => `
              <li>
                <a class="top-nav-link" href="#${item.path}" data-path="${item.path}">
                  ${icon(item.icon, { size: 17 })}
                  <span>${item.label}</span>
                </a>
              </li>`,
              )
              .join("")}
          </ul>
        </nav>`
            : ""
        }

        <div class="header-actions">
          ${
            authed
              ? `
            <span class="header-user">
              <span class="avatar" aria-hidden="true">${escapeHtml(initials(user?.fullName || user?.name || ""))}</span>
              <span>${escapeHtml(user?.name ?? "دانش‌آموز")}</span>
            </span>
            <button class="btn btn-ghost btn-icon" type="button" data-action="logout" aria-label="خروج از حساب" title="خروج از حساب">
              ${icon("logout", { size: 19 })}
            </button>
          `
              : `
            <a class="btn btn-outline btn-sm" href="#${ROUTES.login}">
              ${icon("login", { size: 17 })}<span>ورود</span>
            </a>
          `
          }
        </div>
      </div>`;

    highlight();
  };

  const highlight = () => {
    const active = currentRoute();
    host.querySelectorAll(".top-nav-link").forEach((link) => {
      if (link.dataset.path === active)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };

  host.addEventListener("click", async (event) => {
    const trigger = event.target.closest('[data-action="logout"]');
    if (!trigger) return;
    const confirmed = await confirmAction({
      title: "از حساب خارج می‌شوید؟",
      text: "اگر نشست مطالعه فعالی دارید، پیش از خروج آن را ثبت کنید.",
      confirmLabel: "خروج",
      danger: true,
    });
    if (confirmed) await logout();
  });

  authStore.subscribe(render);
  document.addEventListener("route:changed", highlight);
  render();
}

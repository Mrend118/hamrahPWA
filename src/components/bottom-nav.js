import { NAV_ITEMS } from "./nav-items.js";
import { icon } from "../assets/icons/index.js";
import { authStore } from "../core/auth.js";
import { currentRoute } from "../core/router.js";

export function mountBottomNav(host) {
  const render = () => {
    const authed = authStore.get().status === "authenticated";
    host.hidden = !authed;
    if (!authed) {
      host.innerHTML = "";
      return;
    }

    host.innerHTML = NAV_ITEMS.map(
      (item) => `
      <a class="bottom-nav-link" href="#${item.path}" data-path="${item.path}">
        <span class="nav-icon">${icon(item.icon, { size: 19 })}</span>
        <span>${item.label}</span>
      </a>`,
    ).join("");

    highlight();
  };

  const highlight = () => {
    const active = currentRoute();
    host.querySelectorAll(".bottom-nav-link").forEach((link) => {
      if (link.dataset.path === active)
        link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  };

  authStore.subscribe(render);
  document.addEventListener("route:changed", highlight);
  render();
}

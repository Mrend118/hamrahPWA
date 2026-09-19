import { ROUTES } from "../config.js";
import { isAuthenticated, authStore } from "./auth.js";

const routes = new Map();
let outlet = null;
let currentView = null;
let currentPath = null;

/**
 * ثبت مسیر
 * @param {string} path
 * @param {{load: () => Promise<{render: Function}>, requiresAuth?: boolean, chrome?: boolean, title?: string}} config
 */
export function registerRoute(path, config) {
  routes.set(path, { requiresAuth: true, chrome: true, ...config });
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (window.location.hash === target) return;
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export const currentRoute = () => currentPath;

function parseHash() {
  const raw = window.location.hash.replace(/^#/, "");
  const [path, queryString] = raw.split("?");
  return {
    path: path || ROUTES.home,
    query: Object.fromEntries(new URLSearchParams(queryString || "")),
  };
}

async function resolve() {
  const { path, query } = parseHash();
  const route = routes.get(path);

  if (!route) {
    renderNotFound(path);
    return;
  }

  if (route.requiresAuth && !isAuthenticated()) {
    navigate(ROUTES.login, { replace: true });
    return;
  }

  if (path === ROUTES.login && isAuthenticated()) {
    navigate(ROUTES.home, { replace: true });
    return;
  }

  if (currentView?.destroy) {
    try {
      currentView.destroy();
    } catch (error) {
      console.error("[router] پاک‌سازی صفحه", error);
    }
  }
  currentView = null;
  currentPath = path;

  document.body.dataset.route = path.replace("/", "");
  document.body.classList.toggle("no-chrome", route.chrome === false);
  if (route.title) document.title = `${route.title} | همراه`;

  outlet.innerHTML = "";
  outlet.classList.remove("page-enter");

  try {
    const module = await route.load();
    const view = await module.render(outlet, { query, navigate });
    currentView = view || null;
    // انیمیشن ورود صفحه
    requestAnimationFrame(() => outlet.classList.add("page-enter"));
    outlet.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0 });
  } catch (error) {
    console.error("[router] بارگذاری صفحه ناموفق بود", error);
    outlet.innerHTML = `
      <div class="state state-error" role="alert">
        <div class="state-icon">!</div>
        <p class="state-title">این صفحه بارگذاری نشد</p>
        <p class="state-text">صفحه را دوباره باز کنید. اگر مشکل ادامه داشت، برنامه را ببندید و مجدد وارد شوید.</p>
      </div>`;
  }

  document.dispatchEvent(
    new CustomEvent("route:changed", { detail: { path } }),
  );
}

function renderNotFound(path) {
  currentPath = path;
  outlet.innerHTML = `
    <div class="not-found">
      <p class="code">۴۰۴</p>
      <h1>این صفحه پیدا نشد</h1>
      <p class="state-text">نشانی وارد‌شده وجود ندارد یا حذف شده است.</p>
      <a class="btn btn-primary" href="#${ROUTES.home}">بازگشت به خانه</a>
    </div>`;
  document.dispatchEvent(
    new CustomEvent("route:changed", { detail: { path } }),
  );
}

export function startRouter(outletElement) {
  outlet = outletElement;
  window.addEventListener("hashchange", resolve);
  authStore.subscribe(() => {
    const route = routes.get(parseHash().path);
    if (route?.requiresAuth && !isAuthenticated()) resolve();
  });
  if (!window.location.hash) navigate(ROUTES.home, { replace: true });
  return resolve();
}

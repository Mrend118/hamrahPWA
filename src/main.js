import { ROUTES, CONFIG } from "./config.js";
import { initNetworkWatcher } from "./core/network.js";
import { initAuth } from "./core/auth.js";
import { registerRoute, startRouter } from "./core/router.js";
import {
  initSessionLifecycle,
  restoreActiveSession,
} from "./core/study-session.js";
import { mountNavbar } from "./components/navbar.js";
import { mountBottomNav } from "./components/bottom-nav.js";

/* ---------- ثبت مسیرها ---------- */

registerRoute(ROUTES.home, {
  title: "خانه",
  load: () => import("./pages/home/index.js"),
});
registerRoute(ROUTES.timer, {
  title: "تایمر مطالعه",
  load: () => import("./pages/timer/index.js"),
});
registerRoute(ROUTES.leaderboard, {
  title: "رتبه‌بندی",
  load: () => import("./pages/leaderboard/index.js"),
});
registerRoute(ROUTES.notifications, {
  title: "اطلاعیه‌ها",
  load: () => import("./pages/notifications/index.js"),
});
registerRoute(ROUTES.consultant, {
  title: "چت با مشاور",
  load: () => import("./pages/consultant/index.js"),
});
registerRoute(ROUTES.login, {
  title: "ورود",
  requiresAuth: false,
  chrome: false,
  load: () => import("./pages/login/index.js"),
});

/* ---------- راه‌اندازی ---------- */

async function bootstrap() {
  initNetworkWatcher();

  await initAuth();

  mountNavbar(document.getElementById("app-header"));
  mountBottomNav(document.getElementById("bottom-nav"));

  await startRouter(document.getElementById("main"));

  initSessionLifecycle();
  restoreActiveSession({ silent: true });

  registerServiceWorker();

  if (CONFIG.useMock) {
    console.info(
      "%c[همراه] حالت داده آزمایشی فعال است. برای اتصال به بک‌اند: VITE_USE_MOCK=false",
      "color:#5de0d0",
    );
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname,
  );
  const isSecure = window.location.protocol === "https:" || isLocalhost;
  if (!isSecure) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("../sw.js", import.meta.url), { scope: "./" })
      .catch((error) =>
        console.warn("[pwa] ثبت Service Worker انجام نشد.", error),
      );
  });
}

bootstrap().catch((error) => {
  console.error("[app] راه‌اندازی ناموفق بود", error);
  const main = document.getElementById("main");
  if (main) {
    main.innerHTML = `
      <div class="state state-error" role="alert">
        <p class="state-title">برنامه بالا نیامد</p>
        <p class="state-text">صفحه را دوباره بارگذاری کنید. اگر مشکل ادامه داشت با پشتیبانی تماس بگیرید.</p>
        <button class="btn btn-outline btn-sm" type="button" onclick="location.reload()">بارگذاری دوباره</button>
      </div>`;
  }
});

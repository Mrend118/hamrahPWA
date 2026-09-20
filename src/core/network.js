import { createStore } from "./store.js";
import { icon } from "../assets/icons/index.js";

export const networkStore = createStore({ online: navigator.onLine !== false });

export function initNetworkWatcher() {
  const banner = document.getElementById("offline-banner");

  const render = ({ online }) => {
    if (!banner) return;
    banner.hidden = online;
    if (!online) {
      banner.innerHTML = `${icon("wifiOff", { size: 16 })}<span>اینترنت قطع است. اطلاعات تا وصل شدن به‌روزرسانی نمی‌شود.</span>`;
    }
  };

  networkStore.subscribe(render, { immediate: true });

  window.addEventListener("online", () => networkStore.set({ online: true }));
  window.addEventListener("offline", () => networkStore.set({ online: false }));
}

export const isOnline = () => networkStore.get().online;

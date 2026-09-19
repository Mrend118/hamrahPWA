import { icon } from "../assets/icons/index.js";
import { escapeHtml } from "../utils/helpers.js";

const ICONS = { success: "check", error: "alert", info: "info" };

export function toast(message, { variant = "info", duration = 3600 } = {}) {
  const region = document.getElementById("toast-region");
  if (!region) return;

  const node = document.createElement("div");
  node.className = "toast";
  node.dataset.variant = variant;
  node.setAttribute("role", variant === "error" ? "alert" : "status");
  node.innerHTML = `${icon(ICONS[variant] ?? "info", { size: 18 })}<span>${escapeHtml(message)}</span>`;
  region.append(node);

  const remove = () => {
    node.dataset.leaving = "true";
    node.addEventListener("animationend", () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };

  setTimeout(remove, duration);
  node.addEventListener("click", remove);
}

export const toastSuccess = (message) => toast(message, { variant: "success" });
export const toastError = (message) =>
  toast(message, { variant: "error", duration: 5000 });

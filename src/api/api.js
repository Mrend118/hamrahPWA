import { CONFIG } from "../config.js";
import { ApiError, ERROR_KINDS, kindFromStatus } from "./errors.js";
import { storage, STORAGE_KEYS } from "../utils/storage.js";
import { mockRequest } from "../mock/index.js";

export const ENDPOINTS = {
  // احراز هویت
  login: "/auth/login",
  logout: "/auth/logout",
  me: "/auth/me",

  // پروفایل و آمار
  profile: "/profile",
  studyStats: "/study-stats",
  subjects: "/subjects",
  subjectStats: "/subjects/stats",

  // نشست مطالعه
  sessionStart: "/study-sessions/start",
  sessionPause: "/study-sessions/pause",
  sessionResume: "/study-sessions/resume",
  sessionEnd: "/study-sessions/end",
  sessionSave: "/study-sessions/save",
  sessionActive: "/study-sessions/active",

  // رتبه‌بندی
  leaderboard: "/leaderboard",

  // اطلاعیه‌ها
  announcements: "/announcements",

  // گفت‌وگو با مشاور
  chatMessages: "/chat/messages",
};

/** ساخت آدرس کامل + پارامترهای کوئری */
function buildUrl(endpoint, params) {
  const base = String(CONFIG.apiBaseUrl || "").replace(/\/$/, "");
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const query = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  return `${base}${path}${query ? `?${query}` : ""}`;
}

/** هدرهای احراز هویت بر اساس روش انتخابی بک‌اند */
function authHeaders() {
  if (CONFIG.authMode !== "token") return {};
  const token = storage.get(STORAGE_KEYS.authToken);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * درخواست پایه.
 * @param {string} endpoint یکی از مقادیر ENDPOINTS
 * @param {{method?: string, body?: any, params?: object, signal?: AbortSignal, auth?: boolean}} options
 * @returns {Promise<{data: any, status: number, serverTime: number}>}
 */
export async function request(endpoint, options = {}) {
  const { method = "GET", body, params, signal, auth = true } = options;

  // حالت داده آزمایشی
  if (CONFIG.useMock) {
    return mockRequest(method, endpoint, { body, params });
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ApiError(ERROR_KINDS.offline, { endpoint });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort("timeout"),
    CONFIG.apiTimeout,
  );
  if (signal)
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });

  let response;
  try {
    response = await fetch(buildUrl(endpoint, params), {
      method,
      signal: controller.signal,
      credentials: CONFIG.authMode === "cookie" ? "include" : "same-origin",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(auth ? authHeaders() : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      throw new ApiError(ERROR_KINDS.timeout, { endpoint, details: error });
    }
    // خطای شبکه: DNS، قطع اینترنت، CORS
    throw new ApiError(ERROR_KINDS.offline, { endpoint, details: error });
  }
  clearTimeout(timeoutId);

  // زمان سرور برای اصلاح اختلاف ساعت دستگاه کاربر
  const serverDate = response.headers.get("Date");
  const serverTime = serverDate ? new Date(serverDate).getTime() : Date.now();

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const kind = kindFromStatus(response.status);
    console.error("[api]", method, endpoint, response.status, payload);
    throw new ApiError(kind, {
      status: response.status,
      endpoint,
      details: payload,
    });
  }

  return { data: payload, status: response.status, serverTime };
}

/** میان‌برهای خوانا */
export const http = {
  get: (endpoint, options) => request(endpoint, { ...options, method: "GET" }),
  post: (endpoint, body, options) =>
    request(endpoint, { ...options, method: "POST", body }),
  patch: (endpoint, body, options) =>
    request(endpoint, { ...options, method: "PATCH", body }),
  put: (endpoint, body, options) =>
    request(endpoint, { ...options, method: "PUT", body }),
  del: (endpoint, options) =>
    request(endpoint, { ...options, method: "DELETE" }),
};

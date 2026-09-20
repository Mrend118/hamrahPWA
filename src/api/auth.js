import { ENDPOINTS, http } from "./api.js";
import { storage, STORAGE_KEYS } from "../utils/storage.js";
import { CONFIG } from "../config.js";

export async function login(credentials) {
  const { data } = await http.post(ENDPOINTS.login, credentials, {
    auth: false,
  });
  if (CONFIG.authMode === "token" && data?.token) {
    storage.set(STORAGE_KEYS.authToken, data.token);
  }
  if (data?.user) storage.set(STORAGE_KEYS.authUser, data.user);

  return data;
}

export async function fetchCurrentUser() {
  const { data } = await http.get(ENDPOINTS.me);
  if (data) storage.set(STORAGE_KEYS.authUser, data);
  return data;
}

export async function logout() {
  try {
    await http.post(ENDPOINTS.logout, {});
  } catch (error) {
    console.warn("[auth] خروج سمت سرور ناموفق بود؛ وضعیت محلی پاک شد.", error);
  } finally {
    storage.remove(STORAGE_KEYS.authToken);
    storage.remove(STORAGE_KEYS.authUser);
    storage.remove(STORAGE_KEYS.activeSession);
  }
}

export function hasStoredCredentials() {
  if (CONFIG.authMode === "cookie")
    return Boolean(storage.get(STORAGE_KEYS.authUser));
  return Boolean(storage.get(STORAGE_KEYS.authToken));
}

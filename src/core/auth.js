import { createStore } from "./store.js";
import {
  fetchCurrentUser,
  hasStoredCredentials,
  login as loginRequest,
  logout as logoutRequest,
} from "../api/auth.js";
import { storage, STORAGE_KEYS } from "../utils/storage.js";
import { ROUTES } from "../config.js";

export const authStore = createStore({
  status: "unknown", // unknown | authenticated | anonymous
  user: storage.get(STORAGE_KEYS.authUser, null),
});

export const isAuthenticated = () => authStore.get().status === "authenticated";
export const currentUser = () => authStore.get().user;

export async function initAuth() {
  if (!hasStoredCredentials()) {
    authStore.set({ status: "anonymous", user: null });
    return;
  }

  authStore.set({
    status: "authenticated",
    user: storage.get(STORAGE_KEYS.authUser, null),
  });

  try {
    const user = await fetchCurrentUser();
    authStore.set({ status: "authenticated", user });
  } catch (error) {
    if (error?.isAuthError) {
      await clearSession();
    } else {
      console.warn(
        "[auth] اعتبارسنجی کاربر ممکن نشد؛ ادامه با داده محلی.",
        error,
      );
    }
  }
}

export async function login(credentials) {
  const data = await loginRequest(credentials);
  authStore.set({ status: "authenticated", user: data?.user ?? null });
  return data;
}

export async function logout() {
  await logoutRequest();
  authStore.set({ status: "anonymous", user: null });
  window.location.hash = `#${ROUTES.login}`;
}

export async function clearSession() {
  storage.remove(STORAGE_KEYS.authToken);
  storage.remove(STORAGE_KEYS.authUser);
  storage.remove(STORAGE_KEYS.activeSession);
  authStore.set({ status: "anonymous", user: null });
}

export async function handleAuthError() {
  await clearSession();
  window.location.hash = `#${ROUTES.login}`;
}

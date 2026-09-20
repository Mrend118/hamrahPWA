import { readEnv } from "./utils/helpers.js";

export const CONFIG = {
  apiBaseUrl: readEnv("VITE_API_BASE_URL", "/api"),
  useMock: String(readEnv("VITE_USE_MOCK", "true")) === "true",
  authMode: readEnv("VITE_AUTH_MODE", "token"),
  apiTimeout: Number(readEnv("VITE_API_TIMEOUT", 15000)),
  timerSyncInterval: 60000,
  appName: "همراه",
};

export const ROUTES = {
  home: "/home",
  timer: "/timer",
  leaderboard: "/leaderboard",
  notifications: "/notifications",
  consultant: "/consultant",
  login: "/login",
  admin: "/admin",
};


import { readEnv } from './utils/helpers.js';

export const CONFIG = {
  /** آدرس پایه API. در توسعه از پروکسی Vite استفاده می‌شود. */
  apiBaseUrl: readEnv('VITE_API_BASE_URL', '/api'),

  /** true = */
  useMock: String(readEnv('VITE_USE_MOCK', 'true')) === 'true',

  /** روش احراز هویت*/
  authMode: readEnv('VITE_AUTH_MODE', 'token'),

  /** تایم‌اوت درخواست‌ها (میلی‌ثانیه) */
  apiTimeout: Number(readEnv('VITE_API_TIMEOUT', 15000)),

  /** فاصله همگام‌سازی تایمر با بک‌اند */
  timerSyncInterval: 60000,

  appName: 'همراه',
};

export const ROUTES = {
  home: '/home',
  timer: '/timer',
  leaderboard: '/leaderboard',
  notifications: '/notifications',
  consultant: '/consultant',
  login: '/login',
};

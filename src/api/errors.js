export const ERROR_KINDS = {
  offline: "offline",
  timeout: "timeout",
  badRequest: "badRequest",
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  notFound: "notFound",
  conflict: "conflict",
  validation: "validation",
  server: "server",
  unknown: "unknown",
};

const MESSAGES = {
  offline: "اتصال اینترنت برقرار نیست. پس از وصل شدن دوباره تلاش کنید.",
  timeout: "پاسخی از سرور دریافت نشد. دوباره تلاش کنید.",
  badRequest: "درخواست معتبر نبود. اطلاعات واردشده را بررسی کنید.",
  unauthorized: "برای ادامه باید وارد حساب خود شوید.",
  forbidden: "شما اجازه دسترسی به این بخش را ندارید.",
  notFound: "اطلاعات مورد نظر پیدا نشد.",
  conflict: "این عملیات قبلاً انجام شده است.",
  validation: "اطلاعات واردشده کامل یا درست نیست.",
  server: "مشکلی در سرور رخ داده است. کمی بعد دوباره تلاش کنید.",
  unknown: "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.",
};

export class ApiError extends Error {
  /**
   * @param {string} kind یکی از ERROR_KINDS
   * @param {{status?: number, endpoint?: string, details?: any, message?: string}} meta
   */
  constructor(kind, meta = {}) {
    super(meta.message || MESSAGES[kind] || MESSAGES.unknown);
    this.name = "ApiError";
    this.kind = kind;
    this.status = meta.status ?? 0;
    this.endpoint = meta.endpoint ?? "";
    this.details = meta.details ?? null;
    this.userMessage = MESSAGES[kind] || MESSAGES.unknown;
  }

  get isAuthError() {
    return this.kind === ERROR_KINDS.unauthorized;
  }

  get isOffline() {
    return this.kind === ERROR_KINDS.offline;
  }

  get isRetryable() {
    return [
      ERROR_KINDS.offline,
      ERROR_KINDS.timeout,
      ERROR_KINDS.server,
      ERROR_KINDS.unknown,
    ].includes(this.kind);
  }
}

/** تبدیل کد وضعیت HTTP به نوع خطا */
export function kindFromStatus(status) {
  if (status === 400) return ERROR_KINDS.badRequest;
  if (status === 401) return ERROR_KINDS.unauthorized;
  if (status === 403) return ERROR_KINDS.forbidden;
  if (status === 404) return ERROR_KINDS.notFound;
  if (status === 409) return ERROR_KINDS.conflict;
  if (status === 422) return ERROR_KINDS.validation;
  if (status >= 500) return ERROR_KINDS.server;
  return ERROR_KINDS.unknown;
}

export function userMessageOf(error) {
  if (error instanceof ApiError) return error.userMessage;
  return MESSAGES.unknown;
}

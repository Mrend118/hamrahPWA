import { ENDPOINTS, http } from "./api.js";

/**
 * API Name: دریافت پیام‌ها
 */
export async function getMessages(params) {
  const { data } = await http.get(ENDPOINTS.chatMessages, { params });
  return Array.isArray(data) ? data : (data?.items ?? []);
}

/**
 * API Name: ارسال پیام
 */
export async function sendMessage(text) {
  const { data } = await http.post(ENDPOINTS.chatMessages, { text });
  return data;
}

/**
 * @param {(message: object) => void} onMessage
 * @returns {() => void} unsubscribe
 */
export function subscribeToMessages(onMessage) {
  void onMessage;
  return () => {};
}

import { ENDPOINTS, http } from "./api.js";
import { CONFIG } from "../config.js";
import { storage, STORAGE_KEYS } from "../utils/storage.js";

export async function getMessages(params) {
  const { data } = await http.get(ENDPOINTS.chatMessages, { params });
  return Array.isArray(data) ? data : (data?.items ?? []);
}

export async function sendMessage(text, studentId = null) {
  const payload = { text };
  if (studentId != null) payload.studentId = studentId;
  const { data } = await http.post(ENDPOINTS.chatMessages, payload);
  return data;
}

export function subscribeToMessages(onMessage) {
  if (CONFIG.useMock) return () => {};
  const token = storage.get(STORAGE_KEYS.authToken);
  if (!token) return () => {};
  let stopped = false;
  let pollTimer = null;
  let socket = null;

  const poll = async () => {
    if (stopped) return;
    try {
      const items = await getMessages();
      items.forEach(onMessage);
    } catch {}
  };
  const startPolling = () => {
    if (pollTimer || stopped) return;
    poll();
    pollTimer = setInterval(poll, 10000);
  };

  if (typeof WebSocket === "undefined") {
    startPolling();
    return () => {
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }
  const base = new URL(CONFIG.apiBaseUrl || "/api", window.location.origin);
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(
    `${protocol}//${base.host}${base.pathname.replace(/\/$/, "")}/ws/chat?token=${encodeURIComponent(token)}`,
  );
  socket.addEventListener("message", (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {}
  });
  socket.addEventListener("close", startPolling);
  socket.addEventListener("error", startPolling);
  return () => {
    stopped = true;
    socket?.close();
    if (pollTimer) clearInterval(pollTimer);
  };
}

import {
  getMessages,
  sendMessage,
  subscribeToMessages,
} from "../../api/chat.js";
import {
  bindRetry,
  emptyState,
  errorState,
  skeletonRows,
} from "../../components/loading.js";
import { toastError } from "../../components/toast.js";
import { icon } from "../../assets/icons/index.js";
import { formatTime, formatDate } from "../../utils/format-time.js";
import { escapeHtml, setButtonLoading } from "../../utils/helpers.js";
import { currentUser } from "../../core/auth.js";

export async function render(outlet) {
  const user = currentUser();
  let messages = [];
  let aborted = false;
  let sending = false;

  outlet.innerHTML = `
    <header class="page-head">
      <h1>درخواست مشاوره و گفتگو</h1>
      <p>درخواستت را همین‌جا بنویس؛ معمولاً تا ۲۴ ساعت آینده پاسخ می‌گیری${user?.consultantName ? ` — مشاور شما: ${escapeHtml(user.consultantName)}` : ""}.</p>
    </header>

    <div class="chat-layout">
      <div class="chat-scroll" data-part="scroll" aria-live="polite" aria-relevant="additions">
        ${skeletonRows(4, 48)}
      </div>

      <form class="chat-composer" data-part="form" autocomplete="off">
        <label class="sr-only" for="chat-input">متن پیام</label>
        <textarea class="textarea" id="chat-input" name="text" rows="1" placeholder="درخواست یا سوالت رو اینجا بنویس…" maxlength="1200"></textarea>
        <button class="btn btn-primary btn-icon" type="submit" data-part="send" aria-label="ارسال پیام">
          ${icon("send", { size: 18 })}
        </button>
      </form>
    </div>`;

  const scroll = outlet.querySelector('[data-part="scroll"]');
  const form = outlet.querySelector('[data-part="form"]');
  const input = outlet.querySelector("#chat-input");
  const sendButton = outlet.querySelector('[data-part="send"]');

  const scrollToEnd = () => {
    scroll.scrollTop = scroll.scrollHeight;
  };

  function paint() {
    if (!messages.length) {
      scroll.innerHTML = emptyState({
        title: "هنوز پیامی رد و بدل نشده.",
        text: "اولین سوالت را بپرس؛ مشاور در اولین فرصت جواب می‌دهد.",
        iconName: "chat",
      });
      return;
    }

    let lastDay = "";
    scroll.innerHTML = messages
      .map((message) => {
        const day = formatDate(message.createdAt);
        const separator =
          day && day !== lastDay
            ? `<span class="chat-day">${escapeHtml(day)}</span>`
            : "";
        lastDay = day || lastDay;

        return `${separator}
        <div class="bubble" data-from="${message.from === "me" ? "me" : "consultant"}" data-status="${escapeHtml(message.status ?? "sent")}" data-id="${escapeHtml(message.id)}">
          <span>${escapeHtml(message.text ?? "")}</span>
          <span class="bubble-time num">${escapeHtml(formatTime(message.createdAt))}${message.status === "sending" ? " • در حال ارسال" : ""}</span>
          ${message.status === "failed" ? `<button class="bubble-retry" type="button" data-resend="${escapeHtml(message.id)}">${icon("refresh", { size: 12 })} ارسال نشد، تلاش دوباره</button>` : ""}
        </div>`;
      })
      .join("");

    scrollToEnd();
  }

  async function load() {
    scroll.innerHTML = skeletonRows(4, 48);
    try {
      messages = await getMessages();
      if (aborted) return;
      paint();
    } catch (error) {
      if (aborted) return;
      scroll.innerHTML = errorState({
        title: "دریافت پیام‌ها با مشکل مواجه شد.",
        text: error.userMessage ?? "دوباره تلاش کنید.",
      });
      bindRetry(scroll, load);
    }
  }

  async function submit(text, existingId = null) {
    const tempId = existingId ?? `temp-${Date.now()}`;

    if (existingId) {
      const target = messages.find(
        (message) => String(message.id) === String(existingId),
      );
      if (target) target.status = "sending";
    } else {
      messages = [
        ...messages,
        {
          id: tempId,
          from: "me",
          text,
          createdAt: new Date().toISOString(),
          status: "sending",
        },
      ];
    }
    paint();

    sending = true;
    setButtonLoading(sendButton, true, "");
    try {
      const saved = await sendMessage(text);
      if (aborted) return;
      messages = messages.map((message) =>
        String(message.id) === String(tempId)
          ? { ...saved, from: "me", status: "sent" }
          : message,
      );
      paint();
    } catch (error) {
      if (aborted) return;
      messages = messages.map((message) =>
        String(message.id) === String(tempId)
          ? { ...message, status: "failed" }
          : message,
      );
      paint();
      toastError(error.userMessage ?? "پیام ارسال نشد.");
    } finally {
      sending = false;
      setButtonLoading(sendButton, false);
      sendButton.innerHTML = icon("send", { size: 18 });
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || sending) return;
    input.value = "";
    input.style.height = "auto";
    submit(text);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });

  scroll.addEventListener("click", (event) => {
    const retry = event.target.closest("[data-resend]");
    if (!retry) return;
    const message = messages.find(
      (item) => String(item.id) === String(retry.dataset.resend),
    );
    if (message) submit(message.text, message.id);
  });

  const unsubscribe = subscribeToMessages((message) => {
    if (messages.some((item) => String(item.id) === String(message.id))) return;
    messages = [...messages, message];
    paint();
  });

  await load();

  return {
    destroy() {
      aborted = true;
      unsubscribe();
    },
  };
}

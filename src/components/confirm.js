import { escapeHtml } from "../utils/helpers.js";

export function confirmAction({
  title = "مطمئن هستید؟",
  text = "",
  confirmLabel = "تأیید",
  cancelLabel = "انصراف",
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog";
    dialog.innerHTML = `
      <h2>${escapeHtml(title)}</h2>
      ${text ? `<p>${escapeHtml(text)}</p>` : ""}
      <div class="confirm-actions">
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" type="button" data-confirm>${escapeHtml(confirmLabel)}</button>
        <button class="btn btn-ghost" type="button" data-cancel>${escapeHtml(cancelLabel)}</button>
      </div>`;

    document.body.append(dialog);
    dialog.showModal();
    dialog.querySelector("[data-confirm]").focus();

    const close = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    dialog
      .querySelector("[data-confirm]")
      .addEventListener("click", () => close(true));
    dialog
      .querySelector("[data-cancel]")
      .addEventListener("click", () => close(false));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close(false);
    });
  });
}

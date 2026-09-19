import { icon } from "../assets/icons/index.js";
import { escapeHtml } from "../utils/helpers.js";

/**
 * @param {HTMLElement} host
 * @param {{subjects: Array, selectedId: any, disabled: boolean, onSelect: Function}} options
 */
export function renderSubjectPicker(
  host,
  { subjects = [], selectedId = null, disabled = false, onSelect },
) {
  host.innerHTML = `<div class="subject-picker" role="group" aria-label="انتخاب درس">
    ${subjects
      .map(
        (subject) => `
      <button class="subject-chip" type="button"
        data-subject-id="${escapeHtml(subject.id)}"
        aria-pressed="${String(subject.id) === String(selectedId)}"
        ${disabled ? "disabled" : ""}>
        ${icon("book", { size: 15 })}<span>${escapeHtml(subject.title)}</span>
      </button>`,
      )
      .join("")}
  </div>`;

  host.querySelectorAll(".subject-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.subjectId;
      host.querySelectorAll(".subject-chip").forEach((other) => {
        other.setAttribute("aria-pressed", String(other === chip));
      });
      onSelect?.(id);
    });
  });
}

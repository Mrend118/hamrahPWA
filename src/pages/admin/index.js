import {
  createAdminAnnouncement,
  createAdminGroup,
  createAdminUser,
  deleteAdminAnnouncement,
  deleteAdminUser,
  getAdminAnnouncements,
  getAdminChats,
  getAdminGroups,
  getAdminUsers,
  getCurriculum,
  getDashboard,
  getProfileChangeRequests,
  reviewProfileChangeRequest,
  getStudentStudyStats,
  changeOwnPassword,
  updateAdminUser,
} from "../../api/admin.js";
import { getMessages, sendMessage } from "../../api/chat.js";
import { getLeaderboard } from "../../api/leaderboard.js";
import { currentUser } from "../../core/auth.js";
import { escapeHtml, setButtonLoading } from "../../utils/helpers.js";
import { toastError, toastSuccess } from "../../components/toast.js";
import { formatDate, formatDuration, secondsToMs } from "../../utils/format-time.js";
import { renderRankTable } from "../../components/leaderboard.js";
import { confirmAction } from "../../components/confirm.js";
import { icon } from "../../assets/icons/index.js";

export async function render(outlet) {
  const actor = currentUser();
  outlet.innerHTML = `
    <header class="page-head admin-head">
      <div><h1>پنل مدیریت</h1><p>${actor?.role === "superadmin" ? "مدیریت کل سامانه" : "مدیریت دانش‌آموزان و محتوای سامانه"}</p></div>
      <span class="badge">${actor?.role === "superadmin" ? "سوپرادمین" : "ادمین"}</span>
    </header>

    <section class="credential-reveal" data-part="credential-reveal" hidden>
      <div>
        <span class="eyebrow">رمز ورود جدید — فقط همین‌بار نمایش داده می‌شود</span>
        <strong class="num" data-part="credential-code"></strong>
      </div>
      <button class="btn btn-primary btn-sm" type="button" data-action="copy-credential">کپی رمز</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="close-credential">بستن</button>
    </section>

    <div class="password-modal-backdrop" data-part="password-modal" hidden>
      <section class="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-modal-title">
        <button class="password-modal-close" type="button" data-action="close-password-modal" aria-label="بستن">${icon("close", { size: 18 })}</button>
        <div class="password-modal-head">
          <span class="password-modal-icon">${icon("key", { size: 24 })}</span>
          <div><span class="eyebrow">مدیریت امن رمز ورود</span><h2 id="password-modal-title">تغییر رمز کاربر</h2><p data-part="password-user-name"></p></div>
        </div>

        <div class="current-password-status">
          ${icon("check", { size: 20 })}
          <div><strong>رمز فعلی امن است</strong><p>رمز فعلی به‌صورت Hash یک‌طرفه نگهداری می‌شود و برای هیچ‌کس قابل مشاهده نیست.</p></div>
        </div>

        <form class="password-change-form" data-part="password-form">
          <label class="field">
            <span class="field-label">رمز جدید</span>
            <div class="password-wrap">
              <input class="input" name="newPassword" type="password" minlength="6" maxlength="64" autocomplete="new-password" required>
              <button class="password-toggle" type="button" data-password-toggle="newPassword" aria-label="نمایش رمز">${icon("eye", { size: 18 })}</button>
            </div>
          </label>
          <div class="password-strength" data-part="password-strength"><span></span><small>حداقل ۶ کاراکتر</small></div>
          <label class="field">
            <span class="field-label">تکرار رمز جدید</span>
            <div class="password-wrap">
              <input class="input" name="confirmPassword" type="password" minlength="6" maxlength="64" autocomplete="new-password" required>
              <button class="password-toggle" type="button" data-password-toggle="confirmPassword" aria-label="نمایش تکرار رمز">${icon("eye", { size: 18 })}</button>
            </div>
          </label>
          <button class="btn btn-outline btn-block" type="button" data-action="generate-password">${icon("spark", { size: 17 })}<span>ساخت رمز قوی تصادفی</span></button>
          <div class="password-modal-actions">
            <button class="btn btn-ghost" type="button" data-action="close-password-modal">انصراف</button>
            <button class="btn btn-primary" type="submit">${icon("save", { size: 17 })}<span>ذخیره رمز جدید</span></button>
          </div>
        </form>
      </section>
    </div>

    <dialog class="password-modal student-detail-modal" data-part="student-detail-modal">
      <button class="password-modal-close" type="button" data-action="close-student-detail">${icon("close", { size: 18 })}</button>
      <div class="password-modal-head"><span class="password-modal-icon">${icon("stats", { size: 24 })}</span><div><span class="eyebrow">کارنامه مطالعه</span><h2 data-part="student-detail-name">دانش‌آموز</h2><p>مجموع زمان و تفکیک درس‌ها</p></div></div>
      <div data-part="student-detail-body"></div>
      <div class="password-modal-actions"><button class="btn btn-ghost" type="button" data-action="close-student-detail">بستن</button><button class="btn btn-primary" type="button" data-action="message-detail-student">ارسال پیام</button></div>
    </dialog>

    <div class="admin-shell">
      <nav class="admin-tabs" aria-label="بخش‌های مدیریت">
        ${adminTab("overview", "خانه", "home", true)}
        ${adminTab("announcements", "اعلان‌ها", "bell")}
        ${adminTab("leaderboard", "رتبه‌ها", "ranking")}
        ${adminTab("messages", "پیام‌ها", "chat")}
        ${adminTab("users", "کاربران", "user")}
        ${adminTab("requests", "درخواست‌ها", "inbox")}
      </nav>

      <div class="admin-tab-content">
        <section class="admin-tab-panel" data-admin-panel="overview">
          <div class="admin-welcome">
            <span class="admin-welcome-icon">${icon("spark", { size: 28 })}</span>
            <div><h2>مرکز فرمان همراه</h2><p>خلاصه وضعیت امروز و دسترسی سریع به مدیریت سامانه.</p></div>
          </div>
          <section class="admin-metrics" data-part="metrics">
            ${Array.from({ length: 4 }, () => '<div class="skeleton" style="height:88px"></div>').join("")}
          </section>
          <div class="admin-quick-grid">
            <button type="button" class="admin-quick-card" data-open-tab="messages">${icon("chat", { size: 22 })}<span><strong>ارسال پیام</strong><small>شروع گفتگو با دانش‌آموز</small></span></button>
            <button type="button" class="admin-quick-card" data-open-tab="announcements">${icon("megaphone", { size: 22 })}<span><strong>اعلان جدید</strong><small>اطلاع‌رسانی سریع</small></span></button>
            <button type="button" class="admin-quick-card" data-open-tab="users">${icon("user", { size: 22 })}<span><strong>مدیریت کاربران</strong><small>حساب و رمز ورود</small></span></button>
          </div>
          ${actor?.role === "superadmin" ? `<form class="panel own-password-form" data-part="own-password-form">
            <div class="section-head"><div><h2>تغییر رمز سوپرادمین</h2><p class="hint">رمز فعلی و رمز جدید را وارد کنید.</p></div>${icon("key", { size: 22 })}</div>
            <div class="admin-inline-form">
              <input class="input" name="currentCode" type="password" placeholder="رمز فعلی" minlength="4" required>
              <input class="input" name="newCode" type="password" placeholder="رمز جدید" minlength="6" required>
              <input class="input" name="confirmCode" type="password" placeholder="تکرار رمز جدید" minlength="6" required>
              <button class="btn btn-primary" type="submit">تغییر رمز</button>
            </div>
          </form>` : ""}
        </section>

        <section class="admin-tab-panel" data-admin-panel="announcements" hidden>
          <div class="admin-grid">
            <section class="panel admin-panel">
              <div class="section-head"><h2>انتشار اطلاعیه</h2><span class="hint">برای همه یا یک گروه</span></div>
              <form data-part="announcement-form" class="admin-form">
                <label class="field"><span class="field-label">عنوان</span><input class="input" name="title" maxlength="180" required></label>
                <label class="field"><span class="field-label">متن اطلاعیه</span><textarea class="textarea" name="body" rows="4" maxlength="5000" required></textarea></label>
                <label class="field"><span class="field-label">نوع</span><select class="input" name="tone"><option value="info">اطلاع‌رسانی</option><option value="warning">هشدار</option><option value="danger">مهم</option></select></label>
                <button class="btn btn-primary" type="submit">انتشار اطلاعیه</button>
              </form>
            </section>
            <section class="panel admin-panel">
              <div class="section-head"><h2>اطلاعیه‌های اخیر</h2><button class="btn btn-ghost btn-sm" data-action="reload" type="button">به‌روزرسانی</button></div>
              <div data-part="announcements"></div>
            </section>
          </div>
        </section>

        <section class="admin-tab-panel" data-admin-panel="leaderboard" hidden>
          <section class="panel admin-panel">
        <div class="section-head"><h2>لیدربورد دانش‌آموزان</h2>
          <select class="input admin-period" data-part="leaderboard-period">
            <option value="day">امروز</option>
            <option value="week" selected>این هفته</option>
            <option value="month">این ماه</option>
            <option value="all">کل دوره</option>
          </select>
        </div>
        <div data-part="leaderboard"></div>
          </section>
        </section>

        <section class="admin-tab-panel" data-admin-panel="messages" hidden>
          <section class="panel admin-panel">
            <div class="section-head"><h2>مشاوره و پیام‌ها</h2><button class="btn btn-ghost btn-sm" data-action="reload-chats" type="button">به‌روزرسانی</button></div>
            <div class="admin-chat">
              <div data-part="chat-list" class="admin-chat-list"></div>
              <div data-part="chat-thread" class="admin-chat-thread"><p class="state-text">یک دانش‌آموز را انتخاب و گفتگو را شروع کنید.</p></div>
            </div>
            <form data-part="chat-form" class="admin-chat-form" hidden>
              <textarea class="textarea" name="text" rows="2" maxlength="1200" placeholder="پیام یا پاسخ مشاور…" required></textarea>
              <button class="btn btn-primary" type="submit">ارسال پیام</button>
            </form>
          </section>
        </section>

        <section class="admin-tab-panel" data-admin-panel="users" hidden>
          <section class="panel admin-panel admin-users-panel">
            <div class="section-head"><h2>کاربران</h2><span class="hint">${actor?.role === "superadmin" ? "دانش‌آموزان و ادمین‌ها" : "دانش‌آموزان تحت مدیریت شما"}</span></div>
            <form data-part="user-form" class="admin-inline-form">
              <input class="input" name="fullName" placeholder="نام و نام خانوادگی" maxlength="160" required>
              <select class="input" name="grade" data-part="grade-field"><option value="">پایه تحصیلی</option><option>هفتم</option><option>هشتم</option><option>نهم</option><option>دهم ریاضی</option><option>یازدهم ریاضی</option><option>دوازدهم ریاضی</option><option>دهم تجربی</option><option>یازدهم تجربی</option><option>دوازدهم تجربی</option><option>دهم انسانی</option><option>یازدهم انسانی</option><option>دوازدهم انسانی</option></select>
              <select class="input" name="groupId" data-part="user-group"><option value="">بدون گروه</option></select>
              ${actor?.role === "superadmin" ? '<select class="input" name="role"><option value="student">دانش‌آموز</option><option value="admin">ادمین</option></select>' : '<input type="hidden" name="role" value="student">'}
              <button class="btn btn-outline" type="submit">ساخت کاربر</button>
            </form>
            <details class="panel group-manager" open>
              <summary><strong>گروه‌های آموزشی و مشاور</strong></summary>
              <form data-part="group-form" class="admin-form">
                <input class="input" name="name" placeholder="نام گروه؛ مثلاً نهم متوسطه اول" required>
                <div class="admin-inline-form">
                  <select class="input" name="track"><option value="middle">متوسطه اول</option><option value="math">ریاضی</option><option value="experimental">تجربی</option><option value="humanities">انسانی</option></select>
                  <select class="input" name="grade"></select>
                  <select class="input" name="consultantId" data-part="group-consultant"><option value="">مشاور خودکار/بدون مشاور</option></select>
                </div>
                <div class="group-subject-picker" data-part="group-subjects"></div>
                <button class="btn btn-primary" type="submit">ساخت گروه</button>
              </form>
              <div data-part="groups"></div>
            </details>
            <div data-part="users" class="admin-table-wrap"></div>
          </section>
        </section>

        <section class="admin-tab-panel" data-admin-panel="requests" hidden>
          <section class="panel admin-panel">
            <div class="section-head"><h2>درخواست‌های ویرایش اطلاعات</h2><span class="hint">${actor?.role === "superadmin" ? "تأیید یا رد درخواست‌ها" : "فقط سوپرادمین امکان بررسی نهایی دارد"}</span></div>
            <div data-part="profile-requests"></div>
          </section>
        </section>
      </div>
    </div>`;

  const metrics = outlet.querySelector('[data-part="metrics"]');
  const announcements = outlet.querySelector('[data-part="announcements"]');
  const users = outlet.querySelector('[data-part="users"]');
  const leaderboard = outlet.querySelector('[data-part="leaderboard"]');
  const leaderboardPeriod = outlet.querySelector(
    '[data-part="leaderboard-period"]',
  );
  const chatList = outlet.querySelector('[data-part="chat-list"]');
  const chatThread = outlet.querySelector('[data-part="chat-thread"]');
  const chatForm = outlet.querySelector('[data-part="chat-form"]');
  const profileRequests = outlet.querySelector(
    '[data-part="profile-requests"]',
  );
  const credentialReveal = outlet.querySelector(
    '[data-part="credential-reveal"]',
  );
  const credentialCode = outlet.querySelector('[data-part="credential-code"]');
  const passwordModal = outlet.querySelector('[data-part="password-modal"]');
  const passwordForm = outlet.querySelector('[data-part="password-form"]');
  const passwordUserName = outlet.querySelector(
    '[data-part="password-user-name"]',
  );
  const passwordStrength = outlet.querySelector(
    '[data-part="password-strength"]',
  );
  const adminTabs = [...outlet.querySelectorAll("[data-admin-tab]")];
  const adminPanels = [...outlet.querySelectorAll("[data-admin-panel]")];
  const announcementForm = outlet.querySelector(
    '[data-part="announcement-form"]',
  );
  const userForm = outlet.querySelector('[data-part="user-form"]');
  const userGroup = outlet.querySelector('[data-part="user-group"]');
  const groupForm = outlet.querySelector('[data-part="group-form"]');
  const groupSubjects = outlet.querySelector('[data-part="group-subjects"]');
  const groupsHost = outlet.querySelector('[data-part="groups"]');
  const groupConsultant = outlet.querySelector('[data-part="group-consultant"]');
  const ownPasswordForm = outlet.querySelector('[data-part="own-password-form"]');
  const studentDetailModal = outlet.querySelector('[data-part="student-detail-modal"]');
  const studentDetailName = outlet.querySelector('[data-part="student-detail-name"]');
  const studentDetailBody = outlet.querySelector('[data-part="student-detail-body"]');
  let selectedStudentId = null;
  let passwordTargetId = null;
  let detailStudentId = null;
  let groupsCache = [];
  let usersCache = [];

  function openPasswordModal(userId, userName) {
    passwordTargetId = userId;
    passwordUserName.textContent = userName || "کاربر انتخاب‌شده";
    passwordForm.reset();
    updatePasswordStrength("");
    passwordModal.hidden = false;
    document.body.classList.add("modal-open");
    window.setTimeout(() => {
      passwordModal.classList.add("is-visible");
      passwordForm.elements.newPassword.focus();
    }, 0);
  }

  function closePasswordModal() {
    passwordModal.classList.remove("is-visible");
    passwordTargetId = null;
    document.body.classList.remove("modal-open");
    window.setTimeout(() => {
      passwordModal.hidden = true;
      passwordForm.reset();
    }, 180);
  }

  function updatePasswordStrength(value) {
    const score =
      Number(value.length >= 6) +
      Number(value.length >= 10) +
      Number(/[a-zA-Z]/.test(value) && /\d/.test(value)) +
      Number(/[^a-zA-Z0-9]/.test(value));
    const labels = ["حداقل ۶ کاراکتر", "ضعیف", "متوسط", "خوب", "قوی"];
    passwordStrength.dataset.score = String(score);
    passwordStrength.querySelector("small").textContent = labels[score];
  }

  function openAdminTab(name) {
    adminTabs.forEach((tab) => {
      const active = tab.dataset.adminTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    adminPanels.forEach((panel) => {
      panel.hidden = panel.dataset.adminPanel !== name;
    });
    sessionStorage.setItem("hamrah:admin-tab", name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function revealCredential(code) {
    credentialCode.textContent = code;
    credentialReveal.hidden = false;
    credentialReveal.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function loadDashboard() {
    try {
      const data = await getDashboard();
      metrics.innerHTML =
        metric("دانش‌آموز فعال", data.students) +
        metric("گروه", data.groups) +
        metric("تایمر فعال", data.activeTimers) +
        metric("مطالعه امروز", `${data.todayStudyMinutes ?? 0} دقیقه`);
    } catch (error) {
      metrics.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "آمار دریافت نشد.")}</p>`;
    }
  }

  async function loadAnnouncements() {
    announcements.innerHTML =
      '<div class="skeleton" style="height:120px"></div>';
    try {
      const items = await getAdminAnnouncements();
      announcements.innerHTML = items.length
        ? `<div class="admin-list">${items
            .slice(0, 8)
            .map(
              (item) =>
                `<article class="admin-list-item"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body)}</p><small>${escapeHtml(formatDate(item.createdAt))}</small></div><button class="btn btn-ghost btn-sm" data-delete-announcement="${item.id}" type="button">حذف</button></article>`,
            )
            .join("")}</div>`
        : '<p class="state-text">هنوز اطلاعیه‌ای منتشر نشده است.</p>';
    } catch (error) {
      announcements.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "اطلاعیه‌ها دریافت نشدند.")}</p>`;
    }
  }

  async function loadUsers() {
    users.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    try {
      const items = await getAdminUsers();
      usersCache = items;
      users.innerHTML = items.length
        ? `<table class="admin-table"><thead><tr><th>نام</th><th>نقش</th><th>شناسه عمومی</th><th>پایه</th><th>وضعیت</th><th>امنیت و عملیات</th></tr></thead><tbody>${items.map((item) => renderUserRow(item, actor)).join("")}</tbody></table>`
        : '<p class="state-text">کاربری در این بخش وجود ندارد.</p>';
      const admins = items.filter((item) => ["admin", "superadmin"].includes(item.role));
      if (groupConsultant) groupConsultant.innerHTML = '<option value="">مشاور خودکار/بدون مشاور</option>' + admins.map((item) => `<option value="${item.id}">${escapeHtml(item.fullName)}</option>`).join("");
    } catch (error) {
      users.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "کاربران دریافت نشدند.")}</p>`;
    }
  }

  async function loadGroups() {
    try {
      groupsCache = await getAdminGroups();
      if (userGroup) userGroup.innerHTML = '<option value="">بدون گروه</option>' + groupsCache.map((group) => `<option value="${group.id}">${escapeHtml(group.name)}${group.grade ? ` — ${escapeHtml(group.grade)}` : ""}</option>`).join("");
      if (groupsHost) groupsHost.innerHTML = groupsCache.length ? `<div class="admin-list">${groupsCache.map(renderGroupCard).join("")}</div>` : '<p class="state-text">هنوز گروهی ساخته نشده است.</p>';
    } catch (error) {
      if (groupsHost) groupsHost.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "گروه‌ها دریافت نشدند.")}</p>`;
    }
  }

  function syncGroupGrades() {
    if (!groupForm) return;
    const grades = groupForm.elements.track.value === "middle" ? ["هفتم", "هشتم", "نهم"] : ["دهم", "یازدهم", "دوازدهم"];
    groupForm.elements.grade.innerHTML = grades.map((grade) => `<option>${grade}</option>`).join("");
  }

  async function loadGroupSubjects() {
    if (!groupForm || !groupSubjects) return;
    try {
      const rows = await getCurriculum(groupForm.elements.track.value, groupForm.elements.grade.value);
      groupSubjects.innerHTML = rows.map((row) => `<label class="subject-check"><input type="checkbox" name="subjectIds" value="${row.id}" checked><span>${escapeHtml(row.title)}</span></label>`).join("");
    } catch (error) {
      groupSubjects.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "درس‌ها دریافت نشدند.")}</p>`;
    }
  }

  async function loadLeaderboard() {
    leaderboard.innerHTML = '<div class="skeleton" style="height:180px"></div>';
    try {
      const { items } = await getLeaderboard({
        period: leaderboardPeriod.value,
      });
      leaderboard.innerHTML = items.length
        ? renderRankTable(items.slice(0, 20))
        : '<p class="state-text">هنوز مطالعه‌ای در این بازه ثبت نشده است.</p>';
    } catch (error) {
      leaderboard.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "لیدربورد دریافت نشد.")}</p>`;
    }
  }

  async function loadChats() {
    chatList.innerHTML = '<div class="skeleton" style="height:90px"></div>';
    try {
      const items = await getAdminChats();
      chatList.innerHTML = items.length
        ? items
            .map(
              (item) =>
                `<button type="button" class="admin-chat-person" data-student-id="${item.studentId}" aria-pressed="${String(item.studentId === selectedStudentId)}"><strong>${escapeHtml(item.studentName)}</strong><span>${item.messageCount} پیام</span></button>`,
            )
            .join("")
        : '<p class="state-text">هنوز درخواست مشاوره‌ای ثبت نشده است.</p>';
    } catch (error) {
      chatList.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "گفتگوها دریافت نشدند.")}</p>`;
    }
  }

  async function loadProfileRequests() {
    profileRequests.innerHTML =
      '<div class="skeleton" style="height:100px"></div>';
    try {
      const items = await getProfileChangeRequests();
      profileRequests.innerHTML = items.length
        ? `<div class="admin-list">${items
            .map(
              (item) =>
                `<article class="profile-request-item"><div><strong>${escapeHtml(item.currentFullName)} ← ${escapeHtml(item.requestedFullName)}</strong><p>${requestStatusLabel(item.status)}</p></div>${item.status === "pending" && actor?.role === "superadmin" ? `<div class="admin-row-actions"><button class="btn btn-primary btn-sm" type="button" data-review-request="${item.id}" data-action-value="approve">تأیید</button><button class="btn btn-ghost btn-sm" type="button" data-review-request="${item.id}" data-action-value="reject">رد</button></div>` : ""}</article>`,
            )
            .join("")}</div>`
        : '<p class="state-text">درخواستی ثبت نشده است.</p>';
    } catch (error) {
      profileRequests.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "درخواست‌ها دریافت نشدند.")}</p>`;
    }
  }

  async function loadThread(studentId) {
    selectedStudentId = Number(studentId);
    chatThread.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    try {
      const items = await getMessages({ studentId: selectedStudentId });
      chatThread.innerHTML = items.length
        ? items
            .map(
              (item) =>
                `<div class="admin-message" data-from="${item.from}"><span>${escapeHtml(item.text)}</span></div>`,
            )
            .join("")
        : '<p class="state-text">پیامی وجود ندارد.</p>';
      chatForm.hidden = false;
      chatThread.scrollTop = chatThread.scrollHeight;
      await loadChats();
    } catch (error) {
      chatThread.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "پیام‌ها دریافت نشدند.")}</p>`;
    }
  }

  announcementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = announcementForm.querySelector('button[type="submit"]');
    const data = new FormData(announcementForm);
    setButtonLoading(button, true, "در حال انتشار…");
    try {
      await createAdminAnnouncement({
        title: data.get("title").trim(),
        body: data.get("body").trim(),
        tone: data.get("tone"),
      });
      announcementForm.reset();
      toastSuccess("اطلاعیه منتشر شد.");
      await loadAnnouncements();
    } catch (error) {
      toastError(error.userMessage ?? "انتشار انجام نشد.");
    } finally {
      setButtonLoading(button, false);
    }
  });

  userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = userForm.querySelector('button[type="submit"]');
    const data = new FormData(userForm);
    setButtonLoading(button, true, "در حال ساخت…");
    try {
      const result = await createAdminUser({
        fullName: data.get("fullName").trim(),
        grade: data.get("grade")?.trim() || null,
        groupId: data.get("groupId") ? Number(data.get("groupId")) : null,
        role: data.get("role"),
      });
      userForm.reset();
      revealCredential(result.loginCode);
      toastSuccess("کاربر ساخته شد؛ رمز ورود را کپی کنید.");
      await Promise.all([loadUsers(), loadDashboard()]);
    } catch (error) {
      toastError(error.userMessage ?? "ساخت کاربر انجام نشد.");
    } finally {
      setButtonLoading(button, false);
    }
  });

  if (groupForm) {
    syncGroupGrades();
    await loadGroupSubjects();
    groupForm.elements.track.addEventListener("change", async () => {
      syncGroupGrades();
      await loadGroupSubjects();
    });
    groupForm.elements.grade.addEventListener("change", loadGroupSubjects);
    groupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(groupForm);
      const button = groupForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true, "در حال ساخت…");
      try {
        await createAdminGroup({
          name: data.get("name").trim(),
          track: data.get("track"),
          grade: data.get("grade"),
          consultantId: data.get("consultantId") ? Number(data.get("consultantId")) : null,
          subjectIds: data.getAll("subjectIds").map(Number),
        });
        groupForm.reset();
        syncGroupGrades();
        await Promise.all([loadGroupSubjects(), loadGroups(), loadDashboard()]);
        toastSuccess("گروه آموزشی ساخته شد.");
      } catch (error) {
        toastError(error.userMessage ?? "ساخت گروه انجام نشد.");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  if (ownPasswordForm) {
    ownPasswordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const { currentCode, newCode, confirmCode } = ownPasswordForm.elements;
      if (newCode.value !== confirmCode.value) {
        toastError("رمز جدید و تکرار آن یکسان نیستند.");
        return;
      }
      const button = ownPasswordForm.querySelector('button[type="submit"]');
      setButtonLoading(button, true, "در حال تغییر…");
      try {
        await changeOwnPassword({ currentCode: currentCode.value, newCode: newCode.value });
        ownPasswordForm.reset();
        toastSuccess("رمز سوپرادمین با موفقیت تغییر کرد.");
      } catch (error) {
        toastError(error.userMessage ?? "تغییر رمز انجام نشد.");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  const roleField = userForm.elements.role;
  const gradeField = userForm.elements.grade;
  const syncRoleFields = () => {
    const isStudent = roleField.value === "student";
    gradeField.hidden = !isStudent;
    gradeField.disabled = !isStudent;
    if (userGroup) {
      userGroup.hidden = !isStudent;
      userGroup.disabled = !isStudent;
    }
    if (!isStudent) gradeField.value = "";
  };
  roleField.addEventListener("change", syncRoleFields);
  syncRoleFields();

  passwordForm.elements.newPassword.addEventListener("input", (event) => {
    updatePasswordStrength(event.target.value);
  });
  passwordModal.addEventListener("click", (event) => {
    if (event.target === passwordModal) closePasswordModal();
  });
  const onPasswordEscape = (event) => {
    if (event.key === "Escape" && !passwordModal.hidden) closePasswordModal();
  };
  document.addEventListener("keydown", onPasswordEscape);

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!passwordTargetId) return;
    const newPassword = passwordForm.elements.newPassword.value;
    const confirmPassword = passwordForm.elements.confirmPassword.value;
    if (newPassword.length < 6) {
      toastError("رمز جدید باید حداقل ۶ کاراکتر باشد.");
      passwordForm.elements.newPassword.focus();
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError("رمز جدید و تکرار آن یکسان نیستند.");
      passwordForm.elements.confirmPassword.focus();
      return;
    }
    const submitButton = passwordForm.querySelector('button[type="submit"]');
    setButtonLoading(submitButton, true, "در حال ذخیره…");
    try {
      const result = await updateAdminUser(passwordTargetId, {
        newLoginCode: newPassword,
      });
      closePasswordModal();
      revealCredential(result.loginCode);
      toastSuccess("رمز با موفقیت تغییر کرد؛ نسخه جدید را کپی کنید.");
    } catch (error) {
      toastError(error.userMessage ?? "تغییر رمز انجام نشد.");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });

  leaderboardPeriod.addEventListener("change", loadLeaderboard);

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedStudentId) return;
    const input = chatForm.elements.text;
    const button = chatForm.querySelector('button[type="submit"]');
    const text = input.value.trim();
    if (!text) return;
    setButtonLoading(button, true, "در حال ارسال…");
    try {
      await sendMessage(text, selectedStudentId);
      input.value = "";
      toastSuccess("پاسخ ارسال شد.");
      await loadThread(selectedStudentId);
    } catch (error) {
      toastError(error.userMessage ?? "ارسال پیام انجام نشد.");
    } finally {
      setButtonLoading(button, false);
    }
  });

  outlet.addEventListener("click", async (event) => {
    if (event.target.closest('[data-action="close-student-detail"]')) {
      studentDetailModal?.close();
      detailStudentId = null;
      return;
    }
    if (event.target.closest('[data-action="message-detail-student"]')) {
      const studentId = detailStudentId;
      studentDetailModal?.close();
      if (studentId) {
        openAdminTab("messages");
        await loadThread(studentId);
      }
      return;
    }
    const statsButton = event.target.closest("[data-student-stats]");
    if (statsButton) {
      detailStudentId = Number(statsButton.dataset.studentStats);
      studentDetailName.textContent = statsButton.dataset.studentName || "دانش‌آموز";
      studentDetailBody.innerHTML = '<div class="skeleton" style="height:160px"></div>';
      studentDetailModal?.showModal();
      try {
        studentDetailBody.innerHTML = renderStudentStudyStats(await getStudentStudyStats(detailStudentId));
      } catch (error) {
        studentDetailBody.innerHTML = `<p class="state-text">${escapeHtml(error.userMessage ?? "کارنامه دریافت نشد.")}</p>`;
      }
      return;
    }
    const messageStudent = event.target.closest("[data-message-student]");
    if (messageStudent) {
      openAdminTab("messages");
      await loadThread(messageStudent.dataset.messageStudent);
      return;
    }
    const passwordToggle = event.target.closest("[data-password-toggle]");
    if (passwordToggle) {
      const input =
        passwordForm.elements[passwordToggle.dataset.passwordToggle];
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      passwordToggle.setAttribute(
        "aria-label",
        showing ? "نمایش رمز" : "پنهان کردن رمز",
      );
      passwordToggle.innerHTML = icon(showing ? "eye" : "eyeOff", {
        size: 18,
      });
      return;
    }
    if (event.target.closest('[data-action="generate-password"]')) {
      const generated = generateStrongPassword();
      passwordForm.elements.newPassword.value = generated;
      passwordForm.elements.confirmPassword.value = generated;
      passwordForm.elements.newPassword.type = "text";
      passwordForm.elements.confirmPassword.type = "text";
      updatePasswordStrength(generated);
      toastSuccess("رمز قوی ساخته شد؛ پس از ذخیره می‌توانی آن را کپی کنی.");
      return;
    }
    if (event.target.closest('[data-action="close-password-modal"]')) {
      closePasswordModal();
      return;
    }
    const tab = event.target.closest("[data-admin-tab]");
    if (tab) {
      openAdminTab(tab.dataset.adminTab);
      return;
    }
    const quickTab = event.target.closest("[data-open-tab]");
    if (quickTab) {
      openAdminTab(quickTab.dataset.openTab);
      return;
    }
    if (event.target.closest('[data-action="reload"]'))
      await loadAnnouncements();
    if (event.target.closest('[data-action="reload-chats"]')) await loadChats();
    if (event.target.closest('[data-action="copy-credential"]')) {
      try {
        await copyText(credentialCode.textContent);
        toastSuccess("رمز ورود کپی شد.");
      } catch {
        toastError("کپی خودکار انجام نشد؛ رمز را دستی کپی کنید.");
      }
      return;
    }
    if (event.target.closest('[data-action="close-credential"]')) {
      credentialCode.textContent = "";
      credentialReveal.hidden = true;
      return;
    }
    const chatPerson = event.target.closest("[data-student-id]");
    if (chatPerson) {
      await loadThread(chatPerson.dataset.studentId);
      return;
    }
    const resetUser = event.target.closest("[data-reset-user]");
    if (resetUser) {
      openPasswordModal(
        resetUser.dataset.resetUser,
        resetUser.dataset.userName,
      );
      return;
    }
    const reviewButton = event.target.closest("[data-review-request]");
    if (reviewButton) {
      try {
        await reviewProfileChangeRequest(
          reviewButton.dataset.reviewRequest,
          reviewButton.dataset.actionValue,
        );
        toastSuccess(
          reviewButton.dataset.actionValue === "approve"
            ? "درخواست تأیید و نام کاربر تغییر کرد."
            : "درخواست رد شد.",
        );
        await Promise.all([loadProfileRequests(), loadUsers()]);
      } catch (error) {
        toastError(error.userMessage ?? "بررسی درخواست انجام نشد.");
      }
      return;
    }
    const editUser = event.target.closest("[data-edit-user]");
    if (editUser) {
      const fullName = window.prompt(
        "نام و نام خانوادگی جدید:",
        editUser.dataset.name,
      );
      if (!fullName?.trim()) return;
      try {
        await updateAdminUser(editUser.dataset.editUser, {
          fullName: fullName.trim(),
        });
        toastSuccess("اطلاعات کاربر ویرایش شد.");
        await loadUsers();
      } catch (error) {
        toastError(error.userMessage ?? "ویرایش انجام نشد.");
      }
      return;
    }
    const deleteUser = event.target.closest("[data-delete-user]");
    if (deleteUser) {
      const confirmed = await confirmAction({
        title: "کاربر حذف شود؟",
        text: "حساب کاربر غیرفعال می‌شود و دیگر امکان ورود ندارد.",
        confirmLabel: "حذف کاربر",
        danger: true,
      });
      if (!confirmed) return;
      try {
        await deleteAdminUser(deleteUser.dataset.deleteUser);
        toastSuccess("کاربر غیرفعال شد.");
        await Promise.all([loadUsers(), loadDashboard()]);
      } catch (error) {
        toastError(error.userMessage ?? "حذف انجام نشد.");
      }
      return;
    }
    const button = event.target.closest("[data-delete-announcement]");
    if (!button) return;
    try {
      await deleteAdminAnnouncement(button.dataset.deleteAnnouncement);
      toastSuccess("اطلاعیه غیرفعال شد.");
      await loadAnnouncements();
    } catch (error) {
      toastError(error.userMessage ?? "حذف انجام نشد.");
    }
  });

  await Promise.all([
    loadDashboard(),
    loadAnnouncements(),
    loadUsers(),
    loadGroups(),
    loadLeaderboard(),
    loadChats(),
    loadProfileRequests(),
  ]);
  const savedTab = sessionStorage.getItem("hamrah:admin-tab");
  if (
    savedTab &&
    adminPanels.some((panel) => panel.dataset.adminPanel === savedTab)
  ) {
    openAdminTab(savedTab);
  }
  return {
    destroy() {
      document.removeEventListener("keydown", onPasswordEscape);
      document.body.classList.remove("modal-open");
    },
  };
}

function adminTab(name, label, iconName, active = false) {
  return `<button class="admin-tab" type="button" role="tab" data-admin-tab="${name}" aria-selected="${String(active)}" tabindex="${active ? 0 : -1}">
    <span class="admin-tab-icon">${icon(iconName, { size: 20 })}</span>
    <span>${label}</span>
  </button>`;
}

function metric(label, value) {
  return `<article class="admin-metric"><span>${escapeHtml(label)}</span><strong class="num">${escapeHtml(value ?? 0)}</strong></article>`;
}

function roleLabel(role) {
  return (
    { student: "دانش‌آموز", admin: "ادمین", superadmin: "سوپرادمین" }[role] ??
    role
  );
}

function renderUserRow(item, actor) {
  const superActions =
    actor?.role === "superadmin"
      ? `<button class="btn btn-ghost btn-sm" type="button" data-edit-user="${item.id}" data-name="${escapeHtml(item.fullName)}">ویرایش</button>
         <button class="btn btn-ghost btn-sm" type="button" data-delete-user="${item.id}">حذف</button>`
      : "";
  const credentialAction =
    item.role === "student" || actor?.role === "superadmin"
      ? `<button class="btn btn-outline btn-sm" type="button" data-reset-user="${item.id}" data-user-name="${escapeHtml(item.fullName)}">${icon("key", { size: 15 })}<span>نمایش / تغییر رمز</span></button>`
      : "";
  const studentActions =
    item.role === "student"
      ? `<button class="btn btn-primary btn-sm" type="button" data-student-stats="${item.id}" data-student-name="${escapeHtml(item.fullName)}">${icon("stats", { size: 15 })}<span>کارنامه</span></button>
         <button class="btn btn-ghost btn-sm" type="button" data-message-student="${item.id}">${icon("chat", { size: 15 })}<span>پیام</span></button>`
      : "";
  return `<tr>
    <td data-label="نام">${escapeHtml(item.fullName)}</td>
    <td data-label="نقش">${escapeHtml(roleLabel(item.role))}</td>
    <td data-label="شناسه" class="num">${escapeHtml(item.publicCode)}</td>
    <td data-label="پایه">${escapeHtml(item.grade ?? "—")}<small class="table-subline">${escapeHtml(item.groupName ?? "بدون گروه")}</small></td>
    <td data-label="وضعیت">${item.isActive ? "فعال" : "غیرفعال"}</td>
    <td data-label="امنیت و عملیات"><div class="admin-row-actions">${studentActions}${credentialAction}${superActions}</div></td>
  </tr>`;
}

function renderGroupCard(group) {
  return `<article class="admin-list-item group-card"><div><strong>${escapeHtml(group.name)}</strong><p>${escapeHtml(group.trackLabel || group.track)}${group.grade ? ` — ${escapeHtml(group.grade)}` : ""}</p><small>مشاور: ${escapeHtml(group.consultantName || "تعیین نشده")}</small><div class="subject-chip-list">${(group.subjects || []).map((item) => `<span>${escapeHtml(item.title)}</span>`).join("") || "<span>بدون درس اختصاصی</span>"}</div></div></article>`;
}

function renderStudentStudyStats(data) {
  const subjects = data?.subjects || [];
  return `<div class="student-study-summary"><article class="student-total-card"><span>${icon("clock", { size: 22 })}</span><div><small>مجموع مطالعه</small><strong>${escapeHtml(formatDuration(secondsToMs(data?.totalSeconds || 0)))}</strong></div></article><div class="student-subject-breakdown">${subjects.length ? subjects.map((item) => `<div><span>${escapeHtml(item.title)}</span><strong>${escapeHtml(formatDuration(secondsToMs(item.seconds || 0)))}</strong></div>`).join("") : '<p class="state-text">هنوز مطالعه‌ای ثبت نشده است.</p>'}</div></div>`;
}

function requestStatusLabel(status) {
  return (
    {
      pending: "در انتظار بررسی",
      approved: "تأیید شده",
      rejected: "رد شده",
    }[status] ?? status
  );
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("copy failed");
}

function generateStrongPassword(length = 14) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values].map((value) => alphabet[value % alphabet.length]).join("");
}

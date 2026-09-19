/* صفحه ورود*/

import { icon } from '../../assets/icons/index.js';
import { login } from '../../core/auth.js';
import { ROUTES } from '../../config.js';
import { toastSuccess } from '../../components/toast.js';
import { setButtonLoading } from '../../utils/helpers.js';
import { toEn } from '../../utils/format-time.js';

export async function render(outlet, { navigate }) {
  outlet.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <span class="login-logo">${icon('trophy', { size: 34 })}</span>

        <div>
          <h1>وارد حساب مطالعه‌ات شو</h1>
          <p class="lead">رمز عبوری که مشاور در اختیارت گذاشته را وارد کن تا تایمر، خلاصه مطالعه و رتبه‌بندی فعال شود.</p>
        </div>

        <form class="login-form" data-part="form" novalidate>
          <div class="login-alert" data-part="alert" hidden></div>

          <div class="field">
            <label class="field-label" for="code">رمز عضویت</label>
            <div class="password-wrap">
              <input class="input" id="code" name="code" type="password" inputmode="numeric"
                placeholder="رمز عضویت را وارد کن" autocomplete="current-password" required
                aria-describedby="code-error" />
              <button class="password-toggle" type="button" data-part="toggle"
                aria-label="نمایش رمز" aria-pressed="false">${icon('eye', { size: 18 })}</button>
            </div>
            <p class="field-error" id="code-error" data-part="error" hidden></p>
          </div>

          <button class="btn btn-primary btn-lg btn-block" type="submit" data-part="submit">
            ${icon('login', { size: 18 })}<span>ورود</span>
          </button>
        </form>

        <p class="login-foot">رمز را فراموش کرده‌ای؟ از مشاور خودت بخواه دوباره برایت بفرستد.</p>
      </div>
    </div>`;

  const form = outlet.querySelector('[data-part="form"]');
  const input = outlet.querySelector('#code');
  const submit = outlet.querySelector('[data-part="submit"]');
  const alert = outlet.querySelector('[data-part="alert"]');
  const error = outlet.querySelector('[data-part="error"]');
  const toggle = outlet.querySelector('[data-part="toggle"]');

  let busy = false;

  const showAlert = (message) => {
    alert.innerHTML = `${icon('alert', { size: 18 })}<span>${message}</span>`;
    alert.hidden = false;
  };
  const clearAlert = () => { alert.hidden = true; error.hidden = true; input.removeAttribute('aria-invalid'); };

  toggle.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    toggle.setAttribute('aria-pressed', String(!showing));
    toggle.setAttribute('aria-label', showing ? 'نمایش رمز' : 'پنهان کردن رمز');
    toggle.innerHTML = icon(showing ? 'eye' : 'eyeOff', { size: 18 });
  });

  input.addEventListener('input', clearAlert);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;                     
    clearAlert();

    const code = toEn(input.value.trim()); 
    if (!code) {
      error.innerHTML = `${icon('alert', { size: 15 })}<span>رمز عضویت را وارد کن.</span>`;
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }

    busy = true;
    setButtonLoading(submit, true, 'در حال ورود…');
    try {
      await login({ code });
      toastSuccess('خوش آمدی!');
      navigate(ROUTES.home, { replace: true });
    } catch (err) {
      showAlert(err.userMessage ?? 'ورود انجام نشد. دوباره تلاش کن.');
      input.setAttribute('aria-invalid', 'true');
      input.select();
    } finally {
      busy = false;
      setButtonLoading(submit, false);
    }
  });

  input.focus();

  return { destroy() {} };
}

# راه‌اندازی در cPanel

## پیش‌نیاز قطعی

هاست باید در cPanel بخش **Setup Python App** یا **Application Manager** با Python 3.11 یا جدیدتر داشته باشد. بسته‌های PHP-only قادر به اجرای بک‌اند FastAPI نیستند.

بهتر است برنامه روی ریشه یک ساب‌دامین مانند `app.example.com` نصب شود، نه داخل یک پوشه از دامنه اصلی. AutoSSL/HTTPS باید فعال باشد تا نصب PWA کار کند.

## ساخت Python App

در Setup Python App:

- Python version: 3.11 یا جدیدتر
- Application root: `hamrah`
- Application URL: ریشه ساب‌دامین انتخابی
- Startup file: `passenger_wsgi.py`
- Entry point: `application`

فایل ZIP را داخل Application root استخراج کنید.

## تنظیم محیط

فایل `.env.cpanel.example` را با نام `.env` کپی کنید و دامنه و کلیدها را تغییر دهید:

```bash
cp .env.cpanel.example .env
python -c "import secrets; print(secrets.token_hex(48))"
python -c "import secrets; print(secrets.token_hex(48))"
mkdir -p data
chmod 700 data
```

دو خروجی تصادفی را جداگانه در `SECRET_KEY` و `LOGIN_PEPPER` قرار دهید. در `CORS_ORIGINS` آدرس HTTPS ساب‌دامین را وارد کنید.

## نصب وابستگی‌ها

محیط مجازی ساخته‌شده توسط cPanel را فعال کنید؛ دستور دقیق در بالای صفحه Setup Python App نمایش داده می‌شود. سپس:

```bash
pip install -r requirements-cpanel.txt
```

از داخل cPanel دکمه **Restart** برنامه را بزنید.

## تست

```text
https://YOUR-SUBDOMAIN/api/health
```

باید پاسخ زیر دیده شود:

```json
{"ok":true}
```

حساب‌های تست با `SEED_DEMO=true`:

- دانش‌آموز: `12345678`
- ادمین: `87654321`
- سوپرادمین: `98765432`

پس از تست، حساب‌های واقعی بسازید و `SEED_DEMO=false` کنید. تغییر این مقدار حساب‌های آزمایشی قبلاً ساخته‌شده را حذف نمی‌کند؛ آن‌ها را از پنل سوپرادمین غیرفعال کنید.

## محدودیت cPanel اشتراکی

Passenger معمولاً WebSocket را عبور نمی‌دهد. این نسخه در صورت قطع WebSocket، پیام‌ها را هر ۱۰ ثانیه Poll می‌کند؛ بنابراین چت کار می‌کند اما ممکن است آنی نباشد.

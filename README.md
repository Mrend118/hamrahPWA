# همراه PWA

نسخه یکپارچه فرانت PWA و بک‌اند سامانه ثبت مطالعه دانش‌آموزان.

## امکانات

- ورود با رمز عضویت و JWT
- نقش‌های دانش‌آموز، ادمین و سوپرادمین
- تایمر سمت سرور با شروع، توقف موقت، ادامه، پایان، ثبت نهایی و حذف نشست ثبت‌نشده
- بازیابی تایمر بعد از بسته‌شدن یا Sleep دستگاه
- آمار دقیق ثانیه‌ای روزانه، هفتگی، ماهانه و تفکیک درس
- رتبه‌بندی دوره‌ای
- اعلان عمومی یا مخصوص گروه
- چت زنده دانش‌آموز و مشاور با WebSocket
- درخواست ویرایش نام دانش‌آموز با تأیید سوپرادمین
- نمایش یک‌باره و کپی امن رمز جدید بدون ذخیره متن خام
- پاپ‌آپ امن تغییر رمز با تأیید، چشم نمایش، سنجش قدرت و تولید رمز قوی
- پنل تب‌دار و واکنش‌گرای ادمین و سوپرادمین با ناوبری آیکون‌دار در موبایل، تبلت و لپ‌تاپ
- مدیریت آمار، کاربران، لیدربورد، آغاز گفتگو، مشاوره و انتشار اعلان
- API مدیریت کاربران، گروه‌ها، درس‌ها، اعلان‌ها، جلسات و گزارش عملیات
- PostgreSQL در محیط اصلی و SQLite برای توسعه
- اعلان نصب PWA برای Android و راهنمای نصب iOS
- آیکون‌های اختصاصی PWA، Maskable و Apple Touch
- Docker، Nginx و مستندات OpenAPI

## اجرای توسعه

### بک‌اند

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
uvicorn backend.app.main:app --reload --port 8000
```

متغیرهای فایل `.env` باید در محیط Shell بارگذاری شوند. برای اجرای سریع با تنظیمات پیش‌فرض، اجرای مستقیم Uvicorn کافی است.

### فرانت

```bash
npm install
npm run dev
```

پروکسی Vite درخواست‌های `/api` را به پورت ۸۰۰۰ می‌فرستد. فایل `.env.development` حالت Mock را غیرفعال کرده است.

## حساب‌های آزمایشی

فقط وقتی `SEED_DEMO=true` باشد:

| نقش       | رمز عضویت  |
| --------- | ---------- |
| دانش‌آموز | `12345678` |
| ادمین     | `87654321` |
| سوپرادمین | `98765432` |

این حساب‌ها و کلید `SECRET_KEY` نباید در محیط واقعی استفاده شوند.

## اجرای تست

```bash
DATABASE_URL=sqlite:////tmp/hamrah-pytest.db SECRET_KEY=pytest-secret SEED_DEMO=true \
  .venv/bin/pytest -q backend/tests
npm run build
```

## اجرای Docker

```bash
export POSTGRES_PASSWORD='یک-رمز-قوی'
export SECRET_KEY='یک-کلید-تصادفی-طولانی'
docker compose up --build -d
```

در محیط واقعی `SEED_DEMO=false` نگه داشته شود و HTTPS روی دامنه فعال شود. سپس اولین سوپرادمین را بسازید:

```bash
python -m backend.app.cli create-superadmin --name "مدیر اصلی" --public-code "SA-001" --login-code "یک-رمز-قوی"
```

## مستندات API

بعد از اجرای بک‌اند:

- Swagger UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`
- Health check: `http://localhost:8000/api/health`

## نکات امنیتی

زمان‌های شروع و پایان فقط از ساعت سرور محاسبه می‌شوند. رمزهای عضویت به‌صورت Scrypt ذخیره می‌شوند و مقدار خام فقط هنگام ایجاد یا بازنشانی نمایش داده می‌شود. کنترل نقش روی APIها انجام می‌شود، نه فقط در رابط کاربری.

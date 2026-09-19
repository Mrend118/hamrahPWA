# همراه | اپلیکیشن مطالعه (فرانت‌اند)

اپلیکیشن وب نصب‌شدنی (PWA) برای ثبت و پیگیری زمان مطالعه دانش‌آموزان: تایمر مطالعه، خلاصه آمار، لیگ رتبه‌بندی، اطلاعیه‌های عمومی و گفت‌وگو با مشاور.

- کاملاً فارسی و RTL (بدون سیستم دوزبانه و بدون تغییر زبان)
- HTML + CSS + JavaScript خالص با Vite — **بدون هیچ فریم‌ورکی**
- این مخزن فقط **فرانت‌اند** است. بک‌اند و دیتابیس جدا پیاده‌سازی می‌شوند.

---

## ۱. راه‌اندازی سریع

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

برای بیلد و پیش‌نمایش نسخه نهایی (برای تست PWA و Service Worker):

```bash
npm run build
npm run preview      # http://localhost:4173
```

> Service Worker فقط روی `https` یا `localhost` ثبت می‌شود.

### متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | آدرس پایه API |
| `VITE_USE_MOCK` | `true` | `true` = کار با داده آزمایشی، بدون بک‌اند |
| `VITE_AUTH_MODE` | `token` | `token` (هدر Bearer) یا `cookie` (نشست/کوکی امن) |
| `VITE_API_TIMEOUT` | `15000` | تایم‌اوت درخواست‌ها (میلی‌ثانیه) |

در حالت توسعه، پروکسی Vite مسیر `/api` را به `http://localhost:8000` می‌فرستد (قابل تغییر در `vite.config.js`).

---

## ۲. ساختار پروژه

```
hamrah/
├── public/
│   ├── icons/                 آیکن‌های PWA + favicon
│   ├── images/
│   ├── manifest.webmanifest
│   └── sw.js                  Service Worker
├── src/
│   ├── api/                   ⬅ تنها لایه‌ای که با بک‌اند حرف می‌زند
│   │   ├── api.js             پیکربندی مرکزی + نقشه ENDPOINTS + کلاینت fetch
│   │   ├── errors.js          کلاس ApiError + پیام‌های فارسی
│   │   ├── auth.js  user.js  study-sessions.js
│   │   ├── leaderboard.js  announcements.js  chat.js
│   ├── core/                  منطق مستقل از UI
│   │   ├── router.js          روتر hash + محافظ ورود
│   │   ├── store.js           فروشگاه وضعیت کوچک (pub/sub)
│   │   ├── auth.js            وضعیت ورود
│   │   ├── network.js         وضعیت آنلاین/آفلاین
│   │   └── study-session.js   ⬅ موتور تایمر (وضعیت‌ها، بازیابی، همگام‌سازی)
│   ├── components/            navbar, bottom-nav, timer, leaderboard,
│   │                          notification-card, subject-picker, loading,
│   │                          toast, confirm, nav-items
│   ├── pages/                 home, timer, leaderboard, notifications,
│   │                          consultant, login  (هر کدام یک index.js)
│   ├── mock/                  داده آزمایشی + روتر پاسخ‌های آزمایشی
│   ├── utils/                 format-time, storage, helpers
│   ├── styles/                reset, variables, global, components, pages, responsive
│   ├── assets/icons/          مجموعه آیکن SVG (سبک Lucide، مجوز ISC)
│   ├── config.js              CONFIG و ROUTES
│   └── main.js                نقطه ورود
├── index.html
├── vite.config.js
└── package.json
```

### قاعده معماری

```
UI  →  منطق صفحه/کامپوننت  →  لایه API  →  بک‌اند  →  دیتابیس
```

- هیچ `fetch()` خارج از `src/api/api.js` نوشته نمی‌شود.
- هیچ آدرسی در کامپوننت‌ها هاردکد نمی‌شود؛ همه در `ENDPOINTS` هستند.
- منطق تایمر، منطق API و رندر UI در سه فایل جدا هستند.

---

## ۳. معماری تایمر (مهم‌ترین بخش)

**بک‌اند منبع حقیقت است.** فرانت‌اند هیچ‌وقت با `setInterval` مدت رسمی مطالعه را نمی‌سازد؛ فقط از مهرهای زمانی سرور، مقدار قابل نمایش را حساب می‌کند:

```
elapsed = accumulatedSeconds + (اگر running: now − lastResumedAt)
```

مثال: `startedAt = 10:00` و زمان فعلی `11:27` → نمایش `۰۱:۲۷:۰۰`

- اختلاف ساعت دستگاه با سرور از هدر `Date` پاسخ محاسبه و اصلاح می‌شود.
- در هر بازگشت به صفحه (`visibilitychange`)، هر ۶۰ ثانیه، و پس از وصل شدن اینترنت، زمان با `GET /study-sessions/active` تأیید می‌شود.
- در شروع اپلیکیشن نشست فعال بازیابی می‌شود: رفرش، بستن مرورگر، قفل گوشی، تعویض اپلیکیشن، بستن PWA.
- `localStorage` فقط **کش موقت** است. اگر داده از کش خوانده شود، UI صریحاً «زمان تأییدنشده» نشان می‌دهد.

چرخه وضعیت:

```
idle → running ⇄ paused → ended → (ثبت مطالعه) → idle
```

دکمه‌ها: `شروع` · `توقف موقت` · `ادامه` · `پایان` · `ثبت مطالعه`
دکمه ثبت تا پایان درخواست غیرفعال می‌شود (جلوگیری از ثبت تکراری).

---

## ۴. قرارداد API

> ⚠️ **همه آدرس‌های زیر نمونه (placeholder) هستند** تا قرارداد نهایی بک‌اند مشخص شود.
> برای اتصال به بک‌اند واقعی فقط دو کار لازم است:
> ۱) مقادیر `ENDPOINTS` در `src/api/api.js`
> ۲) اگر نام فیلدها متفاوت بود، تابع `normalizeSession` در `src/api/study-sessions.js` و نگاشت‌های مشابه.
> هیچ صفحه یا کامپوننتی لازم نیست تغییر کند.

قالب پاسخ خطا که فرانت‌اند می‌پسندد (اختیاری ولی مفید):

```json
{ "message": "متن خطا برای لاگ", "errors": { "field": ["..."] } }
```

### ۴.۱ ورود

```yaml
API Name: ورود دانش‌آموز
Method: POST
Endpoint: /api/auth/login            # نمونه
Authentication: ندارد
Request: { "code": "string" }        # یا { username, password } — نظر بک‌اند
Response: { "token": "string?", "user": { "id", "name", "fullName", "level", "rank" } }
Possible Errors: 401 رمز نادرست · 422 ورودی ناقص · 500 خطای سرور
```

### ۴.۲ کاربر جاری

```yaml
API Name: کاربر جاری
Method: GET
Endpoint: /api/auth/me               # نمونه
Authentication: Bearer token یا کوکی نشست
Response: { "id", "name", "fullName", "level", "rank", "consultantName" }
Possible Errors: 401 · 500
```

### ۴.۳ خروج

```yaml
API Name: خروج
Method: POST
Endpoint: /api/auth/logout           # نمونه
Authentication: لازم
Response: { "ok": true }
Possible Errors: 401 · 500   (در هر حالت وضعیت محلی پاک می‌شود)
```

### ۴.۴ پروفایل و آمار

```yaml
API Name: پروفایل
Method: GET
Endpoint: /api/profile               # نمونه
Response: { "id", "name", "level", "rank", "grade" }

API Name: خلاصه آمار مطالعه
Method: GET
Endpoint: /api/study-stats           # نمونه
Response: { "totalMinutes", "weekMinutes", "todayMinutes", "rank", "level", "streakDays" }

API Name: فهرست درس‌ها
Method: GET
Endpoint: /api/subjects              # نمونه
Response: [ { "id", "title" } ]

API Name: آمار به تفکیک درس
Method: GET
Endpoint: /api/subjects/stats        # نمونه
Response: { "items": [ { "subjectId", "title", "minutes" } ] }

Authentication: لازم
Possible Errors: 401 · 403 · 500 · قطع شبکه
```

> واحد همه زمان‌ها **دقیقه** فرض شده است. اگر بک‌اند ثانیه می‌فرستد، در `src/utils/format-time.js` از `secondsToMs` استفاده کنید.

### ۴.۵ نشست مطالعه

```yaml
API Name: شروع نشست
Method: POST
Endpoint: /api/study-sessions/start  # نمونه
Request: { "subjectId": 5 }
Response: نشست (ساختار پایین)
Possible Errors: 409 نشست فعال دیگری وجود دارد · 422 · 401 · 500

API Name: توقف موقت / ادامه / پایان
Method: POST
Endpoint: /api/study-sessions/pause | /resume | /end   # نمونه
Request: { "sessionId": 123 }
Response: نشست به‌روزشده
Possible Errors: 404 نشست پیدا نشد · 409 وضعیت نامعتبر · 401 · 500

API Name: نشست فعال (بازیابی تایمر)
Method: GET
Endpoint: /api/study-sessions/active # نمونه
Response: نشست فعال یا null
Possible Errors: 401 · 500

API Name: ثبت نهایی مطالعه
Method: POST
Endpoint: /api/study-sessions/save   # نمونه
Request: { "sessionId": 123, "subjectId": 5 }
Response: { "saved": true, "minutes": 87 }
Possible Errors: 409 قبلاً ثبت شده · 404 · 422 · 401 · 500
```

ساختار نشست مورد انتظار فرانت‌اند:

```json
{
  "id": 123,
  "status": "running",            // running | paused | ended | saved
  "subjectId": 5,
  "subjectTitle": "فیزیک",
  "startedAt": "2026-09-18T10:00:00Z",
  "lastResumedAt": "2026-09-18T10:42:00Z",
  "accumulatedSeconds": 2520
}
```

`snake_case` هم پذیرفته می‌شود (`started_at`, `accumulated_seconds`, …).

### ۴.۶ رتبه‌بندی

```yaml
API Name: لیگ رتبه‌بندی
Method: GET
Endpoint: /api/leaderboard?period=week   # نمونه — period: week | month | all
Authentication: لازم
Response: {
  "items": [ { "rank", "userId", "name", "minutes", "level" } ],
  "me":    { "rank", "userId", "name", "minutes", "level", "isMe": true }
}
Possible Errors: 401 · 403 · 500
```

محاسبه رتبه کاملاً وظیفه بک‌اند است. فرانت‌اند فقط نمایش، استایل سه نفر اول (طلا/نقره/برنز) و وضعیت‌ها را مدیریت می‌کند.

### ۴.۷ اطلاعیه‌ها

```yaml
API Name: اطلاعیه‌های عمومی
Method: GET
Endpoint: /api/announcements         # نمونه
Authentication: لازم
Response: { "items": [ { "id", "title", "body", "createdAt", "tone" } ] }
tone: info | warning | danger  (اختیاری — فقط آیکن و رنگ)
Possible Errors: 401 · 500
```

اطلاعیه‌ها عمومی هستند: یک پیام برای همه دانش‌آموزان. سیستم اعلان شخصی وجود ندارد.

### ۴.۸ گفت‌وگو با مشاور

```yaml
API Name: دریافت پیام‌ها
Method: GET
Endpoint: /api/chat/messages         # نمونه
Response: { "items": [ { "id", "from": "me|consultant", "text", "createdAt" } ] }

API Name: ارسال پیام
Method: POST
Endpoint: /api/chat/messages         # نمونه
Request: { "text": "string" }
Response: { "id", "from": "me", "text", "createdAt" }

Authentication: لازم
Possible Errors: 422 متن خالی · 401 · 403 · 500
```

هیچ رفتار real-time جعلی پیاده نشده است. اگر بعداً WebSocket اضافه شد، فقط تابع `subscribeToMessages` در `src/api/chat.js` پیاده‌سازی می‌شود.

### ۴.۹ احراز هویت

هر دو روش پشتیبانی می‌شود و با `VITE_AUTH_MODE` انتخاب می‌گردد:

- `token`: توکن در `localStorage` ذخیره و در هدر `Authorization: Bearer …` فرستاده می‌شود.
- `cookie`: درخواست‌ها با `credentials: 'include'` ارسال می‌شوند؛ بک‌اند کوکی `HttpOnly` می‌گذارد (توصیه‌شده‌تر از نظر امنیت).

در حالت `cookie` باید `Access-Control-Allow-Credentials: true` و `Access-Control-Allow-Origin` دقیق تنظیم شود.

---

## ۵. مدیریت خطا

`src/api/errors.js` هر پاسخ را به یک نوع خطا و **پیام فارسی کاربرپسند** تبدیل می‌کند:

| وضعیت | پیام کاربر |
|---|---|
| قطع شبکه | اتصال اینترنت برقرار نیست. پس از وصل شدن دوباره تلاش کنید. |
| تایم‌اوت | پاسخی از سرور دریافت نشد. دوباره تلاش کنید. |
| 400 / 422 | درخواست معتبر نبود / اطلاعات کامل نیست. |
| 401 | برای ادامه باید وارد حساب خود شوید. (خروج خودکار + هدایت به صفحه ورود) |
| 403 | شما اجازه دسترسی به این بخش را ندارید. |
| 404 | اطلاعات مورد نظر پیدا نشد. |
| 409 | این عملیات قبلاً انجام شده است. |
| 5xx | مشکلی در سرور رخ داده است. کمی بعد دوباره تلاش کنید. |

پیام فنی فقط در `console` لاگ می‌شود، هرگز به کاربر نشان داده نمی‌شود.

هر بخش وابسته به API چهار وضعیت دارد: **بارگذاری** (اسکلتون) · **موفق** · **خالی** · **خطا + دکمه تلاش دوباره**.

---

## ۶. داده آزمایشی (mock)

با `VITE_USE_MOCK=true` تمام درخواست‌ها به `src/mock/index.js` می‌روند و همان قالب بک‌اند را برمی‌گردانند (شامل تأخیر شبکه و نشست تایمر پایدار در `localStorage`). UI به داده آزمایشی وابسته نیست: با `false` کردن این متغیر، همان کد به بک‌اند واقعی وصل می‌شود.

تست وضعیت‌ها در کنسول مرورگر:

```js
window.__MOCK_FAIL__ = 500          // خطای سرور در همه درخواست‌ها
window.__MOCK_FAIL__ = '/leaderboard'  // خطا فقط در یک آدرس
window.__MOCK_FAIL__ = 401          // تست خروج خودکار
window.__MOCK_EMPTY__ = true        // تست حالت خالی
delete window.__MOCK_FAIL__         // بازگشت به حالت عادی
```

در حالت آزمایشی هر رمزی جز `wrong` برای ورود پذیرفته می‌شود (`wrong` خطای ۴۰۱ می‌دهد).

---

## ۶.۱ تست منطق تایمر

منطق نشست مطالعه (بازیابی از مهرهای زمانی سرور، توقف/ادامه، ثبت، فالبک آفلاین) با یک اسکریپت بدون مرورگر قابل بررسی است:

```bash
node test-timer-logic.mjs
```

خروجی باید همه موارد را PASS نشان دهد؛ از جمله سناریوی «نشست ۹۰ دقیقه‌ای که بعد از رفرش بازیابی می‌شود».

---

## ۷. PWA

- `public/manifest.webmanifest`: نام، آیکن‌ها (۱۹۲، ۵۱۲، maskable)، `display: standalone`، `dir: rtl`، رنگ تم.
- `public/sw.js`:
  - پوسته اپلیکیشن (HTML/CSS/JS/آیکن/فونت) آفلاین کار می‌کند.
  - درخواست‌های `/api/` **هرگز کش نمی‌شوند**؛ در نبود شبکه پاسخ ۵۰۳ مشخص برمی‌گردد تا UI صادقانه «آفلاین» نشان دهد.
- نصب روی موبایل: «افزودن به صفحه اصلی» — ناوبری پایین با `env(safe-area-inset-bottom)` هم‌خوان است.

---

## ۸. فونت

فونت وزیرمتن از CDN بارگذاری می‌شود (`index.html`). برای اجرای کامل آفلاین یا محیط بدون دسترسی به CDN:

```bash
npm i @fontsource-variable/vazirmatn
```

سپس تگ `<link>` مربوط به jsdelivr را در `index.html` حذف و این خط را به ابتدای `src/styles/global.css` اضافه کنید:

```css
@import '@fontsource-variable/vazirmatn/index.css';
```

---

## ۹. طراحی و ریسپانسیو

- یک اپلیکیشن، دو رفتار چیدمان. داده، منطق و لایه API مشترک است؛ فقط ناوبری و چیدمان با `@media` عوض می‌شود:
  - **موبایل** (`< 1024px`): ناوبری پایین ثابت، دکمه‌های لمسی ۴۴ پیکسلی، بدون اسکرول افقی، فاصله امن برای محتوا.
  - **دسکتاپ** (`≥ 1024px`): ناوبری بالا، چیدمان دو ستونی در خانه و تایمر.
- توکن‌های طراحی در `src/styles/variables.css` (رنگ‌ها در OKLCH، فاصله‌ها بر پایه ۴ پیکسل، مقیاس تایپوگرافی ۱٫۳۳).
- دسترس‌پذیری: حالت فوکوس مشخص، `aria-current` برای مسیر فعال، `aria-live` برای وضعیت‌ها، تأیید کنش‌های حساس با `<dialog>` بومی، پشتیبانی از `prefers-reduced-motion`.

---

## ۱۰. کارهای باقی‌مانده برای تیم

- [ ] جایگزینی `ENDPOINTS` با آدرس‌های نهایی بک‌اند
- [ ] تعیین روش احراز هویت (`token` یا `cookie`) و تنظیم CORS
- [ ] تطبیق نام فیلدهای نشست در `normalizeSession` در صورت تفاوت
- [ ] `VITE_USE_MOCK=false` و حذف تدریجی `src/mock/` پس از پایداری بک‌اند
- [ ] افزودن WebSocket برای گفت‌وگو (در صورت نیاز) در `subscribeToMessages`
- [ ] جایگزینی آیکن‌های PWA با لوگوی نهایی مجموعه در `public/icons/`

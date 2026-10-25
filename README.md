# 🕌 بوت مواقيت الصلاة - Discord Prayer Bot

بوت دسكورد ينبه أعضاء السيرفر بمواقيت الصلاة بتوقيت الإمارات 🇦🇪

## المميزات

- ✅ تنبيه تلقائي عند كل أذان (الفجر، الظهر، العصر، المغرب، العشاء)
- ✅ إرسال صوت الأذان (adhan.mp3)
- ✅ عرض الصلاة الحالية والقادمة مع الأوقات
- ✅ GIF إسلامي مع كل تنبيه
- ✅ تحديث تلقائي للمواقيت يوميًا
- ✅ أوامر Slash:
  - `/prayertimes` — عرض مواقيت اليوم
  - `/nextprayer` — الصلاة القادمة
  - `/testadhan` — تنبيه تجريبي

## التثبيت

### 1. إنشاء بوت Discord

1. روح لـ [Discord Developer Portal](https://discord.com/developers/applications)
2. اضغط **New Application** → سمّه **Prayer** (أو أي اسم)
3. روح لـ **Bot** من القائمة الجانبية
4. اضغط **Reset Token** → انسخ التوكن
5. فعّل **MESSAGE CONTENT INTENT** من نفس الصفحة
6. روح لـ **OAuth2** > **URL Generator**
7. اختر Scopes: `bot` + `applications.commands`
8. اختر Bot Permissions: `Send Messages` + `Embed Links` + `Attach Files` + `Mention Everyone`
9. انسخ الرابط وافتحه لإضافة البوت لسيرفرك

### 2. تجهيز المشروع

```bash
# استنسخ المشروع أو انقل الملفات
cd discord-prayer-bot

# ثبت المكتبات
npm install

# انسخ ملف الإعدادات
copy .env.example .env
```

### 3. تعبئة ملف `.env`

افتح `.env` وعبّي:

```env
DISCORD_TOKEN=توكن_البوت_هنا
CHANNEL_ID=آيدي_القناة_هنا
```

**كيف تجيب Channel ID:**
- فعّل Developer Mode من إعدادات دسكورد > Advanced
- كلك يمين على القناة > Copy Channel ID

### 4. ملف الأذان (اختياري)

حط ملف `adhan.mp3` في نفس مجلد المشروع. البوت بيرسله مع كل تنبيه.

### 5. تشغيل البوت

```bash
npm start
```

## تشغيل دائم (24/7)

### باستخدام PM2:

```bash
npm install -g pm2
pm2 start bot.js --name prayer-bot
pm2 save
pm2 startup
```

### أو باستخدام استضافة مثل:
- [Railway](https://railway.app)
- [Render](https://render.com)
- VPS (DigitalOcean, Vultr, etc.)

## إعدادات إضافية

| المتغير | الوصف | الافتراضي |
|---------|-------|-----------|
| `CITY` | المدينة | `Dubai` |
| `COUNTRY` | الدولة | `AE` |
| `CALCULATION_METHOD` | طريقة حساب المواقيت | `8` (الخليج) |
| `GIF_URL` | رابط GIF مع التنبيه | - |
| `MENTION` | من يتم تنبيهه | `@everyone` |

### طرق حساب المواقيت:
- `8` — منطقة الخليج ✅ (الأفضل للإمارات)
- `4` — أم القرى، مكة
- `3` — رابطة العالم الإسلامي
- `5` — الهيئة المصرية العامة للمساحة

# ⚡ বিদ্যুৎ মনিটর — API (Vercel Serverless)

সব রুট `api/handler.py` একটাই function, `?route=` দিয়ে ডিসপ্যাচ হয় (`vercel.json`-এ rewrite করা আছে)।

| Route | Method | কাজ |
|---|---|---|
| `/api/data` | POST | Tuya থেকে লাইভ ডেটা (power, voltage, current, PF, kWh, fault) |
| `/api/config` | GET | সার্ভার কনফিগ (উপলব্ধ কি না) |
| `/api/check_alert` | GET | ক্রন fallback — বিদ্যুৎ যাওয়া/আসা, ফাল্ট, লোড, খরচ অ্যালার্ট |
| `/api/daily_report` | GET | ক্রন fallback — দৈনিক রিপোর্ট (বাংলাদেশ সময় দুপুর ১২টা) |
| `/api/monthly_report` | GET | ক্রন fallback — মাসিক রিপোর্ট (নতুন মাসের ১ তারিখ) |
| `/api/notify` | POST | ব্রাউজার থেকে পাঠানো সব নোটিফিকেশন (মূল পথ) |
| `/api/test_telegram` | POST | Telegram সংযোগ টেস্ট |
| `/api/save_settings` | POST | Tuya credentials `/tmp`-এ সেভ |

## `/api/notify` — request body

```json
{ "creds": { "telegram_token": "...", "telegram_chat_id": "...", "tuya_client_id": "...", "tuya_client_secret": "...", "tuya_device_id": "...", "tuya_region": "eu" },
  "type": "offline",
  "data": { "time": "12:03:05", "date": "02/10/2026", "kwh": 1234.5678, "dayUsed": 18.2, "offCount": 3, "todayTaka": 145.6 } }
```

`type` যেগুলো সাপোর্ট করে:

| type | কখন যায় | মেসেজে কী থাকে |
|---|---|---|
| `offline` | বিদ্যুৎ চলে গেলে (সাথে সাথে) | সময়, তারিখ, আজকের বিভ্রাট সংখ্যা, আজকের ব্যবহার kWh ও টাকা |
| `online` | বিদ্যুৎ ফিরে এলে | আসার সময়, গিয়েছিল কখন (`startStamp`), **কতক্ষণ বন্ধ ছিল** |
| `power` | লোড সীমা (ডিফল্ট 1000W) ছাড়ালে | এখনকার W, সীমা, ভোল্টেজ, কারেন্ট |
| `voltage` | ভোল্টেজ কম/বেশি হলে | এখনকার V, স্বাভাবিক সীমা, লোড |
| `fault` | TOMZN fault কোড > 0 | কোড, W, V |
| `taka` | খরচ ৳500 (কনফিগারেবল) পার হলে প্রতি ৳100-এ | কোন ধাপ পার, মোট kWh ও টাকা |
| `hourly` | ঘণ্টাভিত্তিক (ডিফল্ট বন্ধ) | মিটার, আজ, মাস |
| `daily` | প্রতিদিন বাংলাদেশ সময় দুপুর ১২টা | **আজ · গতকাল · এই মাস**, গড়/দিন, প্রজেকশন, বিভ্রাট সংখ্যা, মোট বন্ধ সময়, সর্বোচ্চ একটানা বিভ্রাট |
| `monthly` | মাস শেষ / নতুন মাসের ১ তারিখ | মাসের মোট ইউনিট, গড়/দিন, টাকা, বিভ্রাট সংখ্যা, সর্বোচ্চ লোড |

সব মেসেজ `HTML` parse mode-এ যায়, তাই `<b>` ট্যাগ কাজ করে।

## Environment Variables (Vercel → Settings → Environment Variables)

| নাম | ডিফল্ট | কাজ |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | — | Telegram BotFather থেকে পাওয়া টোকেন |
| `TELEGRAM_CHAT_ID` | — | আপনার চ্যাট আইডি |
| `TUYA_CLIENT_ID` | built-in | Tuya IoT ক্লাউড App Client ID |
| `TUYA_CLIENT_SECRET` | built-in | Tuya App Secret |
| `TUYA_DEVICE_ID` | built-in | TOMZN 63A ডিভাইস আইডি |
| `TUYA_REGION` | `eu` | Tuya ডেটা সেন্টার (`eu`/`us`/`in`/`cn`) |
| `PRICE_PER_UNIT` | `8` | প্রতি ইউনিটের দাম (টাকা) |
| `ALERT_THRESHOLD_TAKA` | `500` | কোন টাকা থেকে খরচ অ্যালার্ট শুরু |
| `POWER_ALERT_W` | `1000` | ক্রন fallback-এর লোড সীমা (ওয়াট) |
| `HOURLY_REPORT` | `0` | `1` করলে ক্রনে ঘণ্টাভিত্তিক রিপোর্টও যাবে |

> ℹ️ **আসল credentials কোথায় থাকে:** Tuya/Telegram credentials ব্রাউজারের `localStorage`-এ সেভ হয়
> (Settings ডায়ালগ থেকে) — GitHub-এ যায় না। তাই `creds` সবসময় request body-তে পাঠানো হয়।
> এনভায়রনমেন্ট ভ্যারিয়েবলগুলো শুধু **ক্রন fallback**-এর জন্য দরকার (ব্রাউজার বন্ধ থাকলে)।
> ক্রন fallback কাজ করতে `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` আর Tuya credentials
> এনভায়রনমেন্ট ভ্যারিয়েবলে রাখতে হবে — নাহলে ব্রাউজার খোলা থাকলেই নোটিফিকেশন যাবে।

## Vercel Cron

`vercel.json`-এ:
```json
"crons": [
  { "path": "/api/daily_report",   "schedule": "0 6 * * *" },
  { "path": "/api/monthly_report", "schedule": "0 6 1 * *" }
]
```
`0 6 * * *` মানে **UTC ০৬:০০ = বাংলাদেশ সময় দুপুর ১২:০০** ✅

> ⚠️ টাইমজোন সংক্রান্ত: Vercel ক্রন সবসময় **UTC**-তে চলে, তাই দুপুর ১২টা বাংলাদেশ সময়ের জন্য
> UTC ০৬:০০ ব্যবহার করা হয়েছে। বাংলাদেশে DST নেই, তাই এটা সারা বছরই ঠিক থাকবে।

## ব্রাউজার বন্ধ থাকলে কী হয়?

| ফিচার | ব্রাউজার চালু | ব্রাউজার বন্ধ (ক্রন) |
|---|---|---|
| মেসেজ কে পাঠায় | `/api/notify` (তৎক্ষণাৎ) | `/api/check_alert` (Vercel ক্রন) |
| বিদ্যুৎ যাওয়া/আসা | ✅ সাথে সাথে | ✅ ডিভাইস অফলাইন দেখলে |
| লোড অ্যালার্ট | ✅ (rising edge) | ✅ |
| দৈনিক রিপোর্ট | ✅ দুপুর ১২টা | ✅ দুপুর ১২টা |
| গতকালের হিসাব | ✅ (ব্রাউজার লেজার) | ⚠️ Tuya কাউন্টারের ডেল্টা থেকে আনুমানিক |
| ৩০ দিনের চার্ট | ✅ | ❌ (ব্রাউজার বন্ধে হিসাব জমা হয় না) |

## লোকাল ডেভেলপমেন্ট

```bash
python api/handler.py          # http://127.0.0.1:8000  (vite.config.js-এর proxy এখানে পাঠায়)
npm run dev                    # http://localhost:5173
```

মেসেজ ফরম্যাট আলাদা করে দেখতে:
```bash
python -c "import sys;sys.path.insert(0,'api');import handler as m;print(m._msg('offline',{'time':'12:03:05','date':'02/10/2026','kwh':1234.5,'offCount':3},m.bdnow()))"
```

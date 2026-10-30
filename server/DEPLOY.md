# 🚀 বিদ্যুৎ মনিটর — Ubuntu সার্ভারে হোস্ট করা

এই প্রজেক্ট দুটো অংশের:
| অংশ | কী | কোথায় চলবে |
|---|---|---|
| **ফ্রন্টএন্ড** | React/Vite অ্যাপ (`dist/`) | nginx (`/var/www/bijli`) |
| **ব্যাকএন্ড** | `api/handler.py` (Tuya Cloud + Telegram) | systemd সার্ভিস, `127.0.0.1:8000` |

ফ্রন্টএন্ড `/api/...` **relative** পাথে কল করে, তাই একই ডোমেইনে হোস্ট করলে কোনো কোড বদলাতে হয় না — nginx `/api/` কে ব্যাকএন্ডে proxy করে দেয়।

---

## ১) ফাইল আপলোড

**উপায় A — Git (সবচেয়ে সহজ):**
```bash
cd ~ && git clone <your-repo-url> bijli_final && cd bijli_final
```

**উপায় B — আপনার Windows থেকে scp:**
```powershell
# Windows PowerShell-এ, প্রজেক্ট ফোল্ডার থেকে:
scp -r . ubuntu@<SERVER_IP>:/home/ubuntu/bijli_final
```

**উপায় C — zip:** ZIP বানিয়ে আপলোড করে `unzip bijli_final.zip`।

---

## ২) বিল্ড (dist না থাকলে)

`dist/` আগে থেকেই থাকলে বাদ দিন। নাহলে সার্ভারে:
```bash
sudo apt-get install -y nodejs npm
npm install && npm run build          # → dist/ তৈরি হবে
```

---

## ৩) এক কমান্ডে ইনস্টল

```bash
cd ~/bijli_final
bash server/install.sh
```

স্ক্রিপ্ট নিজেই: `python3-venv + nginx` ইনস্টল, venv বানানো, `dist` → `/var/www/bijli` কপি, systemd সার্ভিস চালু, nginx কনফ বসানো, ক্রন সেট — সব করে দেয়।

---

## ৪) Telegram ক্রেডেনশিয়াল বসান

```bash
sudo nano /etc/bijli.env
#   TELEGRAM_BOT_TOKEN=123456:ABC...
#   TELEGRAM_CHAT_ID=123456789
sudo systemctl restart bijli
```

> এগুলো শুধু **ব্রাউজার বন্ধ থাকলে** (cron fallback) দরকার। ব্রাউজার খোলা থাকলে
> অ্যাপের Settings ডায়ালগ থেকে দেওয়া creds-ই (localStorage) সরাসরি `/api/notify`-তে যায়।

---

## ৫) খুলে দেখুন

```bash
hostname -I            # সার্ভারের IP
```
ব্রাউজারে: `http://<SERVER_IP>/`

সমস্যা হলে লগ:
```bash
sudo systemctl status bijli
sudo journalctl -u bijli -n 80 --no-pager
sudo tail -f /var/log/nginx/error.log
curl -s http://127.0.0.1:8000/api/config ; echo
```

---

## (অপশনাল) ৬) ডোমেইন + HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bijli.example.com
```
তারপর `server/nginx-bijli.conf`-এ `server_name bijli.example.com;` বসিয়ে
`sudo systemctl reload nginx`।

> ⚠️ PWA Service Worker ও "Install App" শুধু **https**-এ (বা localhost-এ) কাজ করে।
> তাই সেলফি/ফোনে অ্যাপের মতো বসাতে চাইলে HTTPS বানান।

---

## ফাইল-কাঠামো

```
bijli_final/
├─ api/handler.py            ← ব্যাকএন্ড (একটাই ফাইল, ?route= দিয়ে ডিসপ্যাচ)
├─ dist/                     ← বিল্ড হওয়া ফ্রন্টএন্ড (nginx এটাই সার্ভ করে)
├─ sw.js, manifest.json      ← PWA
├─ requirements.txt          ← requests
└─ server/                   ← হোস্টিং ফাইলগুলো
   ├─ install.sh             ← এক-কমান্ড ইনস্টলার
   ├─ bijli.service          ← systemd ইউনিট (প্লেসহোল্ডার বসানো হয়)
   ├─ nginx-bijli.conf       ← nginx সাইট (dist + /api proxy)
   ├─ bijli.env.example      ← /etc/bijli.env-এর নমুনা
   └─ bijli-cron             ← দৈনিক/মাসিক/৫-মিনিট অ্যালার্ট ক্রন
```

## পুরনো Vercel সেটআপ বনাম সার্ভার

| ফিচার | Vercel | এই সার্ভার সেটআপ |
|---|---|---|
| ফ্রন্টএন্ড | CDN | nginx (`/var/www/bijli`) |
| API | Serverless function | systemd `bijli` → `127.0.0.1:8000` |
| Cron | `vercel.json` `crons` | crontab (`server/bijli-cron`) |
| ডেটা | ephemeral `/tmp` | `/var/lib/bijli` (রিবুটে টেকে) |
| রাউটিং | `vercel.json` rewrites | nginx `/api/` proxy |

> `vercel.json` সার্ভারে দরকার নেই — রেখে দিলে ক্ষতি নেই (শুধু Vercel-এর জন্য)।
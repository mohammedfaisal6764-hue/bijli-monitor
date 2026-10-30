#!/usr/bin/env bash
# ═══════════ বিদ্যুৎ মনিটর — Ubuntu সার্ভার ইনস্টলার ═══════════
# প্রজেক্ট ফোল্ডার থেকে চালান:   bash server/install.sh
# যা করে: nginx + python3 venv + systemd সার্ভিস + /var/www, /var/lib, cron।
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"  # api/, dist/ যেখানে
WEB_DIR="${WEB_DIR:-/var/www/bijli}"       # ফ্রন্টএন্ড (dist) এখানে যাবে
DATA_DIR="${DATA_DIR:-/var/lib/bijli}"     # রিবুট-নিরাপদ ডেটা
SERVICE_USER="${SERVICE_USER:-$(id -un)}"  # ব্যাকএন্ড যে ইউজারে চলবে

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

if [[ ! -f "$APP_DIR/api/handler.py" ]]; then
  echo "✗ api/handler.py পাওয়া যায়নি ($APP_DIR)। প্রজেক্ট রুট থেকে চালান।" >&2
  exit 1
fi
if [[ -z "$WEB_DIR" || "$WEB_DIR" == "/" ]]; then
  echo "✗ WEB_DIR খালি/রুট হতে পারে না।" >&2
  exit 1
fi
if [[ ! -f "$APP_DIR/dist/index.html" ]]; then
  echo "⚠ dist/ খালি — আগে 'npm install && npm run build' চালান (নাহলে ওয়েবসাইট দেখাবে না)।" >&2
fi

step "1/7 সিস্টেম প্যাকেজ ইনস্টল (sudo লাগবে)"
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-pip nginx curl

step "2/7 Python venv + requests"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip -q
"$APP_DIR/venv/bin/pip" install -q -r "$APP_DIR/requirements.txt"

step "3/7 ডেটা ফোল্ডার: $DATA_DIR"
sudo mkdir -p "$DATA_DIR"
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR"

step "4/7 ফ্রন্টএন্ড কপি: $WEB_DIR"
# ⚠️ বিদ্যমান কোনো ফাইল মুছি না — শুধু কপি করি (একই নামের ফাইল থাকলে তার উপর লিখে যায়)।
# তাই আপনার আগের অন্য সাইট/ফাইল অক্ষত থাকবে। শুধু $WEB_DIR (এই অ্যাপের নিজের ফোল্ডার) ব্যবহৃত হয়।
sudo mkdir -p "$WEB_DIR"
sudo cp -r "$APP_DIR/dist/." "$WEB_DIR/"
# Service Worker (vite dist-এ কপি করে না) — থাকলে যোগ করি
[[ -f "$APP_DIR/sw.js" ]] && sudo cp "$APP_DIR/sw.js" "$WEB_DIR/sw.js"
sudo chown -R www-data:www-data "$WEB_DIR"

step "5/7 systemd সার্ভিস (bijli)"
sudo cp "$APP_DIR/server/bijli.service" /etc/systemd/system/bijli.service
sudo sed -i \
  -e "s|__USER__|$SERVICE_USER|g" \
  -e "s|__APP_DIR__|$APP_DIR|g" \
  -e "s|__DATA_DIR__|$DATA_DIR|g" \
  -e "s|__VENV__|$APP_DIR/venv|g" \
  /etc/systemd/system/bijli.service

# env ফাইল (একবারই তৈরি — পরে আপনার টেলিগ্রাম ক্রেডেনশিয়াল বসান)
if [[ ! -f /etc/bijli.env ]]; then
  sudo cp "$APP_DIR/server/bijli.env.example" /etc/bijli.env
  sudo chmod 600 /etc/bijli.env
  echo "  ℹ /etc/bijli.env তৈরি হয়েছে — Telegram টোকেন/Chat ID বসাতে ভুলবেন না।"
fi

sudo systemctl daemon-reload
sudo systemctl enable --now bijli
sudo systemctl restart bijli

step "6/7 nginx সাইট"
sudo cp "$APP_DIR/server/nginx-bijli.conf" /etc/nginx/sites-available/bijli
sudo sed -i -e "s|__WEB_DIR__|$WEB_DIR|g" /etc/nginx/sites-available/bijli
sudo ln -sf /etc/nginx/sites-available/bijli /etc/nginx/sites-enabled/bijli
# nginx-এর stock welcome সাইট — শুধু এটিই সরাই (এটা ডিফল্ট/অ্যাপের নিজের কিছু নয়)।
# এটা না সরালে ৮০ পোর্টে দুটো default_server সংঘর্ষ করবে।
if [[ -e /etc/nginx/sites-enabled/default ]]; then
  echo "  ℹ nginx-এর stock 'default' সাইট সরাচ্ছি (আপনার নিজের কোনো সাইট নয়)"
  sudo rm -f /etc/nginx/sites-enabled/default
fi
sudo nginx -t && sudo systemctl restart nginx

step "7/7 ক্রন (ব্রাউজার বন্ধ fallback)"
# sudo দিয়ে চালালে cron যেন ubuntu ইউজারে বসে (root-এ নয়)
CRON_USER="${SUDO_USER:-$(id -un)}"
_cron_pipe() { crontab -l 2>/dev/null | grep -vE 'check_alert|daily_report|monthly_report'; cat "$APP_DIR/server/bijli-cron"; echo ''; }
if [[ "$(id -u)" -eq 0 && "$CRON_USER" != "root" ]]; then
  _cron_pipe | crontab -u "$CRON_USER" -
else
  _cron_pipe | crontab -
fi
echo "  ℹ cron বসানো হলো: $CRON_USER"

step "✅ শেষ — যাচাই"
sleep 2
echo "-- সার্ভিস স্ট্যাটাস --"; sudo systemctl --no-pager --lines=0 status bijli || true
echo "-- ব্যাকএন্ড হেলথ --"
curl -fsS http://127.0.0.1:8000/api/config && echo || echo "  ✗ ব্যাকএন্ড উত্তর দিচ্ছে না (journalctl -u bijli -n 50)"
echo "-- ওয়েব হেলথ --"
curl -fsS -o /dev/null -w "  HTTP %{http_code}\n" http://127.0.0.1/ || true

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
printf '\n🌐 ব্রাউজারে খুলুন:  http://%s/\n' "${IP:-<server-ip>}"
echo "📄 বিস্তারিত: server/DEPLOY.md"
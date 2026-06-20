"""
api/handler.py — সব API রুট একটা ফাইলে
/api/data, /api/config, /api/check_alert, /api/monthly_report, /api/test_telegram
"""
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os, json, time, hmac, hashlib, requests
from datetime import datetime, timedelta

# ══════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════
CFG = {
    "tuya_client_id":     os.environ.get("TUYA_CLIENT_ID",     "q5avqmrnwupjwhwvm5q3"),
    "tuya_client_secret": os.environ.get("TUYA_CLIENT_SECRET", "0087dd259b1f4fa7801573a1401254f0"),
    "tuya_device_id":     os.environ.get("TUYA_DEVICE_ID",     "bf253686d86878a2eduejn"),
    "tuya_region":        os.environ.get("TUYA_REGION",        "eu"),
    "telegram_token":     os.environ.get("TELEGRAM_BOT_TOKEN", "8824872160:AAFulh2sM7CSJa8B4_qDdrWPsCPAOXk5khw"),
    "telegram_chat_id":   os.environ.get("TELEGRAM_CHAT_ID",   "6345338101"),
    "price_per_unit":     float(os.environ.get("PRICE_PER_UNIT",          "8")),
    "alert_taka":         float(os.environ.get("ALERT_THRESHOLD_TAKA",  "500")),
    "alert_units":        float(os.environ.get("ALERT_THRESHOLD_UNITS",  "50")),
}

TUYA_BASE = {
    "eu": "https://openapi.tuyaeu.com",
    "us": "https://openapi.tuyaus.com",
    "cn": "https://openapi.tuyacn.com",
    "in": "https://openapi.tuyain.com",
}.get(CFG["tuya_region"], "https://openapi.tuyaeu.com")

_token = {"v": None, "exp": 0}

CORS = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json; charset=utf-8",
}

BN_MONTHS = {1:"জানুয়ারি",2:"ফেব্রুয়ারি",3:"মার্চ",4:"এপ্রিল",5:"মে",6:"জুন",
             7:"জুলাই",8:"আগস্ট",9:"সেপ্টেম্বর",10:"অক্টোবর",11:"নভেম্বর",12:"ডিসেম্বর"}


# ══════════════════════════════════════════
#  TUYA API
# ══════════════════════════════════════════
def _sign(cid, sec, tok, t, n, method, path, body=""):
    h = hashlib.sha256(body.encode()).hexdigest()
    s = "\n".join([method, h, "", path])
    return hmac.new(sec.encode(), (cid + tok + t + n + s).encode(), hashlib.sha256).hexdigest().upper()


def _hdrs(method, path, body="", token=""):
    cid = CFG["tuya_client_id"]
    sec = CFG["tuya_client_secret"]
    t   = str(int(time.time() * 1000))
    n   = hashlib.md5(t.encode()).hexdigest()[:8]
    return {
        "client_id": cid, "sign": _sign(cid, sec, token, t, n, method, path, body),
        "t": t, "sign_method": "HMAC-SHA256", "nonce": n,
        "access_token": token, "Content-Type": "application/json",
    }


def _get_token():
    now = time.time()
    if _token["v"] and now < _token["exp"]:
        return _token["v"]
    path = "/v1.0/token?grant_type=1"
    try:
        r = requests.get(f"{TUYA_BASE}{path}", headers=_hdrs("GET", path), timeout=8)
        d = r.json()
        if d.get("success"):
            _token["v"]   = d["result"]["access_token"]
            _token["exp"] = now + d["result"].get("expire_time", 7200) - 60
            return _token["v"]
    except Exception as e:
        print(f"[Token] {e}")
    return ""


def get_device_data():
    token = _get_token()
    if not token:
        return None
    did  = CFG["tuya_device_id"]
    path = f"/v1.0/devices/{did}/status"
    try:
        r = requests.get(f"{TUYA_BASE}{path}", headers=_hdrs("GET", path, token=token), timeout=8)
        d = r.json()
        if not d.get("success"):
            return None
        dps = {i["code"]: i["value"] for i in d.get("result", [])}
        pw  = round(dps.get("power_a",   dps.get("power",   0)) / 10,   1)
        vv  = round(dps.get("voltage_a", dps.get("voltage", 0)) / 10,   1)
        aa  = round(dps.get("current_a", dps.get("current", 0)) / 1000, 3)
        kwh = round(dps.get("total_forward_energy", 0) / 100, 4)
        pf  = round(pw / (vv * aa), 3) if vv > 0 and aa > 0 else 0.0
        return {
            "power_w": pw, "voltage_v": vv, "current_a": aa, "pf": pf,
            "total_kwh": kwh, "fault": dps.get("fault", 0),
            "online": True, "source": "tuya",
        }
    except Exception as e:
        print(f"[Device] {e}")
        return None


# ══════════════════════════════════════════
#  TELEGRAM
# ══════════════════════════════════════════
def send_telegram(msg):
    tok = CFG["telegram_token"]
    cid = CFG["telegram_chat_id"]
    if not tok or not cid:
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{tok}/sendMessage",
            json={"chat_id": cid, "text": msg, "parse_mode": "HTML"}, timeout=8
        )
        return r.json().get("ok", False)
    except:
        return False


# ══════════════════════════════════════════
#  BREB ধাপ বিল
# ══════════════════════════════════════════
def breb(kwh):
    slabs  = [(50,3.75),(50,5.14),(100,5.36),(100,6.34),(100,9.94),(float('inf'),11.46)]
    labels = ["০–৫০","৫১–১০০","১০১–২০০","২০১–৩০০","৩০১–৪০০","৪০০+"]
    rem, tot, rows = kwh, 0.0, []
    for i,(lim,rate) in enumerate(slabs):
        if rem <= 0: break
        u = min(rem, lim); c = u * rate; tot += c
        rows.append(f"   • {labels[i]}: {u:.1f}×{rate} = ৳{c:.2f}")
        rem -= u
    vat = round(tot * 0.05, 2)
    return {"rows": rows, "vat": vat, "total": round(tot + vat + 40, 2)}


# ══════════════════════════════════════════
#  STATE (টেম্পোরারি ফাইল — /tmp)
# ══════════════════════════════════════════
def _get_step():
    try:
        with open("/tmp/bs.txt") as f: return int(f.read().strip())
    except: return 0


def _set_step(s):
    try:
        with open("/tmp/bs.txt", "w") as f: f.write(str(s))
    except: pass


def _load_month():
    try:
        with open("/tmp/bm.json") as f: return json.load(f)
    except: return {}


def _save_month(log):
    try:
        if len(log) > 13: del log[sorted(log)[0]]
        with open("/tmp/bm.json", "w") as f: json.dump(log, f)
    except: pass


# ══════════════════════════════════════════
#  MAIN HANDLER — সব রুট এখানে
# ══════════════════════════════════════════
class handler(BaseHTTPRequestHandler):

    def log_message(self, *a): pass

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        for k, v in CORS.items(): self.send_header(k, v)
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _route(self):
        """rewrite থেকে আসা route বের করো — query param বা path দুটোই চেক করি"""
        parsed = urlparse(self.path)
        qs     = parse_qs(parsed.query)
        route  = qs.get("route", [""])[0]
        if not route:
            p = parsed.path
            for r in ("data","config","check_alert","monthly_report","test_telegram"):
                if p.endswith(r):
                    route = r
                    break
        return route

    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS.items(): self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        route = self._route()
        if route == "data":            self._data()
        elif route == "config":        self._config()
        elif route == "check_alert":   self._check_alert()
        elif route == "monthly_report": self._monthly_report()
        else: self._json({"ok": False, "error": "not found", "path": self.path}, 404)

    def do_POST(self):
        route = self._route()
        if route == "test_telegram":   self._test_telegram()
        else: self._json({"ok": False, "error": "not found", "path": self.path}, 404)

    # ── /api/data ──
    def _data(self):
        price = CFG["price_per_unit"]
        dev   = get_device_data()
        if dev and dev.get("online"):
            pw,vv,aa,pf,kwh = dev["power_w"],dev["voltage_v"],dev["current_a"],dev["pf"],dev["total_kwh"]
            fault, online, source = dev.get("fault",0), True, "tuya"
        else:
            pw=vv=aa=pf=kwh=fault=0.0
            online, source = False, "offline"

        self._json({
            "ok": True, "online": online, "source": source,
            "power_w": pw, "voltage_v": vv, "current_a": aa, "pf": pf, "fault": fault,
            "total_kwh": kwh, "total_taka": round(kwh*price, 4),
            "price_per_unit": price,
            "alert_threshold_taka":  CFG["alert_taka"],
            "alert_threshold_units": CFG["alert_units"],
            "telegram_ok": bool(CFG["telegram_token"] and CFG["telegram_chat_id"]),
        })

    # ── /api/config ──
    def _config(self):
        self._json({
            "price_per_unit":        CFG["price_per_unit"],
            "alert_threshold_taka":  CFG["alert_taka"],
            "alert_threshold_units": CFG["alert_units"],
            "tuya_configured":       bool(CFG["tuya_client_id"]),
            "telegram_configured":   bool(CFG["telegram_token"]),
            "region":                CFG["tuya_region"],
        })

    # ── /api/check_alert ──
    def _check_alert(self):
        now = datetime.now(); price = CFG["price_per_unit"]; base = CFG["alert_taka"]
        STEP = 100
        results = []

        dev = get_device_data()
        if not dev:
            self._json({"ok": False, "msg": "offline"})
            return

        kwh = dev["total_kwh"]; taka = round(kwh*price, 2)
        pw  = dev["power_w"];   vv   = dev["voltage_v"]; fault = dev.get("fault", 0)

        if fault and fault > 0:
            send_telegram(
                f"🔴 <b>TOMZN FAULT!</b>\n⚠️ কোড: <b>{fault}</b>\n"
                f"লিকেজ/ওভারলোড সম্ভব\n⚡ {pw}W · {vv}V\n"
                f"🕐 {now.strftime('%d/%m/%Y %H:%M')}\n⛔ <b>মেইন সুইচ চেক করুন!</b>"
            )
            results.append({"type": "fault"})

        cur = int(base/STEP) + int((taka-base)/STEP) if taka >= base else 0
        last = _get_step()
        if cur > last:
            _set_step(cur)
            at = base + (cur - int(base/STEP)) * STEP
            if last < int(base/STEP):
                msg = (f"🚨 <b>খরচ অ্যালার্ট!</b>\n৳{base:.0f} ছাড়িয়েছে!\n"
                       f"⚡ {pw}W · 🔋 {vv}V\n📈 {kwh:.4f} kWh\n💰 ৳{taka:.2f}\n"
                       f"🕐 {now.strftime('%d/%m/%Y %H:%M')}")
            else:
                msg = (f"💸 ৳{at:.0f} পার!\n📈 {kwh:.4f} kWh · 💰 ৳{taka:.2f}\n"
                       f"🕐 {now.strftime('%d/%m/%Y %H:%M')}")
            send_telegram(msg)
            results.append({"type": "taka", "at": at})

        if now.minute < 5:
            days = max(now.day, 1); mo = kwh/days*30*price
            send_telegram(
                f"⏰ <b>ঘণ্টার রিপোর্ট</b>\n⚡ {pw}W · 🔋 {vv}V\n"
                f"📊 {kwh:.4f} kWh\n💰 ৳{taka:.2f}\n📅 মাসিক: ৳{mo:.0f}\n"
                f"🕐 {now.strftime('%H:%M')}"
            )
            results.append({"type": "hourly"})

        self._json({"ok": True, "kwh": kwh, "taka": taka, "results": results})

    # ── /api/monthly_report ──
    def _monthly_report(self):
        now = datetime.now(); price = CFG["price_per_unit"]
        dev = get_device_data(); cur = dev["total_kwh"] if dev else 0.0

        this_key = now.strftime("%Y-%m")
        prev_dt  = now.replace(day=1) - timedelta(days=1)
        prev_key = prev_dt.strftime("%Y-%m")
        log      = _load_month(); sent = False

        if prev_key in log:
            used = max(0.0, log.get(this_key, cur) - log[prev_key])
            bill = breb(used)
            rows = "\n".join(bill["rows"])
            send_telegram(
                f"📋 <b>{BN_MONTHS[prev_dt.month]} {prev_dt.year} — মাসিক রিপোর্ট</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"📊 মোট ইউনিট: <b>{used:.2f} kWh</b>\n"
                f"📅 গড়/দিন: <b>{used/30:.2f} kWh</b>\n\n"
                f"💰 সহজ হিসাব: <b>৳{used*price:.2f}</b>\n\n"
                f"🏛 BREB বিল:\n{rows}\n"
                f"   • মিটার ভাড়া: ৳40\n"
                f"   • ভ্যাট(৫%): ৳{bill['vat']}\n"
                f"   ━━━━━━━━━━━━━\n"
                f"   🧾 সম্ভাব্য বিল: <b>৳{bill['total']}</b>\n\n"
                f"🗓 {now.strftime('%d/%m/%Y %H:%M')}"
            )
            sent = True

        if this_key not in log:
            log[this_key] = cur
            _save_month(log)

        self._json({"ok": True, "sent": sent, "kwh": cur})

    # ── /api/test_telegram ──
    def _test_telegram(self):
        ok = send_telegram(
            f"✅ <b>Telegram সংযোগ সফল!</b>\n\n"
            f"⚡ বিদ্যুৎ মনিটর চালু আছে\n"
            f"🔌 TOMZN 63A · Tuya Cloud\n"
            f"🌐 Vercel Deploy সম্পন্ন\n"
            f"🕐 {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}"
        )
        self._json({"success": ok})

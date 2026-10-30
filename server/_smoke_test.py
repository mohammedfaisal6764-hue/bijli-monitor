import os, sys, json, threading, tempfile, time, urllib.request, urllib.error

# Windows কনসোল cp1252 হলে বাংলা প্রিন্টে ক্র্যাশ করে — stdout/stderr UTF-8 করি
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# স্টেট ফাইল যেন workspace-এ না পড়ে — টেম্প ডিরে লিখি
os.environ["BIJLI_DATA_DIR"] = tempfile.mkdtemp(prefix="bijli_smoke_")
os.environ["TELEGRAM_BOT_TOKEN"] = ""
os.environ["TELEGRAM_CHAT_ID"] = ""

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))
import handler as h   # noqa: E402
from http.server import HTTPServer   # noqa: E402

fails = []

def check(name, cond, extra=""):
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(extra)) if extra else ""))
    if not cond:
        fails.append(name)

# ── ১) _msg() প্রতিটি type — খালি না হওয়া উচিত ──
print("[1] message formatting")
for t in ("offline", "online", "power", "voltage", "fault", "taka", "hourly", "daily", "monthly"):
    m = h._msg(t, {"time": "12:03:05", "date": "02/10/2026", "kwh": 1234.5, "ms": 61000,
                   "offCount": 3, "w": 1200, "voltV": 230.0, "ampA": 5.0, "code": 1}, h.bdnow())
    check(f"_msg({t}) non-empty", isinstance(m, str) and len(m) > 0)
check("_msg(unknown) -> text fallback", h._msg("nope", {"text": "hi"}, h.bdnow()) == "hi")

# ── ২) fms() সময়-ফরম্যাট ──
print("[2] duration formatting")
check("fms(61000) == '1 মিনিট 1 সেকেন্ড'", "1 মিনিট" in h.fms(61000), h.fms(61000))
check("fms(0) non-empty", len(h.fms(0)) > 0, h.fms(0))

# ── ৩) breb() স্ল্যাব বিল ──
print("[3] BREB bill")
b = h.breb(120)
check("breb(120) has rows/vat/total", all(k in b for k in ("rows", "vat", "total")))
check("breb(120) total > 0", b["total"] > 0, b["total"])

# ── ৪) লাইভ HTTP সার্ভার ──
print("[4] HTTP routes")
srv = HTTPServer(("127.0.0.1", 8123), h.handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
time.sleep(0.4)
base = "http://127.0.0.1:8123"

def call(path, data=None):
    url = base + path
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method="POST" if body else "GET",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, None

st, cfg = call("/api/config")
check("/api/config 200 + ok", st == 200 and isinstance(cfg, dict) and "tuya_configured" in cfg, cfg)

st, nd = call("/api/notify", {"type": "offline", "data": {"kwh": 100.0}})
check("/api/notify handled", st == 200 and nd.get("ok") is True and nd.get("success") is False, nd)

st, nd2 = call("/api/notify", {})
check("/api/notify missing type -> error", st == 200 and nd2.get("success") is False, nd2)

st, tt = call("/api/test_telegram", {"creds": {}})
check("/api/test_telegram returns success flag", st == 200 and "success" in tt, tt)

st, dt = call("/api/data", {"creds": {}})
check("/api/data returns ok + online flag", st == 200 and dt.get("ok") is True and "online" in dt,
      {k: dt.get(k) for k in ("ok", "online", "error_msg")} if dt else None)

srv.shutdown()
print("\n" + ("✅ ALL PASSED" if not fails else f"❌ {len(fails)} FAILED: {fails}"))
sys.exit(1 if fails else 0)

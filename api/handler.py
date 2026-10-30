from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os, json, time, hmac, hashlib, requests
from datetime import datetime, timedelta

ENV = {
    "tuya_client_id":     os.environ.get("TUYA_CLIENT_ID",     "q5avqmrnwupjwhwvm5q3"),
    "tuya_client_secret": os.environ.get("TUYA_CLIENT_SECRET", "0087dd259b1f4fa7801573a1401254f0"),
    "tuya_device_id":     os.environ.get("TUYA_DEVICE_ID",     "bf253686d86878a2eduejn"),
    "tuya_region":        os.environ.get("TUYA_REGION",        "eu"),
    "telegram_token":     os.environ.get("TELEGRAM_BOT_TOKEN", ""),
    "telegram_chat_id":   os.environ.get("TELEGRAM_CHAT_ID",   ""),
}
DATA_DIR = os.environ.get("BIJLI_DATA_DIR", "/tmp")   # সার্ভারে /var/lib/bijli — রিবুটেও থাকবে
DEF = {
    "price":  float(os.environ.get("PRICE_PER_UNIT",         "8")),
    "alert":  float(os.environ.get("ALERT_THRESHOLD_TAKA", "500")),
}
HOSTS = {"eu":"https://openapi.tuyaeu.com","us":"https://openapi.tuyaus.com","cn":"https://openapi.tuyacn.com","in":"https://openapi.tuyain.com"}
_tc = {}
_tuya_err = {"msg":""}   # সংযোগ ব্যর্থ হলে আসল কারণ এখানে জমা থাকবে
CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Content-Type":"application/json; charset=utf-8"}
BN = {1:"জানুয়ারি",2:"ফেব্রুয়ারি",3:"মার্চ",4:"এপ্রিল",5:"মে",6:"জুন",7:"জুলাই",8:"আগস্ট",9:"সেপ্টেম্বর",10:"অক্টোবর",11:"নভেম্বর",12:"ডিসেম্বর"}

def resolve(body_creds):
    out = dict(ENV)
    if body_creds:
        for k in ("tuya_client_id","tuya_client_secret","tuya_device_id","tuya_region","telegram_token","telegram_chat_id"):
            v = body_creds.get(k)
            if v: out[k] = v
    return out

def _sign(cid,sec,tok,t,n,method,path,body=""):
    h=hashlib.sha256(body.encode()).hexdigest()
    s="\n".join([method,h,"",path])
    return hmac.new(sec.encode(),(cid+tok+t+n+s).encode(),hashlib.sha256).hexdigest().upper()

def _hdrs(cr,method,path,body="",token=""):
    cid=cr["tuya_client_id"]; sec=cr["tuya_client_secret"]
    t=str(int(time.time()*1000)); n=hashlib.md5(t.encode()).hexdigest()[:8]
    return {"client_id":cid,"sign":_sign(cid,sec,token,t,n,method,path,body),"t":t,"sign_method":"HMAC-SHA256","nonce":n,"access_token":token,"Content-Type":"application/json"}

def _base(cr): return HOSTS.get(cr.get("tuya_region","eu"),HOSTS["eu"])

def _token(cr):
    cid=cr["tuya_client_id"]
    if not cid: return ""
    key=cid+"|"+cr.get("tuya_region","eu")
    now=time.time(); c=_tc.get(key)
    if c and now<c["exp"]: return c["v"]
    base=_base(cr); path="/v1.0/token?grant_type=1"
    try:
        r=requests.get(f"{base}{path}",headers=_hdrs(cr,"GET",path),timeout=8); d=r.json()
        if d.get("success"):
            _tc[key]={"v":d["result"]["access_token"],"exp":now+d["result"].get("expire_time",7200)-60}
            return _tc[key]["v"]
        _tuya_err["msg"]=f"Token ব্যর্থ (region: {cr.get('tuya_region','eu')}) — {d.get('msg','')} [কোড {d.get('code','')}]। Client ID/Secret ভুল বা এই region-এ প্রজেক্ট নেই।"
    except Exception as e:
        _tuya_err["msg"]=f"Region {cr.get('tuya_region','eu')} সার্ভারে পৌঁছানো যায়নি: {e}"
    return ""

def _device_status(cr,tok):
    """ডিভাইস স্ট্যাটাস আনে — ব্যর্থ হলে (dev, কারণ) ফেরত দেয়"""
    base=_base(cr); did=cr["tuya_device_id"]; path=f"/v1.0/devices/{did}/status"
    try:
        r=requests.get(f"{base}{path}",headers=_hdrs(cr,"GET",path,token=tok),timeout=8); d=r.json()
        if not d.get("success"):
            code=d.get("code",0)
            if code in (1010,1011,1015,2008,2011,2015):
                return None,f"ডিভাইস পাওয়া যায়নি [কোড {code}] — Device ID ভুল নাহলে Tuya IoT প্রজেক্টে ডিভাইসটা link করা হয়নি।"
            if code==28841002:
                return None,"API সীমা (rate limit) — কিছুক্ষণ পর আবার চেষ্টা করুন।"
            return None,f"Tuya বলছে: {d.get('msg','')} [কোড {code}]"
        dps={i["code"]:i["value"] for i in d.get("result",[])}
        # TOMZN 63A (Tuya) আসল কী: cur_power=0.1W · cur_voltage=0.1V · cur_current=mA · add_ele=0.01kWh
        def G(*ks,d=0):
            for k in ks:
                if k in dps and dps[k] is not None: return dps[k]
            return d
        pw=round(G("cur_power","power_a","power")/10,1)
        vv=round(G("cur_voltage","voltage_a","voltage")/10,1)
        aa=round(G("cur_current","current_a","current")/1000,3)
        kwh=round(G("add_ele","total_forward_energy","total_energy")/100,4)
        pf=round(pw/(vv*aa),3) if vv>0 and aa>0 else 0.0
        return {"power_w":pw,"voltage_v":vv,"current_a":aa,"pf":pf,"total_kwh":kwh,"fault":dps.get("fault",0),"online":True,"source":"tuya"},""
    except Exception as e:
        return None,f"ডিভাইস ডেটা আনতে ব্যর্থ: {e}"
    return ""

def get_device(cr):
    if not cr.get("tuya_client_id") or not cr.get("tuya_device_id"): return None
    tok=_token(cr)
    if not tok: return None
    dev,err=_device_status(cr,tok)
    if dev: _tuya_err["msg"]=""; return dev
    _tuya_err["msg"]=err; return None

def tg(cr,msg):
    return send_tg(cr,msg)[0]

def send_tg(cr,msg):
    tok=cr.get("telegram_token"); cid=cr.get("telegram_chat_id")
    if not tok or not cid: return False,"Bot Token বা Chat ID দেওয়া হয়নি"
    try:
        r=requests.post(f"https://api.telegram.org/bot{tok}/sendMessage",json={"chat_id":cid,"text":msg,"parse_mode":"HTML"},timeout=8)
        data=r.json()
        if data.get("ok"): return True,None
        return False,data.get("description","Telegram অনুরোধ গ্রহণ করেনি")
    except requests.RequestException as e:
        print(f"[Telegram]{e}")
        return False,"Telegram সার্ভারে সংযোগ করা যায়নি"
    except ValueError:
        return False,"Telegram থেকে অপ্রত্যাশিত উত্তর এসেছে"

def breb(kwh):
    slabs=[(50,3.75),(50,5.14),(100,5.36),(100,6.34),(100,9.94),(float('inf'),11.46)]
    labels=["০–৫০","৫১–১০০","১০১–২০০","২০১–৩০০","৩০১–৪০০","৪০০+"]
    rem,tot,rows=kwh,0.0,[]
    for i,(lim,rate) in enumerate(slabs):
        if rem<=0: break
        u=min(rem,lim); c=u*rate; tot+=c
        rows.append(f"   • {labels[i]}: {u:.1f}×{rate} = ৳{c:.2f}")
        rem-=u
    vat=round(tot*.05,2); return {"rows":rows,"vat":vat,"total":round(tot+vat+40,2)}

# ═══════════ বাংলাদেশ সময় (UTC+6) ═══════════
def bdnow(): return datetime.utcnow()+timedelta(hours=6)

def fms(ms):
    s=max(0,int((ms or 0)/1000)); h=s//3600; m=(s%3600)//60; sec=s%60
    out=[]
    if h: out.append(f"{h} ঘণ্টা")
    if m: out.append(f"{m} মিনিট")
    if sec or not out: out.append(f"{sec} সেকেন্ড")
    return " ".join(out)

HR="━━━━━━━━━━━━━━━━━━"

def _msg(t,d,now):
    G=lambda k,v=None:(d.get(k) if d.get(k) not in (None,"") else v)
    T=str(G("time") or now.strftime("%H:%M:%S")); D=str(G("date") or now.strftime("%d/%m/%Y"))
    P=float(G("price") or DEF["price"])
    kwh=float(G("kwh") or 0); taka=float(G("taka") or 0)
    today=float(G("today") or 0); yest=float(G("yesterday") or 0); mon=float(G("month") or 0)
    offc=int(G("offCount") or 0); onc=int(G("onCount") or 0)
    oms=float(G("outageMs") or 0); lms=float(G("longestMs") or 0)
    test="🧪 <b>টেস্ট মেসেজ</b>\n" if d.get("test") else ""
    if t=="offline":
        return (test+"🔴 <b>বিদ্যুৎ চলে গেছে!</b>\n"+HR+"\n"
            f"🕐 সময়: <b>{T}</b>\n📅 তারিখ: <b>{D}</b>\n"
            f"🔢 আজকের বিভ্রাট: <b>{offc} বার</b>\n"
            f"📈 আজকের ব্যবহার: <b>{float(G('dayUsed') or today):.4f} kWh</b>\n"
            f"💰 আজকের খরচ: <b>৳{float(G('todayTaka') or 0):.2f}</b>\n"
            f"📊 মিটার: <b>{kwh:.4f} kWh</b>\n"
            "⏳ কতক্ষণ বন্ধ থাকল — হিসাব শুরু হয়েছে...")
    if t=="online":
        ms=float(G("ms") or 0)
        return (test+"🟢 <b>বিদ্যুৎ ফিরে এসেছে!</b>\n"+HR+"\n"
            f"🕐 এসেছে: <b>{T}</b>\n📅 তারিখ: <b>{D}</b>\n"
            f"🔴 গিয়েছিল: <b>{G('startStamp','—')}</b>\n"
            f"⏱ ছিল না: <b>{G('duration') or fms(ms)}</b>\n"
            f"🔢 আজ মোট গেছে: <b>{offc} বার</b>\n"
            f"📊 মিটার: <b>{kwh:.4f} kWh</b>")
    if t=="power":
        return (test+"⚡ <b>লোড অ্যালার্ট!</b>\n"+HR+"\n"
            f"📈 এখন লোড: <b>{float(G('w') or 0):.0f} W</b>\n"
            f"🚨 নির্ধারিত সীমা: <b>{float(G('limit') or 1000):.0f} W</b>\n"
            f"🔋 ভোল্টেজ: <b>{float(G('voltV') or 0):.1f} V</b> · {float(G('ampA') or 0):.2f} A\n"
            f"🕐 {T} · {D}")
    if t=="voltage":
        return (test+"🔌 <b>ভোল্টেজ অ্যালার্ট!</b>\n"+HR+"\n"
            f"⚡ এখন: <b>{float(G('voltV') or 0):.1f} V</b>\n"
            f"✅ স্বাভাবিক সীমা: {float(G('min') or 180):.0f}–{float(G('max') or 260):.0f} V\n"
            f"📈 লোড: {float(G('w') or 0):.0f} W\n🕐 {T} · {D}")
    if t=="fault":
        return (test+"⚠️ <b>TOMZN FAULT!</b>\n"+HR+"\n"
            f"🔢 কোড: <b>{G('code',0)}</b>\n⚠️ লিকেজ / ওভারলোড সম্ভব\n"
            f"⚡ {float(G('w') or 0):.0f} W · {float(G('voltV') or 0):.1f} V\n🕐 {T} · {D}\n"
            "⛔ <b>মেইন সুইচ চেক করুন!</b>")
    if t=="taka":
        return (test+f"💰 <b>খরচ অ্যালার্ট — ৳{float(G('at') or 0):.0f} পার!</b>\n"+HR+"\n"
            f"📊 {kwh:.4f} kWh\n💰 মোট: <b>৳{float(G('total') or taka):.2f}</b>\n🕐 {T} · {D}")
    if t=="hourly":
        return ("⏰ <b>ঘণ্টার রিপোর্ট</b>\n"+HR+"\n"
            f"📊 মিটার: {kwh:.4f} kWh · 💰 ৳{taka:.2f}\n"
            f"📈 আজ: {today:.4f} kWh (৳{float(G('todayTaka') or 0):.2f})\n"
            f"📅 এই মাস: {mon:.3f} kWh\n🕐 {T}")
    if t=="daily":
        days=int(G("monthDays") or 30)
        return (test+"📰 <b>দৈনিক রিপোর্ট</b> — "+D+"\n"+HR+"\n"
            f"📅 <b>আজ</b> ({D}):\n   ⚡ {today:.4f} kWh · 💰 ৳{float(G('todayTaka') or today*P):.2f}\n"
            f"📆 <b>গতকাল</b>:\n   ⚡ {yest:.4f} kWh\n"
            f"📊 <b>এই মাস</b>:\n   ⚡ {mon:.3f} kWh · 💰 ৳{mon*P:.0f}\n"
            f"📈 গড়/দিন: {mon/max(1,now.day):.3f} kWh · প্রজেকশন: {mon/max(1,now.day)*days:.2f} kWh\n"
            +HR+f"\n🔴 বিদ্যুৎ গেছে: <b>{offc} বার</b> · 🟢 এসেছে: <b>{onc} বার</b>\n"
            f"⏳ মোট বন্ধ ছিল: <b>{fms(oms)}</b>\n"
            f"🕰 সর্বোচ্চ একটানা: <b>{fms(lms)}</b>\n"
            f"⚡ চালু ছিল: <b>{fms(float(G('onlineMs') or 0))}</b>\n"
            f"⚡ সর্বোচ্চ লোড: <b>{float(G('peakW') or 0):.0f} W</b>\n"
            f"🕐 {T} · {D}")
    if t=="monthly":
        return (test+f"📋 <b>{G('monthName','')} — মাসিক রিপোর্ট</b>\n"+HR+"\n"
            f"🕐 {T} · {D}")
    return d.get("text") or ""

def _gs():
    try:
        with open(os.path.join(DATA_DIR,"bs.txt")) as f: return int(f.read().strip())
    except: return 0
def _ss(s):
    try:
        with open(os.path.join(DATA_DIR,"bs.txt"),"w") as f: f.write(str(s))
    except: pass
def _lm():
    try:
        with open(os.path.join(DATA_DIR,"bm.json")) as f: return json.load(f)
    except: return {}
def _sm(log):
    try:
        if len(log)>13: del log[sorted(log)[0]]
        with open(os.path.join(DATA_DIR,"bm.json"),"w") as f: json.dump(log,f)
    except: pass
def _lc():
    try:
        with open(os.path.join(DATA_DIR,"bcreds.json")) as f: return json.load(f)
    except: return {}
def _sc(cr):
    try:
        with open(os.path.join(DATA_DIR,"bcreds.json"),"w") as f: json.dump(cr,f)
    except: pass
def _ds():
    try:
        with open(os.path.join(DATA_DIR,"bdaily.json")) as f: return json.load(f)
    except: return {}
def _dss(d):
    try:
        if len(d)>60: del d[sorted(d)[0]]
        with open(os.path.join(DATA_DIR,"bdaily.json"),"w") as f: json.dump(d,f)
    except: pass
def _ps():
    try:
        with open(os.path.join(DATA_DIR,"bpower.json")) as f: return json.load(f)
    except: return {}
def _pss(s):
    try:
        with open(os.path.join(DATA_DIR,"bpower.json"),"w") as f: json.dump(s,f)
    except: pass

os.makedirs(DATA_DIR,exist_ok=True)

class handler(BaseHTTPRequestHandler):
    def log_message(self,*a): pass

    def _j(self,data,status=200):
        body=json.dumps(data,ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        for k,v in CORS.items(): self.send_header(k,v)
        self.send_header("Content-Length",len(body)); self.end_headers(); self.wfile.write(body)

    def _route(self):
        p=urlparse(self.path); qs=parse_qs(p.query); r=qs.get("route",[""])[0]
        if not r:
            for x in ("data","config","check_alert","daily_report","monthly_report","test_telegram","save_settings","notify"):
                if p.path.endswith(x): r=x; break
        return r

    def _body(self):
        try:
            n=int(self.headers.get("Content-Length",0))
            if n==0: return {}
            raw=self.rfile.read(n); return json.loads(raw) if raw else {}
        except: return {}

    def do_OPTIONS(self):
        self.send_response(200)
        for k,v in CORS.items(): self.send_header(k,v)
        self.end_headers()

    def do_GET(self):
        r=self._route()
        if r=="data": self._data({})
        elif r=="config": self._config()
        elif r=="check_alert": self._check_alert()
        elif r=="daily_report": self._daily_report()
        elif r=="monthly_report": self._monthly()
        else: self._j({"ok":False,"error":"not found"},404)

    def do_POST(self):
        r=self._route(); b=self._body()
        if r=="data": self._data(b)
        elif r=="notify": self._notify(b)
        elif r=="test_telegram": self._test_tg(b)
        elif r=="save_settings": self._save(b)
        else: self._j({"ok":False,"error":"not found"},404)

    def _data(self,b):
        cr=resolve(b.get("creds") if b else None)
        if b and b.get("creds"): _sc(cr)
        price=b.get("price_per_unit") or DEF["price"]
        dev=get_device(cr)
        # ডিভাইস অফলাইন হলেও কেন অফলাইন সেটা বলে দেয় (region ভুল / token / link)
        if dev and dev.get("online"):
            pw,vv,aa,pf,kwh=dev["power_w"],dev["voltage_v"],dev["current_a"],dev["pf"],dev["total_kwh"]
            fault,online,src=dev.get("fault",0),True,"tuya"
            err=""
        else:
            pw=vv=aa=pf=kwh=fault=0.0; online,src=False,"offline"
            err=_tuya_err["msg"] or "Tuya থেকে কোনো ডেটা আসেনি — বিদ্যুৎ নেই বা কানেকশন সমস্যা।"
        self._j({"ok":True,"online":online,"source":src,"power_w":pw,"voltage_v":vv,"current_a":aa,"pf":pf,"fault":fault,"total_kwh":kwh,"error_msg":err,"total_taka":round(kwh*price,4),"price_per_unit":price,"telegram_ok":bool(cr.get("telegram_token")),"tuya_ok":bool(cr.get("tuya_client_id"))})

    def _config(self):
        c=_lc()
        self._j({"price_per_unit":DEF["price"],"alert_threshold_taka":DEF["alert"],"tuya_configured":bool(c.get("tuya_client_id") or ENV["tuya_client_id"]),"telegram_configured":bool(c.get("telegram_token") or ENV["telegram_token"])})

    def _save(self,b):
        cr=resolve(b.get("creds")); _sc(cr)
        dev=get_device(cr)
        self._j({"ok":True,"saved":True,"device_online":bool(dev and dev.get("online"))})

    def _check_alert(self):
        cr=resolve(_lc()); now=bdnow(); price=DEF["price"]; base=DEF["alert"]; STEP=100; res=[]
        st=_ps()
        dev=get_device(cr)
        # ── ডিভাইস অফলাইন = বিদ্যুৎ নেই ──
        if not dev:
            if st.get("on",True):
                st["on"]=False; st["off_at"]=now.isoformat(); st["off_stamp"]=now.strftime("%H:%M:%S")
                _pss(st)
                tg(cr,_msg("offline",{"time":now.strftime("%H:%M:%S"),"date":now.strftime("%d/%m/%Y"),
                    "kwh":st.get("kwh",0),"taka":float(st.get("kwh",0))*price,"offCount":int(st.get("offc",0))+1},now))
                res.append({"type":"offline"})
            self._j({"ok":True,"online":False,"results":res}); return
        kwh=dev["total_kwh"]; taka=round(kwh*price,2); pw=dev["power_w"]; vv=dev["voltage_v"]; fault=dev.get("fault",0)
        # ── বিদ্যুৎ ফিরে এসেছে ──
        if not st.get("on",True):
            ms=0
            try: ms=(now-datetime.fromisoformat(st["off_at"])).total_seconds()*1000
            except: pass
            st["on"]=True; st["offc"]=int(st.get("offc",0))+1; _pss(st)
            tg(cr,_msg("online",{"time":now.strftime("%H:%M:%S"),"date":now.strftime("%d/%m/%Y"),"ms":ms,
                "duration":fms(ms),"startStamp":st.get("off_stamp","—"),"kwh":kwh,"offCount":st["offc"]},now))
            res.append({"type":"online","ms":ms})
        st["on"]=True; st["kwh"]=kwh; _pss(st)
        # ── FAULT ──
        if fault and fault>0:
            tg(cr,_msg("fault",{"code":fault,"w":pw,"voltV":vv},now)); res.append({"type":"fault"})
        # ── লোড সীমা (rising edge) ──
        lim=float(os.environ.get("POWER_ALERT_W","1000"))
        if pw>=lim and not st.get("over"):
            st["over"]=True; _pss(st)
            tg(cr,_msg("power",{"w":pw,"limit":lim,"voltV":vv,"ampA":dev.get("current_a",0)},now)); res.append({"type":"power"})
        elif pw<lim*0.9 and st.get("over"):
            st["over"]=False; _pss(st)
        # ── খরচ অ্যালার্ট ──
        cur=int(base/STEP)+int((taka-base)/STEP) if taka>=base else 0
        last=_gs()
        if cur>last:
            _ss(cur); at=base+(cur-int(base/STEP))*STEP
            tg(cr,_msg("taka",{"at":at,"total":taka,"kwh":kwh},now)); res.append({"type":"taka","at":at})
        # ── ঘণ্টাভিত্তিক (HOURLY_REPORT=1 হলে) ──
        hkey=now.strftime("%Y-%m-%d %H")
        if os.environ.get("HOURLY_REPORT","0")=="1" and st.get("last_hour")!=hkey:
            st["last_hour"]=hkey; _pss(st)
            tg(cr,_msg("hourly",{"kwh":kwh,"taka":taka,"time":now.strftime("%H:%M")},now)); res.append({"type":"hourly"})
        self._j({"ok":True,"online":True,"kwh":kwh,"taka":taka,"results":res})


    def _monthly(self):
        cr=resolve(_lc()); now=bdnow(); price=DEF["price"]
        dev=get_device(cr); cur=dev["total_kwh"] if dev else 0.0
        this_key=now.strftime("%Y-%m"); prev_dt=now.replace(day=1)-timedelta(days=1); prev_key=prev_dt.strftime("%Y-%m")
        log=_lm(); sent=False
        if prev_key in log:
            used=max(0.0,log.get(this_key,cur)-log[prev_key]); bill=breb(used); rows="\n".join(bill["rows"])
            tg(cr,f"📋 <b>{BN[prev_dt.month]} {prev_dt.year} — মাসিক রিপোর্ট</b>\n━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 মোট ইউনিট: <b>{used:.2f} kWh</b>\n📅 গড়/দিন: <b>{used/30:.2f} kWh</b>\n\n💰 সহজ হিসাব: <b>৳{used*price:.2f}</b>\n\n🏛 BREB বিল:\n{rows}\n   • মিটার ভাড়া: ৳40\n   • ভ্যাট(৫%): ৳{bill['vat']}\n   ━━━━━━━━━━━━━\n   🧾 সম্ভাব্য বিল: <b>৳{bill['total']}</b>\n\n🗓 {now.strftime('%d/%m/%Y %H:%M')}"); sent=True
        if this_key not in log: log[this_key]=cur; _sm(log)
        self._j({"ok":True,"sent":sent,"kwh":cur})

    def _daily_report(self):
        """Vercel Cron fallback — ব্রাউজার বন্ধ থাকলেও বাংলাদেশ সময় ১২টায় দৈনিক রিপোর্ট
           (কেউ হোক না হোক — শুধু Tuya কাউন্টার থেকে আজ/গতকাল/মাসের হিসাব বের করা হয়)"""
        cr=resolve(_lc()); now=bdnow(); price=DEF["price"]
        logo=_ds(); today=now.strftime("%Y-%m-%d"); yday=(now-timedelta(days=1)).strftime("%Y-%m-%d")
        dev=get_device(cr); cur=dev["total_kwh"] if dev else float(logo.get(today,{}).get("kwh",0) or 0)
        if cur<=0: self._j({"ok":False,"msg":"no data"}); return
        if today in logo: self._j({"ok":True,"sent":False,"msg":"already sent"}); return
        start=float(logo.get(yday,{}).get("kwh",cur) or cur)
        ystart=float(logo.get((now-timedelta(days=2)).strftime("%Y-%m-%d"),{}).get("kwh",start) or start)
        mk=now.strftime("%Y-%m"); mlog=_lm()
        if mk not in mlog: mlog[mk]=start; _sm(mlog)
        logo[today]={"kwh":cur,"t":now.strftime("%H:%M")}; _dss(logo)
        mon=int(mlog.get("dstart_"+mk,start) or start)
        st=_ps(); oc=int(st.get("offc",0)); oms=float(st.get("offms",0))
        tg(cr,"📰 <b>দৈনিক রিপোর্ট</b> — "+now.strftime("%d/%m/%Y")+"\n"+HR+"\n"
           +f"📅 <b>গতকাল</b> ({yday}):\n   ⚡ <b>{max(0.0,start-ystart):.4f} kWh</b>\n"
           +f"📊 <b>এই মাস</b>: <b>{max(0.0,cur-start):.3f} kWh</b> · ৳{max(0.0,cur-start)*price:.0f}\n"
           +f"📈 গড়/দিন: {max(0.0,cur-start)/max(1,now.day):.3f} kWh\n"+HR
           +f"\n🔴 আজ বিদ্যুৎ গেছে: <b>{oc} বার</b>\n⏳ মোট বন্ধ: <b>{fms(oms)}</b>\n"
           +f"📊 মিটার রিডিং: <b>{cur:.3f} kWh</b>\n🕐 {now.strftime('%H:%M:%S')}")
        self._j({"ok":True,"sent":True,"kwh":cur})

    def _notify(self,b):
        """ব্রাউজার থেকে পাঠানো নোটিফিকেশন (বিদ্যুৎ যাওয়া/আসা, লোড, ভোল্টেজ, রিপোর্ট)"""
        cr=resolve(b.get("creds")); t=(b.get("type") or "").strip(); data=b.get("data") or {}
        if not t: self._j({"ok":False,"success":False,"error":"type দেওয়া হয়নি"}); return
        msg=_msg(t,data,bdnow())
        if not msg: self._j({"ok":False,"success":False,"error":"অজানা type"}); return
        ok,err=send_tg(cr,msg)
        self._j({"ok":True,"success":ok,"error":err,"type":t})


    def _test_tg(self,b):
        cr=resolve(b.get("creds") if b else None)
        ok,error=send_tg(cr,f"✅ <b>Telegram সংযোগ সফল!</b>\n\n⚡ বিদ্যুৎ মনিটর চালু আছে\n🔌 TOMZN 63A · Tuya Cloud\n🌐 Vercel Deploy সম্পন্ন\n🕐 {bdnow().strftime('%d/%m/%Y %H:%M:%S')} (বাংলাদেশ সময়)")
        self._j({"success":ok,"error":error})

if __name__ == "__main__":
    from http.server import HTTPServer
    # ডিফল্ট আগের মতোই (127.0.0.1:8000) — nginx এখানেই proxy করে।
    # সরাসরি (nginx ছাড়া) চালাতে চাইলে:  BIND_HOST=0.0.0.0 PORT=8000 python3 api/handler.py
    _host = os.environ.get("BIND_HOST", "127.0.0.1")
    _port = int(os.environ.get("PORT", "8000"))
    HTTPServer((_host, _port), handler).serve_forever()

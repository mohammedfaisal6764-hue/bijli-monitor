import { useState, useEffect, useCallback, useRef } from 'react'

/* ═══════════════ Storage keys ═══════════════ */
const LS = 'bijli_v2'            // সেটিংস / credentials
const LK = 'bijli_ledger_v1'     // দৈনিক + মাসিক লেজার
const AK = 'bijli_alerts_v1'     // অ্যালার্ট হিস্ট্রি

/* ═══════════════ বাংলাদেশ সময় — UTC+6 (বাংলাদেশে DST নেই) ═══════════════
   ফোন/পিসির টাইমজোন যাই থাকুক, সবসময় বাংলাদেশের সময় দেখাবে।
   কৌশল: Date.now()-এর সাথে ৬ ঘণ্টা যোগ করে UTC getter দিয়ে পড়া হয়।   */
const p2 = n => String(n).padStart(2, '0')
export const BN_DAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার']
export const BN_DAYS_S = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি']
export const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
export const BD_OFFSET_MS = 6 * 60 * 60 * 1000
export const bdNow = (ms = Date.now()) => new Date(ms + BD_OFFSET_MS)
export const bdTime = (d = bdNow()) => `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`
export const bdHM = (d = bdNow()) => `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`
export const bdDate = (d = bdNow()) => `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
export const bdStamp = (d = bdNow()) => `${bdDate(d)} ${bdHM(d)}`
export const bdKey = (d = bdNow()) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
export const bdMonthKey = (d = bdNow()) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}`
export const bdDayName = (d = bdNow()) => BN_DAYS[d.getUTCDay()]
export const bdDayNameShort = (d = bdNow()) => BN_DAYS_S[d.getUTCDay()]
export const bdMonthName = (d = bdNow()) => BN_MONTHS[d.getUTCMonth()]
export const bdLong = (d = bdNow()) => `${d.getUTCDate()} ${BN_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} — ${BN_DAYS[d.getUTCDay()]}`
export const shiftKey = (k, days) => { const [y, m, d] = k.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d) + days * 86400000); return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}` }
export const prevMonthKey = k => { const [y, m] = k.split('-').map(Number); const t = new Date(Date.UTC(y, m - 2, 1)); return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}` }
export const daysInMonth = k => { const [y, m] = k.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate() }
export const monthNameOf = k => { const [y, m] = k.split('-').map(Number); return `${BN_MONTHS[m - 1]} ${y}` }
export const dayNameOfKey = k => { const [y, m, d] = k.split('-').map(Number); return BN_DAYS_S[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] }

/* ═══════════════ ফরম্যাটার ═══════════════ */
export const f = (n, d = 2) => Number(n || 0).toFixed(d)
export const fmtTaka = (n, d = 2) => `৳${Number(n || 0).toFixed(d)}`
export const fmtKwh = (n, d = 4) => `${Number(n || 0).toFixed(d)} kWh`
/* সংক্ষিপ্ত সময়কাল → "2ঘ 05মি" */
export function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}সে`
  if (s < 3600) return `${Math.floor(s / 60)}মি ${p2(s % 60)}সে`
  return `${Math.floor(s / 3600)}ঘ ${p2(Math.floor((s % 3600) / 60))}মি`
}
/* পূর্ণ সময়কাল → "1 ঘণ্টা 20 মিনিট 5 সেকেন্ড" */
export function fmtDurLong(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return [h ? `${h} ঘণ্টা` : '', m ? `${m} মিনিট` : '', (sec || (!h && !m)) ? `${sec} সেকেন্ড` : ''].filter(Boolean).join(' ')
}
/* প্রতি সেকেন্ডে টিক করা টাইমস্ট্যাম্প (লাইভ ঘড়ি / বিভ্রাট টাইমার) */
export function useNow(step = 1000) {
  const [n, setN] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setN(Date.now()), step); return () => clearInterval(id) }, [step])
  return n
}
export const credsOf = s => ({ tuya_client_id: s.tuya_client_id, tuya_client_secret: s.tuya_client_secret, tuya_device_id: s.tuya_device_id, tuya_region: s.tuya_region || 'eu', telegram_token: s.telegram_token, telegram_chat_id: s.telegram_chat_id })
/* ═══════════════ ডিফল্ট সেটিংস ═══════════════ */
export const DEFAULT_SETTINGS = {
  tuya_client_id: '', tuya_client_secret: '', tuya_device_id: '', tuya_region: 'eu',
  telegram_token: '', telegram_chat_id: '',
  price_per_unit: 8,
  power_alert_w: 1000,          // এই W ছাড়ালেই টেলিগ্রাম অ্যালার্ট
  alert_threshold_taka: 500,    // এই টাকার পর থেকে প্রতি ১০০ টাকায় অ্যালার্ট
  voltage_min: 180, voltage_max: 260,
  daily_report_hour: 12,        // বাংলাদেশ সময় — দৈনিক রিপোর্টের ঘণ্টা (0–23)
  daily_report_enabled: true,
  weekly_report_enabled: true,   // প্রতি শুক্রবার সাপ্তাহিক রিপোর্ট
  weekly_report_day: 5,          // ০=রবি … ৫=শুক্র … ৬=শনি
  monthly_budget_tk: 0,          // ০ = বন্ধ। মাসিক বাজেট (৳) — ছাড়ালে অ্যালার্ট
  peak_hour_alert: false,        // পিক আওয়ার শনাক্ত হলে জানাবে
  notify_offline: true, notify_online: true, notify_power: true,
  notify_daily: true, notify_monthly: true, notify_voltage: false, notify_hourly: false,
  notify_weekly: false, notify_budget: true,
  poll_ms: 3000,
}
export function loadSettings() {
  try { const r = localStorage.getItem(LS); if (r) return { ...DEFAULT_SETTINGS, ...JSON.parse(r) } } catch { }
  return { ...DEFAULT_SETTINGS }
}
export function saveSettingsLocal(s) { try { localStorage.setItem(LS, JSON.stringify(s)) } catch { } }

export function loadAlerts() { try { const r = localStorage.getItem(AK); if (r) return JSON.parse(r) } catch { } return [] }
export function saveAlerts(a) { try { localStorage.setItem(AK, JSON.stringify(a.slice(0, 60))) } catch { } }
export function clearAllData() { [LS, LK, AK].forEach(k => { try { localStorage.removeItem(k) } catch { } }) }

/* ═══════════════ BREB স্ল্যাব বিল ═══════════════ */
export function calcSlabBill(kwh) {
  const slabs = [[50, 3.75], [50, 5.14], [100, 5.36], [100, 6.34], [100, 9.94], [Infinity, 11.46]]
  const labels = ['০–৫০', '৫১–১০০', '১০১–২০০', '২০১–৩০০', '৩০১–৪০০', '৪০০+']
  let rem = kwh, total = 0; const rows = []
  slabs.forEach(([lim, rate], i) => {
    if (rem <= 0) return
    const used = Math.min(rem, lim), cost = used * rate
    total += cost
    if (used > 0) rows.push({ label: labels[i], used: used.toFixed(1), rate, cost: cost.toFixed(2) })
    rem -= used
  })
  const vat = total * .05
  return { rows, vat: vat.toFixed(2), total: (total + vat + 40).toFixed(2) }
}
export function calcAll(kwh, price, ms) {
  const h = Math.max(ms / 3600000, .0001), kphH = kwh / h, kphD = kphH * 24, kphM = kphD * 30, kphY = kphD * 365, tTotal = kwh * price
  return { kphH, kphD, kphM, kphY, tTotal, tHr: kphH * price, tDay: kphD * price, tMo: kphM * price, tYr: kphY * price, slab: calcSlabBill(kphM) }
}

/* ═══════════════ ট্রেন্ড অ্যানালাইসিস (ইনসাইট) ═══════════════
   days = ledger.days (key→day)। শেষ N দিনের গড়, সপ্তাহ-তু-সপ্তাহ তুলনা,
   সবচেয়ে বেশি খরচের দিন, পিক-আওয়ার ও মাস-শেষের প্রজেকশন বের করে। */
export function buildInsights(days, price, budgetTk = 0) {
  const todayK = bdKey()
  const get = k => (days[k] && days[k].used > 0 ? days[k] : null)
  const avg = n => {
    let sum = 0, cnt = 0
    for (let i = 1; i <= n; i++) { const d = get(shiftKey(todayK, -i)); if (d) { sum += d.used; cnt++ } }
    return cnt ? sum / cnt : 0
  }
  const avg7 = avg(7), avg30 = avg(30)
  /* এই সপ্তাহ (সোম থেকে) বনাম গত সপ্তাহ */
  const weekSum = off => {
    const dow = bdNow().getUTCDay() || 7          /* ১=সোম … ৭=রবি */
    let sum = 0
    for (let i = 0; i < 7; i++) { const d = get(shiftKey(todayK, -(dow - 1 + i + off))); if (d) sum += d.used }
    return sum
  }
  const thisWeek = weekSum(0), lastWeek = weekSum(7)
  /* সবচেয়ে বেশি খরচের দিন (গত ৩০ দিনে) */
  let top = { key: null, used: 0 }
  for (let i = 1; i <= 30; i++) { const k = shiftKey(todayK, -i); const d = get(k); if (d && d.used > top.used) top = { key: k, used: d.used } }
  /* মাসের প্রজেকশন + বাজেট */
  const mk = bdMonthKey(), m = days[mk] ? days[mk] : null
  const mUsed = (m && m.used) || 0
  const dayNow = bdNow().getUTCDate(), dim = daysInMonth(mk)
  const proj = dayNow > 0 ? (mUsed / dayNow) * dim : 0
  const projTaka = proj * price
  const budgetUsedPct = budgetTk > 0 ? Math.min(200, (mUsed * price / budgetTk) * 100) : 0
  const tips = []
  if (avg7 > 0 && avg30 > 0) {
    if (avg7 > avg30 * 1.15) tips.push(`📉 এই সপ্তাহ গত ৩০ দিনের গড়ের চেয়ে ${( (avg7 / avg30 - 1) * 100).toFixed(0)}% বেশি খরচ হচ্ছে`)
    else if (avg7 < avg30 * 0.85) tips.push(`🌱 দারুণ! এই সপ্তাহ ${( (1 - avg7 / avg30) * 100).toFixed(0)}% কম খরচ হচ্ছে`)
  }
  if (budgetTk > 0 && mUsed * price > budgetTk * 0.8) tips.push(`💰 মাসের বাজেটের ${budgetUsedPct.toFixed(0)}% খরচ হয়ে গেছে`)
  if (proj > 0) tips.push(`🔮 এই গতিতে মাস শেষে ~${proj.toFixed(1)} kWh (৳${(projTaka).toFixed(0)}) হবে`)
  return { avg7, avg30, thisWeek, lastWeek, weekDelta: lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek * 100 : 0, top, proj, projTaka, budgetUsedPct, tips, dim, dayNow }
}

/* ═══════════════ সিমুলেশন (Tuya credentials না থাকলে) ═══════════════ */
let sp = 0, sk = 0, simSeeded = false
function sim(seed) {
  if (!simSeeded) { if (seed && seed > 0) sk = seed; simSeeded = true }
  sp += .04
  const pw = Math.max(180, 455 + Math.sin(sp) * 45 + Math.sin(sp * 2.1) * 18 + (Math.random() - .5) * 15)
  const vV = 220 + Math.sin(sp * .6) * 3.5, pf = .88 + Math.sin(sp * .25) * .05
  sk += (pw / 3600) / 1000
  return { powerW: parseFloat(pw.toFixed(1)), voltV: parseFloat(vV.toFixed(1)), ampA: parseFloat((pw / (vV * pf)).toFixed(3)), pf: parseFloat(pf.toFixed(3)), totalKwh: parseFloat(sk.toFixed(6)), online: false, source: 'sim', fault: 0 }
}

/* ═══════════════ লেজার (দৈনিক / মাসিক হিসাব) ═══════════════ */
export const newDay = k => ({ startKwh: k, endKwh: k, used: 0, taka: 0, peakW: 0, minV: null, maxV: null, onlineMs: 0, offlineMs: 0, offCount: 0, onCount: 0, outageMs: 0, longestMs: 0, outages: [], samples: 0, open: null })
export const newMonth = k => ({ startKwh: k, endKwh: k, used: 0, taka: 0, peakW: 0, offCount: 0, onCount: 0, outageMs: 0, days: 0 })
const emptyLedger = () => ({ days: {}, months: {}, lastKwh: null, lastSampleMs: null, curMonth: null, lastDailyReport: null, lastMonthReport: null, meter: { base: 0, acc: 0, accMs: Date.now() } })
export function loadLedger() {
  const base = emptyLedger()
  try {
    const r = localStorage.getItem(LK)
    if (r) { const j = JSON.parse(r); return { ...base, ...j, days: j.days || {}, months: j.months || {}, meter: { ...base.meter, ...(j.meter || {}) } } }
  } catch { }
  return base
}
function saveLedger(l) {
  try {
    const keys = Object.keys(l.days).sort()
    if (keys.length > 90) keys.slice(0, keys.length - 90).forEach(k => delete l.days[k])
    const mkeys = Object.keys(l.months).sort()
    if (mkeys.length > 24) mkeys.slice(0, mkeys.length - 24).forEach(k => delete l.months[k])
    localStorage.setItem(LK, JSON.stringify(l))
  } catch { }
}
/* ═══════════════ Telegram মেসেজ টাইটেল (পপআপের জন্য) ═══════════════ */
const TITLES = {
  offline: '🔴 বিদ্যুৎ চলে গেছে', online: '🟢 বিদ্যুৎ ফিরে এসেছে', power: '⚡ লোড অ্যালার্ট',
  daily: '📰 দৈনিক রিপোর্ট', monthly: '📋 মাসিক রিপোর্ট', voltage: '🔌 ভোল্টেজ অ্যালার্ট',
  fault: '⚠️ FAULT অ্যালার্ট', taka: '💰 খরচ অ্যালার্ট', hourly: '⏰ ঘণ্টার রিপোর্ট', test: '✅ Telegram টেস্ট',
}
const DEBOUNCE = 2      // টানা ২টা স্যাম্পল মিললেই নিশ্চিত (≈৬ সেকেন্ড)
const MAX_DELTA = 0.5   // এক টিকে সর্বোচ্চ kWh — কাউন্টার লাফ আটকাতে

export function useElectricity() {
  const [settings, setSettingsState] = useState(loadSettings)
  const [data, setData] = useState({ powerW: 0, voltV: 220, ampA: 0, pf: 0, totalKwh: 0, online: false, source: 'sim', fault: 0 })
  const [price, setPriceState] = useState(() => loadSettings().price_per_unit || 8)
  const [alerts, setAlertsState] = useState(loadAlerts)
  const [alertCount, setAlertCount] = useState(() => loadAlerts().length)
  const [tgMsg, setTgMsg] = useState(null)
  const [ledger, setLedger] = useState(loadLedger)
  const [sending, setSending] = useState(false)

  const L = useRef(ledger)
  const startMs = useRef(Date.now())
  const powerState = useRef(null)                 // true=বিদ্যুৎ আছে · false=নেই · null=অজানা
  const onStreak = useRef(0), offStreak = useRef(0)
  const overStreak = useRef(0), powerFlag = useRef(false)
  const vStreak = useRef(0), vCool = useRef(0)
  const astep = useRef(0), tick = useRef(0), busy = useRef(false)

  const commit = useCallback(() => {
    saveLedger(L.current)
    setLedger({ ...L.current, days: { ...L.current.days }, months: { ...L.current.months }, meter: { ...L.current.meter } })
  }, [])

  const setPrice = useCallback(p => { setPriceState(p); const s = loadSettings(); s.price_per_unit = p; saveSettingsLocal(s) }, [])
  const setSettings = useCallback(n => { setSettingsState(n); saveSettingsLocal(n); if (n.price_per_unit) setPriceState(n.price_per_unit) }, [])

  const pushAlert = useCallback((text, color = 'cyan') => {
    setAlertsState(p => { const n = [{ id: Date.now() + Math.random(), text, color, time: bdTime() }, ...p].slice(0, 60); saveAlerts(n); return n })
    setAlertCount(c => c + 1)
  }, [])
  const clearAlerts = useCallback(() => { setAlertsState([]); saveAlerts([]) }, [])
  const showTg = useCallback(msg => { setTgMsg({ text: msg, id: Date.now() }); setTimeout(() => setTgMsg(null), 7000) }, [])

  /* ── আসল Telegram মেসেজ পাঠানো (server → Telegram API) ── */
  const notify = useCallback(async (type, payload) => {
    setSending(true)
    try {
      const r = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creds: credsOf(loadSettings()), type, data: payload || {} }) })
      const j = await r.json().catch(() => null)
      return { ok: !!(j && j.success), error: (j && j.error) || (!r.ok ? `HTTP ${r.status}` : '') }
    } catch (e) { return { ok: false, error: (e && e.message) || 'নেটওয়ার্ক ত্রুটি' } }
    finally { setSending(false) }
  }, [])

  const tgNotify = useCallback(async (type, payload, popup) => {
    if (popup !== null) showTg(`${TITLES[type] || '📨 নোটিফিকেশন'}\n${popup || 'মেসেজ পাঠানো হচ্ছে...'}`)
    const r = await notify(type, payload)
    if (!r.ok) pushAlert(`⚠️ Telegram পাঠানো যায়নি — ${r.error || 'কারণ অজানা'}`, 'orange')
    return r
  }, [notify, showTg, pushAlert])

  /* ── Tuya / সিমুলেশন থেকে ডেটা আনা ── */
  const fetchData = useCallback(async () => {
    const s = loadSettings()
    const real = !!(s.tuya_client_id && s.tuya_device_id)
    if (real) {
      try {
        const ctrl = new AbortController()
        const tid = setTimeout(() => ctrl.abort(), 4500)
        const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creds: credsOf(s), price_per_unit: s.price_per_unit || 8 }), signal: ctrl.signal })
        clearTimeout(tid)
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const d = await res.json()
        if (d && d.online) {
          const smp = { powerW: d.power_w || 0, voltV: d.voltage_v || 0, ampA: d.current_a || 0, pf: d.pf || 0, totalKwh: d.total_kwh || 0, online: true, source: 'tuya', fault: d.fault || 0 }
          setData(smp); return smp
        }
        const off = { powerW: 0, voltV: 0, ampA: 0, pf: 0, totalKwh: (d && typeof d.total_kwh === 'number') ? d.total_kwh : (L.current.lastKwh || 0), online: false, source: 'offline', fault: 0, statusText: (d && d.error_msg) || '' }
        setData(off); return off
      } catch (e) {
        const off = { powerW: 0, voltV: 0, ampA: 0, pf: 0, totalKwh: L.current.lastKwh || 0, online: false, source: 'offline', fault: 0, statusText: (e && e.name === 'AbortError') ? 'টাইমআউট — API সার্ভার ধীর/বন্ধ' : 'API ত্রুটি: ' + (e && e.message) }
        setData(off); return off
      }
    }
    const sm = sim(L.current.lastKwh)
    setData(sm); return sm
  }, [])

  /* ── Telegram মেসেজের ডেটা পেলোড ── */
  const dayPayload = useCallback((k, test) => {
    const s = loadSettings(), g = L.current, pr = s.price_per_unit || 8
    const d = g.days[k] || newDay(0), y = g.days[shiftKey(k, -1)], mon = g.months[bdMonthKey()] || newMonth(0)
    return {
      date: k, time: bdTime(), stamp: bdStamp(), price: pr, test: !!test, monthKey: bdMonthKey(),
      today: d.used, todayTaka: d.used * pr, yesterday: y ? y.used : 0, yesterdayTaka: y ? y.used * pr : 0,
      month: mon.used, monthTaka: mon.used * pr, kwh: g.lastKwh || 0, taka: (g.lastKwh || 0) * pr,
      offCount: d.offCount, onCount: d.onCount, outageMs: d.outageMs, longestMs: d.longestMs,
      onlineMs: d.onlineMs, offlineMs: d.offlineMs, peakW: d.peakW, minV: d.minV, maxV: d.maxV,
      monthDays: daysInMonth(bdMonthKey()),
    }
  }, [])
  const monthPayload = useCallback((mk, test) => {
    const s = loadSettings(), g = L.current, m = g.months[mk] || newMonth(0), n = daysInMonth(mk), pr = s.price_per_unit || 8
    return {
      monthKey: mk, monthName: monthNameOf(mk), time: bdTime(), date: bdDate(), stamp: bdStamp(), price: pr, test: !!test,
      used: m.used, taka: m.used * pr, avgDay: m.used / n, days: n, peakW: m.peakW,
      offCount: m.offCount, onCount: m.onCount, outageMs: m.outageMs,
    }
  }, [])
  const sendDailyNow = useCallback(() => tgNotify('daily', dayPayload(bdKey())), [tgNotify, dayPayload])
  const sendMonthlyNow = useCallback(() => tgNotify('monthly', monthPayload(bdMonthKey())), [tgNotify, monthPayload])
  const testAlert = useCallback(type => {
    const s = loadSettings(), g = L.current, d = g.days[bdKey()] || newDay(0), k = bdKey()
    let p
    if (type === 'offline') p = { ...dayPayload(k, true), dayUsed: d.used, offCount: d.offCount + 1 }
    else if (type === 'online') p = { ...dayPayload(k, true), ms: 734000, duration: fmtDurLong(734000), startStamp: bdStamp(new Date(Date.now() + BD_OFFSET_MS - 734000)) }
    else if (type === 'power') p = { ...dayPayload(k, true), w: (s.power_alert_w || 1000) + 45, limit: s.power_alert_w || 1000, voltV: data.voltV || 220, ampA: data.ampA || 0 }
    else if (type === 'voltage') p = { ...dayPayload(k, true), voltV: (s.voltage_min || 180) - 12, min: s.voltage_min || 180, max: s.voltage_max || 260, w: data.powerW || 0 }
    else if (type === 'monthly') p = monthPayload(bdMonthKey(), true)
    else p = dayPayload(k, true)
    return tgNotify(type, p)
  }, [data, dayPayload, monthPayload, tgNotify])

  /* ── মিটার রিডিং কন্ট্রোল ── */
  const setMeterBase = useCallback(v => { L.current.meter = { base: Number(v) || 0, acc: 0, accMs: Date.now() }; commit() }, [commit])
  const syncMeter = useCallback(() => { const k = L.current.lastKwh || 0, acc = L.current.meter.acc || 0; L.current.meter = { base: Math.max(0, k - acc), acc, accMs: Date.now() }; commit() }, [commit])
  const addMeter = useCallback(v => { L.current.meter = { ...L.current.meter, base: (L.current.meter.base || 0) + (Number(v) || 0), accMs: Date.now() }; commit() }, [commit])
  const resetToday = useCallback(() => { const k = L.current.lastKwh || 0, d = L.current.days[bdKey()]; if (d) { d.startKwh = k; d.used = 0; d.taka = 0; d.samples = 0 } commit() }, [commit])
  const clearHistory = useCallback(() => { L.current = emptyLedger(); commit() }, [commit])

  /* ── ব্যাকআপ / এক্সপোর্ট ── */
  const exportJSON = useCallback(() => {
    const s = loadSettings()
    const out = { exported: bdStamp(), app: 'bijli-monitor', ledger: L.current, settings: { ...s, tuya_client_secret: '***', telegram_token: '***' } }
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = `bijli-backup-${bdKey()}.json`; a.click(); URL.revokeObjectURL(url)
      return true
    } catch { return false }
  }, [])
  const exportCSV = useCallback(() => {
    const keys = Object.keys(L.current.days).sort()
    const rows = [['তারিখ', 'দিন', 'kWh', 'টাকা', 'peak_W', 'min_V', 'max_V', 'বিভ্রাট_বার', 'চালু_বার', 'বিভ্রাট_সময়_ms', 'সর্বোচ্চ_বিভ্রাট_ms', 'চালু_সময়_ms']]
    keys.forEach(k => { const d = L.current.days[k]; rows.push([k, dayNameOfKey(k), d.used.toFixed(4), d.taka.toFixed(2), d.peakW.toFixed(1), d.minV == null ? '' : d.minV, d.maxV == null ? '' : d.maxV, d.offCount, d.onCount, d.outageMs, d.longestMs, d.onlineMs]) })
    try {
      const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(r => r.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `bijli-daily-${bdKey()}.csv`; a.click(); URL.revokeObjectURL(url)
      return true
    } catch { return false }
  }, [])

  const testTelegram = useCallback(async creds => {
    setSending(true)
    try {
      const r = await fetch('/api/test_telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creds: creds || credsOf(loadSettings()) }) })
      const text = await r.text()
      let result
      try { result = JSON.parse(text) } catch { return { success: false, error: `API থেকে JSON উত্তর আসেনি (HTTP ${r.status})${text ? `: ${text.slice(0, 120)}` : ''}` } }
      return { success: result.success === true, error: result.error || (!r.ok ? `API ত্রুটি (HTTP ${r.status})` : 'Telegram টেস্ট ব্যর্থ') }
    } catch (e) { return { success: false, error: `API-তে সংযোগ করা যায়নি${(e && e.message) ? `: ${e.message}` : ''}` } }
    finally { setSending(false) }
  }, [])
  const saveSettingsRemote = useCallback(async s => {
    try { const r = await fetch('/api/save_settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creds: credsOf(loadSettings()) }) }); return await r.json() } catch { return { ok: false } }
  }, [])

  /* ═══════════ মূল টিক — প্রতি ৩ সেকেন্ডে হিসাব আপডেট ═══════════ */
  const runTick = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    try {
      const s = loadSettings()
      const real = !!(s.tuya_client_id && s.tuya_device_id)
      const smp = await fetchData()
      const nowMs = Date.now(), bd = bdNow(nowMs), pr = s.price_per_unit || 8
      const todayK = bdKey(bd), monthK = bdMonthKey(bd)
      /* সপ্তাহ কী — বছরের সপ্তাহ নম্বর (সোমবার শুরু), সাপ্তাহিক রিপোর্ট একবারই পাঠাতে */
      const weekKeyK = (d => {
        const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        const dow = (d.getUTCDay() + 6) % 7              /* 0=সোম */
        const monday = t - dow * 86400000
        return `${new Date(monday).getUTCFullYear()}-W${p2(Math.floor(monday / 604800000) % 100)}`
      })(bd)
      const g = L.current
      const day = g.days[todayK] || (g.days[todayK] = newDay(g.lastKwh == null ? smp.totalKwh : g.lastKwh))
      const mon = g.months[monthK] || (g.months[monthK] = newMonth(g.lastKwh == null ? smp.totalKwh : g.lastKwh))

      /* ১ · ইউনিট হিসাব */
      let delta = 0
      if (g.lastKwh != null && smp.totalKwh >= g.lastKwh) { const dd = smp.totalKwh - g.lastKwh; if (dd <= MAX_DELTA) delta = dd }
      g.lastKwh = smp.totalKwh
      day.endKwh = smp.totalKwh; mon.endKwh = smp.totalKwh
      day.used += delta; mon.used += delta
      day.taka += delta * pr; mon.taka += delta * pr
      g.meter.acc = (g.meter.acc || 0) + delta; g.meter.accMs = nowMs
      day.peakW = Math.max(day.peakW, smp.powerW || 0); mon.peakW = Math.max(mon.peakW, smp.powerW || 0)
      day.samples++
      if (smp.online && smp.voltV > 0) { day.minV = day.minV == null ? smp.voltV : Math.min(day.minV, smp.voltV); day.maxV = day.maxV == null ? smp.voltV : Math.max(day.maxV, smp.voltV) }

      /* ২ · চালু / বন্ধ সময় */
      const dt = g.lastSampleMs ? Math.min(Math.max(0, nowMs - g.lastSampleMs), 90000) : 0
      g.lastSampleMs = nowMs

      /* ৩ · বিদ্যুৎ আছে কি নেই (debounce সহ — ভুল অ্যালার্ট আটকাতে) */
      const powerOn = real ? (smp.online && smp.voltV >= 50) : true
      if (powerOn) { onStreak.current++; offStreak.current = 0 } else { offStreak.current++; onStreak.current = 0 }
      const firstSync = powerState.current === null
      let next = powerState.current
      if (next === null) { if (onStreak.current >= 1) next = true; else if (offStreak.current >= DEBOUNCE) next = false }
      else if (next === true && offStreak.current >= DEBOUNCE) next = false
      else if (next === false && onStreak.current >= DEBOUNCE) next = true
      const changed = next !== powerState.current
      powerState.current = next
      if (next) day.onlineMs += dt; else day.offlineMs += dt

      if (changed && next === false) {
        const o = { startMs: nowMs, startTime: bdHM(bd), startDate: bdDate(bd), startStamp: bdStamp(bd) }
        day.open = o; day.offCount++; mon.offCount++
        if (!firstSync) {
          pushAlert(`🔴 বিদ্যুৎ চলে গেছে — ${bdHM(bd)}`, 'red')
          if (real && s.notify_offline) tgNotify('offline', { ...dayPayload(todayK), dayUsed: day.used, offCount: day.offCount })
        }
      } else if (changed && next === true && !firstSync) {
        const o = day.open, ms = o ? Math.max(0, nowMs - o.startMs) : 0
        day.outages.unshift({ startMs: o ? o.startMs : null, endMs: nowMs, startTime: o ? o.startTime : '—', endTime: bdHM(bd), startDate: o ? o.startDate : bdDate(bd), endDate: bdDate(bd), startStamp: o ? o.startStamp : bdStamp(bd), endStamp: bdStamp(bd), ms })
        if (day.outages.length > 60) day.outages.length = 60
        day.outageMs += ms; day.longestMs = Math.max(day.longestMs, ms); day.onCount++; mon.onCount++
        day.open = null
        pushAlert(`🟢 বিদ্যুৎ এসেছে — ${bdHM(bd)}${ms ? ` (${fmtDur(ms)} পর)` : ''}`, 'green')
        if (real && s.notify_online) tgNotify('online', { ...dayPayload(todayK), ms, duration: fmtDurLong(ms), startStamp: o ? o.startStamp : '—' })
      }

      /* ৪ · লোড (W) অ্যালার্ট — rising edge */
      if (real && s.notify_power) {
        const lim = s.power_alert_w || 1000
        if (smp.powerW >= lim) overStreak.current++; else overStreak.current = 0
        if (overStreak.current >= DEBOUNCE && !powerFlag.current) {
          powerFlag.current = true
          pushAlert(`⚡ লোড ${lim}W ছাড়িয়েছে — ${f(smp.powerW, 0)}W`, 'orange')
          tgNotify('power', { ...dayPayload(todayK), w: smp.powerW, limit: lim, voltV: smp.voltV, ampA: smp.ampA })
        }
        if (smp.powerW < lim * 0.9) powerFlag.current = false
      }

      /* ৫ · ভোল্টেজ অ্যালার্ট (কম / বেশি) */
      if (real && s.notify_voltage && smp.online && smp.voltV > 0) {
        const bad = smp.voltV < (s.voltage_min || 180) || smp.voltV > (s.voltage_max || 260)
        if (bad) vStreak.current++; else vStreak.current = 0
        if (vStreak.current >= 3 && nowMs - vCool.current > 600000) {
          vCool.current = nowMs
          pushAlert(`🔌 ভোল্টেজ অস্বাভাবিক — ${f(smp.voltV, 1)}V`, 'orange')
          tgNotify('voltage', { ...dayPayload(todayK), voltV: smp.voltV, min: s.voltage_min, max: s.voltage_max, w: smp.powerW })
        }
      }

      /* ৬ · FAULT (লিকেজ / ওভারলোড) */
      if (real && smp.fault > 0) {
        pushAlert(`⚠️ TOMZN FAULT — কোড ${smp.fault}`, 'red')
        tgNotify('fault', { ...dayPayload(todayK), code: smp.fault, voltV: smp.voltV, w: smp.powerW })
      }

      /* ৭ · খরচ (৳) অ্যালার্ট — প্রতি ১০০ টাকায় */
      const totalTaka = (g.lastKwh || 0) * pr, base = s.alert_threshold_taka || 500
      if (totalTaka >= base) {
        const step = Math.floor((totalTaka - base) / 100) + 1
        if (step > astep.current) { astep.current = step; const at = base + (step - 1) * 100; pushAlert(`💰 ৳${at} পার — মোট ${fmtTaka(totalTaka)}`, 'red'); if (real) tgNotify('taka', { ...dayPayload(todayK), at, total: totalTaka }) }
      }

      /* ৮ · ঘণ্টাভিত্তিক রিপোর্ট (ডিফল্ট বন্ধ) */
      if (real && s.notify_hourly && tick.current > 0 && tick.current % Math.max(1, Math.round(3600000 / (s.poll_ms || 3000))) === 0) tgNotify('hourly', dayPayload(todayK))

      /* ৯ · দুপুর ১২টায় দৈনিক নিউজ (আজ · গতকাল · এই মাস) */
      if (real && s.daily_report_enabled && s.notify_daily && bd.getUTCHours() >= (s.daily_report_hour == null ? 12 : s.daily_report_hour) && g.lastDailyReport !== todayK && day.samples >= 20) {
        g.lastDailyReport = todayK
        pushAlert(`📰 দৈনিক রিপোর্ট পাঠানো হয়েছে — ${fmtKwh(day.used, 3)}`, 'cyan')
        tgNotify('daily', dayPayload(todayK))
      }

      /* ৯ক · সাপ্তাহিক রিপোর্ট — নির্ধারিত দিনে (ডিফল্ট শুক্রবার) */
      if (real && s.weekly_report_enabled && s.notify_weekly && g.lastWeeklyReport !== weekKeyK) {
        const dayNum = bd.getUTCDay()
        if (dayNum === (s.weekly_report_day == null ? 5 : s.weekly_report_day) && day.samples >= 20) {
          g.lastWeeklyReport = weekKeyK
          pushAlert(`📊 সাপ্তাহিক রিপোর্ট পাঠানো হয়েছে`, 'cyan')
          tgNotify('daily', { ...dayPayload(todayK), weekly: true })
        }
      }

      /* ৯খ · মাসিক বাজেট অ্যালার্ট (৮০% ও ১০০% পার হলে) */
      if (real && s.notify_budget && (s.monthly_budget_tk || 0) > 0) {
        const mUsedTaka = mon.used * pr, bud = s.monthly_budget_tk
        const stage = mUsedTaka >= bud ? 2 : mUsedTaka >= bud * 0.8 ? 1 : 0
        if (stage > g.budgetStage) {
          g.budgetStage = stage
          pushAlert(stage === 2 ? `💰 মাসিক বাজেট ৳${bud} পার হয়ে গেছে!` : `💰 বাজেটের ৮০% (${fmtTaka(mUsedTaka)}) খরচ হয়েছে`, stage === 2 ? 'red' : 'orange')
          tgNotify('taka', { ...dayPayload(todayK), at: stage === 2 ? bud : Math.round(bud * 0.8), total: mUsedTaka, budget: bud, pct: Math.min(200, mUsedTaka / bud * 100) })
        } else if (stage === 0 && g.budgetStage > 0) g.budgetStage = 0
      }

      /* ৯গ · পিক-আওয়ার ট্র্যাকিং (দিনের কোন ঘণ্টায় সবচেয়ে বেশি লোড পড়েছে) */
      if (smp.online && smp.powerW > 0) {
        const h = bd.getUTCHours()
        if (!day.hours) day.hours = {}
        if (!day.hours[h]) day.hours[h] = { used: 0, maxW: 0 }
        day.hours[h].used += delta
        day.hours[h].maxW = Math.max(day.hours[h].maxW, smp.powerW)
      }

      /* ১০ · নতুন মাস শুরু → গত মাসের রিপোর্ট */
      if (g.curMonth && g.curMonth !== monthK) {
        const pk = g.curMonth, pm = g.months[pk]
        if (pm && s.notify_monthly && g.lastMonthReport !== pk) { g.lastMonthReport = pk; tgNotify('monthly', monthPayload(pk)) }
      }
      g.curMonth = monthK
      tick.current++
      commit()

    } finally { busy.current = false }
  }, [fetchData, commit, pushAlert, tgNotify, dayPayload, monthPayload])

  /* ═══════════ ইফেক্ট — প্রতি ৩ সেকেন্ডে টিক ═══════════ */
  useEffect(() => {
    runTick()
    pushAlert(`✅ সিস্টেম চালু — বাংলাদেশ সময় ${bdTime()}`, 'green')
    const id = setInterval(runTick, Math.max(2000, loadSettings().poll_ms || 3000))
    const onVis = () => { if (!document.hidden) runTick() }
    const onHide = () => commit()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('beforeunload', onHide)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('beforeunload', onHide) }
  }, [runTick, pushAlert, commit])

  /* ═══════════ ডেরাইভড হিসাব (UI-এর জন্য) ═══════════ */
  const todayK = bdKey(), monthK = bdMonthKey(), pMonthK = prevMonthKey(monthK)
  const today = ledger.days[todayK] || null
  const yesterday = ledger.days[shiftKey(todayK, -1)] || null
  const month = ledger.months[monthK] || null
  const prevMonth = ledger.months[pMonthK] || null
  const meter = { base: ledger.meter.base || 0, acc: ledger.meter.acc || 0, accMs: ledger.meter.accMs || Date.now(), reading: (ledger.meter.base || 0) + (ledger.meter.acc || 0) }
  const days30 = Array.from({ length: 30 }, (_, i) => { const k = shiftKey(todayK, -(29 - i)); return { key: k, day: dayNameOfKey(k), ...(ledger.days[k] || newDay(0)) } })
  const recentOutages = Object.keys(ledger.days).sort().reverse().slice(0, 5).flatMap(k => (ledger.days[k].outages || []).map(o => ({ ...o, dayKey: k }))).slice(0, 30)
  const monthKeys = Object.keys(ledger.months).sort().reverse().slice(0, 12)
  const openOutage = today && today.open ? today.open : null
  const realMode = !!(settings.tuya_client_id && settings.tuya_device_id)
  const powerOn = powerState.current === null ? (realMode ? (data.online && data.voltV >= 50) : true) : powerState.current
  const outageToday = { offCount: today ? today.offCount : 0, onCount: today ? today.onCount : 0, ms: today ? today.outageMs : 0, longestMs: today ? today.longestMs : 0, list: today ? today.outages : [], onlineMs: today ? today.onlineMs : 0, offlineMs: today ? today.offlineMs : 0 }
  const runtime = Date.now() - startMs.current
  const calc = calcAll(data.totalKwh, price, runtime)

  return {
    data, price, setPrice, settings, setSettings, saveSettingsRemote, testTelegram, testAlert, sending,
    notify, tgNotify, sendDailyNow, sendMonthlyNow,
    alerts, alertCount, clearAlerts, tgMsg, pushAlert, showTg,
    outages: recentOutages, outageToday, openOutage,
    ledger, days30, monthKeys, today, yesterday, month, prevMonth, todayK, monthK, pMonthK,
    meter, setMeterBase, syncMeter, addMeter, resetToday, clearHistory, exportJSON, exportCSV,
    realMode, powerOn, calc, runtime,
  }
}






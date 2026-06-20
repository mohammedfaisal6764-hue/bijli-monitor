import { useState, useEffect, useCallback, useRef } from 'react'

const PRICE_DEFAULT = 8
const ALERT_TAKA = 500
const ALERT_STEP = 100

export function calcSlabBill(kwh) {
  const slabs = [[50,3.75],[50,5.14],[100,5.36],[100,6.34],[100,9.94],[Infinity,11.46]]
  const labels = ['০–৫০','৫১–১০০','১০১–২০০','২০১–৩০০','৩০১–৪০০','৪০০+']
  let rem = kwh, total = 0
  const rows = []
  slabs.forEach(([lim,rate],i) => {
    if (rem <= 0) return
    const used = Math.min(rem, lim)
    const cost = used * rate
    total += cost
    if (used > 0) rows.push({ label: labels[i], used: used.toFixed(1), rate, cost: cost.toFixed(2) })
    rem -= used
  })
  const vat = total * 0.05
  return { rows, vat: vat.toFixed(2), total: (total + vat + 40).toFixed(2) }
}

export function calcAll(kwh, price, runtimeMs) {
  const rHrs = Math.max(runtimeMs / 3600000, 0.0001)
  const kphH = kwh / rHrs
  const kphD = kphH * 24
  const kphM = kphD * 30
  const kphY = kphD * 365
  const tTotal = kwh * price
  return {
    kphH, kphD, kphM, kphY,
    tTotal, tHr: kphH * price,
    tDay: kphD * price, tMo: kphM * price, tYr: kphY * price,
    slab: calcSlabBill(kphM)
  }
}

let simPhase = 0
let simKwh = 0

function simStep() {
  simPhase += 0.04
  const p = simPhase
  const pw = Math.max(180, 455 + Math.sin(p)*45 + Math.sin(p*2.1)*18 + (Math.random()-.5)*15)
  const vV = 220 + Math.sin(p*0.6)*3.5
  const pf = 0.88 + Math.sin(p*0.25)*0.05
  simKwh += (pw / 3600) / 1000
  return {
    powerW: parseFloat(pw.toFixed(1)),
    voltV: parseFloat(vV.toFixed(1)),
    ampA: parseFloat((pw/(vV*pf)).toFixed(3)),
    pf: parseFloat(pf.toFixed(3)),
    totalKwh: parseFloat(simKwh.toFixed(6)),
    online: false, source: 'sim'
  }
}

export function useElectricity() {
  const [data, setData] = useState({ powerW:0, voltV:220, ampA:0, pf:0, totalKwh:0, online:false, source:'sim' })
  const [price, setPrice] = useState(PRICE_DEFAULT)
  const [alerts, setAlerts] = useState([{ id:1, text:'সিস্টেম লোড হচ্ছে...', color:'cyan', time:new Date().toLocaleTimeString('en-GB') }])
  const [alertCount, setAlertCount] = useState(0)
  const [tgMsg, setTgMsg] = useState(null)
  const startMs = useRef(Date.now())
  const alertStep = useRef(0)
  const tick = useRef(0)

  const pushAlert = useCallback((text, color='cyan') => {
    setAlerts(p => [{ id: Date.now(), text, color, time: new Date().toLocaleTimeString('en-GB') }, ...p].slice(0,8))
    setAlertCount(c => c+1)
  }, [])

  const showTg = useCallback((msg) => {
    setTgMsg({ text:msg, id:Date.now() })
    setTimeout(() => setTgMsg(null), 6000)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/data', { cache:'no-store' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const d = await res.json()
      if (d.online) {
        setData({ powerW:d.power_w||0, voltV:d.voltage_v||0, ampA:d.current_a||0, pf:d.pf||0, totalKwh:d.total_kwh||0, online:true, source:'tuya' })
        return d.total_kwh||0
      }
    } catch {}
    const s = simStep()
    setData(s)
    return s.totalKwh
  }, [])

  useEffect(() => {
    fetch('/api/config').then(r=>r.json()).then(c => { if(c.price_per_unit) setPrice(c.price_per_unit) }).catch(()=>{})
  }, [])

  useEffect(() => {
    fetchData()
    pushAlert('✅ সিস্টেম চালু হয়েছে', 'green')
    const id = setInterval(async () => {
      tick.current++
      const kwh = await fetchData()
      const taka = kwh * price
      if (taka >= ALERT_TAKA) {
        const step = Math.floor((taka - ALERT_TAKA) / ALERT_STEP) + 1
        if (step > alertStep.current) {
          alertStep.current = step
          const at = ALERT_TAKA + (step-1)*ALERT_STEP
          pushAlert(`🚨 ৳${at} পার হয়েছে! মোট: ৳${taka.toFixed(2)}`, 'red')
          showTg(`🚨 খরচ অ্যালার্ট!\n৳${at} পার হয়েছে\n💰 ৳${taka.toFixed(2)}`)
        }
      }
      if (tick.current % 1200 === 0) {
        pushAlert(`⏰ ঘণ্টার রিপোর্ট: ${kwh.toFixed(4)} kWh · ৳${taka.toFixed(2)}`, 'cyan')
        showTg(`⏰ ঘণ্টার রিপোর্ট\n📊 ${kwh.toFixed(4)} kWh\n💰 ৳${taka.toFixed(2)}`)
      }
    }, 3000)
    return () => clearInterval(id)
  }, [fetchData, pushAlert, showTg, price])

  return {
    data, price, setPrice,
    alerts, alertCount,
    tgMsg, pushAlert, showTg,
    calc: calcAll(data.totalKwh, price, Date.now() - startMs.current),
    runtime: Date.now() - startMs.current
  }
}

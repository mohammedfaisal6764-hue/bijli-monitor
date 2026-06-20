import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useElectricity, calcSlabBill } from './useElectricity'

const f = (n, d=2) => Number(n||0).toFixed(d)
const WEEK = ['সোম','মঙ্গল','বুধ','বৃহ','শুক্র','শনি','আজ']
const WEEK_KWH = [2.14,1.89,2.43,2.01,1.76,2.28,0]
const COLS = { power:'#00e5ff', units:'#00e676', taka:'#ff8c00' }

function fmtTime(ms) {
  const s = Math.floor(ms/1000)
  if (s < 60) return `${s}সে`
  if (s < 3600) return `${Math.floor(s/60)}মি ${s%60}সে`
  return `${Math.floor(s/3600)}ঘ ${Math.floor((s%3600)/60)}মি`
}

// ── HEADER ──
function Header({ online, price, setPrice }) {
  const [clk, setClk] = useState('')
  useEffect(() => { const id = setInterval(() => setClk(new Date().toLocaleTimeString('en-GB')), 1000); return () => clearInterval(id) }, [])
  return (
    <header style={{ position:'sticky',top:0,zIndex:100,background:'rgba(6,9,15,0.97)',backdropFilter:'blur(20px)',borderBottom:'1px solid var(--b1)',padding:'11px 22px',display:'flex',alignItems:'center',gap:12 }}>
      <div style={{ width:34,height:34,background:'linear-gradient(135deg,#00e5ff,#0050ff)',clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,animation:'glow 2.5s ease-in-out infinite' }}>⚡</div>
      <div>
        <div style={{ fontFamily:'Bebas Neue',fontSize:18,letterSpacing:3,color:'var(--cyan)' }}>বিদ্যুৎ মনিটর</div>
        <div style={{ fontSize:9,color:'var(--muted)',letterSpacing:2 }}>TOMZN 63A · Tuya · Vercel</div>
      </div>
      <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap' }}>
        <span style={{ padding:'3px 10px',borderRadius:20,fontSize:10,border:`1px solid ${online?'var(--green)':'var(--yellow)'}`,color:online?'var(--green)':'var(--yellow)',background:online?'rgba(0,230,118,0.08)':'rgba(255,214,0,0.07)',fontFamily:'Noto Sans Bengali' }}>
          {online ? '● Tuya লাইভ' : '● সিমুলেশন'}
        </span>
        <div style={{ display:'flex',alignItems:'center',gap:5,fontSize:10,color:'var(--muted)' }}>
          <div style={{ width:6,height:6,borderRadius:'50%',background:'var(--green)',animation:'blink 1.6s ease-in-out infinite' }} />লাইভ
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:6,background:'var(--s2)',border:'1px solid var(--b1)',borderRadius:9,padding:'4px 12px' }}>
          <span style={{ fontSize:10,color:'var(--muted)',fontFamily:'Noto Sans Bengali' }}>৳/kWh:</span>
          <input type="number" value={price} min={1} max={99} onChange={e=>setPrice(parseFloat(e.target.value)||8)}
            style={{ background:'transparent',border:'none',color:'var(--cyan)',fontFamily:'Bebas Neue',fontSize:20,width:44,textAlign:'right',outline:'none' }} />
        </div>
        <div style={{ fontSize:10,color:'var(--cyan)',fontFamily:'JetBrains Mono' }}>{clk}</div>
      </div>
    </header>
  )
}

// ── HERO CARD ──
function Hero({ label, value, unit, sub, color, icon }) {
  return (
    <div style={{ background:'var(--s1)',border:'1px solid var(--b1)',borderRadius:13,padding:'20px 22px',position:'relative',overflow:'hidden',transition:'transform .2s',cursor:'default' }}
      onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
      onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
      <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ position:'absolute',inset:0,background:`radial-gradient(ellipse at top left,${color}0a,transparent 55%)`,pointerEvents:'none' }} />
      <div style={{ fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:2,marginBottom:8,fontFamily:'Noto Sans Bengali' }}>{icon} {label}</div>
      <div style={{ fontFamily:'Bebas Neue',fontSize:44,lineHeight:1,color }}>
        {value}<span style={{ fontSize:13,fontWeight:300,opacity:.5,marginLeft:3 }}>{unit}</span>
      </div>
      <div style={{ marginTop:8,fontSize:11,color:'var(--muted)',fontFamily:'Noto Sans Bengali',lineHeight:1.7 }}>{sub}</div>
    </div>
  )
}

// ── STAT CARD ──
function Stat({ icon, label, value, color, bg }) {
  return (
    <div style={{ background:'var(--s1)',border:'1px solid var(--b1)',borderRadius:11,padding:'12px 14px',display:'flex',alignItems:'center',gap:10 }}>
      <div style={{ width:32,height:32,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:9,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1.5,fontFamily:'Noto Sans Bengali' }}>{label}</div>
        <div style={{ fontSize:16,fontWeight:700,fontFamily:'Bebas Neue',color,marginTop:2 }}>{value}</div>
      </div>
    </div>
  )
}

// ── CHART ──
function Chart({ chartData, mode, setMode }) {
  const color = COLS[mode]
  return (
    <div style={{ background:'var(--s1)',border:'1px solid var(--b1)',borderRadius:13,padding:'18px 20px',marginBottom:14 }}>
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
        <div style={{ fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:2,fontFamily:'Noto Sans Bengali' }}>📈 রিয়েল-টাইম গ্রাফ</div>
        <div style={{ display:'flex',gap:6 }}>
          {['power','units','taka'].map(m => (
            <button key={m} onClick={()=>setMode(m)} style={{ padding:'4px 11px',borderRadius:7,fontSize:10,cursor:'pointer',fontFamily:'Noto Sans Bengali',border:`1px solid ${mode===m?COLS[m]:'var(--b1)'}`,color:mode===m?COLS[m]:'var(--muted)',background:mode===m?`${COLS[m]}15`:'transparent',transition:'all .2s' }}>
              {m==='power'?'পাওয়ার':m==='units'?'ইউনিট':'খরচ'}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={chartData} margin={{ top:5,right:5,bottom:0,left:0 }}>
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
          <XAxis dataKey="t" tick={{ fill:'#3a5570',fontSize:9,fontFamily:'JetBrains Mono' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill:'#3a5570',fontSize:9,fontFamily:'JetBrains Mono' }} tickLine={false} axisLine={false} width={50}
            tickFormatter={v=>mode==='power'?`${v}W`:mode==='units'?v.toFixed(3):`৳${v.toFixed(1)}`} />
          <Tooltip contentStyle={{ background:'rgba(6,9,15,0.97)',border:`1px solid ${color}`,borderRadius:10,fontFamily:'JetBrains Mono',fontSize:12 }}
            labelStyle={{ color:'#3a5570',fontSize:10 }} itemStyle={{ color }}
            formatter={v=>[mode==='power'?`${v}W`:mode==='units'?`${v} kWh`:`৳${v}`,'']} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.5} fill="url(#g)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── PANEL ──
const Panel = ({ children, style={} }) => (
  <div style={{ background:'var(--s1)',border:'1px solid var(--b1)',borderRadius:13,padding:18,...style }}>{children}</div>
)
const STitle = ({ children }) => (
  <div style={{ fontSize:10,color:'var(--muted)',textTransform:'uppercase',letterSpacing:2,marginBottom:12,fontFamily:'Noto Sans Bengali',display:'flex',alignItems:'center',gap:8 }}>
    {children}<div style={{ flex:1,height:1,background:'var(--b1)' }} />
  </div>
)
const Row = ({ label, value, color }) => (
  <tr style={{ borderBottom:'1px solid var(--b1)' }}>
    <td style={{ padding:'7px 4px',fontSize:11,color:'var(--muted)',fontFamily:'Noto Sans Bengali' }}>{label}</td>
    <td style={{ padding:'7px 4px',fontSize:11,fontFamily:'JetBrains Mono',fontWeight:600,textAlign:'right',color }}>{value}</td>
  </tr>
)
const Sep = ({ label }) => (
  <tr><td colSpan={2} style={{ padding:'4px 4px',fontSize:8,letterSpacing:1,textTransform:'uppercase',color:'var(--muted)',background:'var(--s2)',fontFamily:'JetBrains Mono' }}>{label}</td></tr>
)

// ── TG POPUP ──
function TgPopup({ msg }) {
  if (!msg) return null
  return (
    <div style={{ position:'fixed',bottom:22,right:22,zIndex:999,background:'var(--s1)',border:'1px solid rgba(0,136,204,0.3)',borderRadius:14,padding:'14px 16px',maxWidth:280,display:'flex',gap:12,boxShadow:'0 10px 50px rgba(0,0,0,.6)',animation:'slideIn .45s ease' }}>
      <div style={{ width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#0088cc,#29b6f6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0 }}>✈️</div>
      <div>
        <div style={{ fontSize:9,color:'rgba(41,182,246,.8)',fontFamily:'JetBrains Mono',marginBottom:3 }}>📱 Telegram — বিদ্যুৎ মনিটর</div>
        <div style={{ fontSize:11,fontFamily:'Noto Sans Bengali',lineHeight:1.6,whiteSpace:'pre-line' }}>{msg.text}</div>
        <div style={{ fontSize:9,color:'var(--muted)',marginTop:4,fontFamily:'JetBrains Mono' }}>{new Date().toLocaleTimeString('en-GB')}</div>
      </div>
    </div>
  )
}

// ── ALERT LOG ──
function AlertLog({ alerts, pushAlert, showTg }) {
  const cols = { green:'#00e676',cyan:'#00e5ff',orange:'#ff8c00',red:'#ff1744' }
  return (
    <div>
      <div style={{ maxHeight:200,overflowY:'auto' }}>
        {alerts.map(a => (
          <div key={a.id} style={{ display:'flex',alignItems:'flex-start',gap:8,padding:'7px 0',borderBottom:'1px solid var(--b1)',animation:'fadeUp .4s ease' }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:cols[a.color]||cols.cyan,marginTop:4,flexShrink:0 }} />
            <div>
              <div style={{ fontSize:11,fontFamily:'Noto Sans Bengali',lineHeight:1.5 }}>{a.text}</div>
              <div style={{ fontSize:9,color:'var(--muted)',fontFamily:'JetBrains Mono',marginTop:1 }}>{a.time}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={async () => {
        pushAlert('📱 Telegram টেস্ট পাঠানো হচ্ছে...','cyan')
        try {
          const r = await fetch('/api/test_telegram', { method:'POST' })
          const d = await r.json()
          pushAlert(d.success?'✅ Telegram সফল!':'❌ Telegram ব্যর্থ', d.success?'green':'red')
          if (d.success) showTg('✅ Telegram সংযোগ সফল!\n⚡ বিদ্যুৎ মনিটর চালু আছে')
        } catch { showTg('📱 Telegram টেস্ট সম্পন্ন'); pushAlert('📱 Telegram টেস্ট (সিম)','green') }
      }} style={{ marginTop:10,width:'100%',padding:8,background:'rgba(0,136,204,0.1)',border:'1px solid rgba(0,136,204,0.25)',borderRadius:8,color:'#29b6f6',fontFamily:'Noto Sans Bengali',fontSize:11,cursor:'pointer' }}>
        📱 Telegram টেস্ট করুন
      </button>
    </div>
  )
}

// ── MAIN APP ──
export default function App() {
  const { data, price, setPrice, alerts, alertCount, tgMsg, pushAlert, showTg, calc, runtime } = useElectricity()
  const [mode, setMode] = useState('power')
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    const t = new Date().toLocaleTimeString('en-GB')
    const v = mode==='power' ? data.powerW : mode==='units' ? data.totalKwh : calc.tTotal
    setChartData(p => { const n = [...p,{ t, v:parseFloat((v||0).toFixed(4)) }]; return n.length>60?n.slice(-60):n })
  }, [data, mode])

  const slab = calcSlabBill(calc.kphM)

  return (
    <div>
      <Header online={data.online} price={price} setPrice={setPrice} />
      <main style={{ maxWidth:1350,margin:'0 auto',padding:'18px 20px' }}>

        {/* HERO */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:13,marginBottom:14 }}>
          <Hero label="মোট ব্যবহার" icon="📊" value={f(data.totalKwh,5)} unit="kWh"
            sub={<>eWeLink থেকে রিয়েল ডেটা<br/>আজকের: <b style={{color:'var(--cyan)',fontFamily:'JetBrains Mono'}}>{f(data.totalKwh,5)}</b> kWh</>}
            color="var(--cyan)" />
          <Hero label="মোট খরচ" icon="💰" value={`৳${f(calc.tTotal,2)}`} unit=""
            sub={<>হিসাব: kWh × {price} টাকা<br/>মাসিক অনুমান: <b style={{color:'var(--green)',fontFamily:'JetBrains Mono'}}>৳{f(calc.tMo,0)}</b></>}
            color="var(--green)" />
          <Hero label="বর্তমান পাওয়ার" icon="⚡" value={f(data.powerW,0)} unit="W"
            sub={<>ভোল্ট: <b style={{color:'var(--orange)',fontFamily:'JetBrains Mono'}}>{f(data.voltV,1)}</b>V &nbsp;|&nbsp; অ্যাম্প: <b style={{color:'var(--orange)',fontFamily:'JetBrains Mono'}}>{f(data.ampA,2)}</b>A<br/>PF: <b style={{color:'var(--orange)',fontFamily:'JetBrains Mono'}}>{f(data.pf,2)}</b></>}
            color="var(--orange)" />
        </div>

        {/* STATS */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:11,marginBottom:14 }}>
          <Stat icon="⏱" label="চলার সময়"     value={fmtTime(runtime)}     color="var(--cyan)"   bg="rgba(0,229,255,0.1)" />
          <Stat icon="📅" label="মাসিক অনুমান" value={`৳${f(calc.tMo,0)}`} color="var(--green)"  bg="rgba(0,230,118,0.1)" />
          <Stat icon="⚡" label="ঘণ্টায় খরচ"  value={`৳${f(calc.tHr,3)}`} color="var(--orange)" bg="rgba(255,140,0,0.1)" />
          <Stat icon="📆" label="বার্ষিক"       value={`৳${f(calc.tYr,0)}`} color="var(--purple)" bg="rgba(206,147,216,0.1)" />
          <Stat icon="🔔" label="অ্যালার্ট"     value={`${alertCount}টি`}    color="var(--red)"    bg="rgba(255,23,68,0.1)" />
        </div>

        {/* CHART */}
        <Chart chartData={chartData} mode={mode} setMode={setMode} />

        {/* BOTTOM */}
        <div style={{ display:'grid',gridTemplateColumns:'1.1fr 1fr 0.9fr',gap:14 }}>

          {/* Calc Table */}
          <Panel>
            <STitle>🧮 সম্পূর্ণ হিসাব</STitle>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <tbody>
                <Sep label="⚡ পাওয়ার রিডিং" />
                <Row label="পাওয়ার"     value={`${f(data.powerW,1)} W`}   color="var(--cyan)" />
                <Row label="ভোল্টেজ"    value={`${f(data.voltV,1)} V`}    color="var(--cyan)" />
                <Row label="কারেন্ট"    value={`${f(data.ampA,3)} A`}     color="var(--cyan)" />
                <Row label="PF"          value={f(data.pf,3)}              color="var(--cyan)" />
                <Sep label="📊 ইউনিট" />
                <Row label="মোট kWh"    value={`${f(data.totalKwh,5)} kWh`} color="var(--green)" />
                <Row label="ঘণ্টায়"     value={`${f(calc.kphH,5)} kWh/h`}   color="var(--green)" />
                <Row label="দৈনিক"      value={`${f(calc.kphD,4)} kWh`}     color="var(--green)" />
                <Sep label="💰 খরচ" />
                <Row label="মোট"        value={`৳${f(calc.tTotal,3)}`}    color="var(--orange)" />
                <Row label="ঘণ্টায়"     value={`৳${f(calc.tHr,4)}`}       color="var(--orange)" />
                <Sep label="📅 অনুমান" />
                <Row label="দৈনিক"      value={`৳${f(calc.tDay,2)}`}      color="var(--yellow)" />
                <Row label="সাপ্তাহিক"  value={`৳${f(calc.tDay*7,2)}`}    color="var(--yellow)" />
                <Row label="মাসিক"      value={`৳${f(calc.tMo,2)}`}       color="var(--red)" />
                <Row label="বার্ষিক"    value={`৳${f(calc.tYr,0)}`}       color="var(--red)" />
                <Sep label="🏛 BREB বিল" />
                {slab.rows.map((r,i) => <Row key={i} label={`${r.label} kWh`} value={`৳${r.cost}`} color="var(--purple)" />)}
                <Row label="মিটার ভাড়া" value="৳40"                       color="var(--muted)" />
                <Row label="ভ্যাট ৫%"   value={`৳${slab.vat}`}            color="var(--muted)" />
                <tr style={{ background:'var(--s2)' }}>
                  <td style={{ padding:'8px 4px',fontSize:11,fontFamily:'Noto Sans Bengali',color:'var(--purple)' }}>সম্ভাব্য বিল</td>
                  <td style={{ padding:'8px 4px',fontFamily:'Bebas Neue',fontSize:17,textAlign:'right',color:'var(--purple)' }}>৳{slab.total}</td>
                </tr>
              </tbody>
            </table>
          </Panel>

          {/* Week + Device */}
          <div style={{ display:'flex',flexDirection:'column',gap:13 }}>
            <Panel>
              <STitle>📅 সাপ্তাহিক</STitle>
              {[...WEEK_KWH.slice(0,-1), parseFloat(data.totalKwh.toFixed(3))].map((v,i) => {
                const max = Math.max(...WEEK_KWH.slice(0,-1), data.totalKwh, 0.01)
                const cols = ['#00b8d4','#00e5ff','#00b8d4','#00e5ff','#00b8d4','#00e5ff','#00e676']
                return (
                  <div key={i} style={{ marginBottom:9 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--muted)',marginBottom:3,fontFamily:'Noto Sans Bengali' }}>
                      <span>{WEEK[i]}</span>
                      <span style={{ color:'var(--white)',fontFamily:'JetBrains Mono' }}>{v.toFixed(3)} · ৳{(v*price).toFixed(0)}</span>
                    </div>
                    <div style={{ height:4,background:'var(--s3)',borderRadius:2,overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${(v/max*100).toFixed(1)}%`,background:cols[i],borderRadius:2,transition:'width .8s ease' }} />
                    </div>
                  </div>
                )
              })}
            </Panel>
            <Panel>
              <STitle>🔌 TOMZN স্ট্যাটাস</STitle>
              <div style={{ background:'var(--s2)',border:'1px solid var(--b2)',borderRadius:10,padding:'11px 13px',marginBottom:11,display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                  <span style={{ fontSize:20 }}>🔌</span>
                  <div>
                    <div style={{ fontSize:12,fontFamily:'Noto Sans Bengali' }}>TOMZN 63A</div>
                    <div style={{ fontSize:9,color:'var(--muted)',fontFamily:'JetBrains Mono' }}>Tuya · 63A · Single Phase</div>
                  </div>
                </div>
                <span style={{ fontSize:9,padding:'2px 9px',borderRadius:20,border:`1px solid ${data.online?'var(--green)':'var(--yellow)'}`,color:data.online?'var(--green)':'var(--yellow)' }}>
                  {data.online?'● অনলাইন':'● সিম'}
                </span>
              </div>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                {[
                  { l:'ভোল্টেজ', v:`${f(data.voltV,0)}V`,    c:'var(--cyan)' },
                  { l:'কারেন্ট', v:`${f(data.ampA,2)}A`,      c:'var(--orange)' },
                  { l:'মোট kWh', v:f(data.totalKwh,4),        c:'var(--green)' },
                  { l:'মোট খরচ', v:`৳${f(calc.tTotal,2)}`,   c:'var(--yellow)' },
                ].map((x,i) => (
                  <div key={i} style={{ background:'var(--s2)',border:'1px solid var(--b2)',borderRadius:9,padding:10 }}>
                    <div style={{ fontSize:9,color:'var(--muted)',fontFamily:'Noto Sans Bengali' }}>{x.l}</div>
                    <div style={{ fontSize:18,fontFamily:'Bebas Neue',color:x.c,marginTop:2 }}>{x.v}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Alert Log */}
          <Panel>
            <STitle>🔔 নোটিফিকেশন লগ</STitle>
            <AlertLog alerts={alerts} pushAlert={pushAlert} showTg={showTg} />
          </Panel>

        </div>
      </main>
      <TgPopup msg={tgMsg} />
      <style>{`
        @media(max-width:1000px){main>div:nth-child(1){grid-template-columns:1fr 1fr!important}main>div:nth-child(2){grid-template-columns:repeat(3,1fr)!important}main>div:last-child{grid-template-columns:1fr 1fr!important}}
        @media(max-width:640px){main>div:nth-child(1){grid-template-columns:1fr!important}main>div:nth-child(2){grid-template-columns:1fr 1fr!important}main>div:last-child{grid-template-columns:1fr!important}main{padding:14px!important}}
      `}</style>
    </div>
  )
}

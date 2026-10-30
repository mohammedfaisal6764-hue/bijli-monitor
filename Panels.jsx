import{useState}from 'react'
import{useNow,bdNow,bdTime,bdHM,bdDate,bdLong,bdDayNameShort,fmtDur,fmtDurLong,f,fmtTaka,fmtKwh,dayNameOfKey,monthNameOf,daysInMonth}from './useElectricity'

/* ── ছোট প্রিমিটিভ ── */
export const Panel=({children,style={}})=><div style={{background:'#0b1120',border:'1px solid #172438',borderRadius:13,padding:18,...style}}>{children}</div>
export const STitle=({children})=><div style={{fontSize:10,color:'#3a5570',textTransform:'uppercase',letterSpacing:2,marginBottom:12,fontFamily:'Noto Sans Bengali',display:'flex',alignItems:'center',gap:8}}>{children}<div style={{flex:1,height:1,background:'#172438'}}/></div>
const Btn=({onClick,children,color='#00e5ff',disabled,style={}})=>(
  <button onClick={onClick} disabled={disabled} style={{padding:'7px 12px',borderRadius:8,border:`1px solid ${color}44`,background:`${color}14`,color,fontFamily:'Noto Sans Bengali',fontSize:11,cursor:disabled?'not-allowed':'pointer',opacity:disabled?.5:1,...style}}>{children}</button>
)
export const Mini=({label,value,color,sub})=>(
  <div style={{background:'#0f1928',border:'1px solid #1d2e42',borderRadius:9,padding:'8px 10px'}}>
    <div style={{fontSize:9,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>{label}</div>
    <div style={{fontSize:15,fontFamily:'Bebas Neue',color,marginTop:1}}>{value}</div>
    {sub&&<div style={{fontSize:9,color:'#3a5570',fontFamily:'JetBrains Mono'}}>{sub}</div>}
  </div>
)

/* ═══════════ ১ · লাইভ মিটার রিডিং ═══════════ */
export function LiveMeter({meter,data,price,today,realMode,onSetBase,onSync,onReset}){
  const now=useNow(1000)
  const[val,setVal]=useState('')
  const live=(meter.base||0)+(meter.acc||0)+((data.powerW||0)/1000)*Math.max(0,now-(meter.accMs||now))/3600000
  const parts=f(live,3).split('.')
  const tkHr=(data.powerW||0)/1000*price
  return(
    <Panel style={{position:'relative',overflow:'hidden',gridColumn:'span 2'}}>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(ellipse at 12% -20%,rgba(0,229,255,.10),transparent 62%)',pointerEvents:'none'}}/>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:6}}>
        <div style={{fontSize:10,color:'#3a5570',letterSpacing:2,fontFamily:'Noto Sans Bengali'}}>🔢 লাইভ মিটার রিডিং (আনুমানিক)</div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <span style={{fontSize:9,padding:'2px 9px',borderRadius:20,border:'1px solid rgba(0,229,255,.28)',color:'#00e5ff',fontFamily:'Noto Sans Bengali'}}>🇧🇩 {bdTime()}</span>
          <span style={{fontSize:9,padding:'2px 9px',borderRadius:20,border:`1px solid ${realMode?'rgba(0,230,118,.3)':'rgba(255,214,0,.3)'}`,color:realMode?'#00e676':'#ffd600',fontFamily:'Noto Sans Bengali'}}>{realMode?'লাইভ ডেটা':'সিমুলেশন'}</span>
        </div>
      </div>
      <div key={parts[1]} className="meterDigits" style={{fontSize:54,color:'#00e5ff',lineHeight:1,margin:'4px 0 2px'}}>
        {parts[0]}<span style={{fontSize:27,opacity:.65}}>.{parts[1]}</span>
        <span style={{fontSize:13,fontFamily:'Noto Sans Bengali',opacity:.5,marginLeft:9,letterSpacing:0}}>kWh</span>
      </div>
      <div style={{fontSize:10,color:'#3a5570',fontFamily:'Noto Sans Bengali',marginBottom:12}}>
        শুরু: <b style={{color:'#dff0ff',fontFamily:'JetBrains Mono'}}>{f(meter.base,3)}</b> kWh · যোগ হয়েছে: <b style={{color:'#00e676',fontFamily:'JetBrains Mono'}}>+{f(meter.acc,3)}</b> kWh
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
        <Mini label="এখন লোড" value={`${f(data.powerW,0)} W`} color="#ff8c00" sub={`${f(data.ampA,2)} A`}/>
        <Mini label="ভোল্টেজ" value={`${f(data.voltV,1)} V`} color="#00e5ff" sub={`PF ${f(data.pf,2)}`}/>
        <Mini label="ঘণ্টায় খরচ" value={fmtTaka(tkHr)} color="#ffd600" sub={`${f(data.powerW/1000,3)} kW`}/>
        <Mini label="আজকের খরচ" value={fmtTaka(today?today.taka:0)} color="#00e676" sub={fmtKwh(today?today.used:0,3)}/>
      </div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
        <input type="number" step="0.001" placeholder="শুরুর রিডিং (kWh)" value={val} onChange={e=>setVal(e.target.value)}
          style={{width:160,padding:'8px 11px',borderRadius:8,background:'#0f1928',border:'1px solid #1d2e42',color:'#dff0ff',fontFamily:'JetBrains Mono',fontSize:12,outline:'none'}}/>
        <Btn onClick={()=>{onSetBase(val===''?0:parseFloat(val));setVal('')}} color="#00e5ff">💾 রিডিং সেট</Btn>
        <Btn onClick={onSync} color="#00e676">🔄 Tuya রিডিং থেকে সিঙ্ক</Btn>
        <Btn onClick={onReset} color="#ff8c00">♻️ আজকের হিসাব রিসেট</Btn>
      </div>
      <div style={{fontSize:10,color:'#3a5570',fontFamily:'Noto Sans Bengali',marginTop:8,lineHeight:1.6}}>
        মিটার রিডিং = আপনার সেট করা শুরুর রিডিং + এরপর ব্যবহৃত ইউনিট। Tuya-র কাউন্টারের সাথে মিলাতে <b style={{color:'#00e676'}}>সিঙ্ক</b> চাপুন।
      </div>
    </Panel>
  )
}
/* ═══════════ ২ · বিদ্যুৎ আছে / নেই স্ট্যাটাস ═══════════ */
export function PowerStatus({powerOn,openOutage,outageToday,realMode}){
  const now=useNow(1000)
  const liveMs=openOutage?Math.max(0,now-openOutage.startMs):0
  const totalOn=outageToday.onlineMs, totalOff=outageToday.offlineMs
  const pct=totalOn+totalOff>0?totalOn/(totalOn+totalOff)*100:100
  const c=powerOn?'#00e676':'#ff1744'
  return(
    <Panel style={{position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 85% 0%,${c}14,transparent 62%)`,pointerEvents:'none'}}/>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <div className={powerOn?'liveDot':'offPulse'} style={{width:11,height:11,borderRadius:'50%',background:c,boxShadow:`0 0 10px ${c}`}}/>
        <div style={{fontFamily:'Bebas Neue',fontSize:19,color:c,letterSpacing:1.5}}>{powerOn?'বিদ্যুৎ আছে':'বিদ্যুৎ নেই'}</div>
      </div>
      {!powerOn&&openOutage?(
        <div style={{background:'rgba(255,23,68,.07)',border:'1px solid rgba(255,23,68,.22)',borderRadius:10,padding:'10px 12px',marginBottom:11}}>
          <div style={{fontSize:10,color:'#ff6b6b',fontFamily:'Noto Sans Bengali'}}>⏳ বিভ্রাট চলছে</div>
          <div style={{fontFamily:'Bebas Neue',fontSize:30,color:'#ff1744',lineHeight:1.1}}>{fmtDur(liveMs)}</div>
          <div style={{fontSize:10,color:'#3a5570',fontFamily:'JetBrains Mono'}}>শুরু: {openOutage.startTime} · {openOutage.startDate}</div>
        </div>
      ):(
        <div style={{background:'rgba(0,230,118,.06)',border:'1px solid rgba(0,230,118,.18)',borderRadius:10,padding:'10px 12px',marginBottom:11}}>
          <div style={{fontSize:10,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>আজ বিদ্যুৎ ছিল</div>
          <div style={{fontFamily:'Bebas Neue',fontSize:26,color:'#00e676',lineHeight:1.15}}>{fmtDur(totalOn)}</div>
          <div style={{fontSize:10,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>আজ বন্ধ ছিল {fmtDur(totalOff)}</div>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        <Mini label="আজ গেছে" value={`${outageToday.offCount} বার`} color="#ff1744"/>
        <Mini label="আজ এসেছে" value={`${outageToday.onCount} বার`} color="#00e676"/>
        <Mini label="সর্বোচ্চ বিভ্রাট" value={fmtDur(outageToday.longestMs)} color="#ffd600"/>
        <Mini label="চালু ছিল" value={`${f(pct,1)}%`} color="#00e5ff"/>
      </div>
      {!realMode&&<div style={{fontSize:10,color:'#ffd600',fontFamily:'Noto Sans Bengali',marginTop:9,lineHeight:1.6}}>⚠️ সিমুলেশন মোডে বিভ্রাট ডিটেকশন বন্ধ — Settings-এ Tuya credentials দিন।</div>}
    </Panel>
  )
}

/* ═══════════ ৩ · বিভ্রাটের লগ (কয়টা থেকে কয়টা) ═══════════ */
export function OutageLog({outages}){
  if(!outages||outages.length===0)return<div style={{fontSize:11,color:'#3a5570',fontFamily:'Noto Sans Bengali',padding:'8px 0'}}>এখনো কোনো বিভ্রাট রেকর্ড হয়নি</div>
  return(
    <div style={{maxHeight:260,overflowY:'auto'}}>
      {outages.map((o,i)=>(
        <div key={i} style={{padding:'9px 0',borderBottom:'1px solid #172438',animation:'fadeUp .4s ease'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#ff1744',flexShrink:0,boxShadow:'0 0 6px #ff1744'}}/>
            <div style={{fontSize:11,color:'#ff6b6b',fontFamily:'Noto Sans Bengali',fontWeight:600}}>🔴 বিদ্যুৎ গেছে → 🟢 এসেছে</div>
            <div style={{marginLeft:'auto',fontSize:11,color:'#ffd600',fontFamily:'Bebas Neue'}}>⏱ {o.ms?fmtDur(o.ms):'—'}</div>
          </div>
          <div style={{fontSize:10,color:'#3a5570',fontFamily:'JetBrains Mono',marginTop:3,paddingLeft:16}}>
            {o.startDate===o.endDate?`${o.startTime} → ${o.endTime}`:`${o.startStamp} → ${o.endStamp}`}
            {o.startDate===o.endDate&&<span style={{color:'#3a5570'}}> · {o.startDate}</span>}
          </div>
          {o.ms>0&&<div style={{fontSize:10,color:'#3a5570',fontFamily:'Noto Sans Bengali',marginTop:2,paddingLeft:16}}>মোট ছিল না: {fmtDurLong(o.ms)}</div>}
        </div>
      ))}
    </div>
  )
}
/* ═══════════ ৪ · ৩০ দিনের হিস্ট্রি ═══════════ */
export function DayHistory({days30,price,monthKeys,ledger}){
  const[view,setView]=useState('day')
  const max=Math.max(...days30.map(d=>d.used||0),.01)
  const rows=[...days30].reverse()
  return(
    <Panel>
      <div style={{display:'flex',gap:6,marginBottom:12}}>
        {[['day','📅 দৈনিক'],['month','🗓 মাসিক']].map(([k,l])=>(
          <button key={k} onClick={()=>setView(k)} style={{padding:'5px 12px',borderRadius:8,fontSize:10,cursor:'pointer',fontFamily:'Noto Sans Bengali',border:`1px solid ${view===k?'#00e5ff':'#172438'}`,color:view===k?'#00e5ff':'#3a5570',background:view===k?'rgba(0,229,255,0.08)':'transparent'}}>{l}</button>
        ))}
      </div>
      <div style={{maxHeight:300,overflowY:'auto'}}>
        {view==='day'?rows.map((d,i)=>(
          <div key={d.key} style={{marginBottom:8}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#3a5570',marginBottom:3,fontFamily:'Noto Sans Bengali',gap:6}}>
              <span>{d.key.slice(8)}/{d.key.slice(5,7)} · {d.day}</span>
              <span style={{fontFamily:'JetBrains Mono',color:'#dff0ff'}}>{f(d.used,3)} kWh · {fmtTaka(d.used*price,0)}</span>
              <span style={{color:d.offCount?'#ff6b6b':'#3a5570',fontFamily:'JetBrains Mono'}}>{d.offCount}⚡</span>
            </div>
            <div style={{height:4,background:'#131f30',borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${Math.min(100,(d.used/max)*100).toFixed(1)}%`,background:i===0?'#00e676':d.offCount?'#ff8c00':'#00e5ff',borderRadius:2,transition:'width .8s ease'}}/>
            </div>
          </div>
        )):(monthKeys&&monthKeys.length?monthKeys.map((k,i)=>{
          const m=ledger.months[k]||{used:0,taka:0,offCount:0,peakW:0}
          const mx=Math.max(...monthKeys.map(x=>(ledger.months[x]||{used:0}).used),.01)
          return(
            <div key={k} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#3a5570',marginBottom:3,fontFamily:'Noto Sans Bengali',gap:6}}>
                <span>{monthNameOf(k)}</span>
                <span style={{fontFamily:'JetBrains Mono',color:'#dff0ff'}}>{f(m.used,2)} kWh · {fmtTaka(m.taka,0)}</span>
                <span style={{color:'#ff6b6b',fontFamily:'JetBrains Mono'}}>{m.offCount}⚡</span>
              </div>
              <div style={{height:5,background:'#131f30',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${Math.min(100,(m.used/mx)*100).toFixed(1)}%`,background:i===0?'#00e676':'#00b8d4',borderRadius:3,transition:'width .8s ease'}}/>
              </div>
              <div style={{fontSize:9,color:'#3a5570',fontFamily:'JetBrains Mono',marginTop:2}}>গড়/দিন {f(m.used/daysInMonth(k),3)} kWh · peak {f(m.peakW,0)}W</div>
            </div>
          )
        }):<div style={{fontSize:11,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>এখনো মাসিক ডেটা নেই</div>)}
      </div>
    </Panel>
  )
}

/* ═══════════ ৫ · দৈনিক / মাসিক রিপোর্ট ═══════════ */
export function Reports({today,yesterday,month,prevMonth,price,sending,sendDailyNow,sendMonthlyNow,monthK,pMonthK}){
  const tU=today?today.used:0, yU=yesterday?yesterday.used:0
  const mU=month?month.used:0, pU=prevMonth?prevMonth.used:0
  const diff=yU>0?((tU-yU)/yU*100):0
  const mDiff=pU>0?((mU-pU)/pU*100):0
  const daysSoFar=new Date(Date.UTC(+monthK.slice(0,4),+monthK.slice(5,7),0)).getUTCDate()
  const elapsed=bdNow().getUTCDate()   // বাংলাদেশ সময়ে মাসের কত তারিখ পার হয়েছে
  const proj=elapsed>0?mU/elapsed*daysSoFar:0
  const Arrow=({v})=><span style={{color:v>0?'#ff6b6b':'#00e676',fontFamily:'JetBrains Mono',fontSize:10}}>{v>0?'▲':'▼'}{f(Math.abs(v),1)}%</span>
  return(
    <Panel>
      <STitle>📊 রিপোর্ট ও তুলনা</STitle>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:11}}>
        <Mini label="আজ" value={fmtKwh(tU,3)} color="#00e5ff" sub={fmtTaka(tU*price)}/>
        <Mini label="গতকাল" value={fmtKwh(yU,3)} color="#00b8d4" sub={<Arrow v={diff}/>}/>
        <Mini label="এই মাস" value={fmtKwh(mU,2)} color="#00e676" sub={fmtTaka(mU*price)}/>
        <Mini label="গত মাস" value={fmtKwh(pU,2)} color="#ffd600" sub={<Arrow v={mDiff}/>}/>
      </div>
      <div style={{background:'#0f1928',border:'1px solid #1d2e42',borderRadius:9,padding:'9px 11px',marginBottom:11}}>
        <div style={{fontSize:9,color:'#3a5570',fontFamily:'Noto Sans Bengali',marginBottom:4}}>এই মাসের অনুমান (প্রজেকশন)</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
          <span style={{fontFamily:'Bebas Neue',fontSize:19,color:'#ce93d8'}}>{f(proj,2)} kWh</span>
          <span style={{fontFamily:'JetBrains Mono',fontSize:11,color:'#ff8c00'}}>{fmtTaka(proj*price)}</span>
        </div>
      </div>
      <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
        <Btn onClick={sendDailyNow} disabled={sending} color="#29b6f6">📰 দৈনিক রিপোর্ট পাঠান</Btn>
        <Btn onClick={sendMonthlyNow} disabled={sending} color="#ce93d8">📋 মাসিক রিপোর্ট পাঠান</Btn>
      </div>
      <div style={{fontSize:10,color:'#3a5570',fontFamily:'Noto Sans Bengali',marginTop:9,lineHeight:1.6}}>
        প্রতিদিন <b style={{color:'#00e5ff'}}>দুপুর ১২টা</b>-য় স্বয়ংক্রিয়ভাবে আজ/গতকাল/এই মাসের রিপোর্ট টেলিগ্রামে যাবে। নতুন মাসের ১ তারিখে গত মাসের পূর্ণ রিপোর্ট যাবে।
      </div>
    </Panel>
  )
}



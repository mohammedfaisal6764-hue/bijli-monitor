import{useState,useEffect}from 'react'
import{AreaChart,Area,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer}from 'recharts'
import{useElectricity,calcSlabBill,DEFAULT_SETTINGS,useNow,bdNow,bdTime,bdLong,bdDayNameShort,fmtDur,fmtTaka,fmtKwh,dayNameOfKey,monthNameOf}from './useElectricity'
import{LiveMeter,PowerStatus,OutageLog,DayHistory,Reports,Mini}from './Panels'
const f=(n,d=2)=>Number(n||0).toFixed(d)
const WEEK=['সোম','মঙ্গল','বুধ','বৃহ','শুক্র','শনি','আজ']
const CC={power:'#00e5ff',units:'#00e676',taka:'#ff8c00'}
const fmtT=fmtDur

function Settings({settings,setSettings,saveSettingsRemote,testTelegram,testAlert,pushAlert,showTg,onClose,exportJSON,exportCSV,clearHistory,clearAlerts}){
  const[fm,setFm]=useState({...settings})
  const[saving,setSaving]=useState(false)
  const[testing,setTesting]=useState(false)
  const[msg,setMsg]=useState('')
  const inp=(k,type='text',ph='')=>({type,placeholder:ph,value:fm[k]||'',onChange:e=>setFm(p=>({...p,[k]:e.target.value})),style:{width:'100%',padding:'9px 12px',borderRadius:8,background:'#0f1928',border:'1px solid #1d2e42',color:'#dff0ff',fontFamily:'JetBrains Mono',fontSize:12,outline:'none',marginBottom:10}})
  const lbl=t=><div style={{fontSize:10,color:'#3a5570',textTransform:'uppercase',letterSpacing:1.5,marginBottom:4,fontFamily:'JetBrains Mono'}}>{t}</div>
  const num=(k,min,max,step,color='#dff0ff')=>({type:'number',min,max,step,value:fm[k]??DEFAULT_SETTINGS[k],onChange:e=>setFm(p=>({...p,[k]:parseFloat(e.target.value)})),style:{width:'100%',padding:'9px 12px',borderRadius:8,background:'#0f1928',border:'1px solid #1d2e42',color,fontFamily:'Bebas Neue',fontSize:18,outline:'none',marginBottom:10}})
  const Tog=({k,label,color='#00e676'})=>(
    <div className="togRow">
      <span style={{fontSize:11,fontFamily:'Noto Sans Bengali',color:'#9fb6cd'}}>{label}</span>
      <div className="togSw" onClick={()=>setFm(p=>({...p,[k]:!p[k]}))} style={{background:fm[k]?color:'#2a3a4d'}}><i style={{left:fm[k]?20:2}}/></div>
    </div>
  )
  const TBtn=(t,l,color)=><button key={t} onClick={async()=>{setTesting(true);setMsg('');const r=await testAlert(t);setTesting(false);setMsg(r.ok?`✅ "${l}" টেস্ট মেসেজ টেলিগ্রামে পাঠানো হয়েছে`:`❌ ব্যর্থ: ${r.error}`)}} disabled={testing} style={{padding:'7px 11px',borderRadius:8,border:`1px solid ${color}44`,background:`${color}12`,color,fontFamily:'Noto Sans Bengali',fontSize:11,cursor:'pointer'}}>{l}</button>
  const DBtn=(fn,l)=>(
    <button key={l} onClick={fn} style={{padding:'7px 11px',borderRadius:8,border:'1px solid #1d2e42',background:'#0f1928',color:'#dff0ff',fontFamily:'Noto Sans Bengali',fontSize:11,cursor:'pointer'}}>{l}</button>
  )
  const save=async()=>{setSaving(true);setMsg('');setSettings(fm);const res=await saveSettingsRemote(fm);setSaving(false);if(res?.device_online){setMsg('✅ সংযোগ সফল! ডিভাইস অনলাইন।');pushAlert('✅ Tuya সংযোগ সফল!','green')}else setMsg('💾 সেভ হয়েছে।')}
  const testTg=async()=>{setTesting(true);setMsg('');const result=await testTelegram(fm);setTesting(false);if(result.success){setMsg('✅ Telegram সফল!');showTg('✅ Telegram সফল!\n⚡ বিদ্যুৎ মনিটর চালু আছে।');pushAlert('✅ Telegram সফল!','green')}else{setMsg(`❌ Telegram ব্যর্থ: ${result.error}`);pushAlert(`❌ Telegram ব্যর্থ: ${result.error}`,'red')}}
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(6px)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#0b1120',border:'1px solid #1d2e42',borderRadius:16,padding:28,width:'100%',maxWidth:460,maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{fontFamily:'Bebas Neue',fontSize:22,letterSpacing:3,color:'#00e5ff',marginBottom:4}}>⚙️ Settings</div>
        <div style={{fontSize:11,color:'#3a5570',marginBottom:20,fontFamily:'Noto Sans Bengali'}}>এখানে credentials দিন — browser-এ সেভ হবে, GitHub-এ যাবে না</div>
        <div style={{borderBottom:'1px solid #172438',marginBottom:16,paddingBottom:8}}>
          <div style={{fontSize:11,color:'#00e5ff',fontFamily:'JetBrains Mono',marginBottom:10}}>🔌 Tuya IoT Platform</div>
          {lbl('Client ID')}<input {...inp('tuya_client_id','text','q5avqmrnwupjwhwvm5q3')}/>
          {lbl('Client Secret')}<input {...inp('tuya_client_secret','password','••••••••••••')}/>
          {lbl('Device ID (TOMZN 63A)')}<input {...inp('tuya_device_id','text','bf253686d86878a2eduejn')}/>
          {lbl('Region')}
          <select value={fm.tuya_region||'eu'} onChange={e=>setFm(p=>({...p,tuya_region:e.target.value}))} style={{width:'100%',padding:'9px 12px',borderRadius:8,background:'#0f1928',border:'1px solid #1d2e42',color:'#dff0ff',fontFamily:'JetBrains Mono',fontSize:12,marginBottom:10}}>
            <option value="eu">eu — Western Europe (বাংলাদেশ)</option>
            <option value="us">us — Western America</option>
            <option value="in">in — India</option>
          </select>
        </div>
        <div style={{borderBottom:'1px solid #172438',marginBottom:16,paddingBottom:8}}>
          <div style={{fontSize:11,color:'#29b6f6',fontFamily:'JetBrains Mono',marginBottom:10}}>📱 Telegram</div>
          {lbl('Bot Token')}<input {...inp('telegram_token','password','8824872160:AAF...')}/>
          {lbl('Chat ID')}<input {...inp('telegram_chat_id','text','6345338101')}/>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:'#ff8c00',fontFamily:'JetBrains Mono',marginBottom:10}}>⚡ সেটিংস</div>
          {lbl('প্রতি ইউনিট মূল্য (টাকা)')}
          <input type="number" min={1} max={99} value={fm.price_per_unit||8} onChange={e=>setFm(p=>({...p,price_per_unit:parseFloat(e.target.value)||8}))} style={{width:'100%',padding:'9px 12px',borderRadius:8,background:'#0f1928',border:'1px solid #1d2e42',color:'#ff8c00',fontFamily:'Bebas Neue',fontSize:20,outline:'none',marginBottom:10}}/>
        </div>
        <div style={{borderBottom:'1px solid #172438',marginBottom:16,paddingBottom:8}}>
          <div style={{fontSize:11,color:'#ff8c00',fontFamily:'JetBrains Mono',marginBottom:10}}>⚡ অ্যালার্ট সেটিংস</div>
          {lbl('লোড অ্যালার্ট (ওয়াট) — এত W ছাড়ালেই মেসেজ')}<input {...num('power_alert_w',50,20000,50,'#ff8c00')}/>
          {lbl('খরচ অ্যালার্ট শুরু (টাকা)')}<input {...num('alert_threshold_taka',50,50000,50,'#ffd600')}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div>{lbl('ভোল্টেজ সর্বনিম্ন')}<input {...num('voltage_min',80,260,1,'#00e5ff')}/></div>
            <div>{lbl('ভোল্টেজ সর্বোচ্চ')}<input {...num('voltage_max',180,320,1,'#00e5ff')}/></div>
          </div>
          {lbl('দৈনিক রিপোর্টের সময় (বাংলাদেশ সময়, ০–২৩ ঘণ্টা)')}<input {...num('daily_report_hour',0,23,1,'#29b6f6')}/>
        </div>
        <div style={{borderBottom:'1px solid #172438',marginBottom:16,paddingBottom:8}}>
          <div style={{fontSize:11,color:'#00e676',fontFamily:'JetBrains Mono',marginBottom:10}}>🔔 কোন কোন নোটিফিকেশন যাবে</div>
          <Tog k="notify_offline" label="🔴 বিদ্যুৎ চলে গেলে (সাথে সাথে)" color="#ff1744"/>
          <Tog k="notify_online" label="🟢 বিদ্যুৎ ফিরে এলে (সময়কাল সহ)" color="#00e676"/>
          <Tog k="notify_power" label="⚡ লোড সীমা ছাড়ালে" color="#ff8c00"/>
          <Tog k="notify_daily" label="📰 প্রতিদিন দুপুর ১২টায় রিপোর্ট" color="#29b6f6"/>
          <Tog k="notify_monthly" label="📋 মাস শেষে / নতুন মাসে রিপোর্ট" color="#ce93d8"/>
          <Tog k="notify_voltage" label="🔌 ভোল্টেজ কম/বেশি হলে" color="#00e5ff"/>
          <Tog k="notify_hourly" label="⏰ প্রতি ঘণ্টায় রিপোর্ট (স্প্যাম হতে পারে)" color="#ffd600"/>
          <Tog k="daily_report_enabled" label="🕛 দৈনিক রিপোর্ট চালু রাখুন" color="#00e676"/>
        </div>
<div style={{borderBottom:'1px solid #172438',marginBottom:16,paddingBottom:8}}>
          <div style={{fontSize:11,color:'#ce93d8',fontFamily:'JetBrains Mono',marginBottom:10}}>🧪 টেলিগ্রাম টেস্ট মেসেজ</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            {[['offline','🔴 বিদ্যুৎ গেছে','#ff1744'],['online','🟢 বিদ্যুৎ এসেছে','#00e676'],['power','⚡ লোড অ্যালার্ট','#ff8c00'],['voltage','🔌 ভোল্টেজ','#00e5ff'],['daily','📰 দৈনিক','#29b6f6'],['monthly','📋 মাসিক','#ce93d8']].map(([t,l,c])=>TBtn(t,l,c))}
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,color:'#3a5570',fontFamily:'JetBrains Mono',marginBottom:10}}>🗄 ডেটা ব্যাকআপ ও রিসেট</div>
          <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
            {DBtn(()=>{const ok=exportJSON();setMsg(ok?'✅ JSON ব্যাকআপ ডাউনলোড হয়েছে':'❌ ব্যাকআপ ব্যর্থ হয়েছে')},'📥 JSON ব্যাকআপ')}
            {DBtn(()=>{const ok=exportCSV();setMsg(ok?'✅ CSV ফাইল ডাউনলোড হয়েছে (Excel-এ খুলবে)':'❌ CSV ব্যর্থ হয়েছে')},'📊 CSV (Excel)')}
            {DBtn(()=>{if(confirm('সব দৈনিক ও মাসিক হিসাব মুছে যাবে। আপনি নিশ্চিত?')){clearHistory();setMsg('🗑 সব হিসাব মুছে ফেলা হয়েছে')}},'🗑 হিসাব মুছুন')}
            {DBtn(()=>{if(confirm('সব অ্যালার্ট লিস্ট মুছে যাবে। আপনি নিশ্চিত?')){clearAlerts();setMsg('🗑 অ্যালার্ট লিস্ট মুছে ফেলা হয়েছে')}},'🔔 অ্যালার্ট মুছুন')}
          </div>
        </div>
        <div style={{fontSize:10,color:'#3a5570',fontFamily:'Noto Sans Bengali',lineHeight:1.7,marginBottom:14}}>
          ℹ️ দৈনিক ও মাসিক হিসাব (কত ইউনিট, কতবার বিদ্যুৎ গেল, কতক্ষণ বন্ধ ছিল) এই ব্রাউজারের localStorage-এ জমা থাকে — ব্রাউজার ডেটা মুছলে হারিয়ে যাবে, তাই মাঝে মাঝে JSON ব্যাকআপ রাখুন।
        </div>
        {msg&&<div style={{padding:'10px 14px',borderRadius:8,background:msg.startsWith('❌')?'rgba(255,60,60,0.08)':'rgba(0,230,118,0.08)',border:`1px solid ${msg.startsWith('❌')?'rgba(255,60,60,0.2)':'rgba(0,230,118,0.2)'}`,color:msg.startsWith('❌')?'#ff6464':'#00e676',fontSize:12,marginBottom:14,fontFamily:'Noto Sans Bengali'}}>{msg}</div>}
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button onClick={save} disabled={saving} style={{flex:1,padding:'10px 16px',borderRadius:9,border:'none',background:'linear-gradient(135deg,#00e5ff,#0050ff)',color:'#000',fontFamily:'Noto Sans Bengali',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'⏳ সংযোগ করছি...':'💾 সেভ ও সংযোগ করুন'}</button>
          <button onClick={testTg} disabled={testing} style={{padding:'10px 14px',borderRadius:9,border:'1px solid rgba(41,182,246,0.3)',background:'rgba(41,182,246,0.08)',color:'#29b6f6',fontFamily:'Noto Sans Bengali',fontSize:12,cursor:'pointer'}}>{testing?'⏳...':'📱 Telegram টেস্ট'}</button>
          <button onClick={onClose} style={{padding:'10px 14px',borderRadius:9,border:'1px solid #1d2e42',background:'transparent',color:'#3a5570',fontFamily:'Noto Sans Bengali',fontSize:12,cursor:'pointer'}}>✕</button>
        </div>
      </div>
    </div>
  )
}

function Header({online,price,setPrice,onSettings}){
  useNow(1000)   /* প্রতি সেকেন্ডে রি-রেন্ডার → বাংলাদেশ সময় লাইভ আপডেট */

  return(
    <header style={{position:'sticky',top:0,zIndex:100,background:'rgba(6,9,15,0.97)',backdropFilter:'blur(20px)',borderBottom:'1px solid #172438',padding:'11px 22px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
      <div style={{width:34,height:34,background:'linear-gradient(135deg,#00e5ff,#0050ff)',clipPath:'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,animation:'glow 2.5s ease-in-out infinite'}}>⚡</div>
      <div><div style={{fontFamily:'Bebas Neue',fontSize:18,letterSpacing:3,color:'#00e5ff'}}>বিদ্যুৎ মনিটর</div><div style={{fontSize:9,color:'#3a5570',letterSpacing:2}}>TOMZN 63A · Tuya · Vercel</div></div>
      <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <span style={{padding:'3px 10px',borderRadius:20,fontSize:10,border:`1px solid ${online?'#00e676':'#ffd600'}`,color:online?'#00e676':'#ffd600',background:online?'rgba(0,230,118,0.08)':'rgba(255,214,0,0.07)',fontFamily:'Noto Sans Bengali'}}>{online?'● Tuya লাইভ':'● সিমুলেশন'}</span>
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,color:'#3a5570'}}><div style={{width:6,height:6,borderRadius:'50%',background:'#00e676',animation:'blink 1.6s ease-in-out infinite'}}/>লাইভ</div>
        <div style={{display:'flex',alignItems:'center',gap:6,background:'#0f1928',border:'1px solid #172438',borderRadius:9,padding:'4px 12px'}}>
          <span style={{fontSize:10,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>৳/kWh:</span>
          <input type="number" value={price} min={1} max={99} onChange={e=>setPrice(parseFloat(e.target.value)||8)} style={{background:'transparent',border:'none',color:'#ff8c00',fontFamily:'Bebas Neue',fontSize:20,width:44,textAlign:'right',outline:'none'}}/>
        </div>
        <button onClick={onSettings} style={{padding:'6px 16px',borderRadius:9,border:'1px solid rgba(0,229,255,0.3)',background:'rgba(0,229,255,0.08)',color:'#00e5ff',fontSize:12,cursor:'pointer',fontFamily:'Noto Sans Bengali',fontWeight:600}}>⚙️ Settings</button>
        <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',lineHeight:1.3}}>
          <div style={{fontSize:14,color:'#00e5ff',fontFamily:'JetBrains Mono',fontWeight:700,letterSpacing:1}}>🇧🇩 {bdTime()}</div>
          <div style={{fontSize:9,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>{bdLong()}</div>
        </div>
      </div>
    </header>
  )
}

const H=({label,value,unit,sub,color,icon})=>(
  <div style={{background:'#0b1120',border:'1px solid #172438',borderRadius:13,padding:'20px 22px',position:'relative',overflow:'hidden',transition:'transform .2s',cursor:'default'}} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
    <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)`}}/>
    <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at top left,${color}0a,transparent 55%)`,pointerEvents:'none'}}/>
    <div style={{fontSize:10,color:'#3a5570',textTransform:'uppercase',letterSpacing:2,marginBottom:8,fontFamily:'Noto Sans Bengali'}}>{icon} {label}</div>
    <div style={{fontFamily:'Bebas Neue',fontSize:44,lineHeight:1,color}}>{value}<span style={{fontSize:13,fontWeight:300,opacity:.5,marginLeft:3}}>{unit}</span></div>
    <div style={{marginTop:8,fontSize:11,color:'#3a5570',fontFamily:'Noto Sans Bengali',lineHeight:1.7}}>{sub}</div>
  </div>
)
const St=({icon,label,value,color,bg})=>(
  <div style={{background:'#0b1120',border:'1px solid #172438',borderRadius:11,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
    <div style={{width:32,height:32,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{icon}</div>
    <div><div style={{fontSize:9,color:'#3a5570',textTransform:'uppercase',letterSpacing:1.5,fontFamily:'Noto Sans Bengali'}}>{label}</div><div style={{fontSize:16,fontWeight:700,fontFamily:'Bebas Neue',color,marginTop:2}}>{value}</div></div>
  </div>
)
const Panel=({children,style={}})=><div style={{background:'#0b1120',border:'1px solid #172438',borderRadius:13,padding:18,...style}}>{children}</div>
const STitle=({children})=><div style={{fontSize:10,color:'#3a5570',textTransform:'uppercase',letterSpacing:2,marginBottom:12,fontFamily:'Noto Sans Bengali',display:'flex',alignItems:'center',gap:8}}>{children}<div style={{flex:1,height:1,background:'#172438'}}/></div>
const TR=({label,value,color})=><tr style={{borderBottom:'1px solid #172438'}}><td style={{padding:'7px 4px',fontSize:11,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>{label}</td><td style={{padding:'7px 4px',fontSize:11,fontFamily:'JetBrains Mono',fontWeight:600,textAlign:'right',color}}>{value}</td></tr>
const SP=({label})=><tr><td colSpan={2} style={{padding:'4px',fontSize:8,letterSpacing:1,textTransform:'uppercase',color:'#3a5570',background:'#0f1928',fontFamily:'JetBrains Mono'}}>{label}</td></tr>
const TgPop=({msg})=>!msg?null:(
  <div style={{position:'fixed',bottom:22,right:22,zIndex:999,background:'#0b1120',border:'1px solid rgba(0,136,204,0.3)',borderRadius:14,padding:'14px 16px',maxWidth:290,display:'flex',gap:12,boxShadow:'0 10px 50px rgba(0,0,0,.6)',animation:'slideIn .45s ease'}}>
    <div style={{width:32,height:32,borderRadius:'50%',background:'linear-gradient(135deg,#0088cc,#29b6f6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>✈️</div>
    <div><div style={{fontSize:9,color:'rgba(41,182,246,.8)',fontFamily:'JetBrains Mono',marginBottom:3}}>📱 Telegram</div><div style={{fontSize:11,fontFamily:'Noto Sans Bengali',lineHeight:1.6,whiteSpace:'pre-line'}}>{msg.text}</div></div>
  </div>
)
/* বিভ্রাটের লগ এখন Panels.jsx থেকে আসে — বিস্তারিত সময় (কয়টা থেকে কয়টা) সহ */


export default function App(){
  const{
    data,price,setPrice,settings,setSettings,saveSettingsRemote,testTelegram,testAlert,sending,
    alerts,alertCount,clearAlerts,tgMsg,pushAlert,showTg,outages,outageToday,openOutage,
    days30,monthKeys,ledger,today,yesterday,month,prevMonth,todayK,monthK,pMonthK,
    meter,setMeterBase,syncMeter,resetToday,clearHistory,exportJSON,exportCSV,sendDailyNow,sendMonthlyNow,
    realMode,powerOn,calc,runtime,
  }=useElectricity()
  const[mode,setMode]=useState('power')
  const[chartData,setChartData]=useState([])
  const[showSett,setShowSett]=useState(false)
  const[tab,setTab]=useState('alerts')
  useEffect(()=>{const t=bdTime(),v=mode==='power'?data.powerW:mode==='units'?data.totalKwh:calc.tTotal;setChartData(p=>{const n=[...p,{t,v:parseFloat((v||0).toFixed(4))}];return n.length>80?n.slice(-80):n})},[data,mode])
  const slab=calcSlabBill(calc.kphM),color=CC[mode]
  const tUsed=today?today.used:0, yUsed=yesterday?yesterday.used:0, mUsed=month?month.used:0
  const cmp=(a,b)=>b>0?((a-b)/b*100):0
  return(
    <div>
      <Header online={data.online} price={price} setPrice={setPrice} onSettings={()=>setShowSett(true)}/>
      {showSett&&<Settings settings={settings} setSettings={s=>{setSettings(s);if(s.price_per_unit)setPrice(s.price_per_unit)}} saveSettingsRemote={saveSettingsRemote} testTelegram={testTelegram} testAlert={testAlert} pushAlert={pushAlert} showTg={showTg} exportJSON={exportJSON} exportCSV={exportCSV} clearHistory={clearHistory} clearAlerts={clearAlerts} onClose={()=>setShowSett(false)}/>}
      <main style={{maxWidth:1350,margin:'0 auto',padding:'18px 20px'}}>
        {!realMode&&<div style={{background:'rgba(255,214,0,0.06)',border:'1px solid rgba(255,214,0,0.2)',borderRadius:10,padding:'10px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:10,fontSize:12,color:'#ffd600',fontFamily:'Noto Sans Bengali'}}>⚠️ সিমুলেশন মোড — ⚙️ Settings-এ Tuya credentials দিন (বিদ্যুৎ যাওয়া/আসা ও টেলিগ্রাম অ্যালার্ট এখানে বন্ধ থাকে)<button onClick={()=>setShowSett(true)} style={{marginLeft:'auto',padding:'4px 12px',borderRadius:7,border:'1px solid rgba(255,214,0,0.3)',background:'transparent',color:'#ffd600',cursor:'pointer',fontSize:11,fontFamily:'Noto Sans Bengali'}}>⚙️ Settings</button></div>}
        {realMode&&!data.online&&<div style={{background:'rgba(255,23,68,0.07)',border:'1px solid rgba(255,23,68,0.24)',borderRadius:10,padding:'10px 16px',marginBottom:14,fontSize:12,color:'#ff6b6b',fontFamily:'Noto Sans Bengali'}}>🔴 ডিভাইস টেলিগ্রাম থেকে উত্তর দিচ্ছে না — বিদ্যুৎ নেই ধরে নেওয়া হচ্ছে। last known reading দেখানো হচ্ছে।</div>}

        {/* ── লাইভ মিটার + বিদ্যুৎ স্ট্যাটাস ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:13,marginBottom:14}}>
          <LiveMeter meter={meter} data={data} price={price} today={today} realMode={realMode} onSetBase={setMeterBase} onSync={syncMeter} onReset={resetToday}/>
          <PowerStatus powerOn={powerOn} openOutage={openOutage} outageToday={outageToday} realMode={realMode}/>
        </div>

        {/* ── আজকের সারসংক্ষেপ ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:13,marginBottom:14}}>
          <H label="আজকের ব্যবহার" icon="📊" value={f(tUsed,3)} unit="kWh" color="#00e5ff" sub={<>গতকাল: <b style={{color:'#00b8d4',fontFamily:'JetBrains Mono'}}>{f(yUsed,3)}</b> kWh {yUsed>0&&<b style={{color:cmp(tUsed,yUsed)>0?'#ff6b6b':'#00e676'}}>({cmp(tUsed,yUsed)>0?'▲':'▼'}{f(Math.abs(cmp(tUsed,yUsed)),1)}%)</b>}<br/>মিটার রিডিং: <b style={{color:'#00e5ff',fontFamily:'JetBrains Mono'}}>{f(meter.reading,3)}</b> kWh</>}/>
          <H label="আজকের খরচ" icon="💰" value={`৳${f(tUsed*price,2)}`} unit="" color="#00e676" sub={<>এই মাস: <b style={{color:'#00e676',fontFamily:'JetBrains Mono'}}>৳{f(mUsed*price,0)}</b><br/>মোট({f(data.totalKwh,3)} kWh): <b style={{color:'#00e676',fontFamily:'JetBrains Mono'}}>৳{f(calc.tTotal,2)}</b></>}/>
          <H label="বর্তমান পাওয়ার" icon="⚡" value={f(data.powerW,0)} unit="W" color="#ff8c00" sub={<>ভোল্ট: <b style={{color:'#ff8c00',fontFamily:'JetBrains Mono'}}>{f(data.voltV,1)}</b>V | অ্যাম্প: <b style={{color:'#ff8c00',fontFamily:'JetBrains Mono'}}>{f(data.ampA,2)}</b>A<br/>সর্বোচ্চ(আজ): <b style={{color:'#ff8c00',fontFamily:'JetBrains Mono'}}>{f(today?today.peakW:0,0)}</b>W</>}/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:11,marginBottom:14}}>
          <St icon="⏱" label="চলার সময়"  value={fmtT(runtime)}      color="#00e5ff" bg="rgba(0,229,255,0.1)"/>
          <St icon="📅" label="মাসিক"      value={`৳${f(calc.tMo,0)}`} color="#00e676" bg="rgba(0,230,118,0.1)"/>
          <St icon="⚡" label="ঘণ্টায়"     value={`৳${f(calc.tHr,3)}`} color="#ff8c00" bg="rgba(255,140,0,0.1)"/>
          <St icon="🔴" label="আজ বিভ্রাট"  value={`${outageToday.offCount}বার`} color="#ff1744" bg="rgba(255,23,68,0.1)"/>
          <St icon="⏳" label="বন্ধ ছিল"    value={fmtT(outageToday.ms)} color="#ffd600" bg="rgba(255,214,0,0.1)"/>
        </div>
        <div style={{background:'#0b1120',border:'1px solid #172438',borderRadius:13,padding:'18px 20px',marginBottom:14}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div style={{fontSize:10,color:'#3a5570',textTransform:'uppercase',letterSpacing:2,fontFamily:'Noto Sans Bengali'}}>📈 রিয়েল-টাইম গ্রাফ</div>
            <div style={{display:'flex',gap:6}}>
              {['power','units','taka'].map(m=><button key={m} onClick={()=>setMode(m)} style={{padding:'4px 11px',borderRadius:7,fontSize:10,cursor:'pointer',fontFamily:'Noto Sans Bengali',border:`1px solid ${mode===m?CC[m]:'#172438'}`,color:mode===m?CC[m]:'#3a5570',background:mode===m?`${CC[m]}15`:'transparent',transition:'all .2s'}}>{m==='power'?'পাওয়ার':m==='units'?'ইউনিট':'খরচ'}</button>)}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={chartData} margin={{top:5,right:5,bottom:0,left:0}}>
              <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.25}/><stop offset="95%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
              <XAxis dataKey="t" tick={{fill:'#3a5570',fontSize:9,fontFamily:'JetBrains Mono'}} tickLine={false} axisLine={false}/>
              <YAxis tick={{fill:'#3a5570',fontSize:9,fontFamily:'JetBrains Mono'}} tickLine={false} axisLine={false} width={52} tickFormatter={v=>mode==='power'?`${v}W`:mode==='units'?v.toFixed(3):`৳${v.toFixed(1)}`}/>
              <Tooltip contentStyle={{background:'rgba(6,9,15,0.97)',border:`1px solid ${color}`,borderRadius:10,fontFamily:'JetBrains Mono',fontSize:12}} labelStyle={{color:'#3a5570',fontSize:10}} itemStyle={{color}} formatter={v=>[mode==='power'?`${v}W`:mode==='units'?`${v} kWh`:`৳${v}`,'']}/>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2.5} fill="url(#g)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1.1fr 1fr 0.9fr',gap:14}}>
          <Panel>
            <STitle>🧮 সম্পূর্ণ হিসাব</STitle>
            <table style={{width:'100%',borderCollapse:'collapse'}}><tbody>
              <SP label="⚡ পাওয়ার"/><TR label="পাওয়ার" value={`${f(data.powerW,1)} W`} color="#00e5ff"/><TR label="ভোল্টেজ" value={`${f(data.voltV,1)} V`} color="#00e5ff"/><TR label="কারেন্ট" value={`${f(data.ampA,3)} A`} color="#00e5ff"/><TR label="PF" value={f(data.pf,3)} color="#00e5ff"/>
              <SP label="📊 ইউনিট"/><TR label="মোট kWh" value={f(data.totalKwh,5)} color="#00e676"/><TR label="ঘণ্টায়" value={`${f(calc.kphH,5)} kWh/h`} color="#00e676"/><TR label="দৈনিক" value={`${f(calc.kphD,4)} kWh`} color="#00e676"/>
              <SP label="💰 খরচ"/><TR label="মোট" value={`৳${f(calc.tTotal,3)}`} color="#ff8c00"/><TR label="ঘণ্টায়" value={`৳${f(calc.tHr,4)}`} color="#ff8c00"/>
              <SP label="📅 অনুমান"/><TR label="দৈনিক" value={`৳${f(calc.tDay,2)}`} color="#ffd600"/><TR label="সাপ্তাহিক" value={`৳${f(calc.tDay*7,2)}`} color="#ffd600"/><TR label="মাসিক" value={`৳${f(calc.tMo,2)}`} color="#ff1744"/><TR label="বার্ষিক" value={`৳${f(calc.tYr,0)}`} color="#ff1744"/>
              <SP label="🏛 BREB বিল"/>
              {slab.rows.map((r,i)=><TR key={i} label={`${r.label} kWh`} value={`৳${r.cost}`} color="#ce93d8"/>)}
              <TR label="মিটার ভাড়া" value="৳40" color="#3a5570"/><TR label="ভ্যাট ৫%" value={`৳${slab.vat}`} color="#3a5570"/>
              <tr style={{background:'#0f1928'}}><td style={{padding:'8px 4px',fontSize:11,fontFamily:'Noto Sans Bengali',color:'#ce93d8'}}>সম্ভাব্য বিল</td><td style={{padding:'8px 4px',fontFamily:'Bebas Neue',fontSize:17,textAlign:'right',color:'#ce93d8'}}>৳{slab.total}</td></tr>
            </tbody></table>
          </Panel>
          <div style={{display:'flex',flexDirection:'column',gap:13}}>
            <Reports today={today} yesterday={yesterday} month={month} prevMonth={prevMonth} price={price} sending={sending} sendDailyNow={sendDailyNow} sendMonthlyNow={sendMonthlyNow} monthK={monthK} pMonthK={pMonthK}/>
            <Panel>
              <STitle>🔌 TOMZN 63A</STitle>
              <div style={{background:'#0f1928',border:'1px solid #1d2e42',borderRadius:10,padding:'11px 13px',marginBottom:11,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:9}}><span style={{fontSize:20}}>🔌</span><div><div style={{fontSize:12,fontFamily:'Noto Sans Bengali'}}>TOMZN 63A</div><div style={{fontSize:9,color:'#3a5570',fontFamily:'JetBrains Mono'}}>Tuya · 63A · Single Phase</div></div></div>
                <span style={{fontSize:9,padding:'2px 9px',borderRadius:20,border:`1px solid ${data.online?'#00e676':'#ffd600'}`,color:data.online?'#00e676':'#ffd600'}}>{data.online?'● অনলাইন':'● সিম'}</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {[{l:'ভোল্টেজ',v:`${f(data.voltV,0)}V`,c:'#00e5ff'},{l:'কারেন্ট',v:`${f(data.ampA,2)}A`,c:'#ff8c00'},{l:'মোট kWh',v:f(data.totalKwh,4),c:'#00e676'},{l:'মোট খরচ',v:`৳${f(calc.tTotal,2)}`,c:'#ffd600'}].map((x,i)=>(
                  <div key={i} style={{background:'#0f1928',border:'1px solid #1d2e42',borderRadius:9,padding:10}}><div style={{fontSize:9,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>{x.l}</div><div style={{fontSize:18,fontFamily:'Bebas Neue',color:x.c,marginTop:2}}>{x.v}</div></div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        {/* ── হিস্ট্রি · বিভ্রাটের লগ · অ্যালার্ট ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginTop:14}}>
          <DayHistory days30={days30} price={price} monthKeys={monthKeys} ledger={ledger}/>
          <Panel>
            <STitle>⚡ বিভ্রাটের লগ (সময় থেকে সময়)</STitle>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:11}}>
              <Mini label="আজ গেছে" value={`${outageToday.offCount} বার`} color="#ff1744"/>
              <Mini label="আজ এসেছে" value={`${outageToday.onCount} বার`} color="#00e676"/>
              <Mini label="মোট বন্ধ" value={fmtT(outageToday.ms)} color="#ffd600"/>
              <Mini label="সর্বোচ্চ একটানা" value={fmtT(outageToday.longestMs)} color="#ff8c00"/>
            </div>
            <OutageLog outages={outages}/>
          </Panel>
          <Panel>
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              {[['alerts','🔔 অ্যালার্ট'],['today','📋 বিস্তারিত']].map(([k,l])=>(
                <button key={k} onClick={()=>setTab(k)} style={{padding:'5px 12px',borderRadius:8,fontSize:10,cursor:'pointer',fontFamily:'Noto Sans Bengali',border:`1px solid ${tab===k?'#00e5ff':'#172438'}`,color:tab===k?'#00e5ff':'#3a5570',background:tab===k?'rgba(0,229,255,0.08)':'transparent',transition:'all .2s'}}>{l}</button>
              ))}
            </div>
            {tab==='alerts'?(
              <>
                <div style={{maxHeight:250,overflowY:'auto'}}>
                  {alerts.length===0&&<div style={{fontSize:11,color:'#3a5570',fontFamily:'Noto Sans Bengali'}}>এখনো কোনো অ্যালার্ট নেই</div>}
                  {alerts.map(a=>{const cs={green:'#00e676',cyan:'#00e5ff',orange:'#ff8c00',red:'#ff1744'};return<div key={a.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 0',borderBottom:'1px solid #172438',animation:'fadeUp .4s ease'}}><div style={{width:6,height:6,borderRadius:'50%',background:cs[a.color]||cs.cyan,marginTop:4,flexShrink:0}}/><div><div style={{fontSize:11,fontFamily:'Noto Sans Bengali',lineHeight:1.5}}>{a.text}</div><div style={{fontSize:9,color:'#3a5570',fontFamily:'JetBrains Mono',marginTop:1}}>{a.time}</div></div></div>})}
                </div>
                <div style={{display:'flex',gap:6,marginTop:10}}>
                  <button onClick={()=>setShowSett(true)} style={{flex:1,padding:8,background:'rgba(0,229,255,0.06)',border:'1px solid rgba(0,229,255,0.15)',borderRadius:8,color:'#00e5ff',fontFamily:'Noto Sans Bengali',fontSize:11,cursor:'pointer'}}>⚙️ Settings খুলুন</button>
                  <button onClick={()=>{if(confirm('সব অ্যালার্ট মুছে যাবে?'))clearAlerts()}} style={{padding:'8px 12px',background:'transparent',border:'1px solid #1d2e42',borderRadius:8,color:'#3a5570',fontFamily:'Noto Sans Bengali',fontSize:11,cursor:'pointer'}}>🗑</button>
                </div>
              </>
            ):(
              <table style={{width:'100%',borderCollapse:'collapse'}}><tbody>
                <SP label="⚡ বিদ্যুৎ — আজ"/>
                <TR label="চালু ছিল" value={fmtT(outageToday.onlineMs)} color="#00e676"/>
                <TR label="বন্ধ ছিল" value={fmtT(outageToday.offlineMs)} color="#ff1744"/>
                <TR label="মোট বিভ্রাট সময়" value={fmtT(outageToday.ms)} color="#ffd600"/>
                <TR label="সর্বোচ্চ একটানা" value={fmtT(outageToday.longestMs)} color="#ff8c00"/>
                <SP label="📊 ব্যবহার — আজ"/>
                <TR label="ব্যবহৃত ইউনিট" value={fmtKwh(tUsed,3)} color="#00e5ff"/>
                <TR label="খরচ" value={fmtTaka(tUsed*price)} color="#00e676"/>
                <TR label="সর্বোচ্চ লোড" value={`${f(today?today.peakW:0,0)} W`} color="#ff8c00"/>
                <TR label="সর্বনিম্ন ভোল্টেজ" value={today&&today.minV!=null?`${f(today.minV,1)} V`:'—'} color="#00e5ff"/>
                <TR label="সর্বোচ্চ ভোল্টেজ" value={today&&today.maxV!=null?`${f(today.maxV,1)} V`:'—'} color="#00e5ff"/>
                <SP label="📅 এই মাস"/>
                <TR label="ব্যবহৃত ইউনিট" value={fmtKwh(mUsed,2)} color="#00e676"/>
                <TR label="খরচ" value={fmtTaka(mUsed*price,0)} color="#00e676"/>
                <TR label="গড়/দিন" value={fmtKwh(mUsed/Math.max(bdNow().getUTCDate(),1),3)} color="#00b8d4"/>
                <TR label="বিভ্রাট" value={`${month?month.offCount:0} বার`} color="#ff1744"/>
                <TR label="মিটার রিডিং" value={fmtKwh(meter.reading,3)} color="#ce93d8"/>
              </tbody></table>
            )}
          </Panel>
        </div>
      </main>
      <TgPop msg={tgMsg}/>
      <style>{`@media(max-width:1100px){main>div:nth-of-type(3),main>div:nth-of-type(5),main>div:nth-of-type(7){grid-template-columns:1fr 1fr!important}}@media(max-width:760px){main>div{grid-template-columns:1fr!important}main{padding:14px!important}}`}</style>
    </div>
  )
}

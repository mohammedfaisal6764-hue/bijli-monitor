import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)

/* ═══ PWA — Service Worker রেজিস্ট্রেশন (অফলাইন সাপোর্ট) ═══
   http/https-এ চললে SW চালু হবে; ফাইল:// বা ব্যর্থ হলে চুপচাপ বাদ যাবে। */
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

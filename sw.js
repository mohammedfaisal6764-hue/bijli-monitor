/* ═══ Service Worker — বিদ্যুৎ মনিটর PWA ═══
   অফলাইনেও অ্যাপ চলবে, ক্যাশ থেকে দেখাবে */
const CACHE = 'bijli-v1'
const CORE = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  /* API কল ক্যাশ হবে না — সবসময় নেটওয়ার্ক */
  if (url.pathname.startsWith('/api/')) return
  /* বাকি সব: network-first, ফেল হলে ক্যাশ */
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && e.request.method === 'GET') {
        const cp = r.clone()
        caches.open(CACHE).then(c => c.put(e.request, cp)).catch(() => {})
      }
      return r
    }).catch(() => caches.match(e.request).then(m => m || caches.match('/index.html')))
  )
})

/**
 * 서비스 워커 — 한 번 받은 뒤에는 인터넷 없이도 놀 수 있게 한다.
 *
 * 캐시 전략이 두 가지인 이유(한자놀이에서 겪고 고친 그대로):
 *   - **HTML은 네트워크 우선.** 캐시 우선으로 두면 배포 뒤 화면이 하얗게 뜬다.
 *     낡은 index.html이 캐시에서 나오는데 그 안의 자산 이름(index-<해시>.js)은
 *     새 배포에 없어 404가 되기 때문이다.
 *   - **자산은 캐시 우선.** 파일명에 내용 해시가 박혀 있어 같은 이름이면 같은 내용이다.
 *
 * 소리(TTS)는 기기 음성을 쓰므로 오프라인에서도 난다. 다만 **발음 채점(SpeechRecognition)은
 * 네트워크가 필요**해서 오프라인에서는 저절로 꺼진다(speech.canScore가 확인한다).
 */
const CACHE = 'yeongeo-nori-v1'

self.addEventListener('install', (e) => {
  // 새 워커를 바로 활성화 — 아이가 앱을 두 번 껐다 켜야 하는 일이 없게
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest'])))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function put(req, res) {
  if (res.ok) {
    const copy = res.clone()
    caches.open(CACHE).then((c) => c.put(req, copy))
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  if (new URL(req.url).origin !== self.location.origin) return

  const isDocument = req.mode === 'navigate' || req.destination === 'document'

  if (isDocument) {
    // 네트워크 우선 — 새 배포를 놓치지 않는다. 오프라인이면 캐시로 떨어진다.
    e.respondWith(
      fetch(req)
        .then((res) => put(req, res))
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match('./'))),
    )
    return
  }

  e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then((res) => put(req, res))))
})

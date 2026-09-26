/* 見切りレーダー Service Worker
 * - ページ本体: ネット優先、つながらなければ保存済みのものを返す
 * - ONNX Runtime（jsDelivr, バージョン固定）と Google Fonts: 保存済みを優先
 * - ページ本体に COOP/COEP ヘッダーを付け、WASM のマルチスレッドを使えるようにする
 *   （GitHub Pages ではヘッダーを設定できないため）
 * 文字認識モデルは index.html 側で Cache Storage（mikiri-models-v1）に保存・検証する。
 */
const SHELL = "mikiri-shell-v2";
const RUNTIME = "mikiri-runtime-v1";
const KEEP = [SHELL, RUNTIME, "mikiri-models-v1"];
const RUNTIME_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith("mikiri-") && !KEEP.includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));

function isolate(r) {
  if (!r || r.type === "opaque") return r;
  const h = new Headers(r.headers);
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Embedder-Policy", "require-corp");
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      try {
        const r = await fetch(req);
        if (r.ok) await c.put(req, r.clone());
        return isolate(r);
      } catch (err) {
        const hit = await c.match(req, { ignoreSearch: true }) || (await c.matchAll())[0];
        if (hit) return isolate(hit);
        throw err;
      }
    })());
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok && r.type !== "opaque") await c.put(req, r.clone());
      return r;
    })());
  }
});

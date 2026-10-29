// Service worker: guarda la app y los datos en el celular para usarla sin conexión.
// Los videos (YouTube y Drive) son de otro sitio: no se guardan ni se tocan.
//
// Cómo se actualiza: una versión nueva se instala en segundo plano y queda «en espera». La app muestra el botón «Actualizar» y
// recién al tocarlo se activa (mensaje SALTEAR_ESPERA). Nunca cambia sola. La lista de archivos y la versión las escribe
// scripts/actualizar_sw.py; la versión es un hash de todos los archivos, así que app y datos cambian siempre juntos.

const PREFIJO = "tao-salud-";

// <<GENERADO por scripts/actualizar_sw.py: no editar a mano
const VERSION = "b76a7a31d2";
const ARCHIVOS = [
  ".git/COMMIT_EDITMSG",
  ".git/HEAD",
  ".git/config",
  ".git/description",
  ".git/hooks/applypatch-msg.sample",
  ".git/hooks/commit-msg.sample",
  ".git/hooks/fsmonitor-watchman.sample",
  ".git/hooks/post-update.sample",
  ".git/hooks/pre-applypatch.sample",
  ".git/hooks/pre-commit.sample",
  ".git/hooks/pre-merge-commit.sample",
  ".git/hooks/pre-push.sample",
  ".git/hooks/pre-rebase.sample",
  ".git/hooks/pre-receive.sample",
  ".git/hooks/prepare-commit-msg.sample",
  ".git/hooks/push-to-checkout.sample",
  ".git/hooks/sendemail-validate.sample",
  ".git/hooks/update.sample",
  ".git/index",
  ".git/info/exclude",
  ".git/logs/HEAD",
  ".git/logs/refs/heads/main",
  ".git/logs/refs/remotes/origin/main",
  ".git/objects/04/688af5edf4eda0a22bedaa97f9b84bcc420ec8",
  ".git/objects/0d/728e50ff7e18d8fced000de7d904beecad9df8",
  ".git/objects/13/d43633f1d0270d197c8ba7658c3c3e3990751b",
  ".git/objects/16/058924935293b3b132a1b92f747c2a3e40c884",
  ".git/objects/17/378647437be9cceafec570ee9ecf7d3d62737b",
  ".git/objects/18/84478394e5ff6599f6cf8aebda90ce47b9b318",
  ".git/objects/1d/3353acd4ee23b49de0c3193d624e059c4deb6b",
  ".git/objects/1d/67f993a58f34bdbb0e3a02573b1f306611e531",
  ".git/objects/1f/53798bb4fe33c86020be7f10c44f29486fd190",
  ".git/objects/2d/7e49ad9757ee03ac2e372c9e922a82979b2a57",
  ".git/objects/33/8f34a6b2865680e6a0c04593267f529c37bef0",
  ".git/objects/34/655d83c41508e9cc912bdfa24b3755466da856",
  ".git/objects/42/30074412051db56397b4c8d5b55677a6e4d7f5",
  ".git/objects/46/b758559b386ff1749dd0e3ee9084d161d1ba55",
  ".git/objects/48/eea46200d47b1ec0f2b5fcf275c2d040e27ee5",
  ".git/objects/4c/d562815b09e155a9a65bf21838c4b1a90de75e",
  ".git/objects/51/0676c85bb626dda72328b46169744882c5e5bd",
  ".git/objects/53/1089d4c9a86daaee479a70da0d3a9cbb9d5590",
  ".git/objects/53/8b0d06406484aac1a509e83d2ab241006226bb",
  ".git/objects/60/4d5d63b5f2bf0472ee4ca65d55d99896e14df9",
  ".git/objects/6d/ac972cf0baadbc688560c9c590ed53b1a7d400",
  ".git/objects/73/f7ddc39c02d2029e4c2aa122e25a10d5e5a494",
  ".git/objects/76/88957b06ad7056b92bf20c2b63b90f98d3db2e",
  ".git/objects/7f/139f68d3cb867162b79a2c0a51571ad3ed34e4",
  ".git/objects/81/04a04a413a118ba43b8cf04917fb87e50af78d",
  ".git/objects/84/3d55dbb4398f8d23f66a532e0cd315b548ce72",
  ".git/objects/88/f3e80230f3d01af23dabd15a5074e93dfb1c76",
  ".git/objects/97/9bbcd55842f72b5348d2ecf7a210c24d2b1195",
  ".git/objects/9e/52e51e42eb2a28e7215d38ece2132e1fa920f1",
  ".git/objects/a4/987882d101e69868acc43053707bc5a2677efd",
  ".git/objects/ba/f1850e5b3125fe3da6b5d813ab1e2ec46f3334",
  ".git/objects/bb/2b5ae1eb719434e5957dd25766aa5ce349adb8",
  ".git/objects/c0/47ad84d704cf4e3ce84a1fdee89a7f1e3bb2b0",
  ".git/objects/ce/28236ede8f653911e66292f5aedfcb4b04e0a2",
  ".git/objects/ce/e84cb4e3391cf93355a4d815e50d50502e0183",
  ".git/objects/d2/5a87058cccc1dabd67611b38d25a16b4a4b219",
  ".git/objects/d6/5d7bfbd10203bc53c19c1d38df5eaf81e937e4",
  ".git/objects/db/a937851cb5f0151bcfe6f874a6272958373ee4",
  ".git/objects/df/ed8c863758931aa81602d1aa4b57b79ea4bd79",
  ".git/objects/e4/a84d69531fcfaae4fda3b53dae8c408dcd450b",
  ".git/objects/e4/cebe2669669350040023f19038a8a6848c981a",
  ".git/objects/e5/532bcc9c0d433bad968e305e9e590aed67e3b9",
  ".git/objects/e6/9de29bb2d1d6434b8b29ae775ad8c2e48c5391",
  ".git/objects/e8/0a872ab84b8fc754a626e28bbfd130a0521b95",
  ".git/objects/f0/750b777f7d71fdba67d2188b073186d688b719",
  ".git/objects/f4/78d1aa14b34a3ded0ce5faa496d098f4d0045c",
  ".git/objects/f4/eb993bdb244f883dc57414575d7c4ba5765fc1",
  ".git/objects/f7/2dc003d682e51fe48113ab2a262dbed29b77cb",
  ".git/objects/fc/47fe22a177ed142e65441d5d08a02a38eb4885",
  ".git/refs/heads/main",
  ".git/refs/remotes/origin/main",
  ".gitignore",
  ".nojekyll",
  "README.md",
  "css/app.css",
  "datos/plan.enc",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/icon.svg",
  "index.html",
  "js/actualizacion.js",
  "js/calculos.js",
  "js/cifrado.js",
  "js/componentes.js",
  "js/datos.js",
  "js/formularios.js",
  "js/hoja.js",
  "js/main.js",
  "js/planilla.js",
  "js/registros.js",
  "js/tema.js",
  "js/util.js",
  "js/videos.js",
  "js/vistas/comidas.js",
  "js/vistas/entreno.js",
  "js/vistas/hoy.js",
  "js/vistas/plan.js",
  "js/vistas/registro.js",
  "js/xlsx.js",
  "manifest.webmanifest"
];
// GENERADO>>

const CACHE = PREFIJO + VERSION;
const url = (ruta) => new URL(ruta, self.registration.scope).href;

self.addEventListener("install", (ev) => {
  // «reload» evita que se guarde una copia vieja que tenga el caché del navegador. Si falta un archivo, no se instala nada.
  // Los datos son plan.json (solo en la computadora, sin cifrar) o plan.enc (publicado): el que no exista no impide instalar.
  const pedir = (a) => new Request(url(a), { cache: "reload" });
  ev.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(ARCHIVOS.filter((a) => !a.startsWith("datos/")).map(pedir));
    await Promise.all(ARCHIVOS.filter((a) => a.startsWith("datos/")).map((a) => c.add(pedir(a)).catch(() => {})));
    if (!(await c.keys()).some((r) => r.url.includes("/datos/"))) throw new Error("No se pudieron guardar los datos del plan.");
  }));
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(PREFIJO) && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (ev) => {
  const pedido = ev.request;
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== self.location.origin) return;
  ev.respondWith((async () => {
    // Toda navegación abre index.html (la ruta va en el #, y ?fecha=… solo sirve para probar).
    const clave = pedido.mode === "navigate" ? url("index.html") : pedido;
    const guardado = await (await caches.open(CACHE)).match(clave, { ignoreSearch: true });
    return guardado ?? fetch(pedido);
  })());
});

self.addEventListener("message", (ev) => {
  if (ev.data?.tipo === "SALTEAR_ESPERA") self.skipWaiting();
  if (ev.data?.tipo === "VERSION") ev.ports[0]?.postMessage(VERSION);
});

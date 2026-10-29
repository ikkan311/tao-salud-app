// Service worker: guarda la app y los datos en el celular para usarla sin conexión.
// Los videos (YouTube y Drive) son de otro sitio: no se guardan ni se tocan.
//
// Cómo se actualiza: una versión nueva se instala en segundo plano y queda «en espera». La app muestra el botón «Actualizar» y
// recién al tocarlo se activa (mensaje SALTEAR_ESPERA). Nunca cambia sola. La lista de archivos y la versión las escribe
// scripts/actualizar_sw.py; la versión es un hash de todos los archivos, así que app y datos cambian siempre juntos.

const PREFIJO = "tao-salud-";

// <<GENERADO por scripts/actualizar_sw.py: no editar a mano
const VERSION = "4e0179b2f6";
const ARCHIVOS = [
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

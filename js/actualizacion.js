// Service worker de la app: registro, aviso de versión nueva con el botón «Actualizar» e instalación en Android.
// Una versión nueva nunca se activa sola: queda en espera hasta que se toca «Actualizar» (ver app/sw.js).

import { esc } from "./util.js";

// Lo que muestra la pantalla Plan. Cada cambio avisa con el evento "app-estado" en document.
export const estadoApp = {
  soporta: "serviceWorker" in navigator,
  lista: false,          // el service worker está activo: la app y los datos ya están guardados
  version: null,
  hayNueva: false,       // hay una versión descargada esperando el «Actualizar»
  instalada: matchMedia("(display-mode: standalone)").matches,
  puedeInstalar: false,  // Chrome ofreció instalarla (evento beforeinstallprompt)
};

let registro = null;
let recargarAlCambiar = false;
let ofertaInstalar = null;
const cambio = () => document.dispatchEvent(new CustomEvent("app-estado"));

// ---------------------------------------------------------------- barra «Actualizar»

function mostrarBarra() {
  if (document.getElementById("barra-actualizar")) return;
  const barra = document.createElement("div");
  barra.id = "barra-actualizar";
  barra.className = "barra-actualizar";
  barra.setAttribute("role", "status");
  barra.innerHTML = `<span>Hay una versión nueva de la app.</span><button type="button" class="btn" data-actualizar>Actualizar</button>`;
  barra.querySelector("button").addEventListener("click", actualizar);
  document.body.prepend(barra);
  document.body.classList.add("con-barra-actualizar");
}

function hayVersionNueva() {
  estadoApp.hayNueva = true;
  mostrarBarra();
  cambio();
}

// Activa la versión que está en espera y recarga. Los registros están en IndexedDB y no se tocan.
export function actualizar() {
  const boton = document.querySelector("[data-actualizar]");
  if (boton) { boton.disabled = true; boton.textContent = "Actualizando…"; }
  recargarAlCambiar = true;
  if (registro?.waiting) registro.waiting.postMessage({ tipo: "SALTEAR_ESPERA" });
  else location.reload();
}

// Pregunta al service worker qué versión es (con mensaje y respuesta por un canal).
function pedirVersion(sw) {
  return new Promise((ok) => {
    const canal = new MessageChannel();
    const t = setTimeout(() => ok(null), 1500);
    canal.port1.onmessage = (ev) => { clearTimeout(t); ok(ev.data); };
    sw.postMessage({ tipo: "VERSION" }, [canal.port2]);
  });
}

async function leerVersion() {
  const sw = navigator.serviceWorker.controller ?? registro?.active;
  if (!sw) return;
  estadoApp.version = await pedirVersion(sw);
  cambio();
}

// Busca una versión nueva. Devuelve "sin-conexion", "nueva" o "al-dia".
export async function buscarActualizacion() {
  if (!estadoApp.soporta || !registro) return "al-dia";
  if (!navigator.onLine) return "sin-conexion";
  try {
    await registro.update();
    // update() devuelve cuando empezó la instalación: se espera a que termine.
    const instalando = registro.installing;
    if (instalando && instalando.state !== "installed") {
      await new Promise((ok) => {
        const t = setTimeout(ok, 20000);
        instalando.addEventListener("statechange", () => { if (["installed", "redundant"].includes(instalando.state)) { clearTimeout(t); ok(); } });
      });
    }
  } catch {
    return "sin-conexion";
  }
  return registro.waiting ? "nueva" : "al-dia";
}

// ---------------------------------------------------------------- instalación en Android

window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  ofertaInstalar = ev;
  estadoApp.puedeInstalar = true;
  cambio();
});

window.addEventListener("appinstalled", () => {
  ofertaInstalar = null;
  Object.assign(estadoApp, { instalada: true, puedeInstalar: false });
  cambio();
});

export async function instalar() {
  if (!ofertaInstalar) return null;
  ofertaInstalar.prompt();
  const { outcome } = await ofertaInstalar.userChoice;
  ofertaInstalar = null;
  estadoApp.puedeInstalar = false;
  cambio();
  return outcome;
}

// ---------------------------------------------------------------- arranque

export async function iniciar() {
  if (!estadoApp.soporta) return;
  try {
    // Si ya está registrado se usa ese registro: con la app instalada y sin conexión, register() se queda esperando
    // (Chrome intenta volver a bajar sw.js) y trabaría todo lo demás.
    registro = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("sw.js"));
  } catch (e) {
    console.warn("No se pudo registrar el service worker:", e.message);
    return;
  }
  // Una versión nueva se avisa solo si ya había una instalada (la primera vez no hay nada que «actualizar»).
  const avisarSiHayControl = () => { if (navigator.serviceWorker.controller) hayVersionNueva(); };
  if (registro.waiting) avisarSiHayControl();
  registro.addEventListener("updatefound", () => {
    const nuevo = registro.installing;
    nuevo.addEventListener("statechange", () => { if (nuevo.state === "installed") avisarSiHayControl(); });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recargarAlCambiar) location.reload();
    else { estadoApp.lista = true; leerVersion(); }
  });
  await navigator.serviceWorker.ready;
  estadoApp.lista = true;
  await leerVersion();
  // Busca versiones nuevas al abrir y cada vez que se vuelve a la app, si hay conexión.
  const buscar = () => { if (navigator.onLine) registro.update().catch(() => {}); };
  buscar();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") buscar(); });
  window.addEventListener("online", buscar);
}

// Sección «La app» de la pantalla Plan.
export function seccionApp() {
  const e = estadoApp;
  const sinConexion = !e.soporta ? "Este navegador no permite guardar la app para usarla sin conexión."
    : e.lista ? "Lista: la app y los datos están guardados en este celular. Sin conexión anda todo, menos los videos."
      : "Todavía no está lista. Abrí la app una vez con conexión y esperá unos segundos.";
  const instalacion = e.instalada ? "Instalada en este celular."
    : e.puedeInstalar ? `<button type="button" class="btn" data-instalar>Instalar en el celular</button>`
      : "Para instalarla: en Chrome tocá los tres puntos de arriba a la derecha y elegí «Instalar app» (o «Agregar a la pantalla principal»).";
  return `<section class="tarjeta" id="la-app"><h2>La app</h2>
    <dl class="datos">
      <dt>Sin conexión</dt><dd>${sinConexion}</dd>
      <dt>Versión</dt><dd>${e.version ? esc(e.version) : "—"}${e.hayNueva ? ` · <strong>hay una versión nueva</strong>` : ""}</dd>
      <dt>Instalación</dt><dd>${instalacion}</dd>
    </dl>
    ${e.hayNueva ? `<button type="button" class="btn" data-actualizar-plan>Actualizar</button>`
      : `<button type="button" class="btn btn-secundario" data-buscar-act>Buscar actualización</button>`}
  </section>`;
}

// Videos de la ficha de un ejercicio: hasta 3, de a uno por vez, con flechas, deslizamiento y «1 de 3».
// YouTube es la primera opción (arranca en video_inicio y corta en video_fin). El link de Drive (`respaldo`, ya recortado)
// se usa solo si la opción no tiene video_id o si YouTube avisa que no puede reproducirla.

import { esc, icono } from "./util.js";
import { ejercicio } from "./datos.js";
import { videoQuitado, quitarVideo } from "./registros.js";

// Los links de Drive para compartir (.../view o open?id=) no se pueden incrustar: se usa la versión /preview.
export function urlIncrustable(url) {
  if (!url) return "";
  const m = url.match(/^https:\/\/drive\.google\.com\/(?:file\/d\/([\w-]+)|open\?(?:[^#]*&)?id=([\w-]+))/);
  return m ? `https://drive.google.com/file/d/${m[1] ?? m[2]}/preview` : url;
}

const ORIGEN_YT = "https://www.youtube-nocookie.com";
const hay = (v) => v != null && v !== "";

export const urlYoutube = (v) => `${ORIGEN_YT}/embed/${v.video_id}?`
  + (hay(v.video_inicio) ? `start=${v.video_inicio}&` : "") + (hay(v.video_fin) ? `end=${v.video_fin}&` : "")
  + `rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;

const urlAbrirYoutube = (v) => `https://www.youtube.com/watch?v=${v.video_id}` + (hay(v.video_inicio) ? `&t=${v.video_inicio}s` : "");

const visibles = (e) => (e.videos ?? []).filter((v) => !videoQuitado(e.id, v.opcion));

// Lo que se ve en el cuadro del reproductor: aviso, o botón «Reproducir» para el video actual.
function cuadro(v, modo) {
  const aviso = (txt, extra = "") => `<div class="video-placeholder">${icono("video")}<span>${txt}</span>${extra}</div>`;
  if (modo === "error") {
    return aviso("Este video no se puede reproducir en la app.",
      v.video_id ? `<a class="button secondary" href="${esc(urlAbrirYoutube(v))}" target="_blank" rel="noopener">Abrir en YouTube</a>` : "");
  }
  if (!navigator.onLine) return aviso("Video disponible con conexión");
  return `<div class="video-placeholder">${icono("video")}<button type="button" class="button" data-vc="reproducir">Reproducir video</button></div>`;
}

function pie(v, i, n) {
  return `<div class="video-info" data-vc-deslizar>
      <strong>${i + 1} de ${n}${v.canal ? ` · ${esc(v.canal)}` : ""}</strong>
      ${v.titulo ? `<span>${esc(v.titulo)}</span>` : ""}${v.notas ? `<small>${esc(v.notas)}</small>` : ""}
    </div>
    <button type="button" class="video-quitar" data-vc="quitar">Quitar este video</button>`;
}

function interior(e) {
  const vs = visibles(e);
  const quitados = (e.videos ?? []).length - vs.length;
  const restaurar = quitados
    ? `<div class="video-restaurar"><span>${quitados === 1 ? "1 video quitado" : `${quitados} videos quitados`}</span><button type="button" class="video-quitar" data-vc="restaurar">Restaurar</button></div>`
    : "";
  const etiqueta = `<div class="video-badges">${e.video_estado !== "aprobado" ? `<span class="badge warning">sin revisar</span>` : `<span class="badge">aprobado</span>`}</div>`;
  if (!vs.length) return `<div class="video-placeholder">${icono("video")}<span>Video pendiente</span></div>${restaurar}${etiqueta}`;
  const flechas = vs.length > 1
    ? `<button type="button" class="video-flecha izq" data-vc="ant" aria-label="Video anterior">${icono("izq")}</button>
       <button type="button" class="video-flecha der" data-vc="sig" aria-label="Video siguiente">${icono("der")}</button>`
    : "";
  return `<div class="video-carrusel" data-i="0">
      <div class="video-escena" data-vc-escena data-vc-deslizar>${cuadro(vs[0])}${flechas}</div>
      <div data-vc-pie>${pie(vs[0], 0, vs.length)}</div>
    </div>${restaurar}${etiqueta}`;
}

export const bloqueVideo = (e) => `<div class="video-bloque" data-ejercicio="${esc(e.id)}">${interior(e)}</div>`;

// ---- Comportamiento (un solo juego de eventos para todas las fichas) ----

const bloqueDe = (el) => el.closest(".video-bloque");
const actual = (b) => {
  const e = ejercicio(b.dataset.ejercicio);
  const c = b.querySelector(".video-carrusel");
  const vs = visibles(e);
  return { e, c, vs, i: c ? Math.min(Number(c.dataset.i), vs.length - 1) : 0 };
};

function pintar(b, { modo } = {}) {
  const { c, vs, i } = actual(b);
  c.dataset.i = i;
  const escena = c.querySelector("[data-vc-escena]");
  escena.querySelector("iframe")?.remove(); // sacar el iframe del video anterior lo detiene
  escena.querySelector(".video-placeholder")?.remove();
  escena.insertAdjacentHTML("afterbegin", cuadro(vs[i], modo));
  c.querySelector("[data-vc-pie]").innerHTML = pie(vs[i], i, vs.length);
  c.dataset.fuente = "";
}

function ponerIframe(b, src, fuente) {
  const c = b.querySelector(".video-carrusel");
  const escena = c.querySelector("[data-vc-escena]");
  escena.querySelector(".video-placeholder")?.remove();
  escena.querySelector("iframe")?.remove();
  const f = document.createElement("iframe");
  f.className = "video-frame";
  f.title = "Video del ejercicio";
  f.allow = "encrypted-media; picture-in-picture";
  f.allowFullscreen = true;
  // Para que YouTube avise por postMessage si no puede reproducir el video (sin cargar su script).
  if (fuente === "yt") f.addEventListener("load", () => f.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), ORIGEN_YT));
  f.src = src;
  escena.insertAdjacentElement("afterbegin", f);
  c.dataset.fuente = fuente;
}

function reproducir(b) {
  const { vs, i } = actual(b);
  const v = vs[i];
  if (v.video_id) return ponerIframe(b, urlYoutube(v), "yt");
  const drive = urlIncrustable(v.respaldo);
  if (drive) return ponerIframe(b, drive, "drive");
  pintar(b, { modo: "error" });
}

// Si YouTube falla: pasa solo al respaldo de Drive de esa opción; si no hay, avisa.
function falloYoutube(b) {
  const { vs, i } = actual(b);
  const drive = urlIncrustable(vs[i]?.respaldo);
  if (drive) ponerIframe(b, drive, "drive"); else pintar(b, { modo: "error" });
}

window.addEventListener("message", (ev) => {
  if (ev.origin !== ORIGEN_YT) return;
  let d;
  try { d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch { return; }
  if (d?.event !== "onError") return;
  const f = [...document.querySelectorAll(".video-carrusel iframe")].find((x) => x.contentWindow === ev.source);
  const b = f && bloqueDe(f);
  if (b && b.querySelector(".video-carrusel").dataset.fuente === "yt") falloYoutube(b);
});

function mover(b, paso) {
  const { c, vs, i } = actual(b);
  if (vs.length < 2) return;
  c.dataset.i = (i + paso + vs.length) % vs.length;
  pintar(b);
}

let armado = null; // «Quitar» pide tocar dos veces, sin ventanas del navegador
document.addEventListener("click", async (ev) => {
  const t = ev.target.closest("[data-vc]");
  const b = t && bloqueDe(t);
  if (!b) return;
  const acc = t.dataset.vc;
  if (acc === "reproducir") reproducir(b);
  else if (acc === "ant") mover(b, -1);
  else if (acc === "sig") mover(b, 1);
  else if (acc === "quitar") {
    if (armado !== t) {
      armado = t;
      t.textContent = "Tocá de nuevo para quitarlo";
      t.classList.add("armado");
      setTimeout(() => { if (armado === t) { armado = null; t.textContent = "Quitar este video"; t.classList.remove("armado"); } }, 4000);
      return;
    }
    armado = null;
    const { e, vs, i } = actual(b);
    await quitarVideo(e.id, vs[i].opcion, true);
    b.innerHTML = interior(e);
  } else if (acc === "restaurar") {
    const e = ejercicio(b.dataset.ejercicio);
    for (const v of e.videos) await quitarVideo(e.id, v.opcion, false);
    b.innerHTML = interior(e);
  }
});

// Deslizar con el dedo sobre el cuadro (antes de reproducir) o sobre el texto del video.
// Con el video en reproducción el iframe se queda con los toques: ahí se usan las flechas.
let toque = null;
document.addEventListener("touchstart", (ev) => {
  const z = ev.target.closest("[data-vc-deslizar]");
  toque = z && ev.touches.length === 1 ? { x: ev.touches[0].clientX, y: ev.touches[0].clientY, b: bloqueDe(z) } : null;
}, { passive: true });
document.addEventListener("touchend", (ev) => {
  if (!toque) return;
  const dx = ev.changedTouches[0].clientX - toque.x, dy = ev.changedTouches[0].clientY - toque.y;
  const b = toque.b;
  toque = null;
  if (b && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) mover(b, dx < 0 ? 1 : -1);
}, { passive: true });

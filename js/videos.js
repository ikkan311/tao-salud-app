// Videos de la ficha de un ejercicio: hasta 3, de a uno por vez, con flechas (debajo del video), deslizamiento y «1 de 3».
// Con conexión, el video aparece directo con su vista previa y su botón de play (el reproductor de YouTube, sin arrancar solo).
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

// `fullscreen` en allow: sin eso el video no puede pasar a pantalla completa ni girar con el celular.
const frame = (src, fuente) => `<iframe class="video-frame" data-fuente="${fuente}" title="Video del ejercicio" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen src="${esc(src)}"></iframe>`;

// Lo que se ve en el cuadro del reproductor: el video con su vista previa, o un aviso si no se puede.
function cuadro(v, modo) {
  const aviso = (txt, extra = "") => `<div class="video-placeholder">${icono("video")}<span>${txt}</span>${extra}</div>`;
  if (modo === "error") {
    return aviso("Este video no se puede reproducir en la app.",
      v.video_id ? `<a class="button secondary" href="${esc(urlAbrirYoutube(v))}" target="_blank" rel="noopener">Abrir en YouTube</a>` : "");
  }
  if (!navigator.onLine) return aviso("Video disponible con conexión");
  if (v.video_id) return frame(urlYoutube(v), "yt");
  const drive = urlIncrustable(v.respaldo);
  return drive ? frame(drive, "drive") : aviso("Video pendiente");
}

// Fila de navegación debajo del video (las flechas no tapan el video) y datos del video.
function pie(v, i, n) {
  const flecha = (acc, ico, txt) => `<button type="button" class="video-flecha" data-vc="${acc}" aria-label="${txt}">${icono(ico)}</button>`;
  return `<div class="video-nav">${n > 1 ? flecha("ant", "izq", "Video anterior") : ""}
      <strong>${i + 1} de ${n}${v.canal ? ` · ${esc(v.canal)}` : ""}</strong>${n > 1 ? flecha("sig", "der", "Video siguiente") : ""}</div>
    <div class="video-info" data-vc-deslizar>
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
  return `<div class="video-carrusel" data-i="0">
      <div class="video-escena" data-vc-escena data-vc-deslizar>${cuadro(vs[0])}</div>
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

function mostrar(b, html) {
  const { c, vs, i } = actual(b);
  c.dataset.i = i;
  const escena = c.querySelector("[data-vc-escena]");
  escena.querySelector("iframe")?.remove(); // sacar el iframe del video anterior lo detiene
  escena.querySelector(".video-placeholder")?.remove();
  escena.insertAdjacentHTML("afterbegin", html);
  c.querySelector("[data-vc-pie]").innerHTML = pie(vs[i], i, vs.length);
}

const pintar = (b, { modo } = {}) => mostrar(b, cuadro(actual(b).vs[actual(b).i], modo));

// Para que YouTube avise por postMessage si no puede reproducir el video (sin cargar su script).
document.addEventListener("load", (ev) => {
  const f = ev.target;
  if (f?.matches?.('iframe[data-fuente="yt"]')) f.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), ORIGEN_YT);
}, true);

// Si YouTube falla: pasa solo al respaldo de Drive de esa opción; si no hay, avisa.
function falloYoutube(b) {
  const { vs, i } = actual(b);
  const drive = urlIncrustable(vs[i]?.respaldo);
  if (drive) mostrar(b, frame(drive, "drive")); else pintar(b, { modo: "error" });
}

window.addEventListener("message", (ev) => {
  if (ev.origin !== ORIGEN_YT) return;
  let d;
  try { d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data; } catch { return; }
  if (d?.event !== "onError") return;
  const f = [...document.querySelectorAll(".video-carrusel iframe")].find((x) => x.contentWindow === ev.source);
  const b = f && bloqueDe(f);
  if (b && f.dataset.fuente === "yt") falloYoutube(b);
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
  if (acc === "ant") mover(b, -1);
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

// Deslizar con el dedo sobre el texto del video. Sobre el video el iframe se queda con los toques: ahí se usan las flechas.
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

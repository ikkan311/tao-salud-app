// Piezas de interfaz que usan varias pantallas.

import { esc, md, icono, num, fechaBreve } from "./util.js";
import { plan, ejercicio, alarmaDe, totalMenu, alimentosMenu } from "./datos.js";
import { bloqueVideo } from "./videos.js";

// Barra de fecha: día anterior, selector de fecha, día siguiente y «Hoy». `extra` ya no se usa (queda por las pantallas sin convertir).
export function navFecha(fecha) {
  const c = plan.calendario;
  const prev = `<button type="button" class="icon-button" data-fecha-mover="-1" aria-label="Día anterior"${fecha > c[0].fecha ? "" : " disabled"}>${icono("izq")}</button>`;
  const sig = `<button type="button" class="icon-button" data-fecha-mover="1" aria-label="Día siguiente"${fecha < c[c.length - 1].fecha ? "" : " disabled"}>${icono("der")}</button>`;
  return `<div class="date-bar">${prev}
    <div class="date-control"><label for="fecha-selector">${icono("calendario")}<span>${esc(fechaBreve(fecha))}</span>${icono("abajo")}</label>
      <input type="date" id="fecha-selector" value="${esc(fecha)}" min="${c[0].fecha}" max="${c[c.length - 1].fecha}" aria-label="Elegir fecha"></div>
    ${sig}<button type="button" class="text-button" data-ir-hoy>Hoy</button></div>`;
}

// Título de pantalla: línea superior, nombre y bajada.
export const titulo = (eyebrow, h1, lede = "") => `<header class="page-heading"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(h1)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ""}</header>`;

export function pastillaTipo(tipo) {
  return tipo === "fuerza" ? `<span class="pastilla pastilla-fuerza">Fuerza</span>` : `<span class="pastilla pastilla-ayuno">Ayuno</span>`;
}

// Fila de ejercicio de Rutina, Pausas o Registro. Toca y abre la ficha.
export function filaEjercicio(r, { detalle = true } = {}) {
  const e = ejercicio(r.ejercicio_id);
  const partes = [];
  const series = r.series ?? r.series_plan;
  const reps = r.reps ?? r.reps_plan;
  if (series && reps) partes.push(`${series} × ${esc(reps)}`);
  else if (reps) partes.push(esc(reps));
  if (r.duracion) partes.push(esc(r.duracion));
  if (r.descanso_seg) partes.push(`descanso ${r.descanso_seg} s`);
  if (r.tempo && r.tempo !== "—") partes.push(`tempo ${esc(r.tempo)}`);
  const rpe = r.rpe_plan ?? r.rpe;
  if (rpe) partes.push(`RPE ${esc(rpe)}`);
  const texto = r.progresion ?? r["indicación"] ?? r.notas;
  return `<li class="ej">
    <a class="ej-cab" href="#/ejercicio/${esc(r.ejercicio_id)}">
      <span class="ej-id">${esc(r.ejercicio_id)}</span>
      <span class="ej-nombre">${esc(r.nombre ?? e?.nombre)}</span>
      ${icono("der", "ej-flecha")}
    </a>
    ${partes.length ? `<div class="ej-meta">${partes.join(" · ")}</div>` : ""}
    ${detalle && texto ? `<details class="mini ej-indic"><summary>Indicaciones</summary><div class="ej-texto">${md(texto)}</div></details>` : ""}
  </li>`;
}

export const listaEjercicios = (filas, op) => `<ul class="ejs">${filas.map((r) => filaEjercicio(r, op)).join("")}</ul>`;

// Los links de Drive para compartir (.../view o open?id=) no se pueden incrustar: se usa la versión /preview.
export function urlIncrustable(url) {
  if (!url) return "";
  const m = url.match(/^https:\/\/drive\.google\.com\/(?:file\/d\/([\w-]+)|open\?(?:[^#]*&)?id=([\w-]+))/);
  return m ? `https://drive.google.com/file/d/${m[1] ?? m[2]}/preview` : url;
}

const CAMPOS_FICHA = [
  ["posicion_inicial", "Posición inicial"], ["ejecucion", "Ejecución"], ["respiracion", "Respiración"], ["tempo", "Tempo"],
  ["rango", "Rango"], ["puntos_clave", "Puntos clave"], ["errores", "Errores"], ["cuidado_rodilla", "Cuidado de rodilla"],
  ["cuidado_abdomen", "Cuidado del abdomen"], ["senales_stop", "Señales para cortar"],
];

// «Señales de alarma» y «Alternativa más segura» de un ejercicio (Etapa 6 y notas de control), si tiene.
export function seguridadEjercicio(id) {
  const a = alarmaDe(id);
  if (!a) return "";
  return `<section class="detail-section danger"><h3>Señales de alarma</h3><p>${esc(a["Señales de alarma"])}</p></section>
    <section class="detail-section"><h3>Alternativa más segura</h3><p>${esc(a["Alternativa más segura"])}</p></section>`;
}

export function fichaEjercicio(e) {
  const enlace = (id) => (id && ejercicio(id)
    ? `<button type="button" class="exercise-link" data-hoja="ejercicio" data-ejercicio="${esc(id)}">${icono("der")}<span>${esc(ejercicio(id).nombre)}<small>${esc(id)}</small></span></button>`
    : `<p>${esc(id ?? "pendiente")}</p>`);
  const pend = (v) => (v ? esc(v) : "pendiente");
  return `<div class="badges"><span class="badge">${esc(e.id)}</span><span class="badge neutral">${esc(e.categoria ?? "pendiente")}</span></div>
    <h3 class="exercise-detail-title">${esc(e.nombre)}</h3>
    <p class="small muted">${pend(e.musculos)}</p>
    <dl class="field-list"><div><dt>Equipamiento</dt><dd>${pend(e.equipamiento)}</dd></div><div><dt>Nivel</dt><dd>${pend(e.nivel)}</dd></div><div><dt>Fases</dt><dd>${pend(e.fases)}</dd></div></dl>
    ${bloqueVideo(e)}
    ${CAMPOS_FICHA.map(([k, t]) => `<section class="detail-section${k === "senales_stop" ? " danger" : ""}"><h3>${t}</h3>${e[k] ? md(e[k]) : `<p>pendiente</p>`}</section>`).join("")}
    ${seguridadEjercicio(e.id)}
    <section class="detail-section"><h3>Regresión</h3>${enlace(e.regresion_id)}</section>
    <section class="detail-section"><h3>Progresión</h3>${enlace(e.progresion_id)}</section>
    ${e.video_notas ? `<section class="detail-section"><h3>Notas del video</h3>${md(e.video_notas)}</section>` : ""}`;
}

// Semáforo (hernia o rodilla) como tarjetas con el color escrito.
export function semaforo(filas) {
  return filas.map((f) => `<article class="traffic-card" data-color="${esc(f.Color)}"><h4>${esc(f.Color)}</h4><p>${esc(f["Cómo se ve"])}</p>
    <p class="action-label">Qué hacer</p><p>${esc(f["Qué hacer"])}</p></article>`).join("");
}

export function macros(t) {
  if (!t) return `<span class="pendiente">pendiente</span>`;
  const col = (rot, v, u = "") => `<div><span>${rot}</span><strong>${num(v)} <small>${u}</small></strong></div>`;
  return `<div class="macro-row">${col("kcal", t.kcal)}${col("Proteína", t.proteina_g, "g")}${col("Carbos", t.carbos_g, "g")}${col("Grasas", t.grasas_g, "g")}</div>`;
}

// Contenido del diálogo «Señales de alarma»: guardia, semáforos y ejercicios con riesgo moderado.
export function htmlAlarma() {
  return `<div class="danger-panel">${md(plan.guardia_md, { nivelBase: 1 })}</div>
    ${desplegable("Semáforo de la hernia", semaforo(plan.semaforos.hernia))}
    ${desplegable("Semáforo de la rodilla (umbral 3/10)", semaforo(plan.semaforos.rodilla))}
    ${desplegable("Ejercicios con riesgo moderado", [...plan.metas.alarmas_control, ...plan.alarmas_ejercicios].map((a) => `<div class="routine-item"><p><strong>${esc(a.ID)} · ${esc(a.Riesgo)}</strong></p>
      <p class="small">${esc(a["Señales de alarma"])}</p><p class="small"><strong>Alternativa más segura:</strong> ${esc(a["Alternativa más segura"])}</p></div>`).join(""))}
    <p class="source-note">Fuente: etapa6_definitiva.md · Guardia y semáforos</p>`;
}

// Opción de una comida del menú como desplegable: macros, alimentos con gramos, preparación y detalle por alimento.
export function opcionMenu(dia, comida, opcion, { abierta = false, extra = "" } = {}) {
  const t = totalMenu(dia, comida, opcion);
  const ing = alimentosMenu(dia, comida, opcion);
  if (!t || !ing.length) return "";
  const prep = plan.menu_opciones.find((m) => m.clave === t.clave)?.preparacion;
  return `<details class="disclosure" data-recordar="op-${esc(`${dia}-${comida}-${opcion}`)}"${abierta ? " open" : ""}>
    <summary><span class="option-heading"><span class="option-tag">Opción ${esc(opcion)}</span><span>${esc(t.plato.replace(/^P\d+ · /, ""))}</span></span></summary>
    <div class="disclosure-body">${macros(t)}
      <ul class="food-list">${ing.map((r) => `<li><span>${esc(r.alimento)}<small>${esc(r["estado (crudo o cocido)"])}</small></span><span class="food-grams">${num(r.gramos)} g</span></li>`).join("")}</ul>
      <div class="preparation"><h4>Preparación</h4>${prep ? md(prep) : `<p class="pendiente">pendiente</p>`}</div>
      <details class="mini"><summary>Detalle de kcal y macros por alimento</summary>${ing.map((r) => `<p class="small"><strong>${esc(r.alimento)}</strong><br>${num(r.kcal, 1)} kcal · ${num(r.proteina_g, 1)} g proteína · ${num(r.carbos_g, 1)} g carbos · ${num(r.grasas_g, 1)} g grasas</p>`).join("")}</details>
      ${extra}
    </div></details>`;
}

// Desplegable con el aspecto de Codex. `resumen` y `cuerpo` ya son HTML.
export const desplegable = (resumen, cuerpo, { abierto = false, recordar = "" } = {}) =>
  `<details class="disclosure"${recordar ? ` data-recordar="${esc(recordar)}"` : ""}${abierto ? " open" : ""}><summary>${resumen}</summary><div class="disclosure-body">${cuerpo}</div></details>`;

// Aviso (azul) o advertencia (ámbar) con ícono.
export const aviso = (html, advertencia = false) => `<div class="notice${advertencia ? " warning" : ""}">${icono(advertencia ? "alerta" : "info")}<div>${html}</div></div>`;

// Fila de enlace que abre un diálogo, con su ícono. Van dentro de tarjetaEnlaces().
export const enlaceHoja = (titulo, sub, datos, ico = "lista") =>
  `<button type="button" class="section-link" ${Object.entries(datos).map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}>${icono(ico)}<span><strong>${esc(titulo)}</strong>${sub ? `<small>${esc(sub)}</small>` : ""}</span>${icono("der")}</button>`;
export const tarjetaEnlaces = (filas) => `<div class="card link-card">${filas}</div>`;

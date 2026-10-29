// Entreno: la sesión de fuerza de la fecha según Registro (con la carga en un diálogo), o las actividades del día si no hay fuerza.

import { esc, md, oracion, num, icono, fechaLarga } from "../util.js";
import { plan, diaPlan, sesionDe, rutinaDe, alarmaDe, metaFuerzaDe, proximaSesion } from "../datos.js";
import { navFecha, titulo, listaEjercicios, desplegable, aviso, enlaceHoja, tarjetaEnlaces, seguridadEjercicio } from "../componentes.js";
import { claveRegistro, valor, vacio } from "../registros.js";
import { cargaAnterior } from "../calculos.js";

// Texto de la Etapa 1, sección 5, copiado tal cual.
const CORTAR = "Ante cualquier señal se corta la serie y se pasa a la alternativa.";

const dato = (etiqueta, valor, unidad = "") =>
  `<div class="metric"><span>${etiqueta}</span><strong>${vacio(valor) ? `<span class="pending-value">pendiente</span>` : `${esc(typeof valor === "number" ? num(valor, valor % 1 ? 1 : 0) : valor)}${unidad ? ` <small>${unidad}</small>` : ""}`}</strong></div>`;

function tarjetaEjercicio(it, i, rutina, s) {
  const r = rutina.find((x) => x.ejercicio_id === it.ejercicio_id);
  const a = alarmaDe(it.ejercicio_id);
  const meta = metaFuerzaDe(it.ejercicio_id);
  const clave = claveRegistro(s.fecha, it.ejercicio_id);
  const v = (k) => valor("registro", clave, k);
  const ant = cargaAnterior(it.fila);
  const cargado = ["carga_kg", "rpe", "reps_s1", "tipo_carga"].some((k) => !vacio(v(k)));
  const cortar = v("apnea") === "si" || v("abombamiento") === "si";
  const unidad = it.unidad === "segundos" ? "seg." : "reps";
  const resumen = `<span class="exercise-order">${String(i + 1).padStart(2, "0")}</span><span class="exercise-summary"><small>${esc(it.ejercicio_id)}${meta ? " · control" : ""}</small><strong>${esc(it.nombre)}</strong>
    <span class="plan-prescription">${esc(it.series_plan)} series · ${esc(it.reps_plan)} ${unidad} · RPE ${esc(it.rpe_plan)}</span></span>`;
  const cuerpo = `${it.notas ? aviso(`<p>${esc(it.notas)}</p>`) : ""}
    <div class="button-group"><button type="button" class="button secondary" data-hoja="ejercicio" data-ejercicio="${esc(it.ejercicio_id)}">${icono("video")} Ficha y video</button></div>
    <dl class="datos">
      ${r?.tempo ? `<dt>Tempo</dt><dd>${esc(r.tempo)}</dd>` : ""}
      ${r?.descanso_seg ? `<dt>Descanso</dt><dd>${esc(r.descanso_seg)} s</dd>` : ""}
      ${meta ? `<dt>Meta día 90</dt><dd>${esc(meta["Día 90"])}</dd>` : ""}
    </dl>
    ${r?.progresion ? `<div class="ej-texto">${md(r.progresion)}</div>` : ""}
    <div class="metrics">
      ${dato("Carga anterior", ant?.carga ?? "", "kg")}${dato("Carga actual", v("carga_kg"), "kg")}
      ${dato("RPE", v("rpe"))}${dato("Tipo de carga", v("tipo_carga"))}
    </div>
    ${cortar ? aviso(`<p><strong>Cortá la serie.</strong> ${esc(CORTAR)}</p>${a ? `<p><strong>Alternativa:</strong> ${esc(a["Alternativa más segura"])}</p>` : ""}`, true) : ""}
    <button type="button" class="button full" data-hoja="serie" data-ejercicio="${esc(it.ejercicio_id)}">${cargado ? "Editar ejercicio" : "Cargar ejercicio"}</button>
    ${seguridadEjercicio(it.ejercicio_id)}`;
  return desplegable(resumen, cuerpo, { recordar: `ej-${it.ejercicio_id}` });
}

const enlacesFinales = () => tarjetaEnlaces(`${enlaceHoja("Reglas de progresión", "Series, cargas y descargas", { hoja: "regla", clave: "progresion" }, "diana")}
  ${enlaceHoja("Señales de alarma", "Guardia y semáforos", { hoja: "alarma" }, "alerta")}`);

function sinSesion(fecha, d) {
  const prox = proximaSesion(fecha);
  const bloques = plan.bloques[d.dia_semana].filter((b) => ["movilidad", "tai chi", "caminata", "sol"].includes(b.categoria));
  return `<div class="empty">${icono("hoja")}
      <h2>Hoy no hay sesión de fuerza</h2>
      <p>${d.tipo_dia === "ayuno" ? "Día de ayuno · " : ""}Fase ${d.fase} · Semana ${d.semana}. La fuerza va lunes, miércoles y viernes.</p>
      ${prox ? `<button type="button" class="button" data-ir-fecha="${prox.fecha}">Ver la próxima sesión: ${esc(prox.sesion)}, ${esc(fechaLarga(prox.fecha))}</button>` : ""}</div>
    <div class="section-heading"><h2>Actividades del día</h2></div>
    ${tarjetaEnlaces(bloques.map((b) => enlaceHoja(oracion(b.actividad), `${b.inicio}–${b.fin}`, { hoja: "bloque", bloque: b.id, fecha }, b.categoria === "caminata" ? "hoy" : b.categoria === "sol" ? "sol" : "hoja")).join(""))}
    ${desplegable("Rutina de movilidad", listaEjercicios(rutinaDe(d.fase, d.dia_semana, "movilidad matinal")))}
    <button type="button" class="button secondary full" data-hoja="semana" data-fecha="${esc(fecha)}">Consultar la semana de fuerza</button>
    ${enlacesFinales()}`;
}

export function vistaEntreno(fecha) {
  const d = diaPlan(fecha);
  const s = sesionDe(fecha);
  const cab = navFecha(fecha) + titulo("Movimiento con un plan", "Entreno", `${oracion(fechaLarga(fecha))}.`);
  if (!s) return cab + sinSesion(fecha, d);
  const rutFuerza = [...rutinaDe(s.fase, s.dia, "fuerza"), ...rutinaDe(s.fase, s.dia, "core")];
  // Registro ya incluye el core de la sesión; se muestra aparte solo lo que no esté.
  const enSesion = new Set(s.items.map((i) => i.ejercicio_id));
  const core = rutinaDe(s.fase, s.dia, "core").filter((r) => !enSesion.has(r.ejercicio_id));
  const bf = plan.bloques[d.dia_semana].find((b) => b.categoria === "fuerza");
  const descarga = plan.reglas.progresion.md.split("\n").find((l) => l.includes("Descarga (semanas 8 y 12)"));
  return `${cab}
    <section class="hero" aria-label="Sesión de hoy"><div class="hero-top"><div><p class="eyebrow">Sesión de hoy</p><h2>Sesión ${esc(s.sesion)}</h2>${bf ? `<p>${esc(bf.inicio)}–${esc(bf.fin)}</p>` : ""}</div>${icono("entreno")}</div>
      <div class="hero-footer"><span>${s.items.length} ejercicios</span><span>Fase ${s.fase} · Semana ${s.semana}</span></div></section>
    ${d.descarga && descarga ? aviso(md(descarga.replace(/^\d+\.\s*/, "")), true) : ""}
    ${d.prueba_final ? aviso("<p>Semana 13 · Prueba final. Consultá las notas de control de cada ejercicio.</p>") : ""}
    ${desplegable("Antes de empezar · calentamiento", listaEjercicios(rutinaDe(s.fase, s.dia, "calentamiento")))}
    <div class="heading-row section-heading"><h2>Tu sesión</h2><span class="badge neutral">Registrá cada ejercicio</span></div>
    ${s.items.map((it, i) => tarjetaEjercicio(it, i, rutFuerza, s)).join("")}
    ${core.length ? desplegable("Core", listaEjercicios(core)) : ""}
    ${desplegable("Recuperación activa", listaEjercicios(rutinaDe(s.fase, s.dia, "recuperación activa")))}
    ${enlacesFinales()}`;
}

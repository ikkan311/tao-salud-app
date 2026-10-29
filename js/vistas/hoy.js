// Hoy: día del plan, línea de tiempo de la semana tipo y contenido de cada bloque.

import { esc, oracion, aMin, num, icono, fechaLarga } from "../util.js";
import { plan, diaPlan, sesionDe, rutinaDe, pausa, ejercicio, totalMenu } from "../datos.js";
import { navFecha, titulo, listaEjercicios, opcionMenu } from "../componentes.js";
import { cargados, CAMPOS_DIARIO } from "../formularios.js";
import { calcularDia } from "../calculos.js";
import { valor, vacio } from "../registros.js";

const GRUPO = {
  comida: "comida", movilidad: "mov", "tai chi": "mov", caminata: "mov", "recuperación": "mov", pausa: "mov",
  fuerza: "fuerza", sol: "habito", "faciales/med": "habito",
};

function comidaDelBloque(dia, b) {
  const m = plan.menu.find((x) => x.dia === dia && x.horario === b.inicio);
  return m?.comida ?? null;
}

function contenido(d, b, i, pausasHechas) {
  const dia = d.dia_semana;
  switch (b.categoria) {
    case "movilidad":
      return listaEjercicios(rutinaDe(d.fase, dia, "movilidad matinal"));
    case "tai chi": {
      const filas = rutinaDe(d.fase, dia, "tai chi").map((r) => ({ ...r, ejercicio_id: d.taichi_id, nombre: ejercicio(d.taichi_id)?.nombre }));
      return (d.taichi_nota ? `<p class="nota">${esc(d.taichi_nota)}</p>` : "") + listaEjercicios(filas)
        + `<button type="button" class="button secondary" data-hoja="regla" data-clave="tai_chi">Ver rotación y criterios de la clase</button>`;
    }
    case "comida": {
      const comida = comidaDelBloque(dia, b);
      if (!comida) return d.tipo_dia === "ayuno" ? `<p class="nota">Ayuno hasta el almuerzo.</p>` : "";
      return [1, 2].map((o) => opcionMenu(dia, comida, o)).join("") + `<a class="enlace" href="#/comidas">Ver el día en Comidas</a>`;
    }
    case "pausa": {
      const id = d.pausas[pausasHechas];
      if (!id) return "";
      return `<p class="eyebrow">Pausa ${esc(id)} · ${b.minutos} min</p>` + listaEjercicios(pausa(id), { detalle: true });
    }
    case "fuerza": {
      const s = sesionDe(d.fecha);
      if (!s) return "";
      return `<p class="small">Sesión ${esc(s.sesion)} · ${s.items.length} ejercicios</p>`
        + `<a class="button secondary" href="#/entreno">Consultar la sesión</a>`
        + listaEjercicios(rutinaDe(d.fase, dia, "calentamiento"));
    }
    case "recuperación":
      return listaEjercicios(rutinaDe(d.fase, dia, "recuperación activa"));
    case "caminata":
      return listaEjercicios(rutinaDe(d.fase, dia, "caminata"));
    case "sol":
      return listaEjercicios(rutinaDe(d.fase, dia, "sol y Kegel"));
    case "faciales/med":
      return listaEjercicios(rutinaDe(d.fase, dia, "noche"));
    case "otro":
      if (b.actividad === "DESPERTADOR") return listaEjercicios(rutinaDe(d.fase, dia, "al levantarte"));
      return "";
    default:
      return "";
  }
}

// Contenido de un bloque suelto (para el diálogo «Bloque del día»).
export function contenidoBloque(fecha, id) {
  const d = diaPlan(fecha);
  const bloques = plan.bloques[d.dia_semana];
  const i = bloques.findIndex((b) => b.id === id);
  if (i < 0) return null;
  const b = bloques[i];
  const pausasAntes = bloques.slice(0, i).filter((x) => x.categoria === "pausa").length;
  const html = contenido(d, b, i, pausasAntes);
  return { b, html: html || `<p class="small">${esc(b.actividad)} · ${esc(b.inicio)}–${esc(b.fin)} · ${b.minutos} min</p>` };
}

function suplementosDelDia(d) {
  const col = d.tipo_dia === "fuerza" ? "Lunes, miércoles y viernes (fuerza)"
    : ["Sábado", "Domingo"].includes(d.dia_semana) ? "Sábado y domingo (ayuno)" : "Martes y jueves (ayuno)";
  const filas = plan.suplementos.horario;
  return `<details class="disclosure"><summary>Suplementos de hoy</summary><div class="disclosure-body">
    <ul class="lista-simple">${filas.map((f) => `<li><strong>${esc(f.Suplemento)}</strong><span>${esc(f[col])}</span></li>`).join("")}</ul>
    <a class="enlace" href="#/plan/suplementos">Dosis y para qué sirve cada uno</a></div></details>`;
}

// Rutina de las 03:00 (HIP-01 de viernes y sábado a la noche), que cae en la madrugada de este día.
function madrugada(d) {
  if (!d.eventos_madrugada.length) return "";
  return `<section class="card"><h2>A las 03:00</h2>${d.eventos_madrugada.map((ev) => {
    const filas = rutinaDe(d.fase, ev.dia_rutina, "noche").filter((r) => r.ejercicio_id === ev.ejercicio_id);
    return `<p class="small muted">Noche del ${esc(ev.dia_rutina.toLowerCase())}</p>${filas.length ? listaEjercicios(filas) : listaEjercicios([{ ejercicio_id: ev.ejercicio_id }])}`;
  }).join("")}</section>`;
}

// Tarjeta de registro del día (pestaña Diario): resume lo cargado y abre «Cargar registro».
export function tarjetaRegistro(fecha, { enlace = true } = {}) {
  const n = cargados("diario", fecha, CAMPOS_DIARIO);
  const v = (k) => valor("diario", fecha, k);
  const dato = (etiqueta, k, unidad = "") => {
    const x = v(k);
    const texto = vacio(x) ? `<span class="pending-value">pendiente</span>` : `${esc(typeof x === "number" ? num(x, x % 1 ? 1 : 0) : x)}${unidad ? ` <small>${unidad}</small>` : ""}`;
    return `<div class="metric"><span>${etiqueta}</span><strong>${texto}</strong></div>`;
  };
  return `<section class="card record-card" data-recordar="registro-dia">
    <div class="heading-row"><div><p class="eyebrow">Tu registro</p><h2>Datos del día</h2></div>
      <span class="badge neutral">${n ? "Guardado" : "pendiente"}</span></div>
    <p class="small muted">${n} de ${CAMPOS_DIARIO.length} datos cargados</p>
    <div class="metrics">${dato("Peso", "peso_kg", "kg")}${dato("Rutina", "rutina_ok")}${dato("Pausas", "pausas")}${dato("Suplementos", "suplementos_ok")}</div>
    <button type="button" class="button full" data-hoja="diario" data-fecha="${esc(fecha)}">${n ? "Editar registro" : "Cargar registro"}</button>
    ${enlace ? `<p class="record-links"><a class="enlace" href="#/registro/diario">Ver kcal, proteína y promedio de peso del día</a></p>` : ""}
  </section>`;
}

export function vistaHoy(fecha, ahora) {
  const d = diaPlan(fecha);
  const bloques = plan.bloques[d.dia_semana];
  const minutos = ahora?.fecha === fecha ? ahora.min : null;
  let nPausa = 0;
  const fila = (b, actual, cuerpo) => {
    const cab = `<time>${esc(b.inicio)}</time><span class="timeline-title">${esc(b.actividad)}${actual ? `<span class="now-badge">Ahora</span>` : ""}<span class="timeline-end">Hasta ${esc(b.fin)}</span></span>`;
    return cuerpo
      ? `<li class="timeline-item${actual ? " active bloque actual" : ""}"><details${actual ? " open" : ""}><summary>${cab}${icono("abajo")}</summary><div class="block-detail">${cuerpo}</div></details></li>`
      : `<li class="timeline-item${actual ? " active bloque actual" : ""}"><div class="tl-fila">${cab}</div></li>`;
  };
  const items = bloques.map((b, i) => {
    const html = contenido(d, b, i, nPausa);
    if (b.categoria === "pausa") nPausa++;
    const actual = minutos !== null && minutos >= aMin(b.inicio) && minutos < aMin(b.fin);
    return fila(b, actual, html);
  });
  // Viernes y sábado no tienen bloque de noche en la semana tipo, pero sí HIP-01 al acostarte en Rutina.
  if (!bloques.some((b) => b.categoria === "faciales/med")) {
    const noche = rutinaDe(d.fase, d.dia_semana, "noche");
    if (noche.length) items.push(fila({ inicio: "—", actividad: "AL ACOSTARTE", fin: "sin horario en la semana tipo" }, false, listaEjercicios(noche)).replace("Hasta sin horario", "Sin horario"));
  }
  const actualHay = items.some((h) => h.includes("timeline-item active"));
  const calc = calcularDia(fecha);
  const fuerza = d.tipo_dia === "fuerza";
  return `${navFecha(fecha)}
    ${titulo("Tu plan de 90 días", "Hoy", `${oracion(fechaLarga(fecha))}.`)}
    <section class="hero" aria-label="Día del plan">
      <div class="hero-top"><div><p class="eyebrow">Día del plan</p><div class="hero-big">${d.dia_plan} <span>/ 90</span></div></div>
        <div class="hero-badges"><span class="badge">${fuerza ? "Día de fuerza" : "Día de ayuno"}</span>${d.descarga ? `<span class="badge">Descarga</span>` : ""}</div></div>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="90" aria-valuenow="${d.dia_plan}"><span style="width:${Math.min(100, (d.dia_plan / 90) * 100)}%"></span></div>
      <div class="hero-footer"><span>Semana <b>${d.semana}</b> de 13</span><span>Fase <b>${d.fase}</b>${d.prueba_final ? " · Prueba final" : ""}</span></div>
    </section>
    <div class="metrics">
      <div class="metric"><span>Objetivo del día</span><strong>${num(calc.kcal_objetivo)} <small>kcal</small></strong></div>
      <div class="metric"><span>Caminata o bici</span><strong>${num(d.caminata_min_plan)} <small>min</small></strong></div>
    </div>
    ${d.sesion || d.medicion ? `<div class="badges">${d.sesion ? `<span class="badge">Sesión ${esc(d.sesion)}</span>` : ""}${d.medicion ? `<span class="badge">Medición ${esc(d.medicion)}</span>` : ""}</div>` : ""}
    ${d.nota ? `<div class="notice">${icono("info")}<p>${esc(d.nota)}</p></div>` : ""}
    ${tarjetaRegistro(fecha)}
    <div class="section-heading heading-row"><h2>Tu día, en orden</h2>${actualHay ? `<button type="button" class="text-button" data-ir-ahora>Ir a ahora ↓</button>` : `<span class="badge neutral">${items.length} bloques</span>`}</div>
    <p class="lede">Tocá un bloque para consultar su contenido.</p>
    <ol class="timeline">${items.join("")}</ol>
    ${madrugada(d)}
    ${suplementosDelDia(d)}`;
}

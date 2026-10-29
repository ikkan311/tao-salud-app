// Registro: Diario del día, Medidas, gráficos de peso y cintura frente a las metas, y metas de fuerza.

import { esc, num, fechaCorta, fechaLarga, aFecha } from "../util.js";
import { plan } from "../datos.js";
import { reg, vacio } from "../registros.js";
import { calcularMedidas, calcularDia, pesoProm7d, esNumero } from "../calculos.js";
import { navFecha, titulo, desplegable, aviso } from "../componentes.js";
import { tarjetaRegistro } from "./hoy.js";

const n = (s) => parseFloat(String(s).replace(",", "."));
const fechaHito = (s) => s.match(/(\d{2})\/(\d{2})\/(\d{4})/).slice(1).reverse().join("-");

function grafico({ titulo, unidad, puntos, reales, sueltos = [], min, max, paso, decReal = 1 }) {
  const W = 340, H = 210, izq = 40, der = 14, arr = 14, aba = 30;
  // Si un registro sale del rango de las metas, se agranda la escala.
  for (const r of [...reales, ...sueltos]) {
    while (r.v < min) min -= paso;
    while (r.v > max) max += paso;
  }
  const inicio = aFecha(plan.plan.inicio);
  const dias = (iso) => Math.round((aFecha(iso) - inicio) / 864e5);
  const x = (d) => izq + (d / 90) * (W - izq - der);
  const y = (v) => arr + ((max - v) / (max - min)) * (H - arr - aba);
  const grilla = [];
  for (let v = min; v <= max + 1e-9; v += paso) {
    grilla.push(`<line class="g-grilla" x1="${izq}" x2="${W - der}" y1="${y(v)}" y2="${y(v)}"/><text class="g-eje" x="${izq - 6}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`);
  }
  const pts = puntos.map((p) => ({ ...p, d: dias(p.fecha) }));
  const linea = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const rs = reales.map((p) => ({ ...p, d: dias(p.fecha) }));
  const lineaReal = rs.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ultimo = rs[rs.length - 1];
  return `<figure class="tarjeta grafico">
    <figcaption><h2>${esc(titulo)}</h2>
      <div class="leyenda"><span class="ley ley-meta"></span>Meta <span class="ley ley-real"></span>${sueltos.length ? "Promedio de 7 días" : "Registro"} ${rs.length ? `<span>· último ${num(ultimo.v, decReal)} ${unidad} (${fechaCorta(ultimo.fecha)})</span>` : `<span class="pendiente">(sin datos todavía)</span>`}</div>
    </figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(titulo)}: metas del plan y registros">
      ${grilla.join("")}
      <path class="g-meta" d="${linea}"/>
      ${rs.length > 1 ? `<path class="g-real" d="${lineaReal}"/>` : ""}
      ${sueltos.map((p) => `<circle class="g-suelto" cx="${x(dias(p.fecha))}" cy="${y(p.v)}" r="2.2"><title>${fechaCorta(p.fecha)}: ${num(p.v, decReal)} ${unidad}</title></circle>`).join("")}
      ${rs.map((p) => `<circle class="g-real-punto" cx="${x(p.d)}" cy="${y(p.v)}" r="2.8"><title>${fechaCorta(p.fecha)}: ${num(p.v, decReal)} ${unidad}</title></circle>`).join("")}
      ${pts.map((p) => `<g class="g-punto" tabindex="0"><title>${esc(p.hito)} (${fechaCorta(p.fecha)}): ${num(p.v, 1)} ${unidad}</title>
        <circle class="g-hit" cx="${x(p.d)}" cy="${y(p.v)}" r="16"/>
        <circle class="g-marca" cx="${x(p.d)}" cy="${y(p.v)}" r="4.5"/>
        <text class="g-valor" x="${x(p.d)}" y="${y(p.v) - 10}" text-anchor="${p.d > 80 ? "end" : p.d < 5 ? "start" : "middle"}">${num(p.v, p.v % 1 ? 1 : 0)}</text>
        <text class="g-eje" x="${x(p.d)}" y="${H - 10}" text-anchor="${p.d > 80 ? "end" : p.d < 5 ? "start" : "middle"}">${esc(p.hito)}</text></g>`).join("")}
    </svg>
    <table class="tabla-oculta"><caption>${esc(titulo)}</caption><tbody>${pts.map((p) => `<tr><td>Meta ${esc(p.hito)}</td><td>${fechaCorta(p.fecha)}</td><td>${num(p.v, 1)} ${unidad}</td></tr>`).join("")}${
      rs.map((p) => `<tr><td>Registro</td><td>${fechaCorta(p.fecha)}</td><td>${num(p.v, decReal)} ${unidad}</td></tr>`).join("")}</tbody></table>
  </figure>`;
}

const v1 = (v, dec = 1, u = "") => (esNumero(v) ? `${num(v, dec)}${u}` : "—");
const signo = (v, dec) => (esNumero(v) ? `${v > 0 ? "+" : ""}${num(v, dec)}` : "—");
const TIPO = { inicio: "Inicio", semanal: "Semanal (cintura)", mensual: "Medición completa", cierre: "Cierre (día 90)" };

const medidaCargada = (x) => esNumero(x.cintura_cm) && (x.m.tipo === "inicio" || reg.medidas.has(x.m.fecha));

const metrica = (etiqueta, v, unidad = "", dec = 0) =>
  `<div class="metric"><span>${etiqueta}</span><strong>${vacio(v) ? `<span class="pending-value">pendiente</span>` : `${esc(typeof v === "number" ? num(v, dec) : v)}${unidad ? ` <small>${unidad}</small>` : ""}`}</strong></div>`;
const sino = (v) => (v === "si" ? "sí" : v === "no" ? "no" : "");

const PESTANAS = [["diario", "Diario"], ["medidas", "Medidas"], ["fuerza", "Fuerza"]];

// Índice de la medición que se muestra: la elegida o la próxima sin cargar (desde la fecha de la pantalla).
function medicionElegida(medidas, fecha, elegida) {
  const i = medidas.findIndex((x) => x.m.fecha === elegida);
  if (i >= 0) return i;
  const prox = medidas.findIndex((x) => x.m.fecha >= fecha && !medidaCargada(x));
  return prox >= 0 ? prox : medidas.length - 1;
}

function pestanaDiario(fecha) {
  const c = calcularDia(fecha);
  const ult = c.comidas.filter((x) => !vacio(x.r.que_comi)).at(-1);
  const hitos = plan.metas.hitos.map((h) => ({ hito: h.Hito, fecha: fechaHito(h.Fecha), v: n(h.Peso) }));
  const pesos = plan.calendario.map((d) => ({ fecha: d.fecha, v: pesoProm7d(d.fecha) })).filter((p) => esNumero(p.v));
  const diarios = [...reg.diario].filter(([, r]) => esNumero(r.peso_kg)).map(([f, r]) => ({ fecha: f, v: r.peso_kg })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return `${tarjetaRegistro(fecha, { enlace: false })}
    <section class="card"><h2>Balance del día</h2>
      <div class="metrics">${metrica("Consumido hoy", c.kcal_real, "kcal")}${metrica("Falta en el día", ult?.falta.kcal, "kcal")}
        ${metrica("Proteína consumida", c.proteina_real_g, "g")}${metrica("Proteína restante", ult?.falta.proteina, "g")}
        ${metrica("Comida OK", sino(c.comida_ok))}${metrica("Proteína OK", sino(c.proteina_ok))}
        ${metrica("Alcohol", c.alcohol_kcal, "kcal")}${metrica("Promedio 7 días", c.peso_prom_7d, "kg", 2)}</div>
      <p class="small muted">Kcal en rango: ±10 % del objetivo (${num(c.kcal_objetivo)} kcal, estado ${esc(c.estado_ajuste)}). Proteína OK: ${plan.constantes.proteina_ok_minimo_g} g o más. El promedio requiere al menos ${plan.constantes.promedio_peso_minimo_pesajes} pesajes en los últimos 7 días. Comidas cargadas: ${c.cargadas} de ${plan.constantes.comidas_por_tipo_dia[c.d.tipo_dia]}.</p></section>
    <section class="seccion">${grafico({ titulo: "Peso y promedio de 7 días", unidad: "kg", puntos: hitos, reales: pesos, sueltos: diarios, min: 100, max: 112, paso: 2, decReal: 2 })}</section>`;
}

function pestanaMedidas(fecha, elegida) {
  const medidas = calcularMedidas();
  const i = medicionElegida(medidas, fecha, elegida);
  const x = medidas[i], m = x.m;
  const prox = medidas.findIndex((y) => y.m.fecha >= fecha && !medidaCargada(y));
  const hitos = plan.metas.hitos.map((h) => ({ hito: h.Hito, fecha: fechaHito(h.Fecha), v: n(h.Cintura) }));
  const cinturas = medidas.filter((y) => esNumero(y.cintura_cm)).map((y) => ({ fecha: y.m.fecha, v: y.cintura_cm }));
  const alerta = x.alerta && x.alerta !== "Faltan datos" ? aviso(`<p>${esc(x.alerta)}</p>`, true) : x.alerta ? `<p class="small muted">Alerta: ${esc(x.alerta)}</p>` : "";
  const completa = m.tipo !== "semanal";
  return `<section class="card"><h2>Medidas</h2>
      <label class="entry-field"><span class="campo-l">Fecha de medición</span><select class="sel" id="medida-fecha">${medidas.map((y, j) =>
        `<option value="${y.m.fecha}"${j === i ? " selected" : ""}>${esc(fechaCorta(y.m.fecha))} · ${esc(TIPO[y.m.tipo] ?? y.m.tipo)}${medidaCargada(y) ? " ✓" : ""}</option>`).join("")}</select></label>
      <p class="small muted">Semana ${m.semana} · ${esc(TIPO[m.tipo] ?? m.tipo)}${m.tipo === "inicio" ? ". La base corresponde a los datos iniciales de la Etapa 1." : ""}</p>
      <div class="metrics">
        ${metrica("Cintura", x.cintura_cm, "cm", 1)}${metrica("Promedio de peso", x.peso_prom_7d, "kg", 2)}
        ${completa || esNumero(x.grasa_pct) ? `${metrica("Grasa US Navy", x.grasa_pct, "%", 1)}${metrica("Masa magra", x.masa_magra_kg, "kg", 1)}${metrica("Cintura / altura", x.cintura_altura, "", 2)}` : ""}
        ${m.calcula_semana ? `${metrica("Cumplimiento", esNumero(x.cumplimiento_pct) ? x.cumplimiento_pct * 100 : "", "%")}${metrica("Pausas promedio", x.pausas_prom, "", 1)}` : ""}
        ${m.dif_contra_fila ? `${metrica("Cambio de peso", esNumero(x.dif_peso_kg) ? `${signo(x.dif_peso_kg, 2)} kg` : "")}${metrica("Cambio de cintura", esNumero(x.dif_cintura_cm) ? `${signo(x.dif_cintura_cm, 1)} cm` : "")}` : ""}
      </div>
      ${m.meta_peso_kg || m.meta_cintura_cm ? `<p class="small muted">Metas: ${m.meta_peso_kg ? `peso ${num(m.meta_peso_kg, 1)} kg` : ""}${m.meta_peso_kg && m.meta_cintura_cm ? " · " : ""}${m.meta_cintura_cm ? `cintura ${num(m.meta_cintura_cm)} cm` : ""}.</p>` : ""}
      ${alerta}
      <button type="button" class="button full" data-hoja="medida" data-fecha="${esc(m.fecha)}">${medidaCargada(x) ? "Editar medidas" : "Cargar medidas"}</button></section>
    ${prox >= 0 && prox !== i ? `<section class="card"><p class="eyebrow">Próxima medición</p><h2>${esc(fechaLarga(medidas[prox].m.fecha))}</h2><p class="small muted">${esc(TIPO[medidas[prox].m.tipo])} · semana ${medidas[prox].m.semana}</p>
      <button type="button" class="button secondary full" data-medida-ir="${medidas[prox].m.fecha}">Ver esa medición</button></section>` : ""}
    <section class="seccion">${grafico({ titulo: "Cintura", unidad: "cm", puntos: hitos, reales: cinturas, min: 100, max: 114, paso: 2 })}</section>`;
}

function pestanaFuerza() {
  return plan.metas.fuerza.map((m) => {
    const cargas = [...reg.registro].filter(([k, r]) => k.endsWith(`|${m.ID}`) && esNumero(r.carga_kg)).map(([k, r]) => ({ fecha: k.split("|")[0], v: r.carga_kg })).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const tope = Math.max(10, ...cargas.map((p) => p.v));
    return `<section class="card meta-fuerza"><p class="eyebrow">${esc(m.ID)}</p><h2>${esc(m.Ejercicio)}</h2>
      <h3 class="titulo-chico">Metas de control</h3>
      <div class="metrics">${["Inicio (semana 1)", "Día 30", "Día 60", "Día 90"].map((k) => `<div class="metric"><span>${esc(k.replace(" (semana 1)", ""))}</span><strong>${esc(m[k])}</strong></div>`).join("")}</div>
      ${grafico({ titulo: "Carga registrada", unidad: "kg", puntos: [], reales: cargas, min: 0, max: Math.ceil(tope / 5) * 5, paso: 5 })}
      <button type="button" class="button secondary full" data-hoja="ejercicio" data-ejercicio="${esc(m.ID)}">Ficha y video</button></section>`;
  }).join("");
}

export function vistaRegistro(fecha, { pestana = "diario", medida = null } = {}) {
  return `${navFecha(fecha)}
    ${titulo("Seguimiento del plan", "Registro", "Tu evolución, con perspectiva.")}
    <div class="pill-tabs" role="group" aria-label="Secciones del registro">${PESTANAS.map(([k, t]) => `<button type="button" class="pill-tab" data-pestana="${k}" aria-pressed="${pestana === k}">${t}</button>`).join("")}</div>
    ${pestana === "medidas" ? pestanaMedidas(fecha, medida) : pestana === "fuerza" ? pestanaFuerza() : pestanaDiario(fecha)}
    ${desplegable("Qué se registra y cuándo", plan.registro_que_y_cuando.map((r) => `<div class="porcion"><h3 class="titulo-chico">${esc(r["Qué"])}</h3><p>${esc(r["Cuándo, según la semana tipo"])}</p><p class="sub">${esc(r["Pestaña"])} · ${esc(r["Tiempo"])}</p></div>`).join(""))}`;
}

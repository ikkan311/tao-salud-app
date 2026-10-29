// Comidas: objetivo y balance del día, una tarjeta por comida (con su registro en un diálogo y las 2 opciones del menú) y pautas en diálogos.

import { esc, num, md, slug, oracion, icono, fechaLarga } from "../util.js";
import { plan, diaPlan } from "../datos.js";
import { calcularDia, platoDe } from "../calculos.js";
import { vacio } from "../registros.js";
import { navFecha, titulo, macros, opcionMenu, desplegable, aviso, enlaceHoja, tarjetaEnlaces } from "../componentes.js";

const DOC5 = "etapa5_definitiva";
const MOMENTO = { todas: "en todas las comidas", desayuno_merienda: "solo desayuno y merienda", almuerzo_cena: "solo almuerzo y cena" };

// El título de la sección ya va en la cabecera del diálogo o del desplegable.
const mdSinTitulo = (t) => md(t.replace(/^#{1,6}\s.*\n+/, ""), { nivelBase: 1 });

function receta(codigo) {
  const doc = plan.documentos.find((d) => d.id === DOC5);
  const s = doc.secciones.find((x) => x.titulo.includes(`(${codigo})`));
  return s ? `<a class="enlace" href="#/doc/${DOC5}/${slug(s.titulo)}">Receta: ${esc(s.titulo)}</a>` : "";
}

const dato = (etiqueta, v, unidad = "") =>
  `<div class="metric"><span>${etiqueta}</span><strong>${vacio(v) ? `<span class="pending-value">pendiente</span>` : `${esc(num(v))}${unidad ? ` <small>${unidad}</small>` : ""}`}</strong></div>`;

const ICONO = { Desayuno: "sol", Cena: "luna" };

function tarjetaComida({ c, r, res }) {
  const que = r.que_comi;
  const plato = platoDe(c, r);
  const elegida = String(que ?? "").charAt(0);
  const opciones = [1, 2].map((o) => {
    const codigo = plan.menu_totales.find((t) => t.clave === `${c.dia}|${c.comida}|${o}`)?.plato.match(/^P\d+/)?.[0];
    return opcionMenu(c.dia, c.comida, o, { abierta: elegida === String(o), extra: codigo ? receta(codigo) : "" });
  }).join("");
  return `<section class="card meal-card">
    <div class="meal-header"><div class="meal-symbol">${icono(ICONO[c.comida] ?? "comidas")}</div><div><h2>${esc(c.comida)}</h2><time>${esc(c.horario)}</time></div></div>
    <div class="meal-record"><p class="small"><strong>Registrado:</strong> ${vacio(que) ? `<span class="pending-value">pendiente</span>` : esc(que)}</p>
      ${plato?.otroDia ? `<p class="small muted">Plato del ${esc(plato.dia.toLowerCase())}, opción ${esc(plato.opcion)}</p>` : ""}
      <div class="metrics">${dato("Consumido", vacio(que) ? "" : res.kcal, "kcal")}${dato("Proteína", vacio(que) ? "" : res.proteina_g, "g")}</div>
      <button type="button" class="button full" data-hoja="comida" data-comida="${esc(c.comida)}">${vacio(que) ? "Registrar comida" : "Editar comida"}</button></div>
    ${opciones}
  </section>`;
}

export function vistaComidas(fecha) {
  const d = diaPlan(fecha);
  const dia = calcularDia(fecha);
  const total = plan.constantes.comidas_por_tipo_dia[d.tipo_dia];
  const ult = dia.comidas.filter((x) => !vacio(x.r.que_comi)).at(-1);
  const ok = (v, si, no) => (v === "si" ? `<span class="estado-ok">${si}</span>` : v === "no" ? `<span class="estado-no">${no}</span>` : "");
  const desde = dia.ajuste_desde;
  // La proteína y la grasa son fijas; lo que cambia son los carbohidratos. Grasa = (kcal − 4 × proteína − 4 × carbos) ÷ 9, que da 70 g en todos los estados.
  const grasasObjetivo = Math.round((dia.kcal_objetivo - 4 * plan.constantes.proteina_objetivo_falta_g - 4 * dia.carbos_obj_g) / 9);
  return `${navFecha(fecha)}
    ${titulo("Nutrición, día a día", "Comidas", `${oracion(fechaLarga(fecha))}.`)}
    <section class="hero" aria-label="Objetivo del día"><div class="hero-top"><div><p class="eyebrow">Objetivo del día</p><h2>${num(dia.kcal_objetivo)} <small>kcal</small></h2>
      <p>${dia.comidas.length} comidas · 2 opciones por comida</p></div><span class="badge">${d.tipo_dia === "fuerza" ? "Fuerza" : "Ayuno"}</span></div>
      <div class="hero-footer"><span>${num(plan.constantes.proteina_objetivo_falta_g)} g proteína</span><span>${num(dia.carbos_obj_g)} g carbos</span><span>${num(grasasObjetivo)} g grasas</span></div></section>
    <p class="small muted">Estado de ajuste: <strong>${esc(dia.estado_ajuste)}</strong>${desde ? ` desde el ${esc(desde.split("-").reverse().join("/"))}` : ""}.</p>
    ${d.tipo_dia === "ayuno" ? aviso("<p>Ayuno hasta el almuerzo</p>") : ""}
    ${dia.gluten.pct > 0 || dia.gluten.avisos.length ? aviso(`<p><strong>Cupo de gluten del día:</strong> ${num(dia.gluten.pct)} % (${dia.gluten.fuentes.map((f) => esc(f.nombre)).join(", ")}).</p>${dia.gluten.avisos.map((a) => `<p>${esc(a)}</p>`).join("")}`, dia.gluten.pasa || dia.gluten.avisos.length > 0) : ""}
    <div class="metrics">${dato("Consumido hoy", dia.kcal_real, "kcal")}${dato("Falta en el día", ult?.falta.kcal, "kcal")}${dato("Proteína consumida", dia.proteina_real_g, "g")}${dato("Proteína restante", ult?.falta.proteina, "g")}</div>
    <p class="small muted">${dia.cargadas} de ${total} comidas cargadas. ${dia.cargadas === total ? `${ok(dia.comida_ok, "Kcal en rango", "Kcal fuera del ±10 %")} ${ok(dia.proteina_ok, `Proteína ≥ ${plan.constantes.proteina_ok_minimo_g} g`, `Proteína por debajo de ${plan.constantes.proteina_ok_minimo_g} g`)}` : ""}${dia.alcohol_kcal ? ` Alcohol: ${num(dia.alcohol_kcal)} kcal.` : ""}</p>
    ${dia.comidas.map(tarjetaComida).join("")}
    <p class="food-note">Kcal y macros de referencia del menú. Podés consultar el detalle por alimento dentro de cada opción.</p>
    <div class="section-heading"><h2>Para acompañar el menú</h2></div>
    ${tarjetaEnlaces(`${enlaceHoja("Recetas", "Las diez recetas completas", { hoja: "pauta", clave: "recetas" }, "comidas")}
      ${enlaceHoja("Cupo de gluten", "Pautas del plan", { hoja: "pauta", clave: "gluten" }, "hoja")}
      ${enlaceHoja("Intercambios y porciones", "Grupos, medidas caseras y topes", { hoja: "porciones" }, "lista")}
      ${enlaceHoja("Comer afuera", "Asados, salidas y fines de semana", { hoja: "pauta", clave: "salidas" }, "comidas")}
      ${enlaceHoja("Café y alcohol", "Horarios y pautas", { hoja: "pauta", clave: "cafe_alcohol" }, "reloj")}`)}`;
}

// Intercambios del menú, cómo se usan las porciones y cada grupo con sus alimentos (para el diálogo y para #/plan/porciones).
export function htmlPorciones() {
  const grupos = [...new Set(plan.porciones.map((p) => p.grupo))];
  return `<p class="dialog-lede">Para registrar un «cambio»: cada porción con sus macros y el máximo de porciones por comida.</p>
    ${desplegable("Intercambios del menú", mdSinTitulo(plan.pautas.intercambios.md))}
    ${desplegable("Cómo se usan las porciones", mdSinTitulo(plan.pautas.registro_por_porciones.md))}
    ${grupos.map((g) => desplegable(esc(g), plan.porciones.filter((p) => p.grupo === g).map((p) => `<article class="porcion">
      <div class="porcion-cab"><strong>${esc(p.alimento)}</strong><span class="ej-id">${esc(p.porcion_id)}</span></div>
      <p>${esc(p.porcion_casera)} · ${num(p.gramos_aprox)} g</p>
      ${macros(p)}
      <p class="sub">Hasta ${num(p.max_porciones)} porciones${p.alcohol === "si" ? " · tiene alcohol" : ""} · ${esc(MOMENTO[p.momento])}${p.ocasional === "si" ? " · ocasional (como mucho una vez por semana)" : ""}</p></article>`).join(""))).join("")}`;
}

export function vistaPorciones() {
  return `<header class="cab-pantalla"><h1>Intercambios por porciones</h1></header>${htmlPorciones()}`;
}

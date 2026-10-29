// Controles de carga (botones, selectores y pasos) y formularios de Diario, Comidas, Registro de fuerza y Medidas.
// Cada control lleva data-tabla, data-clave y data-campo; main.js guarda el cambio en IndexedDB y vuelve a dibujar.

import { esc, num, icono, fechaCorta } from "./util.js";
import { aviso } from "./componentes.js";
import { plan, alarmaDe, ejercicio, diaPlan, gruposDe, platosDeComida } from "./datos.js";
import { reg, valor, vacio, claveComida, claveRegistro } from "./registros.js";
import { calcularDia, cargaAnterior, valorMedida, CAMPOS_MEDIDA, esNumero } from "./calculos.js";
import { CARGA, porcionesDe } from "./planilla.js";

const ref = (t, k, c) => `data-tabla="${t}" data-clave="${esc(k)}" data-campo="${c}"`;
const fmt = (v) => (typeof v === "number" ? num(v, v % 1 ? 1 : 0) : v);

export function botones(t, k, c, opciones, actual, { etiquetas = {}, clase = "" } = {}) {
  return `<div class="seg-grupo ${clase}" role="group" ${ref(t, k, c)}>${opciones.map((o) => {
    const on = o === actual;
    return `<button type="button" class="seg-op${on ? " activo" : ""} op-${esc(String(o).replace(/\s+/g, "-"))}" data-valor="${esc(JSON.stringify(o))}" aria-pressed="${on}">${esc(etiquetas[o] ?? fmt(o))}</button>`;
  }).join("")}</div>`;
}

export function selector(t, k, c, opciones, actual, { vacio: textoVacio = "—", etiquetas = {} } = {}) {
  const ops = !vacio(actual) && !opciones.includes(actual) ? [...opciones, actual] : opciones;
  return `<select class="sel" ${ref(t, k, c)} data-num="${typeof opciones[0] === "number"}">
    <option value="">${esc(textoVacio)}</option>
    ${ops.map((o) => `<option value="${esc(o)}"${o === actual ? " selected" : ""}>${esc(etiquetas[o] ?? fmt(o))}</option>`).join("")}
  </select>`;
}

// Número con − y + (para no tener que tipear). El primer toque arranca desde «inicio».
export function pasos(t, k, c, actual, { rango, paso = 0.1, dec = 1, unidad = "", inicio }) {
  return `<div class="pasos" ${ref(t, k, c)} data-min="${rango[0]}" data-max="${rango[1]}" data-paso="${paso}" data-dec="${dec}" data-inicio="${inicio ?? rango[0]}">
    <button type="button" class="paso-btn" data-paso-dir="-1" aria-label="Menos">−</button>
    <label class="paso-valor"><input type="text" inputmode="decimal" autocomplete="off" value="${esNumero(actual) ? num(actual, dec) : ""}" placeholder="—" aria-label="${esc(c)}"><span>${esc(unidad)}</span></label>
    <button type="button" class="paso-btn" data-paso-dir="1" aria-label="Más">+</button>
  </div>`;
}

export const texto = (t, k, c, actual, placeholder = "") =>
  `<textarea class="texto" rows="2" ${ref(t, k, c)} placeholder="${esc(placeholder)}">${esc(actual)}</textarea>`;

const campo = (etiqueta, control, extra = "") => `<div class="campo${extra}"><span class="campo-l">${etiqueta}</span>${control}</div>`;
const SI_NO = { si: "Sí", no: "No" };

// ---------------------------------------------------------------- Diario

function ultimoPeso(fecha) {
  let ult = null;
  for (const [f, r] of reg.diario) if (f < fecha && esNumero(r.peso_kg) && (!ult || f > ult.f)) ult = { f, p: r.peso_kg };
  return ult?.p ?? plan.medidas_plan[0].peso_prom_7d;
}

export function cargados(tabla, clave, campos) {
  const r = reg[tabla].get(clave) ?? {};
  return campos.filter((k) => !vacio(r[k])).length;
}

export function formDiario(fecha) {
  const d = plan.calendario.find((c) => c.fecha === fecha);
  const v = (k) => valor("diario", fecha, k);
  const T = "diario";
  return `<div class="form">
    ${campo("Peso al levantarte", pasos(T, fecha, "peso_kg", v("peso_kg"), { rango: CARGA.diario.peso_kg.rango, paso: 0.1, dec: 1, unidad: "kg", inicio: ultimoPeso(fecha) }))}
    ${campo("Sueño", selector(T, fecha, "sueno_h", plan.listas.sueno_h, v("sueno_h"), { etiquetas: Object.fromEntries(plan.listas.sueno_h.map((h) => [h, `${num(h, h % 1 ? 1 : 0)} h`])) }))}
    ${campo("Dolor de rodilla al levantarte (0 = nada, 10 = máximo)", selector(T, fecha, "dolor_rodilla_manana", plan.listas.escala_0_10, v("dolor_rodilla_manana")))}
    ${campo("Hernia (semáforo)", botones(T, fecha, "hernia", plan.listas.hernia, v("hernia"), { clase: "semaforo-btn" }))}
    ${campo("Evacuación", botones(T, fecha, "evacuacion", plan.listas.evacuacion, v("evacuacion")))}
    ${campo("Pausas activas hechas", botones(T, fecha, "pausas", plan.listas.pausas_dia, v("pausas")))}
    ${campo(`Caminata (planificada: ${d.caminata_min_plan} min)`, botones(T, fecha, "caminata_min", d.caminata_opciones, v("caminata_min"), { etiquetas: Object.fromEntries(d.caminata_opciones.map((m) => [m, `${m}`])), clase: "envuelve" }))}
    ${campo("Rutina del día", botones(T, fecha, "rutina_ok", plan.listas.si_no, v("rutina_ok"), { etiquetas: SI_NO }))}
    ${campo("Suplementos", botones(T, fecha, "suplementos_ok", plan.listas.si_no, v("suplementos_ok"), { etiquetas: SI_NO }))}
    ${campo("Notas", texto(T, fecha, "notas", v("notas"), "Algo para anotar del día"))}
  </div>`;
}
export const CAMPOS_DIARIO = Object.keys(CARGA.diario);

// Resultado del día: lo que calcula Diario (kcal, proteína, comida_ok, proteina_ok, alcohol y promedio de peso).
export function resumenDia(fecha) {
  const c = calcularDia(fecha);
  const sem = (v) => (v === "si" ? `<span class="estado-ok">sí</span>` : v === "no" ? `<span class="estado-no">no</span>` : `<span class="pendiente">falta cargar comidas</span>`);
  return `<dl class="datos">
    <dt>Kcal</dt><dd>${c.kcal_real === "" ? "—" : num(c.kcal_real)} de ${num(c.kcal_objetivo)} (${esc(c.estado_ajuste)})</dd>
    <dt>Proteína</dt><dd>${c.proteina_real_g === "" ? "—" : `${num(c.proteina_real_g)} g`}</dd>
    <dt>Comidas cargadas</dt><dd>${c.cargadas} de ${plan.constantes.comidas_por_tipo_dia[c.d.tipo_dia]}</dd>
    <dt>Kcal en rango (±10 %)</dt><dd>${sem(c.comida_ok)}</dd>
    <dt>Proteína ≥ ${plan.constantes.proteina_ok_minimo_g} g</dt><dd>${sem(c.proteina_ok)}</dd>
    ${c.alcohol_kcal ? `<dt>Alcohol</dt><dd>${num(c.alcohol_kcal)} kcal</dd>` : ""}
    <dt>Peso, promedio de 7 días</dt><dd>${c.peso_prom_7d === "" ? `<span class="pendiente">hace falta pesarse 5 de los últimos 7 días</span>` : `${num(c.peso_prom_7d, 2)} kg`}</dd>
  </dl>`;
}

// ---------------------------------------------------------------- Comidas

const ETIQ_GRUPO = {
  proteina: "Proteína", proteina_2: "Proteína 2", acomp_1: "Acompañamiento 1", acomp_2: "Acompañamiento 2", verdura: "Verdura", grasa: "Grasa",
  fruta: "Fruta", fruta_2: "Fruta 2", lacteo: "Lácteo", pan_cereal: "Pan o cereal", dulce: "Dulce", bebida: "Bebida", otro: "Otro",
};

function porcionesHasta(alimento) {
  const max = plan.porciones.find((p) => p.alimento === alimento)?.max_porciones ?? 3;
  return plan.listas.porciones.filter((x) => x <= max);
}

// Los alimentos ocasionales (como mucho una vez por semana, Etapa 5) llevan la aclaración al lado.
function etiquetasOcasional() {
  return Object.fromEntries(plan.porciones.filter((p) => p.ocasional === "si").map((p) => [p.alimento, `${p.alimento} (ocasional)`]));
}

function filaPorcion(clave, r, g, comida) {
  const T = "comidas";
  const sinVerdura = g === "verdura" && vacio(r.verdura);
  return `<div class="porcion-fila">
    <span class="campo-l">${ETIQ_GRUPO[g]}</span>
    ${selector(T, clave, g, porcionesDe(g, comida), r[g] ?? "", { vacio: sinVerdura ? "— (ensalada mixta)" : "—", etiquetas: etiquetasOcasional() })}
    ${selector(T, clave, `${g}_porc`, porcionesHasta(sinVerdura ? plan.constantes.porcion_verdura_por_defecto : r[g]), r[`${g}_porc`] ?? "", { vacio: "porc." })}
  </div>`;
}

const conSigno = (n) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(-n)}` : "0");

// «Otro plato del menú»: los platos de esa comida de cualquier día, con cuánto se apartan del objetivo de la comida
// (tabla base de la Etapa 5, sin el recorte ni la inversa de ±160 kcal).
function selectorPlato(fila, clave, r) {
  const tipo = diaPlan(fila.fecha).tipo_dia;
  const obj = plan.objetivos_comida[tipo]?.[fila.comida];
  const ocasionales = new Set(plan.platos_ocasionales.flatMap((o) => o.claves));
  const grupos = [
    ["Hoy", (x) => x.dia === fila.dia],
    [`Otros días de ${tipo}`, (x) => x.dia !== fila.dia && x.tipo_dia === tipo],
    [`Días de ${tipo === "fuerza" ? "ayuno" : "fuerza"}`, (x) => x.tipo_dia !== tipo],
  ];
  const platos = platosDeComida(fila.comida);
  const actual = r.plato_dia ? `${r.plato_dia}|${r.plato_opcion}` : "";
  const opcion = (x) => {
    const t = x.total;
    const dif = obj && t ? ` · ${conSigno(Math.round(t.kcal - obj.kcal))} kcal · ${conSigno(Math.round(t.proteina_g - obj.proteina_g))} g prot.` : "";
    const oca = ocasionales.has(`${x.dia}|${fila.comida}|${x.opcion}`) ? " (ocasional)" : "";
    const valor = `${x.dia}|${x.opcion}`;
    return `<option value="${esc(valor)}"${valor === actual ? " selected" : ""}>${esc(`${x.dia} · ${x.opcion} · ${t?.plato.replace(/^P\d+ · /, "") ?? "pendiente"}${dif}${oca}`)}</option>`;
  };
  return `<select class="sel" ${ref("comidas", clave, "plato")} aria-label="Otro plato del menú">
    <option value="">— elegir un plato —</option>
    ${grupos.map(([nombre, f]) => ({ nombre, xs: platos.filter(f) })).filter((g) => g.xs.length)
      .map((g) => `<optgroup label="${esc(g.nombre)}">${g.xs.map(opcion).join("")}</optgroup>`).join("")}
  </select>
  <p class="sub">${obj ? `Objetivo de esta comida: ${num(obj.kcal)} kcal y ${num(obj.proteina_g)} g de proteína. ` : ""}La diferencia es contra la tabla base de la Etapa 5: no reparte por comida el recorte ni la inversa de ±160 kcal.</p>`;
}

export function formComida(fila, x /* de calcularDia().comidas, más gluten_dia */) {
  const clave = claveComida(fila.fecha, fila.comida);
  const r = x.r;
  const ops = plan.que_comi[`${fila.dia}|${fila.comida}`] ?? [];
  const etiquetas = Object.fromEntries(ops.map((o) => [o, o.startsWith("1") ? "Plato 1" : o.startsWith("2") ? "Plato 2" : o === "cambio" ? "Cambio" : "No comí"]));
  const res = x.res;
  // Si el plato es de otro día, ninguno de los botones Plato 1 y 2 está activo.
  const otroDia = !!r.plato_dia && r.plato_dia !== fila.dia;
  const g = x.gluten, gd = x.gluten_dia;
  const usaGluten = g && (g.pct > 0 || g.avisos.length);
  return `<div class="form registro-comida">
    ${campo("¿Qué comiste?", botones("comidas", clave, "que_comi", ops, otroDia ? "" : r.que_comi ?? "", { etiquetas, clase: "cuatro" }))}
    ${campo("Otro plato del menú", selectorPlato(fila, clave, r))}
    ${r.que_comi === "cambio" ? `<div class="porciones-form">${gruposDe(fila.comida).map((g) => filaPorcion(clave, r, g, fila.comida)).join("")}</div>` : ""}
    <div class="porciones-form">${["bebida", "otro"].map((g) => filaPorcion(clave, r, g, fila.comida)).join("")}</div>
    ${r.que_comi === "no comí" && (r.bebida || r.otro) ? `<p class="nota">Con «no comí», la planilla no suma la bebida ni lo de «otro».</p>` : ""}
    ${campo("Notas", texto("comidas", clave, "notas", r.notas ?? ""))}
    ${vacio(r.que_comi) ? "" : `<div class="resultado">
      <div class="macros"><span class="macro macro-kcal"><b>${num(res.kcal)}</b> kcal</span><span class="macro"><b>${num(res.proteina_g)}</b> g prot.</span>
      <span class="macro"><b>${num(res.carbos_g)}</b> g carb.</span><span class="macro"><b>${num(res.grasas_g)}</b> g grasa</span></div>
      <p class="falta">Falta del día hasta acá: <strong>${num(x.falta.kcal)} kcal</strong> y <strong>${num(x.falta.proteina)} g de proteína</strong></p>
    </div>`}
    ${usaGluten ? aviso(`<p><strong>Cupo de gluten:</strong> esta comida usa ${num(g.pct)} % del cupo diario (${g.fuentes.map((f) => esc(f.nombre)).join(", ")}); el día va en ${num(gd.pct)} %.</p>
      ${gd.avisos.map((a) => `<p>${esc(a)}</p>`).join("")}`, gd.pasa || g.avisos.length > 0) : ""}
    ${res.alcohol_kcal ? `<p class="sub">Alcohol: ${num(res.alcohol_kcal)} kcal</p>` : ""}
  </div>`;
}

// ---------------------------------------------------------------- Registro de fuerza

export function formSerie(it, s) {
  const clave = claveRegistro(s.fecha, it.ejercicio_id);
  const T = "registro";
  const v = (k) => valor(T, clave, k);
  const ant = cargaAnterior(it.fila);
  const lista = it.unidad === "segundos" ? plan.listas.segundos : plan.listas.reps;
  const series = Math.max(Number(it.series_plan) || 0, ...[1, 2, 3, 4].filter((n) => !vacio(v(`reps_s${n}`))));
  const cortar = v("apnea") === "si" || v("abombamiento") === "si";
  const a = alarmaDe(it.ejercicio_id);
  return `<div class="form registro-serie">
    <p class="carga-ant">Carga anterior: ${ant ? `<strong>${num(ant.carga, ant.carga % 1 ? 1 : 0)} kg</strong> <span class="sub">(${fechaCorta(ant.fecha)})</span>` : `<span class="pendiente">sin carga anterior</span>`}</p>
    ${campo("Tipo de carga", botones(T, clave, "tipo_carga", plan.listas.tipo_carga, v("tipo_carga")))}
    ${v("tipo_carga") === "sin carga" ? "" : campo("Carga", pasos(T, clave, "carga_kg", v("carga_kg"), { rango: CARGA.registro.carga_kg.rango, paso: 0.5, dec: 1, unidad: "kg", inicio: ant?.carga ?? 2 }))}
    <div class="series">${Array.from({ length: Math.min(series || 1, 4) }, (_, i) => campo(`Serie ${i + 1}`, selector(T, clave, `reps_s${i + 1}`, lista, v(`reps_s${i + 1}`), { vacio: it.unidad === "segundos" ? "seg." : "reps" }))).join("")}</div>
    ${campo("RPE (5 = fácil, 10 = máximo)", selector(T, clave, "rpe", plan.listas.rpe, v("rpe")))}
    ${campo("¿Aguantaste la respiración (apnea)?", botones(T, clave, "apnea", plan.listas.si_no, v("apnea"), { etiquetas: SI_NO, clase: "alerta-si" }))}
    ${campo("¿Se abombó el abdomen?", botones(T, clave, "abombamiento", plan.listas.si_no, v("abombamiento"), { etiquetas: SI_NO, clase: "alerta-si" }))}
    ${cortar ? `<div class="aviso-alarma fuerte">${icono("alerta")}<div><p><strong>Cortá la serie.</strong> Ante cualquier señal se corta la serie y se pasa a la alternativa.</p>
      ${a ? `<p><strong>Alternativa:</strong> ${esc(a["Alternativa más segura"])}</p>` : ""}
      ${ejercicio(it.ejercicio_id)?.regresion_id ? `<p><button type="button" class="enlace" data-hoja="ejercicio" data-ejercicio="${esc(ejercicio(it.ejercicio_id).regresion_id)}">Ver la versión más fácil (${esc(ejercicio(it.ejercicio_id).regresion_id)})</button></p>` : ""}</div></div>` : ""}
    ${campo("Dolor de rodilla (0 = nada, 10 = máximo)", selector(T, clave, "dolor_rodilla", plan.listas.escala_0_10, v("dolor_rodilla")))}
    ${campo("Notas", texto(T, clave, "notas", reg.registro.get(clave)?.notas ?? ""))}
  </div>`;
}

// ---------------------------------------------------------------- Medidas

const ETIQ_MEDIDA = { cintura_cm: "Cintura (a la altura del ombligo)", cuello_cm: "Cuello", cadera_cm: "Cadera", muslo_cm: "Muslo", brazo_cm: "Brazo" };

export function formMedida(m, x /* de calcularMedidas() */, anterior) {
  const T = "medidas";
  const completa = m.tipo !== "semanal";
  const campos = completa ? CAMPOS_MEDIDA : ["cintura_cm"];
  const ctrl = (k) => campo(ETIQ_MEDIDA[k], pasos(T, m.fecha, k, valorMedida(m, k), { rango: CARGA.medidas[k].rango, paso: 0.5, dec: 1, unidad: "cm", inicio: anterior?.[k] || plan.medidas_plan[0][k] }));
  return `<div class="form">
    ${campos.map(ctrl).join("")}
    ${completa ? "" : `<details class="mini" data-recordar="mas-medidas"><summary>Más medidas (opcional)</summary>${CAMPOS_MEDIDA.slice(1).map(ctrl).join("")}</details>`}
    ${completa ? campo("Fotos", botones(T, m.fecha, "foto", plan.listas.si_no, valorMedida(m, "foto"), { etiquetas: SI_NO })) : ""}
    ${campo("Notas", texto(T, m.fecha, "notas", reg.medidas.get(m.fecha)?.notas ?? "", m.notas ?? ""))}
  </div>`;
}

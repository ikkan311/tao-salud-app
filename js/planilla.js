// Pestañas Diario, Comidas, Registro y Medidas de plan.xlsx: columnas, validación de la carga, importación y exportación.

import { plan, esDesayunoMerienda, platosDeComida, DIAS_SEMANA } from "./datos.js";
import { reg, vacio, datos, base, guardarFilas, claveComida, claveRegistro } from "./registros.js";
import { calcularDia, cargaAnteriorExcel, calcularMedidas, itemsRegistro, ajustes, esNumero } from "./calculos.js";
import { leerXlsx, escribirXlsx, serialAISO, isoASerial } from "./xlsx.js";

const L = () => plan.listas;
// Columnas de porciones de Comidas, en el orden de la planilla.
export const GRUPOS_PORCION = ["proteina", "acomp_1", "acomp_2", "verdura", "grasa", "fruta", "bebida", "otro"];
// Grupos que se agregan al final de Comidas, para el cambio en desayuno y merienda (proteina y fruta repiten la lista de las de arriba).
export const GRUPOS_NUEVOS = ["proteina_2", "lacteo", "pan_cereal", "fruta_2", "dulce"];
export const GRUPOS_TODOS = [...GRUPOS_PORCION, ...GRUPOS_NUEVOS];
const PORC = () => L().porciones;

// Columnas de carga de cada pestaña y qué valores aceptan (las mismas validaciones de datos de plan.xlsx).
// lista: opciones (función de la fila del plan cuando dependen del día); rango: [mín, máx]; texto: libre.
export const CARGA = {
  diario: {
    peso_kg: { rango: [80, 130] }, sueno_h: { lista: () => L().sueno_h }, dolor_rodilla_manana: { lista: () => L().escala_0_10 },
    hernia: { lista: () => L().hernia }, evacuacion: { lista: () => L().evacuacion }, pausas: { lista: () => L().pausas_dia },
    caminata_min: { lista: (f) => f.caminata_opciones }, rutina_ok: { lista: () => L().si_no }, suplementos_ok: { lista: () => L().si_no },
    notas: { texto: true },
  },
  comidas: {
    // Un plato de esa comida de cualquier día, «cambio» o «no comí». De qué día es se dice en plato_dia y plato_opcion.
    que_comi: { lista: (f) => [...platosDeComida(f.comida).map((x) => x.texto), "cambio", "no comí"] },
    plato_dia: { lista: DIAS_SEMANA }, plato_opcion: { lista: () => ["1", "2"] },
    ...Object.fromEntries(GRUPOS_TODOS.flatMap((g) => [
      [g, { lista: () => porcionesDe(g) }], [`${g}_porc`, { lista: PORC }],
    ])),
    notas: { texto: true },
  },
  registro: {
    tipo_carga: { lista: () => L().tipo_carga }, carga_kg: { rango: [0.5, 60] },
    ...Object.fromEntries([1, 2, 3, 4].map((n) => [`reps_s${n}`, { lista: (f) => (f.unidad === "segundos" ? L().segundos : L().reps) }])),
    rpe: { lista: () => L().rpe }, apnea: { lista: () => L().si_no }, abombamiento: { lista: () => L().si_no },
    dolor_rodilla: { lista: () => L().escala_0_10 }, notas: { texto: true },
  },
  medidas: {
    cintura_cm: { rango: [70, 140] }, cuello_cm: { rango: [30, 60] }, cadera_cm: { rango: [80, 140] },
    muslo_cm: { rango: [40, 90] }, brazo_cm: { rango: [25, 55] }, foto: { lista: () => L().si_no }, notas: { texto: true },
  },
};
// Alimentos que ofrece un grupo. Con la comida, solo los de su momento (desayuno y merienda, o almuerzo y cena); sin ella, los de las dos
// (así se validan las importaciones).
export function porcionesDe(grupo, comida) {
  const dm = plan.porciones_selectores_dm[grupo.replace(/_2$/, "")] ?? [];
  const ac = (plan.porciones_selectores[grupo] ?? []).filter((id) => porcionPorId(id).momento !== "desayuno_merienda");
  const ids = new Set(comida === undefined ? [...dm, ...ac] : esDesayunoMerienda(comida) ? dm : ac);
  return plan.porciones.filter((p) => ids.has(p.porcion_id)).map((p) => p.alimento);
}
const porcionPorId = (id) => plan.porciones.find((p) => p.porcion_id === id);

// Columnas de cada pestaña, en el orden de plan.xlsx, con el formato de número de la planilla.
const COLUMNAS = {
  Diario: [["fecha", "fecha"], ["dia"], ["peso_kg", "0.0"], ["sueno_h", "0.0"], ["dolor_rodilla_manana", "0"], ["hernia"], ["evacuacion"],
    ["pausas", "0"], ["caminata_min", "0"], ["rutina_ok"], ["suplementos_ok"], ["notas"], ["semana", "0"], ["tipo_dia"], ["estado_ajuste"],
    ["kcal_objetivo", "0"], ["carbos_obj_g", "0"], ["kcal_real", "0"], ["proteina_real_g", "0"], ["carbos_real_g", "0"], ["grasas_real_g", "0"],
    ["comida_ok"], ["proteina_ok"], ["alcohol_kcal", "0"], ["peso_prom_7d", "0.0"], ["gluten_cupo_pct", "0"], ["gluten_aviso"]],
  Comidas: [["fecha", "fecha"], ["dia"], ["comida"], ["horario", "hora"], ["que_comi"],
    ...GRUPOS_PORCION.flatMap((g) => [[g], [`${g}_porc`, "0.0"]]),
    ["kcal", "0"], ["proteina_g", "0"], ["carbos_g", "0"], ["grasas_g", "0"], ["falta_kcal_dia", "0"], ["falta_proteina_dia", "0"], ["notas"], ["alcohol_kcal", "0"],
    ["plato_dia"], ["plato_opcion"], ...GRUPOS_NUEVOS.flatMap((g) => [[g], [`${g}_porc`, "0.0"]]), ["gluten_cupo_pct", "0"]],
  Registro: [["fecha", "fecha"], ["semana", "0"], ["fase", "0"], ["dia"], ["sesion"], ["ejercicio_id"], ["nombre"], ["series_plan", "0"], ["reps_plan"],
    ["rpe_plan"], ["tipo_carga"], ["carga_kg", "0.0"], ["carga_anterior", "0.0"], ["reps_s1", "0"], ["reps_s2", "0"], ["reps_s3", "0"], ["reps_s4", "0"],
    ["rpe", "0.0"], ["apnea"], ["abombamiento"], ["dolor_rodilla", "0"], ["notas"]],
  Medidas: [["fecha", "fecha"], ["semana", "0"], ["tipo"], ["peso_prom_7d", "0.0"], ["cintura_cm", "0.0"], ["cuello_cm", "0.0"], ["cadera_cm", "0.0"],
    ["muslo_cm", "0.0"], ["brazo_cm", "0.0"], ["grasa_pct", "0.0"], ["masa_magra_kg", "0.0"], ["cintura_altura", "0.00"], ["dif_peso_kg", "0.0"],
    ["dif_cintura_cm", "0.0"], ["cumplimiento_pct", "pct"], ["pausas_prom", "0.0"], ["meta_peso_kg", "0.0"], ["meta_cintura_cm", "0.0"], ["alerta"],
    ["foto"], ["notas"]],
  Ajustes: [["fecha_desde", "fecha"], ["estado_ajuste"]],
};

// Filas del plan de cada pestaña, con su clave y lo que la planilla ya trae escrito (notas del plan, medidas de inicio).
function filasPlan(tabla) {
  switch (tabla) {
    case "diario": return plan.calendario.map((c) => ({ clave: c.fecha, f: c, defecto: { notas: c.nota } }));
    case "comidas": return plan.comidas_plan.map((c) => ({ clave: claveComida(c.fecha, c.comida), f: c, defecto: {} }));
    case "registro": return itemsRegistro().map((it) => ({ clave: claveRegistro(it.fecha, it.ejercicio_id), f: it, defecto: { notas: it.notas } }));
    case "medidas": return plan.medidas_plan.map((m) => ({
      clave: m.fecha, f: m, defecto: Object.fromEntries(Object.keys(CARGA.medidas).map((k) => [k, m[k]])),
    }));
  }
  return [];
}

// Lo que se exporta en una columna de carga: lo del usuario o, si no cargó nada, lo que trae la planilla.
const efectivo = (tabla, clave, k, defecto) => {
  const v = reg[tabla].get(clave)?.[k];
  return vacio(v) ? defecto[k] ?? "" : v;
};

// ---------------------------------------------------------------- exportar

const horaASerial = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return (h * 60 + m) / 1440; };

export function armarHojas() {
  const hojas = [];
  const filasD = filasPlan("diario").map(({ clave, f, defecto }) => {
    const c = calcularDia(clave);
    const v = (k) => efectivo("diario", clave, k, defecto);
    return [isoASerial(f.fecha), f.dia_semana, v("peso_kg"), v("sueno_h"), v("dolor_rodilla_manana"), v("hernia"), v("evacuacion"), v("pausas"),
      v("caminata_min"), v("rutina_ok"), v("suplementos_ok"), v("notas"), f.semana, f.tipo_dia, c.estado_ajuste, c.kcal_objetivo, c.carbos_obj_g,
      c.kcal_real, c.proteina_real_g, c.carbos_real_g, c.grasas_real_g, c.comida_ok, c.proteina_ok, c.alcohol_kcal, c.peso_prom_7d,
      c.cargadas ? Math.round(c.gluten.pct) : "", c.gluten.avisos.join(" ")];
  });
  hojas.push({ nombre: "Diario", filas: filasD });
  const filasC = [];
  for (const cal of plan.calendario) {
    for (const { c, r, res, falta, gluten } of calcularDia(cal.fecha).comidas) {
      filasC.push([isoASerial(c.fecha), c.dia, c.comida, horaASerial(c.horario), r.que_comi ?? "",
        ...GRUPOS_PORCION.flatMap((g) => [r[g] ?? "", r[`${g}_porc`] ?? ""]),
        res.kcal, res.proteina_g, res.carbos_g, res.grasas_g, falta.kcal, falta.proteina, r.notas ?? "", res.alcohol_kcal,
        r.plato_dia ?? "", r.plato_opcion ?? "", ...GRUPOS_NUEVOS.flatMap((g) => [r[g] ?? "", r[`${g}_porc`] ?? ""]), vacio(r.que_comi) ? "" : Math.round(gluten.pct)]);
    }
  }
  hojas.push({ nombre: "Comidas", filas: filasC });
  hojas.push({ nombre: "Registro", filas: filasPlan("registro").map(({ clave, f, defecto }) => {
    const v = (k) => efectivo("registro", clave, k, defecto);
    return [isoASerial(f.fecha), f.semana, f.fase, f.dia, f.sesion, f.ejercicio_id, f.nombre, f.series_plan, f.reps_plan, f.rpe_plan,
      v("tipo_carga"), v("carga_kg"), cargaAnteriorExcel(f.fila), v("reps_s1"), v("reps_s2"), v("reps_s3"), v("reps_s4"), v("rpe"), v("apnea"),
      v("abombamiento"), v("dolor_rodilla"), v("notas")];
  }) });
  hojas.push({ nombre: "Medidas", filas: calcularMedidas().map((x) => [isoASerial(x.m.fecha), x.m.semana, x.m.tipo, x.peso_prom_7d,
    x.cintura_cm, x.cuello_cm, x.cadera_cm, x.muslo_cm, x.brazo_cm, x.grasa_pct, x.masa_magra_kg, x.cintura_altura, x.dif_peso_kg, x.dif_cintura_cm,
    x.cumplimiento_pct, x.pausas_prom, x.m.meta_peso_kg ?? "", x.m.meta_cintura_cm ?? "", x.alerta, x.foto, x.notas]) });
  hojas.push({ nombre: "Ajustes", filas: ajustes().map((a) => [isoASerial(a.fecha_desde), a.estado_ajuste]) });
  for (const h of hojas) h.columnas = COLUMNAS[h.nombre].map(([nombre, formato]) => ({ nombre, formato }));
  return hojas;
}

export function exportar() {
  return escribirXlsx(armarHojas());
}

// ---------------------------------------------------------------- importar

const HOJA = { diario: "Diario", comidas: "Comidas", registro: "Registro", medidas: "Medidas" };
const NOMBRE_TABLA = { diario: "Diario", comidas: "Comidas", registro: "Registro de fuerza", medidas: "Medidas", ajustes: "Ajustes de calorías" };

function aFechaISO(v) {
  if (typeof v === "number") return serialAISO(v);
  const m = String(v ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ?? String(v ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const [d, mes, a] = m[1].length === 4 ? [m[3], m[2], m[1]] : [m[1], m[2], m[3]];
  return `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Lleva un valor del archivo al valor que guardaría la app. Excel compara texto sin distinguir mayúsculas,
// así que «Si» o «No comí» se toman como «si» y «no comí». Devuelve { v } o { error }.
function normalizar(spec, crudo, f) {
  if (crudo === null || crudo === undefined || (typeof crudo === "string" && !crudo.trim())) return { v: "" };
  if (typeof crudo === "object") return { error: `error de Excel ${crudo.error}` };
  if (spec.texto) return { v: String(crudo).trim() };
  if (spec.rango) {
    const n = typeof crudo === "number" ? crudo : Number(String(crudo).replace(",", "."));
    if (!isFinite(n)) return { error: `«${crudo}» no es un número` };
    if (n < spec.rango[0] || n > spec.rango[1]) return { error: `${n} está fuera del rango ${spec.rango[0]}–${spec.rango[1]}` };
    return { v: n };
  }
  const ops = spec.lista(f) ?? [];
  const t = typeof crudo === "string" ? crudo.trim() : crudo;
  let op = ops.find((o) => o === t || (typeof o === "number" && Number(String(t).replace(",", ".")) === o)
    || (typeof o === "string" && typeof t === "string" && o.toLowerCase() === t.toLowerCase())
    || (typeof o === "string" && typeof t === "number" && String(t) === o));
  return op === undefined ? { error: `«${crudo}» no está entre las opciones` } : { v: op };
}

// Un plato de otro día se importa solo si el texto de que_comi es el que figura en plato_dia y plato_opcion (y, sin ellos, si es de la
// misma fecha). Si no coincide, avisa y ese dato no se importa. Un plan.xlsx viejo, sin esas columnas, queda como plato del mismo día.
function revisarPlato(nuevo, f, avisos, donde) {
  if (!f?.comida) return;
  const q = nuevo.que_comi;
  const esPlato = typeof q === "string" && /^[12]/.test(q);
  const soltar = (...ks) => ks.forEach((k) => delete nuevo[k]);
  if (nuevo.plato_dia === undefined && nuevo.plato_opcion === undefined) {
    if (esPlato && !(plan.que_comi[`${f.dia}|${f.comida}`] ?? []).includes(q)) {
      avisos.push(`${donde}, que_comi: es un plato de otro día y falta plato_dia. No se importa ese dato.`);
      soltar("que_comi");
    }
    return;
  }
  if (!esPlato) {
    avisos.push(`${donde}, plato_dia: solo va con un plato del menú (1 o 2). No se importa ese dato.`);
    return soltar("plato_dia", "plato_opcion");
  }
  const dia = nuevo.plato_dia ?? f.dia, opcion = nuevo.plato_opcion ?? q.charAt(0);
  if ((plan.que_comi[`${dia}|${f.comida}`] ?? [])[Number(opcion) - 1] !== q) {
    avisos.push(`${donde}, que_comi: el texto no coincide con el plato ${opcion} del ${dia}. No se importa ese dato.`);
    return soltar("que_comi", "plato_dia", "plato_opcion");
  }
  nuevo.plato_dia = dia;
  nuevo.plato_opcion = opcion;
}

// Lee el archivo y arma el resumen sin guardar nada.
export async function analizar(buffer) {
  const hojas = await leerXlsx(buffer);
  const res = { tablas: {}, avisos: [], hojasFaltantes: [] };
  for (const [tabla, nombreHoja] of Object.entries(HOJA)) {
    const filas = hojas[nombreHoja];
    const t = (res.tablas[tabla] = { nombre: NOMBRE_TABLA[tabla], nuevos: [], completan: [], iguales: 0, conflictos: [], fuera: [], celdas: 0 });
    if (!filas) { res.hojasFaltantes.push(nombreHoja); continue; }
    const enc = (filas[0] ?? []).map((h) => String(h ?? "").trim());
    const col = (k) => enc.indexOf(k);
    const plano = new Map(filasPlan(tabla).map((x) => [x.clave, x]));
    for (let i = 1; i < filas.length; i++) {
      const fila = filas[i];
      if (!fila) continue;
      const fecha = aFechaISO(fila[col("fecha")]);
      let clave = fecha;
      if (tabla === "comidas") clave = claveComida(fecha, String(fila[col("comida")] ?? "").trim());
      if (tabla === "registro") clave = claveRegistro(fecha, String(fila[col("ejercicio_id")] ?? "").trim());
      const p = plano.get(clave);
      const nuevo = {};
      for (const [k, spec] of Object.entries(CARGA[tabla])) {
        const j = col(k);
        if (j < 0) continue;
        const n = normalizar(spec, fila[j], p?.f ?? {});
        if (n.error) { res.avisos.push(`${nombreHoja} fila ${i + 1}, ${k}: ${n.error}. No se importa ese dato.`); continue; }
        if (vacio(n.v)) continue;
        if (p && n.v === p.defecto[k]) continue; // lo que ya trae el plan no es un registro
        nuevo[k] = n.v;
      }
      if (tabla === "comidas") revisarPlato(nuevo, p?.f, res.avisos, `${nombreHoja} fila ${i + 1}`);
      if (!Object.keys(nuevo).length) continue;
      if (!p) { t.fuera.push(`fila ${i + 1} (${fecha ?? "sin fecha"})`); continue; }
      t.celdas += Object.keys(nuevo).length;
      const actual = datos(tabla, reg[tabla].get(clave));
      const choques = Object.keys(nuevo).filter((k) => !vacio(actual[k]) && actual[k] !== nuevo[k]);
      const agrega = Object.keys(nuevo).filter((k) => vacio(actual[k]));
      const item = { clave, fila: i + 1, nuevo, actual, choques };
      if (choques.length) t.conflictos.push(item);
      else if (!agrega.length) t.iguales++;
      else if (Object.keys(actual).length) t.completan.push(item);
      else t.nuevos.push(item);
    }
  }
  // Ajustes de calorías: tabla «fecha_desde | estado_ajuste» de «Ajustes y suplementos» (o la pestaña Ajustes de un archivo exportado).
  const aj = (res.tablas.ajustes = { nombre: NOMBRE_TABLA.ajustes, nuevos: [], completan: [], iguales: 0, conflictos: [], fuera: [], celdas: 0 });
  const hojaAj = hojas["Ajustes y suplementos"] ?? hojas["Ajustes"];
  if (hojaAj) {
    const ini = hojaAj.findIndex((f) => String(f?.[0] ?? "").trim() === "fecha_desde");
    const enPlan = new Map(plan.ajustes_calorias.map((a) => [a.fecha_desde, a.estado_ajuste]));
    for (let i = ini + 1; ini >= 0 && i < hojaAj.length; i++) {
      const f = hojaAj[i];
      if (!f || vacio(f[0])) continue;
      const fecha = aFechaISO(f[0]);
      const n = normalizar({ lista: () => L().estado_ajuste }, f[1]);
      if (!fecha || fecha < plan.plan.inicio || fecha > plan.plan.fin) { res.avisos.push(`Ajustes fila ${i + 1}: la fecha no está dentro del plan. No se importa.`); continue; }
      if (n.error || vacio(n.v)) { res.avisos.push(`Ajustes fila ${i + 1}: ${n.error ?? "falta el estado"}. No se importa.`); continue; }
      if (enPlan.get(fecha) === n.v && !reg.ajustes.has(fecha)) continue;
      aj.celdas++;
      const actual = reg.ajustes.get(fecha)?.estado_ajuste;
      const item = { clave: fecha, fila: i + 1, nuevo: { estado_ajuste: n.v }, actual: actual ? { estado_ajuste: actual } : {}, choques: [] };
      if (actual === undefined) aj.nuevos.push(item);
      else if (actual === n.v) aj.iguales++;
      else { item.choques = ["estado_ajuste"]; aj.conflictos.push(item); }
    }
  } else res.hojasFaltantes.push("Ajustes y suplementos");
  return res;
}

// Guarda lo analizado. En los conflictos se queda lo de la app, salvo que se pida que mande el archivo.
export async function aplicar(res, mandaArchivo) {
  const hecho = {};
  for (const [tabla, t] of Object.entries(res.tablas)) {
    const filas = [];
    for (const item of [...t.nuevos, ...t.completan, ...t.conflictos]) {
      const actual = reg[tabla].get(item.clave);
      const fila = { ...(actual ?? base(tabla, item.clave)) };
      for (const [k, v] of Object.entries(item.nuevo)) {
        if (vacio(fila[k]) || mandaArchivo) fila[k] = v;
      }
      // Otro plato sin plato_dia en el archivo: deja de valer el día de origen que tenía la app.
      if (tabla === "comidas" && item.nuevo.que_comi !== undefined && actual?.que_comi !== item.nuevo.que_comi && item.nuevo.plato_dia === undefined) {
        delete fila.plato_dia;
        delete fila.plato_opcion;
      }
      filas.push(fila);
    }
    if (filas.length) await guardarFilas(tabla, filas);
    hecho[tabla] = filas.length;
  }
  return hecho;
}


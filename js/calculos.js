// Cálculos de plan.xlsx sobre los registros (docs/formulas.md), fila por fila como en cada pestaña.

import { plan, redondear, estadoAjuste, objetivoDia, totalMenu, alimentosMenu } from "./datos.js";
import { reg, vacio, claveComida, claveRegistro } from "./registros.js";

export const N = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
export const esNumero = (v) => typeof v === "number" && isFinite(v);
const suma = (xs) => xs.reduce((a, b) => a + b, 0);

let indice = null;
function idx() {
  if (indice) return indice;
  const porciones = new Map(plan.porciones.map((p) => [p.alimento, p]));
  const fechas = new Map(plan.calendario.map((c, i) => [c.fecha, i]));
  const comidasPorFecha = new Map();
  plan.comidas_plan.forEach((c, i) => {
    if (!comidasPorFecha.has(c.fecha)) comidasPorFecha.set(c.fecha, []);
    comidasPorFecha.get(c.fecha).push({ ...c, _fila: i + 2 });
  });
  const items = plan.sesiones.flatMap((s) => s.items.map((it) => ({ ...it, fecha: s.fecha, semana: s.semana, fase: s.fase, dia: s.dia, sesion: s.sesion })));
  const itemPorFila = new Map(items.map((it) => [it.fila, it]));
  const medidaPorFila = new Map(plan.medidas_plan.map((m) => [m._fila, m]));
  return (indice = { porciones, fechas, comidasPorFecha, items, itemPorFila, medidaPorFila });
}
export const porcion = (nombre) => idx().porciones.get(nombre);
export const itemsRegistro = () => idx().items;

// ---------------------------------------------------------------- ajustes (Diario!O, P y Q)

// Cambios de estado: los de plan.xlsx y los cargados en la app (si coinciden en fecha, manda la app), en orden de fecha.
export function ajustes() {
  const m = new Map(plan.ajustes_calorias.map((a) => [a.fecha_desde, { ...a, origen: "plan" }]));
  for (const a of reg.ajustes.values()) m.set(a.fecha_desde, { fecha_desde: a.fecha_desde, estado_ajuste: a.estado_ajuste, origen: "app" });
  return [...m.values()].sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));
}
export const estadoDe = (fecha) => estadoAjuste(fecha, ajustes());
export function objetivoDe(fecha) {
  const d = plan.calendario[idx().fechas.get(fecha)];
  const { estado, desde } = estadoDe(fecha);
  return { ...objetivoDia(d.tipo_dia, estado), estado, desde };
}

// ---------------------------------------------------------------- Comidas!V a Y y AC

const MACROS = ["kcal", "proteina_g", "carbos_g", "grasas_g"];

export function alcoholComida(r) {
  const p = porcion(r.bebida);
  return p?.alcohol === "si" ? (p.kcal ?? 0) * N(r.bebida_porc) : 0;
}

// Grupos que suma un «cambio». Los cinco últimos son de desayuno y merienda; en almuerzo y cena quedan vacíos.
// Se suman todos los que tengan algo cargado, como la fórmula de Comidas!V a Y, que no distingue la comida. La verdura por defecto
// (ensalada mixta) se multiplica por verdura_porc, así que en desayuno y merienda, que no cargan verdura_porc, no suma nada.
const GRUPOS_CAMBIO = ["proteina", "acomp_1", "acomp_2", "grasa", "fruta", "proteina_2", "lacteo", "pan_cereal", "fruta_2", "dulce"];

// El plato del menú puede ser de otro día (plato_dia y plato_opcion); sin eso, es el de la misma fecha.
export const platoDe = (c, r) => {
  const op = String(r.que_comi ?? "").charAt(0);
  return op === "1" || op === "2" ? { dia: r.plato_dia || c.dia, opcion: String(r.plato_opcion || op), otroDia: !!r.plato_dia && r.plato_dia !== c.dia } : null;
};

export function calcularComida(c /* fila de comidas_plan */, r = {}) {
  const res = { alcohol_kcal: alcoholComida(r) };
  const q = r.que_comi;
  const plato = platoDe(c, r);
  for (const k of MACROS) {
    if (vacio(q)) { res[k] = ""; continue; }
    if (q === "no comí") { res[k] = 0; continue; }
    const v = (n, cant) => (porcion(n)?.[k] ?? 0) * N(cant);
    const menu = plato ? (totalMenu(plato.dia, c.comida, plato.opcion)?.[k] ?? 0) : 0;
    const cambio = q === "cambio"
      ? suma(GRUPOS_CAMBIO.map((g) => v(r[g], r[`${g}_porc`])))
        + v(vacio(r.verdura) ? plan.constantes.porcion_verdura_por_defecto : r.verdura, r.verdura_porc)
      : 0;
    res[k] = redondear(menu + cambio + v(r.bebida, r.bebida_porc) + v(r.otro, r.otro_porc));
  }
  return res;
}

// ---------------------------------------------------------------- cupo de gluten

// Cupo de gluten de una comida: porcentaje del cupo diario (80 g de pan de salvado, Etapa 5) y sus fuentes. Los porcentajes
// salen de plan.gluten (por porción y por alimento del menú); la avena y la cerveza no suman.
export function glutenComida(c, r = {}) {
  const G = plan.gluten;
  const fuentes = new Map(); // alimento → % del cupo
  const avisos = new Map(); // alimento → aviso, para lo que tiene gluten y la Etapa 5 no dice cuánto del cupo usa
  const q = r.que_comi;
  if (vacio(q) || q === "no comí") return { pct: 0, fuentes: [], avisos: [] };
  const sumar = (nombre, pct) => fuentes.set(nombre, (fuentes.get(nombre) ?? 0) + pct);
  const porPorcion = (alimento, cant) => {
    const p = porcion(alimento);
    if (!p) return;
    if (G.porciones[p.porcion_id]) sumar(p.alimento, G.porciones[p.porcion_id].pct * N(cant));
    else if (G.porciones_con_aviso_sin_pct[p.porcion_id]) { sumar(p.alimento, 0); avisos.set(p.alimento, `${p.alimento}: ${G.porciones_con_aviso_sin_pct[p.porcion_id]}`); }
  };
  const plato = platoDe(c, r);
  if (plato) for (const m of alimentosMenu(plato.dia, c.comida, plato.opcion)) if (G.menu[m.alimento]) sumar(m.alimento, (N(m.gramos) / G.menu[m.alimento].cupo_g) * 100);
  if (q === "cambio") for (const g of [...GRUPOS_CAMBIO, "verdura"]) porPorcion(r[g], r[`${g}_porc`]);
  porPorcion(r.bebida, r.bebida_porc);
  porPorcion(r.otro, r.otro_porc);
  return { pct: suma([...fuentes.values()]), fuentes: [...fuentes].map(([nombre, pct]) => ({ nombre, pct })), avisos: [...avisos.values()] };
}

// Cupo del día: suma de las comidas. Avisa si pasa el 100 % o si junta más de una fuente (la Etapa 5 pide una sola por día).
export function glutenDia(comidas /* de calcularDia().comidas */) {
  const por = new Map();
  const avisosSinPct = new Set();
  for (const x of comidas) {
    for (const f of x.gluten.fuentes) por.set(f.nombre, (por.get(f.nombre) ?? 0) + f.pct);
    x.gluten.avisos.forEach((a) => avisosSinPct.add(a));
  }
  const pct = suma([...por.values()]);
  const avisos = [];
  if (pct > 100 + 1e-9) avisos.push(`Pasás el cupo de gluten del día (${Math.round(pct)} % del cupo de ${plan.gluten.cupo_dia_g_pan} g de pan de salvado).`);
  if (por.size > 1) avisos.push(`Juntás más de una fuente de gluten en el día (${[...por.keys()].join(", ")}): la Etapa 5 pide una sola fuente por día.`);
  return { pct, fuentes: [...por].map(([nombre, p]) => ({ nombre, pct: p })), avisos: [...avisos, ...avisosSinPct], pasa: pct > 100 + 1e-9 || por.size > 1 };
}

// ---------------------------------------------------------------- Diario (R a Y) y Comidas!Z y AA

export function calcularDia(fecha) {
  const C = plan.constantes;
  const i = idx().fechas.get(fecha);
  const d = plan.calendario[i];
  const obj = objetivoDe(fecha);
  let acK = 0, acP = 0;
  const comidas = (idx().comidasPorFecha.get(fecha) ?? []).map((c) => {
    const r = reg.comidas.get(claveComida(fecha, c.comida)) ?? {};
    const res = calcularComida(c, r);
    acK += N(res.kcal);
    acP += N(res.proteina_g);
    const falta = vacio(r.que_comi) ? { kcal: "", proteina: "" } : { kcal: obj.kcal - acK, proteina: C.proteina_objetivo_falta_g - acP };
    return { c, r, res, falta, gluten: glutenComida(c, r) };
  });
  const cargadas = comidas.filter((x) => !vacio(x.r.que_comi)).length;
  const tot = (k) => (cargadas ? redondear(suma(comidas.map((x) => N(x.res[k])))) : "");
  const out = {
    fecha, d, comidas, cargadas, estado_ajuste: obj.estado, ajuste_desde: obj.desde,
    kcal_objetivo: obj.kcal, carbos_obj_g: obj.carbos,
    kcal_real: tot("kcal"), proteina_real_g: tot("proteina_g"), carbos_real_g: tot("carbos_g"), grasas_real_g: tot("grasas_g"),
    // Diario!X suma el alcohol de todas las comidas de la fecha, también las que no tienen «que_comi».
    alcohol_kcal: cargadas ? suma(comidas.map((x) => N(x.res.alcohol_kcal))) : "",
    comida_ok: "", proteina_ok: "",
    gluten: glutenDia(comidas),
  };
  if (cargadas === C.comidas_por_tipo_dia[d.tipo_dia]) {
    out.comida_ok = Math.abs(out.kcal_real - out.kcal_objetivo) <= C.tolerancia_kcal_comida_ok * out.kcal_objetivo ? "si" : "no";
    out.proteina_ok = out.proteina_real_g >= C.proteina_ok_minimo_g ? "si" : "no";
  }
  out.peso_prom_7d = pesoProm7d(fecha);
  return out;
}

// Diario!Y: pesajes de la fila y las 6 anteriores (desde el día 0), con 5 como mínimo.
export function pesoProm7d(fecha) {
  const C = plan.constantes;
  const i = idx().fechas.get(fecha);
  if (i === undefined) return "";
  const pesos = [];
  for (let j = Math.max(0, i - C.promedio_peso_ventana_dias + 1); j <= i; j++) {
    const p = reg.diario.get(plan.calendario[j].fecha)?.peso_kg;
    if (esNumero(p)) pesos.push(p);
  }
  return pesos.length >= C.promedio_peso_minimo_pesajes ? redondear(suma(pesos) / pesos.length, 2) : "";
}

// ---------------------------------------------------------------- Registro!M

// Para la pantalla: null si ninguna sesión anterior tiene carga (se muestra «sin carga anterior»).
export function cargaAnterior(fila) {
  const { itemPorFila } = idx();
  let it = itemPorFila.get(fila);
  while (it?.fila_anterior != null) {
    it = itemPorFila.get(it.fila_anterior);
    const c = reg.registro.get(claveRegistro(it.fecha, it.ejercicio_id))?.carga_kg;
    if (!vacio(c)) return { carga: c, fecha: it.fecha };
  }
  return null;
}

// Para exportar, igual que Excel: sin fórmula (primera vez) queda vacía; una fórmula que llega a una celda vacía da 0.
export function cargaAnteriorExcel(fila) {
  const it = idx().itemPorFila.get(fila);
  if (it?.fila_anterior == null) return "";
  const ant = idx().itemPorFila.get(it.fila_anterior);
  const c = reg.registro.get(claveRegistro(ant.fecha, ant.ejercicio_id))?.carga_kg;
  if (!vacio(c)) return c;
  const m = cargaAnteriorExcel(ant.fila);
  return m === "" ? 0 : m;
}

// ---------------------------------------------------------------- Medidas

export function grasaPct(cintura, cuello) {
  if (!esNumero(cintura) || !esNumero(cuello)) return "";
  if (cintura - cuello <= 0) return NaN; // #¡NUM! en Excel; los rangos de carga no lo permiten
  return redondear(495 / (1.0324 - 0.19077 * Math.log10(cintura - cuello) + 0.15456 * Math.log10(plan.constantes.altura_cm)) - 450, 1);
}
export const masaMagra = (peso, grasa) => (esNumero(peso) && esNumero(grasa) ? redondear(peso * (1 - grasa / 100), 1) : "");
export const cinturaAltura = (cintura) => (esNumero(cintura) ? redondear(cintura / plan.constantes.altura_cm, 2) : "");

// Medidas!O y P: la semana que termina en la fecha (7 días, aunque falten).
function semanaHasta(fecha) {
  const i = idx().fechas.get(fecha);
  let si = 0;
  const pausas = [];
  for (let j = Math.max(0, i - 6); j <= i; j++) {
    const f = plan.calendario[j].fecha;
    if (calcularDia(f).comida_ok === "si") si++;
    const p = reg.diario.get(f)?.pausas;
    if (esNumero(p)) pausas.push(p);
  }
  return { cumplimiento_pct: si / 7, pausas_prom: pausas.length ? redondear(suma(pausas) / pausas.length, 1) : "" };
}

export const CAMPOS_MEDIDA = ["cintura_cm", "cuello_cm", "cadera_cm", "muslo_cm", "brazo_cm"];

// Valor de un campo de carga: lo del usuario o, si no hay, lo que trae plan.xlsx (por ejemplo las medidas de inicio).
export const valorMedida = (m, k) => (vacio(reg.medidas.get(m.fecha)?.[k]) ? m[k] ?? "" : reg.medidas.get(m.fecha)[k]);

export function calcularMedidas() {
  const C = plan.constantes;
  const filas = plan.medidas_plan.map((m) => {
    const v = Object.fromEntries([...CAMPOS_MEDIDA, "foto", "notas"].map((k) => [k, valorMedida(m, k)]));
    const peso = m.peso_de_diario ? pesoProm7d(m.fecha) : m.peso_prom_7d ?? "";
    const grasa = grasaPct(v.cintura_cm, v.cuello_cm);
    return {
      m, ...v, peso_prom_7d: peso, grasa_pct: grasa, masa_magra_kg: masaMagra(peso, grasa), cintura_altura: cinturaAltura(v.cintura_cm),
      ...(m.calcula_semana ? semanaHasta(m.fecha) : { cumplimiento_pct: "", pausas_prom: "" }),
    };
  });
  const porFila = new Map(filas.map((f) => [f.m._fila, f]));
  for (const f of filas) {
    const b = porFila.get(f.m.dif_contra_fila);
    f.dif_peso_kg = b && esNumero(f.peso_prom_7d) && esNumero(b.peso_prom_7d) ? redondear(f.peso_prom_7d - b.peso_prom_7d, 2) : "";
    f.dif_cintura_cm = b && esNumero(f.cintura_cm) && esNumero(b.cintura_cm) ? redondear(f.cintura_cm - b.cintura_cm, 1) : "";
  }
  for (const f of filas) {
    f.alerta = "";
    if (!f.m.alerta_contra_filas) continue;
    const [fPrev, fCint] = f.m.alerta_contra_filas;
    const d = f.dif_peso_kg, dPrev = porFila.get(fPrev).dif_peso_kg;
    const e = f.cintura_cm, ePrev = porFila.get(fCint).cintura_cm;
    if (![d, dPrev, e, ePrev].every(esNumero)) f.alerta = "Faltan datos";
    else if (d > C.alerta_estancamiento.dif_peso_mayor_a && dPrev > C.alerta_estancamiento.dif_peso_mayor_a
      && e - ePrev > C.alerta_estancamiento.dif_cintura_2_semanas_mayor_a) f.alerta = "Posible estancamiento: seguí los pasos de la Etapa 1";
    else if (d < C.alerta_baja_rapida.dif_peso_menor_a && dPrev < C.alerta_baja_rapida.dif_peso_menor_a) f.alerta = "Baja rápida: regla inversa de la Etapa 1";
  }
  return filas;
}

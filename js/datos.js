// Acceso a app/datos/plan.json y cálculos que replican plan.xlsx (ver docs/formulas.md).

import { planDescifrado } from "./cifrado.js";

export let plan = null;
// Si los datos vinieron de plan.enc (publicado) o de plan.json (computadora de desarrollo, sin cifrar).
export const modoCifrado = { activo: false };
let ejercicioPorId = new Map();

// En 127.0.0.1 y localhost se usa plan.json si está (sin contraseña, para desarrollar y probar; «?cifrado» fuerza plan.enc). Publicada,
// la app solo tiene plan.enc: lo abre con la contraseña, que se pide una vez por dispositivo (js/cifrado.js).
export async function cargar(pedirContrasena) {
  const local = ["127.0.0.1", "localhost"].includes(location.hostname) && !new URLSearchParams(location.search).has("cifrado");
  const r = local ? await fetch("datos/plan.json", { cache: "no-cache" }).catch(() => null) : null;
  if (r?.ok) plan = await r.json();
  else {
    plan = await planDescifrado(pedirContrasena);
    modoCifrado.activo = true;
  }
  ejercicioPorId = new Map(plan.ejercicios.map((e) => [e.id, e]));
  return plan;
}

export const ejercicio = (id) => ejercicioPorId.get(id);
export const diaPlan = (fecha) => plan.calendario.find((c) => c.fecha === fecha);
export const sesionDe = (fecha) => plan.sesiones.find((s) => s.fecha === fecha);
export const rutinaDe = (fase, dia, bloque) =>
  plan.rutina.filter((r) => r.fase === fase && r.dia === dia && r.bloque === bloque).sort((a, b) => a.orden - b.orden);
export const pausa = (id) => plan.pausas.items.filter((p) => p.pausa_id === id).sort((a, b) => a.orden - b.orden);
export const totalMenu = (dia, comida, opcion) => plan.menu_totales.find((t) => t.clave === `${dia}|${comida}|${opcion}`);
export const alimentosMenu = (dia, comida, opcion) =>
  plan.menu.filter((m) => m.dia === dia && m.comida === comida && String(m.opcion) === String(opcion));

// Grupos del «cambio» por porciones según la comida (los de Comidas de plan.xlsx para almuerzo y cena; los de desayuno
// y merienda salen de la columna grupo_desayuno_merienda de Porciones). La verdura por defecto es solo de almuerzo y cena.
export const GRUPOS_CAMBIO_ALM_CENA = ["proteina", "acomp_1", "acomp_2", "verdura", "grasa", "fruta"];
export const GRUPOS_CAMBIO_DES_MER = ["proteina", "proteina_2", "lacteo", "pan_cereal", "fruta", "fruta_2", "grasa", "dulce"];
export const esDesayunoMerienda = (comida) => comida === "Desayuno" || comida === "Merienda";
export const gruposDe = (comida) => (esDesayunoMerienda(comida) ? GRUPOS_CAMBIO_DES_MER : GRUPOS_CAMBIO_ALM_CENA);
export const DIAS_SEMANA = () => plan.calendario.slice(0, 7).map((c) => c.dia_semana);
// Platos 1 y 2 de una comida en los 7 días de la semana: { dia, opcion, texto, tipo_dia, total }. `texto` es el de Listas (lo que va en que_comi).
export function platosDeComida(comida) {
  const tipo = new Map(plan.calendario.slice(0, 7).map((c) => [c.dia_semana, c.tipo_dia]));
  return DIAS_SEMANA().flatMap((dia) => (plan.que_comi[`${dia}|${comida}`] ?? []).filter((t) => /^[12]/.test(t)).map((texto) => ({
    dia, opcion: texto.charAt(0), texto, tipo_dia: tipo.get(dia), total: totalMenu(dia, comida, texto.charAt(0)),
  })));
}
export const alarmaDe = (id) =>
  plan.alarmas_ejercicios.find((a) => a.ID === id) ?? plan.metas.alarmas_control.find((a) => a.ID === id);
export const metaFuerzaDe = (id) => plan.metas.fuerza.find((m) => m.ID === id);

export function proximaSesion(fecha) {
  return plan.sesiones.find((s) => s.fecha >= fecha) ?? null;
}

// ROUND de Excel: mitad hacia afuera del cero, con 15 cifras significativas.
export function redondear(x, n = 0) {
  const f = 10 ** n;
  const v = Number((Math.abs(x) * f).toPrecision(15));
  return (Math.sign(x) * Math.round(v)) / f;
}

// Diario!O: último estado con fecha_desde <= fecha; si no hay, "base". La lista la arma calculos.ajustes().
export function estadoAjuste(fecha, ajustes) {
  let estado = plan.constantes.estado_ajuste_por_defecto;
  let desde = null;
  for (const a of [...ajustes].sort((x, y) => x.fecha_desde.localeCompare(y.fecha_desde))) {
    if (a.fecha_desde <= fecha) { estado = a.estado_ajuste; desde = a.fecha_desde; } else break;
  }
  return { estado, desde };
}

// Diario!P y Diario!Q.
export function objetivoDia(tipoDia, estado) {
  const C = plan.constantes;
  const obj = (t) => (estado === "mantenimiento" ? t.mantenimiento
    : t[tipoDia] + (estado === "recorte40" ? t.recorte40 : estado === "inversa40" ? t.inversa40 : 0));
  return { kcal: obj(C.kcal_objetivo), carbos: obj(C.carbos_obj_g), proteina: C.proteina_objetivo_falta_g };
}

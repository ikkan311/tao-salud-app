// Respaldo de los registros en una planilla de Google Sheets, mediante una aplicación web de Apps Script (apps-script/respaldo.gs).
// - Los registros que cambian quedan anotados como «pendientes» en IndexedDB (js/registros.js) y se mandan solos cuando hay conexión.
// - El link de la aplicación web y el token se guardan en este dispositivo (localStorage), nunca en el repositorio ni en los datos del plan.
// - El token va en el cuerpo del pedido (HTTPS), no en la dirección, y solo se manda a script.google.com.
// - Restaurar: se lee la planilla y se pasa por la misma pantalla de importación que un archivo de Excel (sin pisar nada sin preguntar).

import { reg, pendientes, alCambiar, quitarPendientes, marcarTodoPendiente } from "./registros.js";
import { CARGA } from "./planilla.js";

const CLAVE_CONFIG = "tao-respaldo";
const POR_PEDIDO = 400; // filas por pedido (el script acepta hasta 1000)
const ESPERA_TRAS_CAMBIO_MS = 4000;
const ESPERA_TRAS_ERROR_MS = 60000;
const REVISAR_CADA_MS = 5 * 60000;

// Pestaña de la planilla y campos que la identifican. Las columnas son los campos de carga de cada tabla.
const TABLAS = {
  diario: { hoja: "Diario", claves: ["fecha"] },
  comidas: { hoja: "Comidas", claves: ["fecha", "comida"] },
  registro: { hoja: "Registro", claves: ["fecha", "ejercicio_id"] },
  medidas: { hoja: "Medidas", claves: ["fecha"] },
  ajustes: { hoja: "Ajustes", claves: ["fecha_desde"] },
};
const columnasDe = (t) => [...new Set([...TABLAS[t].claves, ...(t === "ajustes" ? ["estado_ajuste"] : Object.keys(CARGA[t]))])];
const esNumerica = (c) => /(_kg|_h|_cm|_porc)$|^(pausas|caminata_min|rpe)$|^reps_s\d$|^dolor_/.test(c);

// Solo se acepta la dirección de una aplicación web de Apps Script: el token no se manda a ningún otro sitio.
export const URL_VALIDA = /^https:\/\/script\.google\.com\/(a\/[\w.-]+\/)?macros\/s\/[\w-]+\/exec$/;

// ---------------------------------------------------------------- configuración y estado

export function leerConfig() {
  try { const c = JSON.parse(localStorage.getItem(CLAVE_CONFIG)); return c?.url && c?.token ? c : null; } catch { return null; }
}
function escribirConfig(c) {
  try { if (c) localStorage.setItem(CLAVE_CONFIG, JSON.stringify(c)); else localStorage.removeItem(CLAVE_CONFIG); } catch { /* sin almacenamiento: no se puede configurar */ }
}
const actualizarConfig = (cambios) => { const c = leerConfig(); if (c) escribirConfig({ ...c, ...cambios }); };

let enviando = false;
let proximoIntentoDesde = 0;
const avisarEstado = () => document.dispatchEvent(new Event("respaldo-estado"));

export function estadoRespaldo() {
  const c = leerConfig();
  return { configurado: !!c, pendientes: pendientes.size, ultima: c?.ultima ?? null, error: c?.error ?? null, enviando, enLinea: navigator.onLine };
}

const dosCifras = (n) => String(n).padStart(2, "0");
export function cuandoFue(iso) {
  const d = new Date(iso), hoy = new Date(), ayer = new Date(hoy.getTime() - 86400000);
  const hora = `${dosCifras(d.getHours())}:${dosCifras(d.getMinutes())}`;
  const mismo = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  return mismo(d, hoy) ? `hoy ${hora}` : mismo(d, ayer) ? `ayer ${hora}` : `${dosCifras(d.getDate())}/${dosCifras(d.getMonth() + 1)} ${hora}`;
}

// Texto corto para el encabezado y para Plan, y su estado de color (ok, pendiente, error).
export function indicador() {
  const e = estadoRespaldo();
  if (!e.configurado) return { tipo: "local", texto: "En tu dispositivo" };
  if (e.enviando) return { tipo: "pendiente", texto: "Respaldando…" };
  if (e.error) return { tipo: "error", texto: e.pendientes ? `${e.pendientes} sin respaldar · error` : "Error de respaldo" };
  if (e.pendientes) return { tipo: "pendiente", texto: e.enLinea ? `${e.pendientes} sin respaldar` : `${e.pendientes} sin respaldar · sin conexión` };
  return { tipo: "ok", texto: e.ultima ? `Respaldado ${cuandoFue(e.ultima)}` : "Respaldo al día" };
}

// ---------------------------------------------------------------- pedidos

async function pedir(cfg, cuerpo) {
  if (!URL_VALIDA.test(cfg.url)) throw new Error("La dirección no es la de una aplicación web de Apps Script.");
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), 45000);
  let r;
  try {
    // Sin cabeceras propias: el cuerpo viaja como text/plain y el navegador no pide permiso previo (Apps Script no lo contesta).
    r = await fetch(cfg.url, { method: "POST", body: JSON.stringify({ token: cfg.token, ...cuerpo }), redirect: "follow", signal: control.signal });
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "Google tardó demasiado en responder." : "No se pudo conectar con Google.");
  } finally {
    clearTimeout(corte);
  }
  let j;
  try { j = JSON.parse(await r.text()); } catch { throw new Error("La dirección no respondió como el respaldo: revisá que sea la de la aplicación web y que esté abierta a «Cualquier persona»."); }
  if (!j.ok) throw new Error(j.error === "token" ? "El token no es correcto." : `El script respondió: ${j.error}`);
  return j;
}

function clavesDe(tabla, clave) {
  const partes = tabla === "comidas" || tabla === "registro" ? clave.split("|") : [clave];
  return Object.fromEntries(TABLAS[tabla].claves.map((c, i) => [c, partes[i]]));
}

// Lotes del pedido a partir de los pendientes: los registros que existen se mandan completos; los que ya no existen, para borrar.
function armarLotes(lista) {
  const por = {};
  for (const p of lista) {
    const l = (por[p.tabla] ??= { tabla: TABLAS[p.tabla].hoja, claves: TABLAS[p.tabla].claves, columnas: columnasDe(p.tabla), numericas: columnasDe(p.tabla).filter(esNumerica), filas: [], borrar: [] });
    const fila = reg[p.tabla].get(p.clave);
    if (fila) { const { clave, ...campos } = fila; l.filas.push(campos); } else l.borrar.push(clavesDe(p.tabla, p.clave));
  }
  return Object.values(por);
}

// ---------------------------------------------------------------- envío

const mensaje = (e) => e.message || String(e);

export async function enviarPendientes({ forzar = false } = {}) {
  const cfg = leerConfig();
  if (!cfg || enviando || !navigator.onLine || !pendientes.size) return { enviados: 0 };
  if (!forzar && Date.now() < proximoIntentoDesde) return { enviados: 0 };
  enviando = true;
  avisarEstado();
  let enviados = 0;
  try {
    const lista = [...pendientes.values()];
    for (let i = 0; i < lista.length; i += POR_PEDIDO) {
      const parte = lista.slice(i, i + POR_PEDIDO);
      await pedir(cfg, { accion: "guardar", lotes: armarLotes(parte) });
      await quitarPendientes(parte.map(({ id, v }) => ({ id, v })));
      enviados += parte.length;
    }
    actualizarConfig({ ultima: new Date().toISOString(), error: null });
    proximoIntentoDesde = 0;
  } catch (e) {
    actualizarConfig({ error: mensaje(e) });
    proximoIntentoDesde = Date.now() + ESPERA_TRAS_ERROR_MS;
    return { enviados, error: mensaje(e) };
  } finally {
    enviando = false;
    avisarEstado();
  }
  return { enviados };
}

let temporizador = null;
export function programarEnvio(ms = ESPERA_TRAS_CAMBIO_MS) {
  if (!leerConfig()) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => enviarPendientes(), ms);
}

// Guarda el link y el token después de comprobar que funcionan; deja anotado todo lo que ya hay para mandarlo.
export async function configurar(url, token) {
  url = String(url ?? "").trim();
  token = String(token ?? "").trim();
  if (!URL_VALIDA.test(url)) throw new Error("La dirección tiene que ser la de la aplicación web, la que termina en /exec (empieza con https://script.google.com/).");
  if (token.length < 16) throw new Error("El token es muy corto: copialo completo desde Apps Script.");
  const r = await pedir({ url, token }, { accion: "probar" });
  escribirConfig({ url, token, ultima: null, error: null });
  await marcarTodoPendiente();
  avisarEstado();
  programarEnvio(300);
  return r;
}

export function quitarConfiguracion() {
  escribirConfig(null);
  clearTimeout(temporizador);
  avisarEstado();
}

// Lee toda la planilla y la deja en el formato de hojas que entiende la importación: [[encabezado], [fila], …] por pestaña.
export async function leerPlanilla() {
  const cfg = leerConfig();
  if (!cfg) throw new Error("Primero configurá el respaldo.");
  if (!navigator.onLine) throw new Error("Sin conexión: no se puede leer la planilla.");
  const r = await pedir(cfg, { accion: "leer" });
  const hojas = {};
  for (const [nombre, h] of Object.entries(r.hojas ?? {})) hojas[nombre] = [h.columnas, ...h.filas];
  return hojas;
}

export function iniciarRespaldo() {
  alCambiar(() => { programarEnvio(); avisarEstado(); });
  window.addEventListener("online", () => { avisarEstado(); programarEnvio(500); });
  window.addEventListener("offline", avisarEstado);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") programarEnvio(1000); });
  setInterval(() => { if (pendientes.size) programarEnvio(0); }, REVISAR_CADA_MS);
  programarEnvio(2500);
  avisarEstado();
}

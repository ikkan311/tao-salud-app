// Registros del usuario en IndexedDB, en el celular. Nunca van al repositorio.
// Al abrir la app se cargan todos en memoria (son pocos: a lo sumo unas 800 filas en 90 días).

const DB = "tao-salud";
const VERSION = 2;

// Una tabla por pestaña de plan.xlsx, con su clave. La clave identifica la fila del plan, no el número de fila.
export const CLAVE = { diario: "fecha", comidas: "clave", registro: "clave", medidas: "fecha", ajustes: "fecha_desde" };
// Campos que arman la clave y que no cuentan como datos cargados.
const CAMPOS_CLAVE = { diario: ["fecha"], comidas: ["clave", "fecha", "comida"], registro: ["clave", "fecha", "ejercicio_id"], medidas: ["fecha"], ajustes: ["fecha_desde"] };

export const reg = Object.fromEntries(Object.keys(CLAVE).map((t) => [t, new Map()]));
let db = null;

// Videos que quitó el usuario de la ficha de un ejercicio (clave «ID|opción»). No son registros del plan: no se exportan ni se importan.
const TABLA_QUITADOS = "videos_quitados";
const quitados = new Set();

const pedido = (r) => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });
const fin = (tx) => new Promise((ok, mal) => { tx.oncomplete = () => ok(); tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error); });

export async function abrir() {
  const r = indexedDB.open(DB, VERSION);
  r.onupgradeneeded = () => {
    for (const [t, k] of Object.entries(CLAVE)) if (!r.result.objectStoreNames.contains(t)) r.result.createObjectStore(t, { keyPath: k });
    if (!r.result.objectStoreNames.contains(TABLA_QUITADOS)) r.result.createObjectStore(TABLA_QUITADOS, { keyPath: "clave" });
  };
  db = await pedido(r);
  const tx = db.transaction(Object.keys(CLAVE), "readonly");
  for (const t of Object.keys(CLAVE)) {
    const filas = await pedido(tx.objectStore(t).getAll());
    reg[t] = new Map(filas.map((f) => [f[CLAVE[t]], f]));
  }
  const tq = db.transaction(TABLA_QUITADOS, "readonly");
  for (const f of await pedido(tq.objectStore(TABLA_QUITADOS).getAll())) quitados.add(f.clave);
}

export const videoQuitado = (ejercicioId, opcion) => quitados.has(`${ejercicioId}|${opcion}`);

export async function quitarVideo(ejercicioId, opcion, quitar) {
  const clave = `${ejercicioId}|${opcion}`;
  const tx = db.transaction(TABLA_QUITADOS, "readwrite");
  if (quitar) tx.objectStore(TABLA_QUITADOS).put({ clave, ejercicio_id: ejercicioId, opcion });
  else tx.objectStore(TABLA_QUITADOS).delete(clave);
  await fin(tx);
  if (quitar) quitados.add(clave); else quitados.delete(clave);
}

export const claveComida = (fecha, comida) => `${fecha}|${comida}`;
export const claveRegistro = (fecha, ejercicioId) => `${fecha}|${ejercicioId}`;

export function base(tabla, clave) {
  if (tabla === "comidas") { const [fecha, comida] = clave.split("|"); return { clave, fecha, comida }; }
  if (tabla === "registro") { const [fecha, ejercicio_id] = clave.split("|"); return { clave, fecha, ejercicio_id }; }
  return { [CLAVE[tabla]]: clave };
}

export const vacio = (v) => v === null || v === undefined || v === "";

// Campos cargados de un registro, sin los de la clave.
export function datos(tabla, fila) {
  if (!fila) return {};
  return Object.fromEntries(Object.entries(fila).filter(([k, v]) => !CAMPOS_CLAVE[tabla].includes(k) && !vacio(v)));
}

export const obtener = (tabla, clave) => reg[tabla].get(clave);
export const valor = (tabla, clave, campo) => reg[tabla].get(clave)?.[campo] ?? "";

// Guarda un campo. Un valor vacío lo borra; si el registro se queda sin datos, se borra entero.
export async function guardarCampo(tabla, clave, campo, v) {
  await guardarCampos(tabla, clave, { [campo]: v });
}

// Varios campos de un registro en una sola escritura ({ campo: valor }; vacío borra).
export async function guardarCampos(tabla, clave, cambios) {
  const fila = { ...(reg[tabla].get(clave) ?? base(tabla, clave)) };
  for (const [campo, v] of Object.entries(cambios)) {
    if (vacio(v)) delete fila[campo]; else fila[campo] = v;
  }
  await guardarFilas(tabla, [fila]);
}

export async function guardarFilas(tabla, filas) {
  const tx = db.transaction(tabla, "readwrite");
  const st = tx.objectStore(tabla);
  for (const f of filas) {
    const k = f[CLAVE[tabla]];
    if (tabla !== "ajustes" && !Object.keys(datos(tabla, f)).length) st.delete(k); else st.put(f);
  }
  await fin(tx);
  for (const f of filas) {
    const k = f[CLAVE[tabla]];
    if (tabla !== "ajustes" && !Object.keys(datos(tabla, f)).length) reg[tabla].delete(k); else reg[tabla].set(k, f);
  }
}

export async function borrar(tabla, clave) {
  const tx = db.transaction(tabla, "readwrite");
  tx.objectStore(tabla).delete(clave);
  await fin(tx);
  reg[tabla].delete(clave);
}

export const cuantos = () => Object.fromEntries(Object.keys(CLAVE).map((t) => [t, reg[t].size]));

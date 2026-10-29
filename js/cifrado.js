// Descifrado de datos/plan.enc (lo único del plan que se publica). Lo escribe scripts/cifrar_datos.py: AES-GCM con una clave que sale de
// una contraseña por PBKDF2-SHA256. La contraseña se pide una vez por dispositivo: se guarda la CryptoKey derivada, no exportable, en una
// base de IndexedDB aparte (tao-salud-clave). Ni la contraseña ni la clave en bruto quedan guardadas, y los registros no se cifran ni se tocan.

const DB = "tao-salud-clave", TABLA = "clave", ID = "plan";
const AAD = new TextEncoder().encode("tao-salud-plan-v1");

const pedido = (r) => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });

async function abrirDb() {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(TABLA);
  return pedido(r);
}

export async function leerClave() {
  try {
    const db = await abrirDb();
    return (await pedido(db.transaction(TABLA).objectStore(TABLA).get(ID))) ?? null;
  } catch {
    return null; // sin IndexedDB (ventana privada, por ejemplo): se pide la contraseña cada vez
  }
}

async function guardarClave(clave) {
  try {
    const db = await abrirDb();
    const tx = db.transaction(TABLA, "readwrite");
    tx.objectStore(TABLA).put(clave, ID);
    await new Promise((ok, mal) => { tx.oncomplete = ok; tx.onerror = () => mal(tx.error); });
  } catch { /* sin dónde guardarla: la próxima vez se vuelve a pedir */ }
}

export async function olvidarClave() {
  const db = await abrirDb();
  const tx = db.transaction(TABLA, "readwrite");
  tx.objectStore(TABLA).delete(ID);
  await new Promise((ok, mal) => { tx.oncomplete = ok; tx.onerror = () => mal(tx.error); });
}

const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Clave AES-GCM no exportable derivada de la contraseña.
async function derivar(contrasena, sobre) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(contrasena), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: deB64(sobre.sal), iterations: sobre.iteraciones, hash: sobre.hash },
    material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}

// JSON del plan, o una excepción OperationError si la clave no corresponde.
async function descifrar(sobre, clave) {
  const plano = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(sobre.iv), additionalData: AAD }, clave, deB64(sobre.datos));
  const texto = await new Response(new Blob([plano]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return JSON.parse(texto);
}

// Descarga plan.enc y lo abre con la clave guardada. Si no hay, o ya no sirve (se volvió a cifrar con otra contraseña),
// llama a pedir(mensajeDeError) hasta que la contraseña sea correcta. Los errores de red salen tal cual.
export async function planDescifrado(pedir) {
  const r = await fetch("datos/plan.enc", { cache: "no-cache" });
  if (!r.ok) throw new Error(`No pude leer los datos del plan (${r.status}).`);
  const sobre = await r.json();
  const guardada = await leerClave();
  if (guardada) {
    try { return await descifrar(sobre, guardada); } catch (e) { if (e.name !== "OperationError") throw e; await olvidarClave(); }
  }
  let error = "";
  for (;;) {
    const contrasena = await pedir(error);
    const clave = await derivar(contrasena, sobre);
    try {
      const plan = await descifrar(sobre, clave);
      await guardarClave(clave);
      return plan;
    } catch (e) {
      if (e.name !== "OperationError") throw e;
      error = "La contraseña no es correcta.";
    }
  }
}

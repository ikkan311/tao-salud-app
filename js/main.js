// Arranque, navegación por hash y eventos de la app.

import { esc, icono, aISO, sumarDias } from "./util.js";
import { cargar, plan } from "./datos.js";
import { olvidarClave } from "./cifrado.js";
import { aplicarTema, guardarTema } from "./tema.js";
import { abrir, guardarCampo, guardarCampos, guardarFilas, borrar, valor, vacio } from "./registros.js";
import { analizar, aplicar, exportar, GRUPOS_TODOS } from "./planilla.js";
import { iniciar as iniciarServiceWorker, actualizar, buscarActualizacion, instalar } from "./actualizacion.js";
import { contenidoHoja, htmlHoja } from "./hoja.js";
import { vistaHoy } from "./vistas/hoy.js";
import { vistaEntreno } from "./vistas/entreno.js";
import { vistaComidas } from "./vistas/comidas.js";
import { vistaRegistro } from "./vistas/registro.js";
import * as P from "./vistas/plan.js";
import { LIMITE_EJ, resultadosEjercicios } from "./vistas/plan.js";

const raiz = document.getElementById("vista");
const params = new URLSearchParams(location.search);
// pila: diálogos apilados (el último es el que se ve); fondo: pantalla que queda debajo cuando la ruta es un diálogo (#/ejercicio/ID, #/alarma).
const estado = { fecha: null, pestanaRegistro: "diario", medida: null, filtroEj: { limite: LIMITE_EJ }, importacion: null, pila: [], fondo: null };
const hoja = document.getElementById("hoja");
const hojaContenido = document.getElementById("hoja-contenido");

const SECCIONES = [["hoy", "Hoy"], ["entreno", "Entreno"], ["comidas", "Comidas"], ["registro", "Registro"], ["plan", "Plan"]];
document.getElementById("navegacion").innerHTML = SECCIONES.map(([id, t]) => `<a href="#/${id}" data-sec="${id}">${icono(id)}<span>${t}</span></a>`).join("");
document.getElementById("icono-alarma").innerHTML = icono("alerta");
document.getElementById("hoja-cerrar").innerHTML = icono("cerrar");
document.getElementById("hoja-atras").innerHTML = icono("izq");

// Fecha y hora "de ahora". Para probar: ?fecha=2026-10-28&hora=18:45
function ahora() {
  const f = new Date();
  const fecha = params.get("fecha") ?? aISO(f);
  const [h, m] = (params.get("hora") ?? `${f.getHours()}:${f.getMinutes()}`).split(":").map(Number);
  return { fecha, min: h * 60 + m };
}

function acotar(fecha) {
  const ini = plan.calendario[0].fecha, fin = plan.calendario[plan.calendario.length - 1].fecha;
  return fecha < ini ? ini : fecha > fin ? fin : fecha;
}

const PRINCIPALES = ["hoy", "entreno", "comidas", "registro", "plan"];

function rutas(partes) {
  const [a, b, c] = partes;
  switch (a) {
    case "hoy": return vistaHoy(estado.fecha, ahora());
    case "entreno": return vistaEntreno(estado.fecha);
    case "comidas": return vistaComidas(estado.fecha);
    case "registro": return vistaRegistro(estado.fecha, { pestana: estado.pestanaRegistro, medida: estado.medida });
    case "plan":
      switch (b) {
        case "ajuste": return P.vistaAjuste(estado.fecha);
        case "importar": return P.vistaImportar(estado.importacion);
        default: return P.vistaPlan(estado.fecha, estado.filtroEj);
      }
    default: return null;
  }
}

// Rutas que abren un diálogo sobre la pantalla de abajo: #/ejercicio/ID, #/alarma, #/doc/ID[/seccion] y #/plan/<consulta>.
const CONSULTAS_PLAN = ["suplementos", "reglas", "analisis", "contexto", "documentos", "compras", "porciones", "metas"];
const esRutaDialogo = (p) => ["ejercicio", "alarma", "doc"].includes(p[0]) || (p[0] === "plan" && CONSULTAS_PLAN.includes(p[1]));
function hojaDeRuta(p) {
  switch (p[0]) {
    case "alarma": return { tipo: "alarma" };
    case "ejercicio": return { tipo: "ejercicio", ejercicio: decodeURIComponent(p[1] ?? "") };
    case "doc": return { tipo: "documento", clave: p[1], seccion: p[2] };
    default: return { tipo: p[1] };
  }
}

function render() {
  let partes = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (!partes.length) { location.replace("#/hoy"); return; }
  // #/registro/diario sigue andando: es la pestaña Diario de Registro.
  if (partes[0] === "registro" && partes[1] === "diario") { estado.pestanaRegistro = "diario"; location.replace("#/registro"); return; }
  if (partes[0] === "plan" && partes[1] === "ejercicios") { location.replace("#/plan"); return; }
  const rutaDialogo = esRutaDialogo(partes) ? partes : null;
  if (rutaDialogo) partes = estado.fondo ?? ["plan"]; else estado.fondo = partes;
  const html = rutas(partes);
  if (html === null) { location.replace("#/hoy"); return; }
  const principal = PRINCIPALES.includes(partes[0]) && partes.length === 1;
  const seccionNav = partes[0];
  raiz.innerHTML = (principal ? "" : `<div class="barra-volver"><button class="btn-volver" data-volver>${icono("izq")}<span>Volver</span></button></div>`) + html;
  document.querySelectorAll("#navegacion a").forEach((a) => a.classList.toggle("activo", a.dataset.sec === seccionNav));
  const actual = raiz.querySelector(".timeline-item.active");
  if (actual && partes[0] === "hoy") window.scrollTo(0, actual.getBoundingClientRect().top + window.scrollY - 200);
  else window.scrollTo(0, 0);
  if (rutaDialogo && !(hoja.open && estado.pila[0]?.ruta === location.hash)) abrirHoja({ ...hojaDeRuta(rutaDialogo), ruta: location.hash }, true);
}

// Qué desplegables están abiertos y qué opción de menú está elegida dentro de un contenedor.
function recordar(cont) {
  const n = {};
  const els = [...cont.querySelectorAll("[data-recordar]")];
  return new Map(els.map((el) => {
    const k = `${el.dataset.recordar}#${(n[el.dataset.recordar] = (n[el.dataset.recordar] ?? 0) + 1)}`;
    return [k, el.tagName === "DETAILS" ? el.open : [...el.querySelectorAll("[data-ver-op]")].find((x) => x.classList.contains("activo"))?.dataset.verOp];
  }));
}
function restaurar(cont, guardado) {
  const n = {};
  cont.querySelectorAll("[data-recordar]").forEach((el) => {
    const k = `${el.dataset.recordar}#${(n[el.dataset.recordar] = (n[el.dataset.recordar] ?? 0) + 1)}`;
    if (!guardado.has(k)) return;
    const v = guardado.get(k);
    if (el.tagName === "DETAILS") el.open = v;
    else if (v) verOpcion(el.querySelector(`[data-ver-op="${v}"]`));
  });
}

// Dibuja de nuevo el contenido del diálogo de arriba de la pila, sin perder el scroll ni los desplegables abiertos.
function dibujarHoja() {
  const h = estado.pila.at(-1);
  if (!h) return;
  const c = contenidoHoja(h);
  if (!c) return h.ruta ? salirDeRuta() : cerrarHoja();
  const y = hojaContenido.scrollTop, guardado = recordar(hojaContenido);
  document.getElementById("hoja-titulo").textContent = c.cabecera ?? "Cargar registro";
  document.getElementById("hoja-atras").hidden = estado.pila.length < 2;
  hojaContenido.innerHTML = htmlHoja(c);
  restaurar(hojaContenido, guardado);
  hojaContenido.scrollTop = y;
}
// Abre un diálogo; si ya hay uno abierto, se apila encima (y «‹» vuelve al anterior). `nuevo` arma una pila nueva.
function abrirHoja(h, nuevo = false) {
  if (hoja.open && !nuevo) {
    estado.pila.at(-1).y = hojaContenido.scrollTop;
    estado.pila.push(h);
  } else estado.pila = [h];
  hojaContenido.scrollTop = 0;
  dibujarHoja();
  if (estado.pila.length && !hoja.open) hoja.showModal();
}
function volverHoja() {
  if (estado.pila.length < 2) return;
  estado.pila.pop();
  dibujarHoja();
  hojaContenido.scrollTop = estado.pila.at(-1).y ?? 0;
}
// Si la ruta era un diálogo (#/ejercicio/ID, #/alarma), al cerrarlo se vuelve a la pantalla de abajo.
function salirDeRuta() {
  const ruta = estado.pila[0]?.ruta;
  estado.pila = [];
  if (hoja.open) hoja.close();
  if (ruta && location.hash === ruta) location.replace("#/" + (estado.fondo ?? ["plan"]).join("/"));
}
function cerrarHoja() {
  if (estado.pila[0]?.ruta) return salirDeRuta();
  estado.pila = [];
  if (hoja.open) hoja.close();
  refrescar();
}
hoja.addEventListener("cancel", () => { salirDeRuta(); });

// Vuelve a dibujar después de guardar, sin perder el lugar: scroll, paneles abiertos y opción de menú elegida.
function refrescar() {
  const y = window.scrollY;
  const guardado = recordar(raiz);
  render();
  restaurar(raiz, guardado);
  window.scrollTo(0, y);
  dibujarHoja();
}

let tAviso;
function avisar(texto, tipo = "ok") {
  let el = document.getElementById("aviso");
  if (!el) {
    el = Object.assign(document.createElement("div"), { id: "aviso", className: "aviso-flotante" });
    el.setAttribute("role", "status");
  }
  (hoja.open ? hoja : document.body).append(el);
  el.textContent = texto;
  el.dataset.tipo = tipo;
  el.hidden = false;
  clearTimeout(tAviso);
  tAviso = setTimeout(() => (el.hidden = true), tipo === "error" ? 5000 : 1400);
}

async function guardar(tabla, clave, campo, v) {
  try {
    if (tabla === "comidas" && campo === "plato") {
      // «Otro plato del menú»: el valor es «día|opción». Se guardan el texto del plato y su día de origen en una sola escritura.
      const [dia, opcion] = v ? v.split("|") : [];
      const texto = (plan.que_comi[`${dia}|${clave.split("|")[1]}`] ?? [])[Number(opcion) - 1];
      await guardarCampos(tabla, clave, texto ? { que_comi: texto, plato_dia: dia, plato_opcion: opcion } : {});
    } else if (tabla === "comidas" && campo === "que_comi") {
      // Con los botones (Plato 1, Plato 2, Cambio, No comí) vale el plato de la misma fecha: no queda un día de origen viejo.
      await guardarCampos(tabla, clave, { que_comi: v, plato_dia: "", plato_opcion: "" });
    } else await guardarCampo(tabla, clave, campo, v);
    // Al elegir un alimento sin porciones, queda 1 porción (se puede cambiar).
    if (tabla === "comidas" && GRUPOS_TODOS.includes(campo) && !vacio(v) && vacio(valor(tabla, clave, `${campo}_porc`))) {
      await guardarCampo(tabla, clave, `${campo}_porc`, 1);
    }
    refrescar();
    avisar("Guardado");
  } catch (e) {
    avisar(`No se pudo guardar: ${e.message}`, "error");
  }
}

const aNumero = (s) => { const t = String(s).trim().replace(",", "."); return t === "" ? null : Number(t); };

// Número de un control con − y +: dentro del rango y redondeado al paso.
function valorPaso(g, x) {
  const min = Number(g.dataset.min), max = Number(g.dataset.max), paso = Number(g.dataset.paso), dec = Number(g.dataset.dec);
  return Number((Math.round(Math.min(max, Math.max(min, x)) / paso) * paso).toFixed(dec));
}

function verOpcion(t) {
  if (!t) return;
  const tarjeta = t.closest("[data-comida]");
  tarjeta.querySelectorAll("[data-ver-op]").forEach((b) => {
    const on = b === t;
    b.classList.toggle("activo", on);
    b.setAttribute("aria-selected", on);
  });
  tarjeta.querySelectorAll(".op-panel").forEach((p) => (p.hidden = p.dataset.op !== t.dataset.verOp));
}

async function importar(archivo) {
  if (!archivo) return;
  try {
    avisar("Leyendo el archivo…");
    const res = await analizar(await archivo.arrayBuffer());
    estado.importacion = { ...res, archivo: archivo.name };
    document.getElementById("aviso").hidden = true;
    if (location.hash === "#/plan/importar") render(); else location.hash = "#/plan/importar";
  } catch (e) {
    avisar(`No pude leer el archivo: ${e.message}`, "error");
  }
}

function descargar() {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(exportar()), download: `registros-tao-salud-${aISO(new Date())}.xlsx`,
  });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  avisar("Archivo exportado");
}

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-tema]");
  if (!b) return;
  guardarTema(b.dataset.tema);
  refrescar();
});

document.addEventListener("click", async (ev) => {
  if (!ev.target.closest("[data-olvidar-clave]")) return;
  if (!confirm("¿Olvidar la contraseña en este dispositivo? Para volver a abrir el plan vas a tener que ponerla de nuevo. Tus registros no se borran.")) return;
  await olvidarClave();
  location.reload();
});

// Carga de registros: botones, pasos − y +, ajustes, importar y exportar.
document.addEventListener("click", async (ev) => {
  const op = ev.target.closest(".seg-op[data-valor]");
  if (op) {
    const g = op.closest("[data-campo]");
    guardar(g.dataset.tabla, g.dataset.clave, g.dataset.campo, op.classList.contains("activo") ? "" : JSON.parse(op.dataset.valor));
    return;
  }
  const pb = ev.target.closest("[data-paso-dir]");
  if (pb) {
    const g = pb.closest(".pasos");
    const x = aNumero(g.querySelector("input").value);
    const nuevo = x === null || !isFinite(x) ? Number(g.dataset.inicio) : x + Number(g.dataset.paso) * Number(pb.dataset.pasoDir);
    guardar(g.dataset.tabla, g.dataset.clave, g.dataset.campo, valorPaso(g, nuevo));
    return;
  }
  const t = ev.target.closest("[data-aj-estado],[data-ajuste-agregar],[data-ajuste-borrar],[data-exportar],[data-importar],[data-instalar],[data-buscar-act],[data-actualizar-plan]");
  if (!t) return;
  try {
    if (t.dataset.ajEstado) {
      t.parentElement.querySelectorAll(".seg-op").forEach((b) => { b.classList.toggle("activo", b === t); b.setAttribute("aria-pressed", b === t); });
    } else if (t.dataset.ajusteAgregar !== undefined) {
      const fecha = raiz.querySelector("#aj-fecha").value;
      const est = raiz.querySelector("#aj-estado .activo")?.dataset.ajEstado;
      if (!fecha || fecha < plan.plan.inicio || fecha > plan.plan.fin) return avisar("Elegí una fecha dentro del plan.", "error");
      await guardarFilas("ajustes", [{ fecha_desde: fecha, estado_ajuste: est }]);
      refrescar();
      avisar(`Desde el ${fecha.split("-").reverse().join("/")} rige ${est}`);
    } else if (t.dataset.ajusteBorrar) {
      await borrar("ajustes", t.dataset.ajusteBorrar);
      refrescar();
      avisar("Cambio quitado");
    } else if (t.dataset.exportar !== undefined) {
      descargar();
    } else if (t.dataset.instalar !== undefined) {
      if ((await instalar()) === "accepted") avisar("Instalando la app…");
    } else if (t.dataset.actualizarPlan !== undefined) {
      actualizar();
    } else if (t.dataset.buscarAct !== undefined) {
      avisar("Buscando…");
      const r = await buscarActualizacion();
      avisar(r === "sin-conexion" ? "Sin conexión: no se pudo buscar una versión nueva." : r === "nueva" ? "Hay una versión nueva: tocá «Actualizar»." : "Ya tenés la última versión.", r === "sin-conexion" ? "error" : "ok");
    } else if (t.dataset.importar) {
      if (t.dataset.importar === "cancelar") { estado.importacion = null; location.hash = "#/plan"; return; }
      t.disabled = true;
      estado.importacion.hecho = await aplicar(estado.importacion, t.dataset.importar === "archivo");
      render();
      avisar("Registros importados");
    }
  } catch (e) {
    avisar(`No se pudo completar: ${e.message}`, "error");
  }
});

document.addEventListener("change", (ev) => {
  const t = ev.target;
  if (t.id === "cat-ej" || t.id === "fase-ej") {
    estado.filtroEj = { ...estado.filtroEj, [t.id === "cat-ej" ? "cat" : "fase"]: t.value, limite: LIMITE_EJ };
    filtrarEjercicios();
    return;
  }
  if (t.id === "doc-seccion") { if (t.value) hojaContenido.querySelector(`#${CSS.escape(t.value)}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (t.id === "medida-fecha") { estado.medida = t.value; render(); return; }
  if (t.id === "fecha-selector") { if (t.value) { estado.fecha = acotar(t.value); render(); } return; }
  if (t.id === "importar-xlsx") { importar(t.files[0]); t.value = ""; return; }
  const g = t.closest("[data-campo]");
  if (!g) return;
  const { tabla, clave, campo } = g.dataset;
  if (t.tagName === "SELECT") guardar(tabla, clave, campo, t.value === "" ? "" : g.dataset.num === "true" ? Number(t.value) : t.value);
  else if (t.tagName === "TEXTAREA") guardar(tabla, clave, campo, t.value.trim());
  else if (g.classList.contains("pasos")) {
    const x = aNumero(t.value);
    if (x === null) return guardar(tabla, clave, campo, "");
    if (!isFinite(x) || x < Number(g.dataset.min) || x > Number(g.dataset.max)) {
      avisar(`Tiene que ser un número entre ${g.dataset.min} y ${g.dataset.max}.`, "error");
      return refrescar();
    }
    guardar(tabla, clave, campo, valorPaso(g, x));
  }
});

// Vuelve a dibujar la lista de la biblioteca sin tocar el buscador (para no perder el foco ni el teclado).
function filtrarEjercicios() {
  const cont = raiz.querySelector("#resultados-ej");
  if (cont) cont.innerHTML = resultadosEjercicios(estado.filtroEj);
}

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-fecha-mover],[data-ir-fecha],[data-ir-hoy],[data-hoja],[data-pestana],[data-medida-ir],[data-ir-ahora],[data-cerrar-hoja],#hoja-cerrar,#hoja-atras,[data-ver-op],[data-mas-ejercicios],[data-volver]");
  if (!t) {
    // Un enlace dentro del diálogo lo cierra y navega.
    if (ev.target.closest("#hoja a[href^='#/']")) { estado.pila = []; hoja.close(); }
    return;
  }
  if (t.dataset.hoja) {
    abrirHoja({ tipo: t.dataset.hoja, fecha: t.dataset.fecha ?? estado.fecha, comida: t.dataset.comida, ejercicio: t.dataset.ejercicio, clave: t.dataset.clave, bloque: t.dataset.bloque });
  } else if (t.id === "hoja-atras") {
    volverHoja();
  } else if (t.dataset.cerrarHoja !== undefined || t.id === "hoja-cerrar") {
    cerrarHoja();
  } else if (t.dataset.pestana) {
    estado.pestanaRegistro = t.dataset.pestana;
    render();
  } else if (t.dataset.medidaIr) {
    estado.medida = t.dataset.medidaIr;
    render();
  } else if (t.dataset.irAhora !== undefined) {
    const actual = raiz.querySelector(".timeline-item.active");
    if (actual) {
      const det = actual.querySelector("details");
      if (det) det.open = true;
      window.scrollTo({ top: actual.getBoundingClientRect().top + window.scrollY - 200, behavior: "smooth" });
    }
  } else if (t.dataset.irHoy !== undefined) {
    estado.fecha = acotar(ahora().fecha);
    render();
  } else if (t.dataset.fechaMover) {
    estado.fecha = acotar(sumarDias(estado.fecha, Number(t.dataset.fechaMover)));
    render();
  } else if (t.dataset.irFecha) {
    if (hoja.open) { estado.pila = []; hoja.close(); }
    estado.fecha = acotar(t.dataset.irFecha);
    render();
  } else if (t.dataset.verOp) {
    verOpcion(t);
  } else if (t.dataset.masEjercicios !== undefined) {
    estado.filtroEj.limite += LIMITE_EJ;
    filtrarEjercicios();
  } else if (t.dataset.volver !== undefined) {
    if (history.length > 1) history.back(); else location.hash = "#/plan";
  }
});

document.addEventListener("input", (ev) => {
  if (ev.target.id === "buscar-ej") {
    estado.filtroEj = { ...estado.filtroEj, q: ev.target.value, limite: LIMITE_EJ };
    filtrarEjercicios();
  }
});

window.addEventListener("hashchange", () => { if (hoja.open) { estado.pila = []; hoja.close(); } render(); });

// El estado del service worker o de la instalación cambió: se actualiza la sección «La app» de Plan.
// Si todavía no cargaron los datos del plan no hay nada que redibujar.
document.addEventListener("app-estado", () => { if (plan && estado.fecha && location.hash === "#/plan") refrescar(); });

// Al perder o recuperar la red se vuelve a dibujar el aviso de los videos (salvo que uno se esté reproduciendo).
for (const e of ["online", "offline"]) window.addEventListener(e, () => { if (raiz.querySelector(".video-placeholder, .video-frame") || (hoja.open && hojaContenido.querySelector(".video-placeholder, .video-frame"))) refrescar(); });

aplicarTema();
iniciarServiceWorker();

// Pantalla de la contraseña: se muestra solo la primera vez en cada dispositivo (o después de «Olvidar en este dispositivo»).
function pedirContrasena(error) {
  document.body.classList.add("bloqueada");
  raiz.innerHTML = `<section class="tarjeta"><p class="eyebrow">Datos cifrados</p><h2>Desbloquear el plan</h2>
    <p class="small muted">El plan está cifrado. Poné la contraseña una sola vez: queda guardada solo en este dispositivo.</p>
    <form id="form-clave" class="form" autocomplete="off">
      <label class="campo"><span class="campo-l">Contraseña</span><input type="password" class="texto" id="clave-plan" autocomplete="off" autocapitalize="none" required></label>
      ${error ? `<p class="nota destacada" role="alert">${esc(error)}</p>` : ""}
      <button type="submit" class="button full">Desbloquear</button>
    </form></section>`;
  const campo = raiz.querySelector("#clave-plan");
  campo.focus();
  return new Promise((ok) => raiz.querySelector("#form-clave").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const boton = ev.target.querySelector("button");
    boton.disabled = true;
    boton.textContent = "Abriendo…";
    document.body.classList.remove("bloqueada");
    ok(campo.value);
  }));
}

Promise.all([cargar(pedirContrasena), abrir()])
  .then(() => {
    estado.fecha = acotar(ahora().fecha);
    render();
  })
  .catch((e) => {
    raiz.innerHTML = `<section class="tarjeta borde-alerta"><h2>No se pudo abrir el plan</h2><p>${esc(e.message)}</p></section>`;
  });

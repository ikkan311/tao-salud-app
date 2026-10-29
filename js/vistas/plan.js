// Plan: datos y respaldo, biblioteca de ejercicios, enlaces a los diálogos de consulta, estado de ajuste e importación.
// Los diálogos de consulta (suplementos, metas, reglas, análisis, contexto, compras, documentos) arman su HTML acá y los abre hoja.js.

import { esc, md, seccionMd, slug, icono, num } from "../util.js";
import { plan, objetivoDia, modoCifrado } from "../datos.js";
import { TEMAS, temaGuardado } from "../tema.js";
import { estadoDe, ajustes, objetivoDe } from "../calculos.js";
import { cuantos } from "../registros.js";
import { seccionApp } from "../actualizacion.js";
import { desplegable, enlaceHoja, tarjetaEnlaces } from "../componentes.js";

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const doc = (id) => plan.documentos.find((d) => d.id === id);
// El título de la sección ya va en la cabecera del diálogo o del desplegable.
const mdSinTitulo = (t) => md(String(t ?? "").replace(/^#{1,6}\s.*\n+/, ""), { nivelBase: 1 });
const pend = `<p class="pendiente">pendiente</p>`;
const fecha = (iso) => iso.split("-").reverse().join("/");

// ---------------------------------------------------------------- biblioteca de ejercicios

const normalizar = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// «1–3» = fases 1 a 3; «1, 3» = fases 1 y 3.
function enFase(fases, f) {
  const t = String(fases ?? "");
  if (/[–-]/.test(t)) { const [a, b] = t.split(/[–-]/).map(Number); return Number(f) >= a && Number(f) <= b; }
  return t.split(/[,; ]+/).includes(String(f));
}
export const LIMITE_EJ = 20;

export function resultadosEjercicios({ q = "", cat = "", fase = "", limite = LIMITE_EJ } = {}) {
  const buscar = normalizar(q).trim();
  const lista = plan.ejercicios.filter((e) => (!cat || e.categoria === cat) && (!fase || enFase(e.fases, fase))
    && normalizar(`${e.id} ${e.nombre} ${e.musculos ?? ""} ${e.equipamiento ?? ""}`).includes(buscar));
  if (!lista.length) return `<div class="empty">${icono("buscar")}<h3>Sin resultados</h3><p>Probá con otro nombre, músculo o equipamiento.</p></div>`;
  return `<p class="result-count" role="status">${lista.length} ejercicio${lista.length !== 1 ? "s" : ""}${lista.length > limite ? ` · mostrando ${limite}` : ""}</p>
    <div class="card library-results">${lista.slice(0, limite).map((e) => `<div class="exercise-result"><button type="button" data-hoja="ejercicio" data-ejercicio="${esc(e.id)}"><span class="result-icon">${icono(e.categoria === "fuerza" ? "entreno" : "hoja")}</span><span class="exercise-summary"><small>${esc(e.id)} · ${esc(e.categoria)}</small><strong>${esc(e.nombre)}</strong><small>${esc(e.equipamiento ?? "pendiente")}</small></span>${icono("der")}</button></div>`).join("")}</div>
    ${lista.length > limite ? `<button type="button" class="button secondary full" data-mas-ejercicios>Ver más ejercicios</button>` : ""}`;
}

// ---------------------------------------------------------------- pantalla Plan

export function vistaPlan(fechaIso, filtro = {}) {
  const { estado } = estadoDe(fechaIso);
  const n = cuantos();
  const cats = [...new Set(plan.ejercicios.map((e) => e.categoria))].sort((a, b) => a.localeCompare(b, "es"));
  const obj = objetivoDe(fechaIso);
  const d = plan.calendario.find((c) => c.fecha === fechaIso);
  return `<header class="page-heading"><p class="eyebrow">Tu biblioteca personal</p><h1>Plan</h1><p class="lede">Todo lo que necesitás consultar.</p></header>
    <section class="card"><p class="eyebrow">Tus datos</p><h2>Registros y respaldo</h2>
      <p class="small muted">Guardados en este celular: ${plural(n.diario, "día", "días")}, ${plural(n.comidas, "comida", "comidas")}, ${plural(n.registro, "ejercicio", "ejercicios")}, ${plural(n.medidas, "medición", "mediciones")} y ${plural(n.ajustes, "cambio", "cambios")} de ajuste.</p>
      <div class="stack-buttons">
        <label class="button full" for="importar-xlsx">Importar registros desde plan.xlsx</label>
        <input type="file" id="importar-xlsx" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
        <button type="button" class="button secondary full" data-exportar>Exportar registros</button></div>
      <p class="small muted">El archivo se procesa en tu dispositivo. Al importar se suman los datos ya cargados, sin duplicar. La exportación trae Diario, Comidas, Registro y Medidas.</p></section>
    ${seccionApp()}
    <section class="card"><p class="eyebrow">Aspecto</p><h2>Tema de la app</h2>
      <p class="small muted">Automático sigue al celular. Claro u oscuro la dejan fija, aunque el celular cambie.</p>
      <div class="seg-grupo" role="group" aria-label="Tema de la app">${TEMAS.map(([k, n]) => `<button type="button" class="seg-op${temaGuardado() === k ? " activo" : ""}" data-tema="${k}" aria-pressed="${temaGuardado() === k}">${n}</button>`).join("")}</div></section>
    ${modoCifrado.activo ? `<section class="card"><p class="eyebrow">Seguridad</p><h2>Datos cifrados</h2>
      <p class="small muted">El plan se abre con una contraseña que este dispositivo ya conoce. Si le prestás el celular a alguien o lo vendés, olvidala: la próxima vez que abras la app te la va a pedir. Tus registros no se borran.</p>
      <button type="button" class="button secondary full" data-olvidar-clave>Olvidar en este dispositivo</button></section>` : ""}
    ${tarjetaEnlaces(`${enlaceHoja("Documentos del plan", "Etapas completas y contexto", { hoja: "documentos" }, "documento")}
      ${enlaceHoja("Suplementos y horarios", `${plan.suplementos.fichas.length} fichas · dosis y condiciones`, { hoja: "suplementos" }, "pastilla")}
      ${enlaceHoja("Metas y reglas de ajuste", "Peso, cintura, fuerza y calorías", { hoja: "metas" }, "diana")}
      ${enlaceHoja("Lista de compras", "Por categoría de alimentos", { hoja: "compras" }, "carrito")}`)}
    <div class="section-heading"><h2>Biblioteca de ejercicios</h2><p class="caption">${plan.ejercicios.length} fichas completas</p></div>
    <div class="filter-bar">
      <div class="search-field">${icono("buscar")}<input type="search" id="buscar-ej" placeholder="Buscá un ejercicio o músculo" value="${esc(filtro.q ?? "")}" autocomplete="off" aria-label="Buscar ejercicio, músculo o equipamiento"></div>
      <label><span class="filter-label">Categoría</span><select id="cat-ej"><option value="">Todas</option>${cats.map((c) => `<option value="${esc(c)}"${filtro.cat === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label><span class="filter-label">Fase</span><select id="fase-ej"><option value="">Todas</option>${[1, 2, 3].map((f) => `<option value="${f}"${String(filtro.fase) === String(f) ? " selected" : ""}>Fase ${f}</option>`).join("")}</select></label>
    </div>
    <div id="resultados-ej">${resultadosEjercicios(filtro)}</div>
    <div class="section-heading"><h2>Cuidado y seguimiento</h2></div>
    ${tarjetaEnlaces(`${enlaceHoja("Semáforos de hernia y rodilla", "Señales y alternativas", { hoja: "alarma" }, "alerta")}
      ${enlaceHoja("Análisis pendientes", `${plan.analisis.length} análisis previos de la Etapa 6`, { hoja: "analisis" }, "lista")}
      ${enlaceHoja("Contexto clínico", "Paciente, condiciones y restricciones", { hoja: "contexto" }, "documento")}
      ${enlaceHoja("Reglas del plan", "Progresión, descargas y caída de fuerza", { hoja: "reglas" }, "entreno")}`)}
    <section class="card"><p class="eyebrow">Ajuste de calorías</p><div class="heading-row"><h2>Estado ${esc(estado)}</h2><span class="badge">${num(obj.kcal)} kcal</span></div>
      <p class="small muted">Vigente desde ${esc(fecha(estadoDe(fechaIso).desde ?? plan.plan.inicio))} · ${d?.tipo_dia === "fuerza" ? "día de fuerza" : "día de ayuno"}</p>
      <a class="button full" href="#/plan/ajuste">Cargar estado de ajuste</a>
      <button type="button" class="button secondary full" data-hoja="regla" data-clave="estados_ajuste">Consultar reglas de ajuste</button></section>`;
}

// ---------------------------------------------------------------- diálogos de consulta

export function htmlSuplementos() {
  const s = plan.suplementos;
  const fila = (k, v) => `<dt>${k}</dt><dd>${v ? esc(v) : "pendiente"}</dd>`;
  const fichas = s.fichas.map((f) => {
    const horario = f.horario ? Object.entries(f.horario).filter(([k]) => k !== "Suplemento") : [];
    return desplegable(`<span class="exercise-summary"><small>${esc(f.suplemento_id)} · ${esc(f.estado)}</small><strong>${esc(f.nombre)}</strong></span>`, `
      <dl class="datos">${fila("Dosis", f.dosis)}${fila("Momento", f.momento)}${fila("Requiere análisis", f.requiere_analisis)}${fila("Antes de la cirugía", f.antes_de_la_cirugia)}
        ${fila("Para qué", f.etapa6?.["Para qué"])}${fila("Evidencia", f.etapa6?.Evidencia)}</dl>
      <h4 class="titulo-chico">Cómo empezarlo</h4>${f.como_empezar_md ? md(f.como_empezar_md, { nivelBase: 2 }) : pend}
      ${horario.length ? `<h4 class="titulo-chico">Horario según el tipo de día</h4><dl class="datos">${horario.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
      ${f.evidencia_testosterona?.length ? `<h4 class="titulo-chico">Evidencia sobre la testosterona</h4>${f.evidencia_testosterona.map((e) => `<div class="porcion"><dl class="datos">${Object.entries(e).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${md(v)}</dd>`).join("")}</dl></div>`).join("")}` : ""}`,
    { recordar: `sup-${f.suplemento_id}` });
  }).join("");
  return `${fichas}
    ${desplegable("Horario según el tipo de día", mdSinTitulo(s.horario_md.md))}
    ${desplegable("Cómo empezarlos", mdSinTitulo(s.como_empezar_general_md))}
    ${desplegable("Productos", md(s.productos_md, { nivelBase: 1 }))}`;
}

export function htmlMetas() {
  const S = plan.metas.secciones;
  return `${desplegable("Metas de peso y cintura", mdSinTitulo(S.corporales.md), { abierto: true })}
    ${desplegable("Metas de fuerza", mdSinTitulo(S.fuerza.md))}
    ${desplegable("Calorías y macros", mdSinTitulo(S.calorias_macros.md))}
    ${desplegable("Regla de ajuste", mdSinTitulo(plan.reglas.ajuste_calorias.md))}
    ${desplegable("Estados de ajuste", mdSinTitulo(plan.reglas.estados_ajuste.md))}`;
}

export function htmlReglas() {
  const claves = ["progresion", "otras", "caida_fuerza", "pausas", "hipopresivos", "tai_chi", "restricciones", "ajuste_calorias", "estados_ajuste"];
  return claves.filter((k) => plan.reglas[k]).map((k) => desplegable(esc(plan.reglas[k].titulo), mdSinTitulo(plan.reglas[k].md), { abierto: k === "progresion" })).join("")
    + `<button type="button" class="button secondary full" data-hoja="alarma">Guardia y semáforos de hernia y rodilla</button>`;
}

export function htmlCompras() {
  const cats = [...new Set(plan.compras.map((c) => c.categoria))];
  return cats.map((c) => desplegable(esc(c), `<ul class="food-list">${plan.compras.filter((x) => x.categoria === c)
    .map((x) => `<li><span>${esc(x.alimento)}<small>${esc(x.cantidad_semanal)}</small></span></li>`).join("")}</ul>`)).join("");
}

export function htmlAnalisis() {
  return `<p class="dialog-lede">Análisis previos de la Etapa 6</p>${plan.analisis.map((x) => `<div class="porcion"><h4 class="titulo-chico">${esc(x["Análisis"])}</h4>
    <dl class="datos"><dt>Para qué</dt><dd>${esc(x["Para qué"])}</dd><dt>Notas</dt><dd>${esc(x.Notas)}</dd></dl></div>`).join("")}`;
}

export function htmlContexto() {
  return `<h4 class="titulo-chico">Metas a 30, 60 y 90 días</h4>
    ${plan.metas.hitos.map((h) => `<div class="porcion"><strong>${esc(h.Hito)} · ${esc(h.Fecha)}</strong><div class="macros">
      <span class="macro"><b>${esc(h.Peso)}</b></span><span class="macro"><b>${esc(h.Cintura)}</b> cintura</span>
      <span class="macro"><b>${esc(h["Cintura/altura"])}</b> cintura/altura</span><span class="macro"><b>${esc(h["% grasa estimado"])}</b> grasa</span>
      <span class="macro"><b>${esc(h["Masa magra estimada"])}</b> magra</span></div></div>`).join("")}
    <div class="doc">${md(doc("contexto").md, { nivelBase: 1 })}</div>`;
}

export function htmlDocumentos() {
  return `<p class="dialog-lede">Consultá cada documento completo o navegá por sus secciones.</p>
    ${tarjetaEnlaces(plan.documentos.map((d) => enlaceHoja(d.titulo, `${d.secciones.length} secciones`, { hoja: "documento", clave: d.id }, "documento")).join(""))}`;
}

// Un documento entero (con selector para ir a una sección) o una sola sección (#/doc/ID/seccion).
export function htmlDocumento(id, seccion) {
  const d = doc(id);
  if (!d) return null;
  if (seccion) {
    const s = d.secciones.find((x) => slug(x.titulo) === seccion);
    return { titulo: d.titulo, html: `<article class="doc">${s ? md(seccionMd(d.md, s.titulo), { nivelBase: 1 }) : pend}</article>
      <button type="button" class="button secondary full" data-hoja="documento" data-clave="${esc(d.id)}">Ver el documento completo</button>` };
  }
  return { titulo: d.titulo, html: `<label class="entry-field"><span class="campo-l">Ir a una sección</span>
      <select class="sel" id="doc-seccion"><option value="">Elegí una sección</option>${d.secciones.filter((s) => s.nivel <= 3).map((s) => `<option value="${esc(slug(s.titulo))}">${esc(s.titulo)}</option>`).join("")}</select></label>
    <article class="doc">${md(d.md, { nivelBase: 1 })}</article>` };
}

export function vistaAjuste(fecha) {
  const d = plan.calendario.find((c) => c.fecha === fecha);
  const { estado, desde } = estadoDe(fecha);
  const f = objetivoDia("fuerza", estado), a = objetivoDia("ayuno", estado);
  return `<header class="cab-pantalla"><h1>Ajuste de calorías</h1></header>
    <section class="tarjeta objetivo-dia">
      <p class="obj-pie">Estado que rige el ${esc(fecha.split("-").reverse().join("/"))}: <strong>${esc(estado)}</strong>${desde ? `, desde el ${esc(desde.split("-").reverse().join("/"))}` : ""}.</p>
      <div class="obj-grande"><span class="obj-n">${num(f.kcal)}</span><span class="obj-l">kcal días de fuerza</span></div>
      <div class="obj-grande"><span class="obj-n">${num(a.kcal)}</span><span class="obj-l">kcal días de ayuno</span></div>
      <div class="obj-grande"><span class="obj-n">${num(d?.tipo_dia === "fuerza" ? f.carbos : a.carbos)}</span><span class="obj-l">g de carbohidratos hoy</span></div>
    </section>
    <section class="tarjeta"><h2>Cambios cargados</h2><ul class="lista-simple">${ajustes().map((x) => `<li class="fila-ajuste"><span class="aj-texto"><strong>Desde el ${esc(x.fecha_desde.split("-").reverse().join("/"))}</strong><span>${esc(x.estado_ajuste)} · ${esc(estadoTexto(x.estado_ajuste))}</span></span>${
      x.origen === "app" ? `<button type="button" class="btn-chico" data-ajuste-borrar="${esc(x.fecha_desde)}">Quitar</button>` : `<span class="sub">de plan.xlsx</span>`}</li>`).join("")}</ul></section>
    <section class="tarjeta"><h2>Cargar un cambio</h2>
      <p class="sub">Rige desde la fecha que elijas hasta el próximo cambio. Diario lo toma solo desde esa fecha.</p>
      <div class="form">
        <div class="campo"><span class="campo-l">Desde</span><input type="date" class="sel" id="aj-fecha" min="${plan.plan.inicio}" max="${plan.plan.fin}" value="${esc(fecha)}"></div>
        <div class="campo"><span class="campo-l">Estado</span><div class="seg-grupo envuelve" id="aj-estado" role="group">${plan.listas.estado_ajuste.map((e, i) => `<button type="button" class="seg-op${i ? "" : " activo"}" data-aj-estado="${esc(e)}" aria-pressed="${!i}">${esc(e)}</button>`).join("")}</div></div>
        <button type="button" class="btn" data-ajuste-agregar>Guardar el cambio</button>
      </div>
    </section>
    <article class="tarjeta doc">${md(seccionMd(doc("etapa1_definitiva").md, "7. Regla de ajuste por estancamiento"), { nivelBase: 0 })}</article>
    <article class="tarjeta doc">${md(seccionMd(doc("etapa6_definitiva").md, "Calorías: cómo se aplica"))}</article>`;
}

// Qué significa cada estado de ajuste. Las cifras salen de plan.constantes (datos cifrados), no del código, que es público.
const estadoTexto = (e) => {
  const K = plan.constantes.kcal_objetivo, H = plan.constantes.carbos_obj_g, con = (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
  return {
    base: `${K.fuerza} kcal los días de fuerza y ${K.ayuno} los de ayuno`,
    recorte40: `${con(K.recorte40)} kcal y ${con(H.recorte40)} g de carbohidratos por día`,
    inversa40: `${con(K.inversa40)} kcal y ${con(H.inversa40)} g de carbohidratos por día`,
    mantenimiento: `${K.mantenimiento} kcal y ${H.mantenimiento} g de carbohidratos`,
  }[e] ?? "";
};

const CORTO = { "Registro de fuerza": "Fuerza", "Ajustes de calorías": "Ajustes" };

// Resumen de una importación, antes de guardar.
export function vistaImportar(res) {
  if (!res) return `<section class="tarjeta vacia"><h2>No hay ninguna importación en curso</h2><a class="enlace" href="#/plan">Volver a Plan</a></section>`;
  if (res.hecho) {
    return `<header class="cab-pantalla"><h1>Importación lista</h1></header>
      <section class="tarjeta"><ul class="lista-simple">${Object.entries(res.tablas).map(([k, t]) => `<li><strong>${esc(t.nombre)}</strong><span>${res.hecho[k] ?? 0} filas guardadas</span></li>`).join("")}</ul></section>
      <a class="fila-enlace" href="#/registro"><span><strong>Ver los registros</strong></span>${icono("der")}</a>`;
  }
  const tablas = Object.values(res.tablas);
  const totalConf = tablas.reduce((a, t) => a + t.conflictos.length, 0);
  const totalNuevo = tablas.reduce((a, t) => a + t.nuevos.length + t.completan.length, 0);
  const fechaDe = (clave) => clave.split("|")[0].split("-").reverse().join("/") + (clave.includes("|") ? ` · ${clave.split("|")[1]}` : "");
  const val = (v) => (v === undefined || v === "" ? "vacío" : typeof v === "number" ? num(v, v % 1 ? 1 : 0) : v);
  return `<header class="cab-pantalla"><h1>Importar registros</h1><p class="sub">${esc(res.archivo)}. Todavía no se guardó nada.</p></header>
    <section class="tarjeta"><div class="tabla compacta"><table>
      <thead><tr><th>Pestaña</th><th>Nuevas</th><th>Suman</th><th>Iguales</th><th>Distintas</th></tr></thead>
      <tbody>${tablas.map((t) => `<tr><td>${esc(CORTO[t.nombre] ?? t.nombre)}</td><td>${t.nuevos.length}</td><td>${t.completan.length}</td><td>${t.iguales}</td><td>${t.conflictos.length}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="sub">Nuevas: filas que la app no tenía. Suman: la app tenía algunos datos y el archivo suma otros. Iguales: ya estaban; se saltean.
      Distintas: el mismo dato con otro valor. Lo que ya trae el plan (notas del plan y medidas de inicio) no cuenta como registro.</p></section>
    ${res.hojasFaltantes.length ? `<p class="nota destacada">No encontré estas pestañas en el archivo: ${esc(res.hojasFaltantes.join(", "))}.</p>` : ""}
    ${totalConf ? `<section class="tarjeta borde-aviso"><h2>Datos distintos (${totalConf})</h2>
      <p>Por defecto se queda lo que ya tenía la app. Si preferís el archivo, usá el segundo botón.</p>
      <ul class="lista-simple">${tablas.flatMap((t) => t.conflictos.map((c) => `<li><strong>${esc(t.nombre)} · ${esc(fechaDe(c.clave))}</strong>${
        c.choques.map((k) => `<span>${esc(k)}: app «${esc(val(c.actual[k]))}» · archivo «${esc(val(c.nuevo[k]))}»</span>`).join("")}</li>`)).join("")}</ul></section>` : ""}
    ${res.avisos.length ? `<details class="tarjeta plegable"><summary><span class="sum-texto"><h2>Datos que no se importan (${res.avisos.length})</h2><span class="sub">Quedan pendientes: revisalos en el archivo</span></span>${icono("der", "chev")}</summary>
      <ul class="lista-simple">${res.avisos.map((a) => `<li><span>${esc(a)}</span></li>`).join("")}</ul></details>` : ""}
    ${tablas.some((t) => t.fuera.length) ? `<p class="nota destacada">Filas con datos que no son del plan (una fecha, comida o ejercicio que el plan no tiene), quedan sin importar: ${
      esc(tablas.filter((t) => t.fuera.length).map((t) => `${t.nombre}: ${t.fuera.slice(0, 5).join(", ")}${t.fuera.length > 5 ? ` y ${t.fuera.length - 5} más` : ""}`).join(" · "))}</p>` : ""}
    <div class="acciones">
      ${totalNuevo || totalConf ? `<button type="button" class="btn" data-importar="app">${totalConf ? "Importar y dejar lo de la app" : "Importar"}</button>` : `<p>No hay nada nuevo para importar.</p>`}
      ${totalConf ? `<button type="button" class="btn btn-secundario" data-importar="archivo">Importar y usar lo del archivo</button>` : ""}
      <button type="button" class="btn btn-secundario" data-importar="cancelar">Cancelar</button>
    </div>`;
}

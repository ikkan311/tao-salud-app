// Utilidades comunes: fechas, texto, markdown e íconos.

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// ---------------------------------------------------------------- fechas

export function aFecha(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function aISO(f) {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
}
export function sumarDias(iso, n) {
  const f = aFecha(iso);
  f.setDate(f.getDate() + n);
  return aISO(f);
}
export function fechaLarga(iso) {
  const f = aFecha(iso);
  return `${DIAS[f.getDay()].toLowerCase()} ${f.getDate()} de ${MESES[f.getMonth()]}`;
}
export function fechaBreve(iso) {
  const f = aFecha(iso);
  return `${DIAS[f.getDay()].slice(0, 3).toLowerCase()}, ${f.getDate()} ${MESES[f.getMonth()].slice(0, 3)}`;
}
export function fechaCorta(iso) {
  const f = aFecha(iso);
  return `${f.getDate()}/${f.getMonth() + 1}`;
}
export const aMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// ---------------------------------------------------------------- números

export function num(n, dec = 0) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toLocaleString("es-AR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ---------------------------------------------------------------- texto

// Las actividades de la semana tipo vienen en mayúsculas: se muestran en minúscula con mayúscula inicial,
// sin cambiar las palabras.
const PROPIOS = { SIRO: "Siro", KEGEL: "Kegel" };
export function oracion(s) {
  const t = String(s).split(/(\s+)/).map((w) => {
    const letras = w.replace(/[^\p{L}]/gu, "");
    if (!letras || letras !== letras.toUpperCase()) return w;
    return PROPIOS[letras] ? w.replace(letras, PROPIOS[letras]) : w.toLowerCase();
  }).join("");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function slug(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------- markdown

function enLinea(s) {
  return esc(s)
    .replace(/&lt;br&gt;/g, "<br>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:]|$)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function celdas(linea) {
  return linea.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

// Markdown a HTML: títulos, párrafos, listas, tablas, citas y separadores. Copia el texto tal cual.
export function md(texto, { nivelBase = 0 } = {}) {
  const lineas = String(texto ?? "").split(/\r?\n/);
  const out = [];
  let parrafo = [];
  let lista = null;
  const cerrarParrafo = () => {
    if (parrafo.length) out.push(`<p>${enLinea(parrafo.join(" "))}</p>`);
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista) out.push(`<${lista.tipo}>${lista.items.map((i) => `<li>${enLinea(i)}</li>`).join("")}</${lista.tipo}>`);
    lista = null;
  };
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    let m;
    if (!l.trim()) { cerrarParrafo(); cerrarLista(); continue; }
    if ((m = l.match(/^(#{1,6})\s+(.*)$/))) {
      cerrarParrafo(); cerrarLista();
      const n = Math.min(6, m[1].length + nivelBase);
      out.push(`<h${n} id="${slug(m[2])}">${enLinea(m[2])}</h${n}>`);
      continue;
    }
    if (l.trimStart().startsWith("|")) {
      cerrarParrafo(); cerrarLista();
      const filas = [];
      while (i < lineas.length && lineas[i].trimStart().startsWith("|")) filas.push(celdas(lineas[i++]));
      i--;
      const [enc, ...resto] = filas;
      const cuerpo = resto.filter((f) => !f.every((c) => /^:?-+:?$/.test(c)));
      out.push(`<div class="tabla"><table><thead><tr>${enc.map((c) => `<th>${enLinea(c)}</th>`).join("")}</tr></thead><tbody>${
        cuerpo.map((f) => `<tr>${f.map((c) => `<td>${enLinea(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (/^\s*([-*•])\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l)) {
      cerrarParrafo();
      const tipo = /^\s*\d+[.)]\s+/.test(l) ? "ol" : "ul";
      if (!lista || lista.tipo !== tipo) { cerrarLista(); lista = { tipo, items: [] }; }
      lista.items.push(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      continue;
    }
    if (/^>\s?/.test(l)) { cerrarParrafo(); cerrarLista(); out.push(`<blockquote>${enLinea(l.replace(/^>\s?/, ""))}</blockquote>`); continue; }
    if (/^-{3,}$/.test(l.trim())) { cerrarParrafo(); cerrarLista(); out.push("<hr>"); continue; }
    if (lista) { lista.items[lista.items.length - 1] += " " + l.trim(); continue; }
    parrafo.push(l.trim());
  }
  cerrarParrafo(); cerrarLista();
  return out.join("\n");
}

// Sección de un markdown que empieza en el título dado, con sus subsecciones.
export function seccionMd(texto, titulo) {
  const lineas = texto.split(/\r?\n/);
  const i = lineas.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s+/, "").trim().startsWith(titulo));
  if (i < 0) return "";
  const nivel = lineas[i].match(/^#+/)[0].length;
  let j = i + 1;
  while (j < lineas.length && !(lineas[j].match(/^(#{1,6})\s/) && lineas[j].match(/^#+/)[0].length <= nivel)) j++;
  return lineas.slice(i, j).join("\n");
}

// ---------------------------------------------------------------- íconos (SVG propios)

const P = {
  hoy: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  entreno: '<path d="m6 4-2 2 14 14 2-2M3 9l6-6m6 18 6-6M2 6l4-4m12 20 4-4M8 14l6-6"/>',
  comidas: '<path d="M5 3v6m3-6v6M3 3v4a3 3 0 0 0 6 0V3M6 10v11M18 3c-3 2-4 6-3 10h4M19 3v18"/>',
  registro: '<path d="M4 3v17h17M8 14l4-5 4 3 5-7"/>',
  plan: '<path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"/>',
  alerta: '<path d="m10.3 3.8-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.2l-8-14a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>',
  izq: '<path d="m14 5-7 7 7 7"/>',
  der: '<path d="m9 5 7 7-7 7"/>',
  abajo: '<path d="m5 9 7 7 7-7"/>',
  cerrar: '<path d="m6 6 12 12M6 18 18 6"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m6 0h2"/>',
  buscar: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  video: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  luna: '<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
  pastilla: '<path d="m9 4-5 5a6 6 0 0 0 8 8l5-5a6 6 0 0 0-8-8Zm-3 3 8 8"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  documento: '<path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9Zm0 0v7h7M7 13h10M7 17h7"/>',
  carrito: '<path d="M3 3h2l3 13h11l2-9H6M9 21h.01M18 21h.01"/>',
  hoja: '<path d="M20 3C6 1 1 10 6 16c6 6 15 0 14-13ZM4 21 16 9"/>',
  pausa: '<path d="M9 5v14M15 5v14"/>',
  diana: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
};
export function icono(nombre, clase = "") {
  return `<svg class="ico ${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nombre] ?? ""}</svg>`;
}

// Lectura y escritura de .xlsx sin librerías: un .xlsx es un zip con XML adentro.
// Se leen los valores de las celdas (de una fórmula, el último resultado que guardó Excel); no se calculan fórmulas.
// Para descomprimir se usa DecompressionStream("deflate-raw") de Chrome. Para escribir, un zip sin compresión.

// ---------------------------------------------------------------- zip

const u16 = (b, i) => b[i] | (b[i + 1] << 8);
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

async function inflar(datos) {
  const s = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

async function leerZip(buffer) {
  const b = new Uint8Array(buffer);
  let fin = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (u32(b, i) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error("El archivo no es un .xlsx (no encontré el índice del zip).");
  const total = u16(b, fin + 10);
  let p = u32(b, fin + 16);
  const archivos = new Map();
  const dec = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error("El zip del .xlsx está dañado.");
    const metodo = u16(b, p + 10), tam = u32(b, p + 20);
    const lNombre = u16(b, p + 28), lExtra = u16(b, p + 30), lComent = u16(b, p + 32), local = u32(b, p + 42);
    const nombre = dec.decode(b.subarray(p + 46, p + 46 + lNombre));
    archivos.set(nombre, { metodo, tam, local });
    p += 46 + lNombre + lExtra + lComent;
  }
  return {
    nombres: [...archivos.keys()],
    async texto(nombre) {
      const a = archivos.get(nombre);
      if (!a) return null;
      const ini = a.local + 30 + u16(b, a.local + 26) + u16(b, a.local + 28);
      const crudo = b.subarray(ini, ini + a.tam);
      if (a.metodo === 0) return dec.decode(crudo);
      if (a.metodo === 8) return dec.decode(await inflar(crudo));
      throw new Error(`Compresión no soportada en ${nombre}.`);
    },
  };
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function armarZip(archivos /* [[nombre, texto]] */) {
  const enc = new TextEncoder();
  const partes = [], central = [];
  let pos = 0;
  const cab = (n) => new DataView(new ArrayBuffer(n));
  for (const [nombre, texto] of archivos) {
    const n = enc.encode(nombre), d = enc.encode(texto), crc = crc32(d);
    const l = cab(30);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true);
    l.setUint32(14, crc, true); l.setUint32(18, d.length, true); l.setUint32(22, d.length, true); l.setUint16(26, n.length, true);
    const c = cab(46);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true); c.setUint16(28, n.length, true);
    c.setUint32(42, pos, true);
    partes.push(l, n, d);
    central.push(c, n);
    pos += 30 + n.length + d.length;
  }
  const tamCentral = central.reduce((s, x) => s + x.byteLength, 0);
  const f = cab(22);
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, archivos.length, true); f.setUint16(10, archivos.length, true);
  f.setUint32(12, tamCentral, true); f.setUint32(16, pos, true);
  return new Blob([...partes, ...central, f], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ---------------------------------------------------------------- lectura

const xml = (t) => new DOMParser().parseFromString(t, "application/xml");
const hijos = (el, nombre) => [...el.getElementsByTagNameNS("*", nombre)];

function textoDe(si) {
  // Texto de un <si> o <is>: todos los <t>, salvo los de la guía fonética (<rPh>).
  return hijos(si, "t").filter((t) => t.parentNode.localName !== "rPh").map((t) => t.textContent).join("");
}

function columnaANumero(letras) {
  let n = 0;
  for (const ch of letras) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

// Devuelve { nombreHoja: filas }, donde filas[i][j] es número, texto, booleano o null (fila 1 = filas[0]).
export async function leerXlsx(buffer) {
  const zip = await leerZip(buffer);
  const wb = await zip.texto("xl/workbook.xml");
  if (!wb) throw new Error("El archivo no tiene planillas (falta xl/workbook.xml).");
  const libro = xml(wb);
  const rels = xml((await zip.texto("xl/_rels/workbook.xml.rels")) ?? "<Relationships/>");
  const destino = Object.fromEntries(hijos(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target")]));
  const ssTexto = await zip.texto("xl/sharedStrings.xml");
  const compartidos = ssTexto ? hijos(xml(ssTexto), "si").map(textoDe) : [];
  const hojas = {};
  for (const h of hijos(libro, "sheet")) {
    const rid = [...h.attributes].find((a) => a.localName === "id" && a.prefix)?.value;
    let ruta = destino[rid] ?? "";
    ruta = ruta.startsWith("/") ? ruta.slice(1) : "xl/" + ruta.replace(/^\.\//, "");
    const t = await zip.texto(ruta);
    if (t === null) continue;
    const filas = [];
    let r = 0;
    for (const fila of hijos(xml(t), "row")) {
      r = fila.hasAttribute("r") ? Number(fila.getAttribute("r")) - 1 : r;
      const celdas = (filas[r] = []);
      let c = 0;
      for (const celda of hijos(fila, "c")) {
        const ref = celda.getAttribute("r");
        if (ref) c = columnaANumero(ref.replace(/\d+/g, ""));
        const tipo = celda.getAttribute("t");
        const v = hijos(celda, "v")[0]?.textContent;
        let valor = null;
        if (tipo === "inlineStr") valor = textoDe(hijos(celda, "is")[0] ?? celda);
        else if (v === undefined) valor = null;
        else if (tipo === "s") valor = compartidos[Number(v)] ?? "";
        else if (tipo === "str") valor = v;
        else if (tipo === "b") valor = v === "1";
        else if (tipo === "e") valor = { error: v };
        else valor = Number(v);
        celdas[c++] = valor;
      }
      r++;
    }
    hojas[h.getAttribute("name")] = filas;
  }
  return hojas;
}

// Fecha de Excel (sistema 1900) a "AAAA-MM-DD", y vuelta.
const EPOCA = Date.UTC(1899, 11, 30);
export function serialAISO(n) {
  const f = new Date(EPOCA + Math.floor(n) * 864e5);
  return f.toISOString().slice(0, 10);
}
export function isoASerial(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - EPOCA) / 864e5;
}

// ---------------------------------------------------------------- escritura

const escXml = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
  .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function letra(n) {
  let s = "";
  for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Formatos de celda (índice en cellXfs de styles.xml).
const ESTILO = { general: 0, encabezado: 1, fecha: 2, hora: 3, pct: 4, "0": 5, "0.0": 6, "0.00": 7 };
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function hojaXml(h) {
  const filas = [h.columnas.map((c) => c.nombre), ...h.filas];
  const cuerpo = filas.map((fila, i) => {
    const celdas = fila.map((v, j) => {
      if (v === null || v === undefined || v === "") return "";
      const ref = letra(j) + (i + 1);
      const s = i === 0 ? ESTILO.encabezado : ESTILO[h.columnas[j].formato ?? "general"] ?? 0;
      const st = s ? ` s="${s}"` : "";
      if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
      if (typeof v === "boolean") return `<c r="${ref}"${st} t="b"><v>${v ? 1 : 0}</v></c>`;
      return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${escXml(v)}</t></is></c>`;
    }).join("");
    return `<row r="${i + 1}">${celdas}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${cuerpo}</sheetData></worksheet>`;
}

// hojas: [{ nombre, columnas: [{ nombre, formato }], filas: [[valor]] }]. Las fechas y horas van como número de Excel.
export function escribirXlsx(hojas) {
  const tipos = hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return armarZip([
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tipos}</Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${
      hojas.map((h, i) => `<sheet name="${escXml(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${
      hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")
    }<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", ESTILOS],
    ...hojas.map((h, i) => [`xl/worksheets/sheet${i + 1}.xml`, hojaXml(h)]),
  ]);
}

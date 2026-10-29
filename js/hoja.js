// Contenido de los diálogos. Cada hoja es { tipo, fecha, ... } y se vuelve a armar después de cada guardado.
// Los de carga (diario, comida, serie, medida) llevan «Listo»; la ficha del ejercicio y las señales de alarma son de lectura.

import { esc, md, oracion, fechaLarga } from "./util.js";
import { plan, sesionDe, ejercicio, diaPlan } from "./datos.js";
import { contenidoBloque } from "./vistas/hoy.js";
import { htmlPorciones } from "./vistas/comidas.js";
import { htmlSuplementos, htmlMetas, htmlReglas, htmlCompras, htmlAnalisis, htmlContexto, htmlDocumentos, htmlDocumento } from "./vistas/plan.js";
import { calcularDia, calcularMedidas } from "./calculos.js";
import { fichaEjercicio, htmlAlarma, enlaceHoja, tarjetaEnlaces } from "./componentes.js";
import { formDiario, formComida, formSerie, formMedida } from "./formularios.js";

// El título de la sección ya va en la cabecera del diálogo.
const sinTitulo = (texto) => texto.replace(/^#{1,6}\s.*\n+/, "");
const dia = (fecha) => fechaLarga(fecha).replace(/^\S+ /, "");

// { eyebrow, titulo, html } o null si lo que se estaba cargando ya no existe.
export function contenidoHoja(h) {
  switch (h.tipo) {
    case "diario":
      return { eyebrow: `${dia(h.fecha)} · Diario`, titulo: "Diario", html: formDiario(h.fecha) };
    case "comida": {
      const d = calcularDia(h.fecha);
      const x = d.comidas.find((m) => m.c.comida === h.comida);
      if (!x) return null;
      const { c, ...resto } = x;
      return { eyebrow: `${dia(h.fecha)} · Comidas`, titulo: c.comida, html: formComida(c, { ...resto, gluten_dia: d.gluten }) };
    }
    case "serie": {
      const s = sesionDe(h.fecha);
      const it = s?.items.find((i) => i.ejercicio_id === h.ejercicio);
      if (!it) return null;
      return { eyebrow: `${dia(h.fecha)} · Fuerza`, titulo: `${it.ejercicio_id} · ${it.nombre}`, html: formSerie(it, s) };
    }
    case "medida": {
      const medidas = calcularMedidas();
      const i = medidas.findIndex((x) => x.m.fecha === h.fecha);
      if (i < 0) return null;
      return { eyebrow: `${dia(h.fecha)} · Medidas`, titulo: "Medidas", html: formMedida(medidas[i].m, medidas[i], medidas[i - 1]) };
    }
    case "ejercicio": {
      const e = ejercicio(h.ejercicio);
      return e ? { cabecera: "Ficha del ejercicio", lectura: true, html: fichaEjercicio(e) } : null;
    }
    case "bloque": {
      const x = contenidoBloque(h.fecha, h.bloque);
      return x ? { cabecera: "Bloque del día", lectura: true, html: `<p class="eyebrow">${esc(x.b.inicio)}–${esc(x.b.fin)}</p><h3>${esc(oracion(x.b.actividad))}</h3>${x.html}` } : null;
    }
    case "semana": {
      const d = diaPlan(h.fecha);
      const filas = plan.calendario.filter((c) => c.semana === d.semana && c.sesion);
      return { cabecera: "Sesiones de la semana", lectura: true, html: `<p class="dialog-lede">Semana ${d.semana} de 13</p>${tarjetaEnlaces(filas.map((c) => enlaceHoja(`${c.dia_semana} · Sesión ${c.sesion}`, dia(c.fecha), { "ir-fecha": c.fecha }, "entreno")).join(""))}` };
    }
    case "regla": {
      const r = plan.reglas[h.clave];
      return r ? { cabecera: r.titulo, lectura: true, html: md(sinTitulo(r.md), { nivelBase: 1 }) } : null;
    }
    case "pauta": {
      const p = plan.pautas[h.clave];
      return p ? { cabecera: p.titulo, lectura: true, html: md(sinTitulo(p.md), { nivelBase: 1 }) } : null;
    }
    case "documentos": return { cabecera: "Documentos del plan", lectura: true, html: htmlDocumentos() };
    case "documento": {
      const x = htmlDocumento(h.clave, h.seccion);
      return x ? { cabecera: x.titulo, lectura: true, html: x.html } : null;
    }
    case "suplementos": return { cabecera: "Suplementos y horarios", lectura: true, html: htmlSuplementos() };
    case "metas": return { cabecera: "Metas y reglas de ajuste", lectura: true, html: htmlMetas() };
    case "reglas": return { cabecera: "Reglas del plan", lectura: true, html: htmlReglas() };
    case "compras": return { cabecera: "Lista de compras", lectura: true, html: htmlCompras() };
    case "analisis": return { cabecera: "Análisis pendientes", lectura: true, html: htmlAnalisis() };
    case "contexto": return { cabecera: "Contexto clínico", lectura: true, html: htmlContexto() };
    case "porciones":
      return { cabecera: "Intercambios y porciones", lectura: true, html: htmlPorciones() };
    case "alarma":
      return { cabecera: "Señales de alarma", lectura: true, html: htmlAlarma() };
    default:
      return null;
  }
}

export const htmlHoja = (c) => c.lectura ? c.html : `<p class="eyebrow">${esc(c.eyebrow)}</p><h3>${esc(c.titulo)}</h3>
  <p class="dialog-lede">Se guarda solo al tocar cada dato. Lo que dejes vacío queda pendiente.</p>
  ${c.html}
  <div class="form-actions"><button type="button" class="button" data-cerrar-hoja>Listo</button></div>`;

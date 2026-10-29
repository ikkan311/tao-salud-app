// Tema de la app: automático (sigue al sistema), claro u oscuro. Se guarda en este dispositivo (localStorage) y se aplica con
// data-tema en <html>; el CSS lo respeta. index.html lo aplica antes de dibujar para que no parpadee.

const CLAVE = "tao-tema";
export const TEMAS = [["auto", "Automático"], ["claro", "Claro"], ["oscuro", "Oscuro"]];
const COLORES = { claro: "#f7f6f0", oscuro: "#111d23" };

export function temaGuardado() {
  try { const t = localStorage.getItem(CLAVE); return TEMAS.some(([k]) => k === t) ? t : "auto"; } catch { return "auto"; }
}

export function aplicarTema(tema = temaGuardado()) {
  const raiz = document.documentElement;
  if (tema === "auto") raiz.removeAttribute("data-tema"); else raiz.dataset.tema = tema;
  // Barra del navegador: con un tema fijo, los dos <meta theme-color> (claro y oscuro) llevan el mismo color.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const propio = m.media?.includes("dark") ? COLORES.oscuro : COLORES.claro;
    m.setAttribute("content", tema === "auto" ? propio : COLORES[tema]);
  });
}

export function guardarTema(tema) {
  try { localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento: vale hasta cerrar la app */ }
  aplicarTema(tema);
}

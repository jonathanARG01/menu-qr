// Genera el SQL que carga la guía de venta privada en Supabase (tabla prospectos_textos, clave 'guia_venta').
// El contenido NO va en el repo (es público): se lee de un archivo local, la exportación HTML de la guía en Claude Docs.
// Uso: node scripts/guia-venta/generar.mjs <guia.html> <salida.sql>
import { readFileSync, writeFileSync } from "fs";

const [entrada, salidaSql] = process.argv.slice(2);
if (!entrada || !salidaSql) {
  console.error("Uso: node scripts/guia-venta/generar.mjs <guia.html> <salida.sql>");
  process.exit(1);
}
let html = readFileSync(entrada, "utf8");

// La mención del autor sale como id interno: se cambia por el nombre.
html = html.replace(/<span data-atom="mention"[^>]*>[^<]*<\/span>/g, "Jonathan Rojas");
// Las casillas se pueden marcar (se recuerdan en el navegador).
html = html.replace(/<input type="checkbox" disabled>/g, '<input type="checkbox">');
// Tablas con scroll horizontal en el celular.
html = html.replace(/<table>/g, '<div class="tabla"><table>').replace(/<\/table>/g, "</table></div>");
// Enlaces externos en otra pestaña.
html = html.replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

// Índice con las secciones numeradas (h2).
const indice = [...html.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)]
  .map(([, id, t]) => `<li><a href="#${id}">${t}</a></li>`)
  .join("");
html = html.replace(/(<h2 id=)/, `<nav class="indice"><b>Secciones</b><ol>${indice}</ol></nav>\n$1`);

if (html.includes("$guia$")) throw new Error("El contenido no puede tener $guia$");
const sql = `-- Guía de venta privada (platovi.cl/p/<ruta>/guia). Re-ejecutable: reemplaza la versión anterior.
insert into public.prospectos_textos (clave, valor, actualizado)
values ('guia_venta', $guia$${html}$guia$, now())
on conflict (clave) do update set valor = excluded.valor, actualizado = now();
`;
writeFileSync(salidaSql, sql);
console.log("SQL generado:", salidaSql, Math.round(sql.length / 1024), "KB");

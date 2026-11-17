// Genera src/lib/prospectos/plantilla.ts a partir de scripts/prospectos/plantilla.html.
// Uso: node scripts/prospectos/generar-plantilla.mjs
// La plantilla NO lleva datos (el repo es público): __DATOS__, __ESTADOS__ y __ANEXO__ los rellena la ruta /p/[token].
import { readFileSync, writeFileSync } from "node:fs";
const html = readFileSync(new URL("./plantilla.html", import.meta.url), "utf8");
for (const k of ["__DATOS__", "__ESTADOS__", "__ANEXO__"]) if (!html.includes(k)) throw new Error(`Falta ${k} en la plantilla`);
const ts = `// Plantilla de la lista privada de prospectos (/p/<ruta secreta>). Fuente: scripts/prospectos/plantilla.html
// (editar ahí y regenerar con: node scripts/prospectos/generar-plantilla.mjs).
// Los datos NO van aquí (el repo es público): vienen de la tabla public.prospectos y se insertan en __DATOS__ y __ANEXO__.
export const PLANTILLA_PROSPECTOS: string =
  ${JSON.stringify(html)};
`;
writeFileSync(new URL("../../src/lib/prospectos/plantilla.ts", import.meta.url), ts);
console.log("plantilla.ts generada,", html.length, "caracteres");

"use client";

import { useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useToast } from "@/components/Toast";
import type { Categoria, Plato } from "@/lib/types";
import { ETIQUETAS, formatoPrecio, mensajeError } from "@/lib/utils";

// Importar la carta desde Excel: se pega lo copiado de la planilla o se sube un CSV (también el que exportan
// otros sistemas). Se muestra una vista previa antes de guardar.

type Fila = {
  categoria: string;
  nombre: string;
  descripcion: string;
  precio: number | null;
  precio_llevar: number | null;
  etiquetas: string[];
  error?: string;
};

const COLUMNAS = ["Categoría", "Plato", "Descripción", "Precio", "Precio para llevar", "Etiquetas"];

const EJEMPLO = [
  ["Entradas", "Empanada de pino", "Horneada, con carne, cebolla, huevo y aceituna", "3.500", "", ""],
  ["Fondos", "Lomo a lo pobre", "Con papas fritas, cebolla y huevo frito", "12.990", "12.490", "recomendado"],
  ["Bebidas", "Jugo natural", "Frambuesa, mango o piña", "3.200", "", "vegano"],
];

// Columnas reconocidas por nombre (en español o como las exportan otros sistemas).
const ALIAS: Record<keyof Omit<Fila, "error">, RegExp> = {
  categoria: /^(categor|rubro|familia|secci|grupo|category)/i,
  nombre: /^(plato|producto|nombre|art[ií]culo|item|name|descripci[oó]n corta)/i,
  descripcion: /^(descrip|detalle|ingredientes|description)/i,
  precio_llevar: /(llevar|delivery|take)/i,
  precio: /^(precio|valor|price|pvp|monto)/i,
  etiquetas: /^(etiqueta|tags?)/i,
};

const sinTildes = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

// "$12.990" → 12990 · "12.990,50" → 12990.5 · "4,5" → 4.5 · "1,200" → 1200.
export function leerPrecio(texto: string): number | null {
  let t = texto.replace(/[^\d.,-]/g, "");
  if (!t) return null;
  const punto = t.lastIndexOf(".");
  const coma = t.lastIndexOf(",");
  if (punto >= 0 && coma >= 0) {
    const decimal = punto > coma ? "." : ",";
    const miles = decimal === "." ? "," : ".";
    t = t.split(miles).join("").replace(decimal, ".");
  } else if (punto >= 0 || coma >= 0) {
    const sep = punto >= 0 ? "." : ",";
    const partes = t.split(sep);
    const ultima = partes[partes.length - 1];
    t = partes.length > 2 || ultima.length === 3 ? partes.join("") : partes.join(".");
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

// Separa en filas y celdas respetando comillas. El separador se adivina (tabulación al pegar desde Excel).
export function leerTabla(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/)[0] ?? "";
  const sep = primera.includes("\t") ? "\t" : (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"' && celda === "") comillas = true;
    else if (c === sep) {
      fila.push(celda.trim());
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda.trim());
      if (fila.some(Boolean)) filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  fila.push(celda.trim());
  if (fila.some(Boolean)) filas.push(fila);
  return filas;
}

export function interpretar(tabla: string[][]): Fila[] {
  if (tabla.length === 0) return [];
  const cabecera = tabla[0];
  const conCabecera = cabecera.some((c) => /plato|producto|nombre|precio|categor/i.test(c));
  // Posición de cada columna: por nombre si hay cabecera, si no en el orden de la plantilla.
  const pos: Record<string, number> = { categoria: 0, nombre: 1, descripcion: 2, precio: 3, precio_llevar: 4, etiquetas: 5 };
  if (conCabecera) {
    const usadas = new Set<number>();
    for (const campo of ["precio_llevar", "categoria", "nombre", "descripcion", "precio", "etiquetas"] as const) {
      const i = cabecera.findIndex((c, k) => !usadas.has(k) && ALIAS[campo].test(c.trim()));
      pos[campo] = i;
      if (i >= 0) usadas.add(i);
    }
  }
  const celda = (f: string[], campo: string) => (pos[campo] >= 0 ? (f[pos[campo]] ?? "").trim() : "");
  return tabla.slice(conCabecera ? 1 : 0).map((f) => {
    const precio = leerPrecio(celda(f, "precio"));
    const llevar = celda(f, "precio_llevar");
    const fila: Fila = {
      categoria: celda(f, "categoria").slice(0, 60) || "Sin categoría",
      nombre: celda(f, "nombre").slice(0, 80),
      descripcion: celda(f, "descripcion").slice(0, 300),
      precio,
      precio_llevar: llevar ? leerPrecio(llevar) : null,
      etiquetas: celda(f, "etiquetas")
        .split(/[,|/]+/)
        .map((e) => sinTildes(e))
        .map((e) => ETIQUETAS.find((x) => sinTildes(x) === e))
        .filter((e): e is string => !!e),
    };
    if (!fila.nombre) fila.error = "Falta el nombre";
    else if (precio === null) fila.error = "Precio no válido";
    return fila;
  });
}

export function ImportarCarta({
  supabase,
  restauranteId,
  moneda,
  categorias,
  platos,
  onCerrar,
}: {
  supabase: SupabaseClient;
  restauranteId: string;
  moneda: string;
  categorias: Categoria[];
  platos: Plato[];
  onCerrar: () => void;
}) {
  const avisar = useToast();
  const [texto, setTexto] = useState("");
  const [actualizar, setActualizar] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const filas = useMemo(() => interpretar(leerTabla(texto)), [texto]);
  const validas = filas.filter((f) => !f.error);
  const formato = (n: number) => formatoPrecio(n, moneda);

  const categoriaExistente = (nombre: string) => categorias.find((c) => sinTildes(c.nombre) === sinTildes(nombre));
  const platoExistente = (f: Fila) => {
    const cat = categoriaExistente(f.categoria);
    return cat ? platos.find((p) => p.categoria_id === cat.id && sinTildes(p.nombre) === sinTildes(f.nombre)) : undefined;
  };
  const nuevas = [...new Set(validas.map((f) => f.categoria))].filter((c) => !categoriaExistente(c));
  const repetidos = validas.filter((f) => platoExistente(f)).length;

  function plantilla() {
    const csv = [COLUMNAS, ...EJEMPLO].map((f) => f.map((c) => `"${c}"`).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "plantilla-carta-platovi.csv";
    a.click();
  }

  async function leerArchivo(archivo: File | undefined) {
    if (!archivo) return;
    if (/\.xlsx?$/i.test(archivo.name)) {
      avisar("Abre el Excel, selecciona la tabla, cópiala (Ctrl+C) y pégala aquí. O guárdalo como CSV.", "error");
      return;
    }
    const buffer = await archivo.arrayBuffer();
    // Excel en Windows suele guardar el CSV en Latin-1: si no es UTF-8 válido, se lee así.
    let contenido: string;
    try {
      contenido = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      contenido = new TextDecoder("windows-1252").decode(buffer);
    }
    setTexto(contenido);
  }

  async function importar() {
    if (!validas.length) return;
    setGuardando(true);
    try {
      // 1. Categorías que faltan.
      const ids = new Map(categorias.map((c) => [sinTildes(c.nombre), c.id]));
      if (nuevas.length) {
        const { data, error } = await supabase
          .from("categorias")
          .insert(nuevas.map((nombre, i) => ({ restaurante_id: restauranteId, nombre, orden: categorias.length + i })))
          .select("id, nombre");
        if (error) throw error;
        for (const c of data ?? []) ids.set(sinTildes(c.nombre), c.id);
      }
      // 2. Platos: los que ya existen se actualizan (si se eligió) y el resto se crea.
      const crear: Record<string, unknown>[] = [];
      const cambios: PromiseLike<{ error: unknown }>[] = [];
      const ordenPorCategoria = new Map<string, number>();
      for (const f of validas) {
        const categoria_id = ids.get(sinTildes(f.categoria))!;
        const existente = platoExistente(f);
        if (existente) {
          if (actualizar)
            cambios.push(
              supabase
                .from("platos")
                .update({
                  precio: f.precio,
                  ...(f.descripcion ? { descripcion: f.descripcion } : {}),
                  ...(f.precio_llevar !== null ? { precio_llevar: f.precio_llevar } : {}),
                })
                .eq("id", existente.id),
            );
          continue;
        }
        const orden =
          ordenPorCategoria.get(categoria_id) ?? platos.filter((p) => p.categoria_id === categoria_id).length;
        ordenPorCategoria.set(categoria_id, orden + 1);
        crear.push({
          restaurante_id: restauranteId,
          categoria_id,
          nombre: f.nombre,
          descripcion: f.descripcion || null,
          precio: f.precio,
          etiquetas: f.etiquetas,
          orden,
          ...(f.precio_llevar !== null ? { precio_llevar: f.precio_llevar } : {}),
        });
      }
      for (let i = 0; i < crear.length; i += 200) {
        const { error } = await supabase.from("platos").insert(crear.slice(i, i + 200));
        if (error) throw error;
      }
      const fallos = (await Promise.all(cambios)).filter((r) => r.error);
      if (fallos.length) throw fallos[0].error;
      avisar(`Listo: ${crear.length} platos nuevos${cambios.length ? ` y ${cambios.length} actualizados` : ""}`);
      // La carta del panel se vuelve a cargar con todo lo importado.
      window.location.reload();
    } catch (e) {
      avisar(mensajeError(e), "error");
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importar carta"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl bg-superficie shadow-2xl"
      >
        <div className="space-y-3 overflow-y-auto p-5">
          <div>
            <h2 className="text-lg font-semibold">Importar carta desde Excel</h2>
            <p className="mt-1 text-sm text-suave">
              Columnas: <strong>{COLUMNAS.join(" · ")}</strong>. Solo Plato y Precio son obligatorias. Sirve también el
              Excel que exportan Fudo, Toteat u otros sistemas (se reconocen los nombres de columna más comunes).
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button type="button" className="boton-secundario" onClick={plantilla}>
              Descargar plantilla
            </button>
            <label className="boton-secundario cursor-pointer">
              Subir CSV
              <input type="file" accept=".csv,.txt,.tsv,.xls,.xlsx" className="hidden" onChange={(e) => leerArchivo(e.target.files?.[0])} />
            </label>
          </div>
          <label className="block text-sm">
            O pega aquí lo que copiaste de Excel o Google Sheets (con la fila de títulos)
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              className="campo mt-1 font-mono text-xs"
              placeholder={"Categoría\tPlato\tDescripción\tPrecio\nFondos\tLomo a lo pobre\tCon papas fritas y huevo\t12990"}
            />
          </label>

          {filas.length > 0 && (
            <>
              <p className="text-sm">
                <strong>{validas.length}</strong> platos listos
                {nuevas.length > 0 && <> · {nuevas.length} categorías nuevas ({nuevas.join(", ")})</>}
                {filas.length - validas.length > 0 && (
                  <span className="text-red-600"> · {filas.length - validas.length} filas con error (no se importan)</span>
                )}
              </p>
              {repetidos > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={actualizar} onChange={(e) => setActualizar(e.target.checked)} />
                  {repetidos} ya están en tu carta: actualizar su precio y descripción (si no, se dejan como están)
                </label>
              )}
              <div className="max-h-72 overflow-auto rounded-xl border border-borde">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-stone-50 text-left text-suave">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Categoría</th>
                      <th className="px-2 py-1.5 font-medium">Plato</th>
                      <th className="px-2 py-1.5 text-right font-medium">Precio</th>
                      <th className="px-2 py-1.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {filas.slice(0, 300).map((f, i) => (
                      <tr key={i} className={f.error ? "bg-red-50" : ""}>
                        <td className="px-2 py-1.5">{f.categoria}</td>
                        <td className="px-2 py-1.5">
                          <span className="font-medium">{f.nombre || "—"}</span>
                          {f.descripcion && <span className="block truncate text-suave">{f.descripcion}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {f.precio !== null ? formato(f.precio) : "—"}
                          {f.precio_llevar !== null && <span className="block text-suave">llevar {formato(f.precio_llevar)}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-suave">
                          {f.error ? <span className="text-red-600">{f.error}</span> : platoExistente(f) ? "ya existe" : "nuevo"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-borde p-4">
          <button type="button" className="boton-secundario" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="button" className="boton" disabled={!validas.length || guardando} onClick={importar}>
            {guardando ? "Importando…" : `Importar ${validas.length || ""} platos`}
          </button>
        </div>
      </div>
    </div>
  );
}

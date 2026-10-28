"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { borrarFoto, subirFoto } from "@/lib/fotos";
import type { Categoria, GrupoOpciones, Plato, Restaurante } from "@/lib/types";
import { gruposDe } from "@/lib/opciones";
import { ETIQUETAS, mensajeError } from "@/lib/utils";
import { Interruptor } from "@/components/Interruptor";
import { IDIOMAS_EXTRA, IDIOMA_EN_ESPANOL } from "@/lib/i18n";

type Props = {
  restaurante: Restaurante;
  categorias: Categoria[];
  plato: Plato | null;
  categoriaId: string;
  contarPlatos: (categoriaId: string) => number;
  onCerrar: () => void;
  onGuardado: (plato: Plato, esNuevo: boolean) => void;
  onBorrado: (id: string) => void;
};

export function PlatoModal({
  restaurante,
  categorias,
  plato,
  categoriaId,
  contarPlatos,
  onCerrar,
  onGuardado,
  onBorrado,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const esNuevo = !plato;
  const [nombre, setNombre] = useState(plato?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plato?.descripcion ?? "");
  const [precio, setPrecio] = useState(plato ? String(plato.precio) : "");
  const [categoria, setCategoria] = useState(plato?.categoria_id ?? categoriaId);
  const [etiquetas, setEtiquetas] = useState<string[]>(plato?.etiquetas ?? []);
  const [disponible, setDisponible] = useState(plato?.disponible ?? true);
  const [destacado, setDestacado] = useState(plato?.destacado ?? false);
  // La casilla de destacado aparece cuando ya existe la columna (migración 0007).
  const [tieneDestacado] = useState(() => !plato || "destacado" in plato);
  const [fotoUrl, setFotoUrl] = useState<string | null>(plato?.foto_url ?? null);
  // Migración 0018: opciones (tamaño, acompañamiento…) y precio para llevar o delivery.
  const [grupos, setGrupos] = useState<GrupoOpciones[]>(() => (plato ? gruposDe(plato) : []));
  const [precioLlevar, setPrecioLlevar] = useState(plato?.precio_llevar != null ? String(plato.precio_llevar) : "");
  const idiomas = IDIOMAS_EXTRA.filter((i) => restaurante.idiomas?.includes(i));
  const [traducciones, setTraducciones] = useState<Record<string, { nombre: string; descripcion: string }>>(() =>
    Object.fromEntries(
      IDIOMAS_EXTRA.map((i) => [
        i,
        { nombre: plato?.traducciones?.[i]?.nombre ?? "", descripcion: plato?.traducciones?.[i]?.descripcion ?? "" },
      ]),
    ),
  );
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subidas = useRef<string[]>([]);
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cancelar();
    window.addEventListener("keydown", alTeclear);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si se cierra sin guardar, se borran las fotos subidas en esta edición.
  function cancelar() {
    subidas.current.forEach((url) => borrarFoto(supabase, url));
    onCerrar();
  }

  async function elegirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      const url = await subirFoto(supabase, restaurante.id, archivo);
      subidas.current.push(url);
      setFotoUrl(url);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(precio.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      setError("Escribe un precio válido.");
      return;
    }
    const llevar = precioLlevar.trim() ? Number(precioLlevar.replace(",", ".")) : null;
    if (llevar !== null && (!Number.isFinite(llevar) || llevar < 0)) {
      setError("Escribe un precio para llevar válido o déjalo vacío.");
      return;
    }
    const opciones = gruposDe({ opciones: grupos });
    setGuardando(true);
    setError(null);

    const datos = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio: Math.round(valor * 100) / 100,
      categoria_id: categoria,
      etiquetas,
      disponible,
      ...(tieneDestacado ? { destacado } : {}),
      foto_url: fotoUrl,
      // Solo si ya existe la columna (migración 0003).
      ...("idiomas" in restaurante
        ? {
            traducciones: {
              ...plato?.traducciones,
              ...Object.fromEntries(
                IDIOMAS_EXTRA.map((i) => [
                  i,
                  {
                    nombre: traducciones[i].nombre.trim() || undefined,
                    descripcion: traducciones[i].descripcion.trim() || undefined,
                  },
                ]),
              ),
            },
          }
        : {}),
      ...(esNuevo || categoria !== plato.categoria_id ? { orden: contarPlatos(categoria) } : {}),
      // Solo si se usan o ya existen las columnas (así sin la migración 0018 se sigue pudiendo guardar).
      ...(opciones.length || (plato && "opciones" in plato) ? { opciones } : {}),
      ...(llevar !== null || (plato && "precio_llevar" in plato) ? { precio_llevar: llevar === null ? null : Math.round(llevar * 100) / 100 } : {}),
    };

    const enviar = (fila: Partial<Plato>) =>
      esNuevo
        ? supabase
            .from("platos")
            .insert({ ...fila, restaurante_id: restaurante.id })
            .select()
            .single()
        : supabase.from("platos").update(fila).eq("id", plato.id).select().single();
    let { data, error } = await enviar(datos);
    // Sin la migración 0007 todavía no existe la columna "destacado": se guarda sin ella.
    if (error && "destacado" in datos && error.message.includes("destacado")) {
      const { destacado: _sinColumna, ...resto } = datos;
      void _sinColumna;
      ({ data, error } = await enviar(resto));
    }

    if (error) {
      setError(mensajeError(error));
      setGuardando(false);
      return;
    }

    // Limpia las fotos que ya no se usan.
    const enUso = new Set([fotoUrl]);
    const sobrantes = [...subidas.current, plato?.foto_url].filter((u): u is string => Boolean(u) && !enUso.has(u!));
    sobrantes.forEach((url) => borrarFoto(supabase, url));

    onGuardado(data as Plato, esNuevo);
  }

  async function borrar() {
    if (!plato || !confirm(`¿Borrar "${plato.nombre}"? No se puede deshacer.`)) return;
    setGuardando(true);
    const { error } = await supabase.from("platos").delete().eq("id", plato.id);
    if (error) {
      setError(mensajeError(error));
      setGuardando(false);
      return;
    }
    [...subidas.current, plato.foto_url].forEach((url) => borrarFoto(supabase, url));
    onBorrado(plato.id);
  }

  function alternarEtiqueta(et: string) {
    setEtiquetas((actuales) => (actuales.includes(et) ? actuales.filter((x) => x !== et) : [...actuales, et]));
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={cancelar}>
      <form
        onSubmit={guardar}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-plato"
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-superficie shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-borde px-5 py-4">
          <h2 id="titulo-plato" className="text-lg font-semibold">
            {esNuevo ? "Nuevo plato" : "Editar plato"}
          </h2>
          <button
            type="button"
            onClick={cancelar}
            aria-label="Cerrar"
            className="text-2xl leading-none text-suave hover:text-tinta"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => inputFoto.current?.click()}
              disabled={subiendo}
              className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-50 text-center text-xs text-suave hover:border-marca"
            >
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoUrl} alt="Foto del plato" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <span>{subiendo ? "Subiendo…" : "+ Foto"}</span>
              )}
              {subiendo && fotoUrl && (
                <span className="absolute inset-0 flex items-center justify-center bg-superficie/70">Subiendo…</span>
              )}
            </button>
            <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={elegirFoto} />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <label htmlFor="plato-nombre" className="etiqueta-campo">
                  Nombre
                </label>
                <input
                  id="plato-nombre"
                  required
                  maxLength={80}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="campo"
                  autoFocus={esNuevo}
                />
              </div>
              {fotoUrl && (
                <div className="flex gap-3 text-sm">
                  <button type="button" onClick={() => inputFoto.current?.click()} className="text-marca">
                    Cambiar foto
                  </button>
                  <button type="button" onClick={() => setFotoUrl(null)} className="text-suave hover:text-red-600">
                    Quitar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="plato-descripcion" className="etiqueta-campo">
              Descripción <span className="font-normal text-suave">(opcional)</span>
            </label>
            <textarea
              id="plato-descripcion"
              rows={2}
              maxLength={300}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="campo resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="plato-precio" className="etiqueta-campo">
                Precio ({restaurante.moneda})
              </label>
              <input
                id="plato-precio"
                required
                inputMode="decimal"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="campo tabular-nums"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="plato-categoria" className="etiqueta-campo">
                Categoría
              </label>
              <select id="plato-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="campo">
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="plato-precio-llevar" className="etiqueta-campo">
              Precio para llevar o delivery <span className="font-normal text-suave">(opcional)</span>
            </label>
            <input
              id="plato-precio-llevar"
              inputMode="decimal"
              value={precioLlevar}
              onChange={(e) => setPrecioLlevar(e.target.value)}
              className="campo tabular-nums"
              placeholder="Igual que en el local"
            />
          </div>

          <EditorOpciones grupos={grupos} onChange={setGrupos} moneda={restaurante.moneda} />

          <fieldset>
            <legend className="etiqueta-campo">Etiquetas</legend>
            <div className="flex flex-wrap gap-2">
              {ETIQUETAS.map((et) => {
                const activa = etiquetas.includes(et);
                return (
                  <button
                    key={et}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => alternarEtiqueta(et)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      activa ? "border-marca bg-marca text-white" : "border-borde text-suave hover:border-stone-400"
                    }`}
                  >
                    {et}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {idiomas.length > 0 && (
            <fieldset className="space-y-3 rounded-xl border border-borde p-3">
              <legend className="px-1 text-sm font-medium">Traducciones</legend>
              {idiomas.map((i) => (
                <div key={i} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-suave">{IDIOMA_EN_ESPANOL[i]}</p>
                  <input
                    aria-label={`Nombre en ${IDIOMA_EN_ESPANOL[i]}`}
                    maxLength={80}
                    value={traducciones[i].nombre}
                    onChange={(e) => setTraducciones((t) => ({ ...t, [i]: { ...t[i], nombre: e.target.value } }))}
                    placeholder={nombre || "Nombre"}
                    className="campo py-2"
                  />
                  <input
                    aria-label={`Descripción en ${IDIOMA_EN_ESPANOL[i]}`}
                    maxLength={300}
                    value={traducciones[i].descripcion}
                    onChange={(e) => setTraducciones((t) => ({ ...t, [i]: { ...t[i], descripcion: e.target.value } }))}
                    placeholder={descripcion || "Descripción"}
                    className="campo py-2"
                  />
                </div>
              ))}
              <p className="text-xs text-suave">Si dejas un campo vacío, se muestra en español.</p>
            </fieldset>
          )}

          <label className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
            <span>
              <span className="block font-medium">{disponible ? "Disponible" : "Agotado"}</span>
              <span className="block text-xs text-suave">Los platos agotados no se muestran en la carta.</span>
            </span>
            <Interruptor activo={disponible} onChange={setDisponible} etiqueta="Disponible" />
          </label>

          {tieneDestacado && (
            <label className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3">
              <span>
                <span className="block font-medium">★ Destacado</span>
                <span className="block text-xs text-suave">Sale arriba de todo en la carta, con foto grande.</span>
              </span>
              <Interruptor activo={destacado} onChange={setDestacado} etiqueta="Destacado" />
            </label>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="flex items-center gap-3 border-t border-borde px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {!esNuevo && (
            <button type="button" onClick={borrar} disabled={guardando} className="text-sm text-red-600 hover:underline">
              Borrar
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={cancelar} className="boton-secundario">
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || subiendo}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Grupos de opciones del plato: "Tamaño" (elige 1, obligatorio), "Agregados" (hasta 3, con precio extra)…
function EditorOpciones({
  grupos,
  onChange,
  moneda,
}: {
  grupos: GrupoOpciones[];
  onChange: (g: GrupoOpciones[]) => void;
  moneda: string;
}) {
  const cambiar = (i: number, cambios: Partial<GrupoOpciones>) =>
    onChange(grupos.map((g, k) => (k === i ? { ...g, ...cambios } : g)));
  const cambiarValor = (i: number, j: number, cambios: Partial<{ nombre: string; precio: number }>) =>
    cambiar(i, { valores: grupos[i].valores.map((v, k) => (k === j ? { ...v, ...cambios } : v)) });

  return (
    <fieldset className="space-y-3 rounded-xl border border-borde p-3">
      <legend className="px-1 text-sm font-medium">Opciones para elegir</legend>
      {grupos.length === 0 && (
        <p className="text-xs text-suave">
          Tamaño, acompañamiento, punto de la carne… El cliente y el mesero las eligen al pedir, y cada una puede sumar un
          precio extra.
        </p>
      )}
      {grupos.map((g, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-stone-50 p-2.5">
          <div className="flex gap-2">
            <input
              aria-label="Nombre del grupo"
              value={g.nombre}
              maxLength={40}
              onChange={(e) => cambiar(i, { nombre: e.target.value })}
              placeholder="Ej: Acompañamiento"
              className="campo py-2"
            />
            <button
              type="button"
              onClick={() => onChange(grupos.filter((_, k) => k !== i))}
              className="shrink-0 px-2 text-sm text-suave hover:text-red-600"
              aria-label="Quitar grupo"
            >
              ×
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={g.min > 0} onChange={(e) => cambiar(i, { min: e.target.checked ? 1 : 0 })} />
              Obligatorio
            </label>
            <label className="flex items-center gap-1.5">
              Se pueden marcar
              <input
                type="number"
                min={1}
                max={10}
                value={g.max}
                onChange={(e) => cambiar(i, { max: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })}
                className="w-14 rounded-lg border border-borde px-2 py-1"
              />
            </label>
          </div>
          {g.valores.map((v, j) => (
            <div key={j} className="flex gap-2">
              <input
                aria-label="Opción"
                value={v.nombre}
                maxLength={40}
                onChange={(e) => cambiarValor(i, j, { nombre: e.target.value })}
                placeholder={j === 0 ? "Ej: Papas fritas" : "Otra opción"}
                className="campo min-w-0 flex-1 py-1.5"
              />
              {/* El ancho va en un contenedor: .campo fuerza width 100% y ganaba al w-24, aplastando el nombre. */}
              <span className="w-24 shrink-0">
                <input
                  aria-label={`Precio extra (${moneda})`}
                  inputMode="decimal"
                  value={v.precio ? String(v.precio) : ""}
                  onChange={(e) => cambiarValor(i, j, { precio: Math.max(0, Number(e.target.value.replace(",", ".")) || 0) })}
                  placeholder="+0"
                  className="campo py-1.5 tabular-nums"
                />
              </span>
              <button
                type="button"
                onClick={() => cambiar(i, { valores: g.valores.filter((_, k) => k !== j) })}
                className="shrink-0 px-1 text-suave hover:text-red-600"
                aria-label="Quitar opción"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => cambiar(i, { valores: [...g.valores, { nombre: "", precio: 0 }] })}
            className="text-sm font-medium text-marca"
          >
            + Opción
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...grupos, { nombre: "", min: 0, max: 1, valores: [{ nombre: "", precio: 0 }] }])}
        className="text-sm font-medium text-marca"
      >
        + Grupo de opciones
      </button>
    </fieldset>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Restaurante, Sucursal } from "@/lib/types";
import { mensajeError, slugify, urlCarta } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { Interruptor } from "@/components/Interruptor";
import { useUrlSitio } from "@/lib/useUrlSitio";
import { revalidarCarta } from "../actions";

type Borrador = Pick<Sucursal, "nombre" | "slug" | "direccion" | "horario" | "whatsapp">;
const VACIA: Borrador = { nombre: "", slug: "", direccion: "", horario: "", whatsapp: "" };

// Tope del plan Grupo: 5 sucursales contando la principal (la base de datos también lo exige, SQL 0027).
export const MAX_SUCURSALES = 5;

export function EditorSucursales({
  restaurante,
  iniciales,
  nombrePrincipalInicial,
}: {
  restaurante: Restaurante;
  iniciales: Sucursal[];
  nombrePrincipalInicial: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const sitio = useUrlSitio();
  const [sucursales, setSucursales] = useState(iniciales);
  const [editando, setEditando] = useState<Sucursal | "nueva" | null>(null);
  // Nombre del local principal (restaurantes.ajustes.nombre_principal): el que no es sucursal.
  const [principal, setPrincipal] = useState(nombrePrincipalInicial);
  const [principalGuardado, setPrincipalGuardado] = useState(nombrePrincipalInicial);
  const [guardandoPrincipal, setGuardandoPrincipal] = useState(false);

  // Se lee antes lo último guardado en ajustes para no pisar otros cambios.
  async function guardarPrincipal(e: { preventDefault(): void }) {
    e.preventDefault();
    const nombre = principal.trim().slice(0, 60);
    setGuardandoPrincipal(true);
    const { data, error } = await supabase.from("restaurantes").select("ajustes").eq("id", restaurante.id).single();
    const { error: e2 } = error
      ? { error }
      : await supabase
          .from("restaurantes")
          .update({ ajustes: { ...(data?.ajustes ?? {}), nombre_principal: nombre } })
          .eq("id", restaurante.id);
    setGuardandoPrincipal(false);
    if (e2) return avisar(mensajeError(e2), "error");
    setPrincipal(nombre);
    setPrincipalGuardado(nombre);
    avisar("Nombre del local principal guardado");
  }

  async function guardar(datos: Borrador) {
    const fila = {
      nombre: datos.nombre.trim(),
      slug: slugify(datos.slug || datos.nombre).slice(0, 32),
      direccion: datos.direccion?.trim() || null,
      horario: datos.horario?.trim() || null,
      whatsapp: datos.whatsapp?.replace(/\D/g, "") || null,
    };
    if (editando === "nueva" && sucursales.length >= MAX_SUCURSALES) {
      return avisar(`Máximo ${MAX_SUCURSALES} sucursales, contando la principal.`, "error");
    }
    const consulta =
      editando === "nueva"
        ? supabase
            .from("sucursales")
            .insert({ ...fila, restaurante_id: restaurante.id, orden: sucursales.length })
            .select()
            .single()
        : supabase
            .from("sucursales")
            .update(fila)
            .eq("id", (editando as Sucursal).id)
            .select()
            .single();
    const { data, error } = await consulta;
    if (error) return avisar(mensajeError(error), "error");
    const nueva = data as Sucursal;
    setSucursales((s) => (editando === "nueva" ? [...s, nueva] : s.map((x) => (x.id === nueva.id ? nueva : x))));
    setEditando(null);
    avisar("Sucursal guardada");
    revalidarCarta();
  }

  async function alternar(s: Sucursal, activa: boolean) {
    setSucursales((l) => l.map((x) => (x.id === s.id ? { ...x, activa } : x)));
    const { error } = await supabase.from("sucursales").update({ activa }).eq("id", s.id);
    if (error) {
      setSucursales((l) => l.map((x) => (x.id === s.id ? s : x)));
      return avisar(mensajeError(error), "error");
    }
    revalidarCarta();
  }

  async function borrar(s: Sucursal) {
    if (!confirm(`¿Borrar la sucursal "${s.nombre}" y sus mesas? Los QR impresos seguirán abriendo la carta.`)) return;
    const { error } = await supabase.from("sucursales").delete().eq("id", s.id);
    if (error) return avisar(mensajeError(error), "error");
    setSucursales((l) => l.filter((x) => x.id !== s.id));
    revalidarCarta();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Sucursales</h1>
        <p className="text-sm text-suave">
          Todas comparten la misma carta. Cada sucursal tiene su dirección, horario, WhatsApp para pedidos y sus propios QR de
          mesa.
        </p>
      </div>

      <form onSubmit={guardarPrincipal} className="tarjeta space-y-3 p-4">
        <div>
          <p className="font-semibold">Local principal</p>
          <p className="text-sm text-suave">
            Es tu local de siempre, el que no es sucursal. Este nombre se ve en los selectores de Salón, QR, Para llevar y
            Estadísticas. Si lo dejas vacío se usa &quot;{restaurante.nombre}&quot;.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            maxLength={60}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            placeholder={restaurante.nombre}
            className="campo min-w-0 flex-1"
            aria-label="Nombre del local principal"
          />
          <button
            type="submit"
            className="boton"
            disabled={guardandoPrincipal || principal.trim() === principalGuardado.trim()}
          >
            {guardandoPrincipal ? "Guardando…" : "Guardar"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="break-all font-mono text-xs text-suave">{urlCarta(restaurante.slug, undefined, sitio)}</span>
          <Link href="/panel/qr?sucursal=principal" className="text-marca">
            QR del local principal
          </Link>
        </div>
      </form>

      {sucursales.length === 0 && (
        <div className="tarjeta p-6 text-center text-sm text-suave">
          Si tienes un solo local no necesitas cargar nada aquí. Agrega sucursales cuando tengas más de uno (hasta 5, contando la principal).
        </div>
      )}

      <ul className="space-y-3">
        {sucursales.map((s) => (
          <li key={s.id} className={`tarjeta p-4 ${s.activa ? "" : "opacity-70"}`}>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {s.nombre}
                  {!s.activa && <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs font-normal">Oculta</span>}
                </p>
                {s.direccion && <p className="text-sm text-suave">{s.direccion}</p>}
                {s.horario && <p className="text-sm text-suave">{s.horario}</p>}
                <p className="mt-1 text-xs text-suave">
                  {s.whatsapp ? `WhatsApp ${s.whatsapp}` : "Usa el WhatsApp del restaurante"}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-suave">
                  {urlCarta(restaurante.slug, undefined, sitio, s.slug)}
                </p>
              </div>
              <Interruptor activo={s.activa} onChange={(v) => alternar(s, v)} etiqueta={`Mostrar ${s.nombre}`} />
            </div>
            <div className="mt-3 flex gap-4 border-t border-borde pt-3 text-sm">
              <button type="button" className="text-marca" onClick={() => setEditando(s)}>
                Editar
              </button>
              <Link href={`/panel/qr?sucursal=${s.id}`} className="text-marca">
                QR de esta sucursal
              </Link>
              <div className="flex-1" />
              <button type="button" className="text-suave hover:text-red-600" onClick={() => borrar(s)}>
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {sucursales.length < MAX_SUCURSALES ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="boton" onClick={() => setEditando("nueva")}>
            + Agregar sucursal
          </button>
          <span className="text-sm text-suave">
            {sucursales.length} de {MAX_SUCURSALES}, contando la principal
          </span>
        </div>
      ) : (
        <p className="tarjeta p-4 text-sm text-suave">
          Llegaste al máximo de {MAX_SUCURSALES} sucursales, contando la principal. Para agregar otra, borra una que ya no uses.
        </p>
      )}

      {editando && (
        <FormSucursal
          inicial={editando === "nueva" ? VACIA : editando}
          nueva={editando === "nueva"}
          onCerrar={() => setEditando(null)}
          onGuardar={guardar}
        />
      )}
    </div>
  );
}

function FormSucursal({
  inicial,
  nueva,
  onCerrar,
  onGuardar,
}: {
  inicial: Borrador;
  nueva: boolean;
  onCerrar: () => void;
  onGuardar: (datos: Borrador) => Promise<void>;
}) {
  const [datos, setDatos] = useState<Borrador>(inicial);
  const [slugTocado, setSlugTocado] = useState(!nueva);
  const [guardando, setGuardando] = useState(false);
  const campo = (clave: keyof Borrador) => ({
    value: datos[clave] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const valor = e.target.value;
      setDatos((d) => ({
        ...d,
        [clave]: valor,
        ...(clave === "nombre" && !slugTocado ? { slug: slugify(valor).slice(0, 32) } : {}),
      }));
    },
  });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onCerrar}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setGuardando(true);
          await onGuardar(datos);
          setGuardando(false);
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-sucursal"
        className="w-full max-w-md space-y-4 rounded-t-2xl bg-superficie p-5 shadow-2xl sm:rounded-2xl"
      >
        <h2 id="titulo-sucursal" className="text-lg font-semibold">
          {nueva ? "Nueva sucursal" : "Editar sucursal"}
        </h2>
        <label className="block">
          <span className="etiqueta-campo">Nombre</span>
          <input required maxLength={60} placeholder="Providencia" className="campo" autoFocus {...campo("nombre")} />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Nombre corto para el enlace</span>
          <input
            required
            maxLength={32}
            className="campo font-mono text-sm"
            value={datos.slug}
            onChange={(e) => {
              setSlugTocado(true);
              setDatos((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }));
            }}
          />
          <span className="mt-1 block text-xs text-suave">Va en los QR de esta sucursal. Si lo cambias, reimprime sus QR.</span>
        </label>
        <label className="block">
          <span className="etiqueta-campo">Dirección</span>
          <input maxLength={160} placeholder="Av. Santa Fe 1234" className="campo" {...campo("direccion")} />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Horario</span>
          <input maxLength={120} placeholder="Lun a sáb de 8 a 20 h" className="campo" {...campo("horario")} />
        </label>
        <label className="block">
          <span className="etiqueta-campo">WhatsApp para pedidos</span>
          <input inputMode="tel" placeholder="56912345678" className="campo" {...campo("whatsapp")} />
          <span className="mt-1 block text-xs text-suave">Opcional. Si lo dejas vacío se usa el del restaurante.</span>
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className="boton-secundario">
            Cancelar
          </button>
          <button type="submit" className="boton" disabled={guardando || !datos.nombre.trim()}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Interruptor } from "@/components/Interruptor";
import { subirImagen } from "@/lib/imagenes";
import type { Cupon, Negocio, Premio, ProgramaSellos, PromocionFila, Reto } from "@/lib/tipos";
import { formatoFecha, formatoPrecio, mensajeError } from "@/lib/utils";

type Pestana = "catalogo" | "cupones" | "promociones" | "retos";
type Puede = { premios: boolean; cupones: boolean; promociones: boolean; retos: boolean; puntos: boolean };

const hoy = () => new Date().toISOString().slice(0, 10);

// Catálogo de premios (con foto, stock y fechas), cupones, promociones por fecha y retos con insignias.
export function Premios({
  negocio,
  programa,
  puede,
  premios,
  cupones,
  promociones,
  retos,
}: {
  negocio: Negocio;
  programa: ProgramaSellos;
  puede: Puede;
  premios: Premio[];
  cupones: Cupon[];
  promociones: PromocionFila[];
  retos: Reto[];
}) {
  const [pestana, setPestana] = useState<Pestana>("catalogo");
  const PESTANAS: [Pestana, string, boolean][] = [
    ["catalogo", "Catálogo de premios", puede.premios],
    ["cupones", "Cupones", puede.cupones],
    ["promociones", "Promociones", puede.promociones],
    ["retos", "Retos e insignias", puede.retos],
  ];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Premios y cupones</h1>
        <p className="text-sm text-suave">Todo lo que tus clientes pueden ganar, administrado por ti.</p>
      </div>
      <div className="sin-barra flex gap-1 overflow-x-auto" role="tablist">
        {PESTANAS.map(([id, texto]) => (
          <button
            key={id}
            role="tab"
            aria-selected={pestana === id}
            onClick={() => setPestana(id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${pestana === id ? "bg-marca text-white shadow-sm" : "bg-superficie text-suave ring-1 ring-borde"}`}
          >
            {texto}
          </button>
        ))}
      </div>
      {!PESTANAS.find((p) => p[0] === pestana)?.[2] ? (
        <div className="tarjeta border-dashed p-5 text-sm">
          <p className="font-semibold">Esto es del plan Pro</p>
          <p className="text-suave">Súbete al plan Pro para usarlo. Lo que ya armaste se guarda igual.</p>
          <a href="/panel/plan" className="boton mt-3">
            Ver planes
          </a>
        </div>
      ) : pestana === "catalogo" ? (
        <Catalogo negocio={negocio} programa={programa} premios={premios} />
      ) : pestana === "cupones" ? (
        <Cupones negocio={negocio} cupones={cupones} />
      ) : pestana === "promociones" ? (
        <Promociones negocio={negocio} promociones={promociones} />
      ) : (
        <Retos negocio={negocio} programa={programa} retos={retos} />
      )}
    </div>
  );
}

function useGuardar() {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  async function correr(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setOcupado(true);
    const { error } = await fn();
    setOcupado(false);
    if (error) {
      avisar(mensajeError(error), "error");
      return false;
    }
    avisar(ok);
    router.refresh();
    return true;
  }
  return { supabase, avisar, ocupado, correr };
}

// ── Catálogo ─────────────────────────
const PREMIO_NUEVO = {
  titulo: "",
  descripcion: "",
  imagen_url: null as string | null,
  categoria: "",
  puntos: 500,
  stock: null as number | null,
  desde: null as string | null,
  hasta: null as string | null,
  costo: null as number | null,
  destacado: false,
  activo: true,
  orden: 0,
};

function Catalogo({ negocio, programa, premios }: { negocio: Negocio; programa: ProgramaSellos; premios: Premio[] }) {
  const { supabase, avisar, ocupado, correr } = useGuardar();
  const [editando, setEditando] = useState<(typeof PREMIO_NUEVO & { id?: string }) | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const u = programa.nombre_puntos || "puntos";

  async function foto(archivo: File | undefined) {
    if (!archivo || !editando) return;
    setSubiendo(true);
    try {
      const url = await subirImagen(supabase, negocio.id, archivo, "premio", 900);
      setEditando({ ...editando, imagen_url: url });
    } catch (e) {
      avisar(mensajeError(e), "error");
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    const { id, ...fila } = editando;
    const ok = await correr(
      () =>
        id
          ? supabase.from("premios").update(fila).eq("id", id)
          : supabase.from("premios").insert({ ...fila, negocio_id: negocio.id }),
      "Premio guardado",
    );
    if (ok) setEditando(null);
  }

  return (
    <div className="space-y-4">
      {programa.tipo !== "puntos" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
          El catálogo se canjea con puntos. Tu tarjeta es de sellos: cámbiala a puntos o cashback en{" "}
          <a href="/panel/tarjeta" className="font-semibold underline">
            Tu tarjeta
          </a>{" "}
          para que tus clientes lo vean.
        </p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-suave">{premios.length} premios</p>
        <button className="boton py-2" onClick={() => setEditando({ ...PREMIO_NUEVO, orden: premios.length })}>
          + Nuevo premio
        </button>
      </div>

      {editando && (
        <form onSubmit={guardar} className="tarjeta grid gap-4 p-5 sm:grid-cols-[10rem_1fr]">
          <label className="flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-borde bg-fondo text-center text-xs text-suave">
            {editando.imagen_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={editando.imagen_url} alt="" className="h-full w-full object-cover" />
            ) : subiendo ? (
              "Subiendo…"
            ) : (
              "📷 Subir foto"
            )}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => foto(e.target.files?.[0])} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="etiqueta-campo">Premio</span>
              <input
                required
                maxLength={60}
                value={editando.titulo}
                onChange={(e) => setEditando({ ...editando, titulo: e.target.value })}
                placeholder="Taza de la casa"
                className="campo"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="etiqueta-campo">Descripción</span>
              <textarea
                maxLength={300}
                rows={2}
                value={editando.descripcion}
                onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })}
                className="campo resize-none"
              />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Cuesta ({u})</span>
              <input
                type="number"
                min={1}
                required
                value={editando.puntos}
                onChange={(e) => setEditando({ ...editando, puntos: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                className="campo"
              />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Categoría</span>
              <input
                maxLength={30}
                value={editando.categoria}
                onChange={(e) => setEditando({ ...editando, categoria: e.target.value })}
                placeholder="Bebidas, Merch, Experiencias…"
                className="campo"
              />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Stock (vacío = sin límite)</span>
              <input
                type="number"
                min={0}
                value={editando.stock ?? ""}
                onChange={(e) => setEditando({ ...editando, stock: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))) })}
                className="campo"
              />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Te cuesta (opcional)</span>
              <input
                type="number"
                min={0}
                value={editando.costo ?? ""}
                onChange={(e) => setEditando({ ...editando, costo: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                className="campo"
              />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Desde</span>
              <input
                type="date"
                value={editando.desde ?? ""}
                onChange={(e) => setEditando({ ...editando, desde: e.target.value || null })}
                className="campo"
              />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Hasta</span>
              <input
                type="date"
                value={editando.hasta ?? ""}
                onChange={(e) => setEditando({ ...editando, hasta: e.target.value || null })}
                className="campo"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editando.destacado} onChange={(e) => setEditando({ ...editando, destacado: e.target.checked })} />
              Destacado (sale primero)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editando.activo} onChange={(e) => setEditando({ ...editando, activo: e.target.checked })} />
              Visible
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button className="boton" disabled={ocupado || subiendo}>
                {ocupado ? "Guardando…" : "Guardar premio"}
              </button>
              <button type="button" className="boton-secundario" onClick={() => setEditando(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {premios.map((r) => (
          <li key={r.id} className={`tarjeta overflow-hidden ${r.activo ? "" : "opacity-60"}`}>
            <div className="aspect-[4/3] bg-fondo">
              {r.imagen_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imagen_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl">🎁</div>
              )}
            </div>
            <div className="space-y-1 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">
                  {r.destacado && "⭐ "}
                  {r.titulo}
                </p>
                <p className="shrink-0 rounded-full bg-marca/10 px-2 py-0.5 text-xs font-bold text-marca">
                  {r.puntos.toLocaleString("es-CL")} {u}
                </p>
              </div>
              <p className="text-xs text-suave">
                {[
                  r.categoria,
                  r.stock === null ? "Sin límite" : r.stock === 0 ? "Agotado" : `Quedan ${r.stock}`,
                  r.hasta && `hasta el ${formatoFecha(`${r.hasta}T12:00:00`, { day: "numeric", month: "short" })}`,
                  r.costo !== null && `te cuesta ${formatoPrecio(Number(r.costo), negocio.moneda)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="flex gap-3 pt-1 text-sm">
                <button className="text-marca hover:underline" onClick={() => setEditando({ ...r })}>
                  Editar
                </button>
                <button
                  className="text-suave hover:text-red-700"
                  onClick={() => confirm(`¿Borrar “${r.titulo}”?`) && correr(() => supabase.from("premios").delete().eq("id", r.id), "Premio borrado")}
                >
                  Borrar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!premios.length && !editando && (
        <p className="tarjeta p-6 text-center text-sm text-suave">
          Todavía no hay premios. Agrega el primero: una bebida, un producto, una experiencia o un descuento.
        </p>
      )}
    </div>
  );
}

// ── Cupones ─────────────────────────
function Cupones({ negocio, cupones }: { negocio: Negocio; cupones: Cupon[] }) {
  const { supabase, ocupado, correr } = useGuardar();
  const [nuevo, setNuevo] = useState({ titulo: "", detalle: "", dias: 30 as number | null, costo: null as number | null });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const ok = await correr(() => supabase.from("cupones").insert({ ...nuevo, negocio_id: negocio.id }), "Cupón creado");
    if (ok) setNuevo({ titulo: "", detalle: "", dias: 30, costo: null });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">
        Un cupón se regala a un cliente desde su ficha, a un grupo con una campaña o en su cumpleaños. El equipo lo marca como
        usado al entregarlo.
      </p>
      <form onSubmit={crear} className="tarjeta grid gap-3 p-5 sm:grid-cols-[2fr_2fr_1fr_1fr_auto] sm:items-end">
        <label className="block text-sm">
          <span className="etiqueta-campo">Cupón</span>
          <input required maxLength={60} value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} placeholder="20% en tu próxima compra" className="campo" />
        </label>
        <label className="block text-sm">
          <span className="etiqueta-campo">Detalle</span>
          <input maxLength={200} value={nuevo.detalle} onChange={(e) => setNuevo({ ...nuevo, detalle: e.target.value })} placeholder="No acumulable" className="campo" />
        </label>
        <label className="block text-sm">
          <span className="etiqueta-campo">Dura</span>
          <select value={nuevo.dias ?? ""} onChange={(e) => setNuevo({ ...nuevo, dias: e.target.value ? Number(e.target.value) : null })} className="campo">
            {[7, 15, 30, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
            <option value="">No vence</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="etiqueta-campo">Te cuesta</span>
          <input
            type="number"
            min={0}
            value={nuevo.costo ?? ""}
            onChange={(e) => setNuevo({ ...nuevo, costo: e.target.value === "" ? null : Number(e.target.value) })}
            className="campo"
          />
        </label>
        <button className="boton" disabled={ocupado}>
          Crear
        </button>
      </form>
      <ul className="space-y-2">
        {cupones.map((c) => (
          <li key={c.id} className="tarjeta flex items-center gap-3 p-4">
            <span className="text-2xl" aria-hidden>
              🎟️
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.titulo}</p>
              <p className="text-xs text-suave">
                {[c.detalle, c.dias ? `dura ${c.dias} días` : "no vence", c.costo !== null && `te cuesta ${formatoPrecio(Number(c.costo), negocio.moneda)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Interruptor
              activo={c.activo}
              etiqueta="Cupón activo"
              onChange={(v) => correr(() => supabase.from("cupones").update({ activo: v }).eq("id", c.id), v ? "Cupón activo" : "Cupón pausado")}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Promociones ─────────────────────────
function Promociones({ negocio, promociones }: { negocio: Negocio; promociones: PromocionFila[] }) {
  const { supabase, ocupado, correr } = useGuardar();
  const [nueva, setNueva] = useState({ titulo: "Doble puntos este fin de semana", multiplicador: 2, desde: hoy(), hasta: hoy() });

  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">
        En esas fechas cada visita suma el doble (o el triple). Sale como aviso en la tarjeta de tus clientes.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => supabase.from("promociones").insert({ ...nueva, negocio_id: negocio.id }), "Promoción creada");
        }}
        className="tarjeta grid gap-3 p-5 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end"
      >
        <label className="block text-sm">
          <span className="etiqueta-campo">Promoción</span>
          <input required maxLength={60} value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} className="campo" />
        </label>
        <label className="block text-sm">
          <span className="etiqueta-campo">Multiplica</span>
          <select value={nueva.multiplicador} onChange={(e) => setNueva({ ...nueva, multiplicador: Number(e.target.value) })} className="campo">
            {[2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                ×{n}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="etiqueta-campo">Desde</span>
          <input type="date" required value={nueva.desde} onChange={(e) => setNueva({ ...nueva, desde: e.target.value })} className="campo" />
        </label>
        <label className="block text-sm">
          <span className="etiqueta-campo">Hasta</span>
          <input type="date" required min={nueva.desde} value={nueva.hasta} onChange={(e) => setNueva({ ...nueva, hasta: e.target.value })} className="campo" />
        </label>
        <button className="boton" disabled={ocupado}>
          Crear
        </button>
      </form>
      <ul className="space-y-2">
        {promociones.map((x) => {
          const vigente = x.activo && x.desde <= hoy() && x.hasta >= hoy();
          return (
            <li key={x.id} className="tarjeta flex items-center gap-3 p-4">
              <span className="rounded-xl bg-marca px-2.5 py-1 text-sm font-extrabold text-white">×{x.multiplicador}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{x.titulo}</p>
                <p className="text-xs text-suave">
                  {formatoFecha(`${x.desde}T12:00:00`, { day: "numeric", month: "short" })} al{" "}
                  {formatoFecha(`${x.hasta}T12:00:00`, { day: "numeric", month: "short" })}
                  {vigente ? " · activa hoy" : x.hasta < hoy() ? " · terminó" : ""}
                </p>
              </div>
              <button
                className="text-sm text-suave hover:text-red-700"
                onClick={() => correr(() => supabase.from("promociones").delete().eq("id", x.id), "Promoción borrada")}
              >
                Borrar
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Retos ─────────────────────────
const INSIGNIAS = ["🏅", "🔥", "⚡", "🏆", "💎", "👑", "🚀", "🌟", "🎯", "💪"];

function Retos({ negocio, programa, retos }: { negocio: Negocio; programa: ProgramaSellos; retos: Reto[] }) {
  const { supabase, ocupado, correr } = useGuardar();
  const [nuevo, setNuevo] = useState({ titulo: "Racha de 3", insignia: "🔥", visitas: 3, dias: 30, regalo: 1 });
  const regalo = (n: number) =>
    n === 0 ? "solo la insignia" : programa.tipo === "puntos" ? `${n * programa.puntos_regalo} ${programa.nombre_puntos}` : `${n} sello${n > 1 ? "s" : ""}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-suave">Ej: “ven 3 veces en 30 días y gana 1 sello”. El cliente ve su avance y gana la insignia.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          correr(() => supabase.from("retos").insert({ ...nuevo, negocio_id: negocio.id }), "Reto creado");
        }}
        className="tarjeta space-y-3 p-5"
      >
        <div className="flex flex-wrap gap-1.5">
          {INSIGNIAS.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={nuevo.insignia === i}
              onClick={() => setNuevo({ ...nuevo, insignia: i })}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${nuevo.insignia === i ? "border-marca ring-2 ring-marca/30" : "border-borde"}`}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
          <label className="block text-sm">
            <span className="etiqueta-campo">Reto</span>
            <input required maxLength={60} value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} className="campo" />
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Visitas</span>
            <input
              type="number"
              min={2}
              max={100}
              value={nuevo.visitas}
              onChange={(e) => setNuevo({ ...nuevo, visitas: Math.min(100, Math.max(2, Math.round(Number(e.target.value) || 2))) })}
              className="campo"
            />
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">En días</span>
            <input
              type="number"
              min={1}
              max={365}
              value={nuevo.dias}
              onChange={(e) => setNuevo({ ...nuevo, dias: Math.min(365, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
              className="campo"
            />
          </label>
          <label className="block text-sm">
            <span className="etiqueta-campo">Regalo</span>
            <select value={nuevo.regalo} onChange={(e) => setNuevo({ ...nuevo, regalo: Number(e.target.value) })} className="campo">
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {regalo(n)}
                </option>
              ))}
            </select>
          </label>
          <button className="boton" disabled={ocupado}>
            Crear
          </button>
        </div>
      </form>
      <ul className="grid gap-2 sm:grid-cols-2">
        {retos.map((r) => (
          <li key={r.id} className="tarjeta flex items-center gap-3 p-4">
            <span className="text-3xl" aria-hidden>
              {r.insignia}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{r.titulo}</p>
              <p className="text-xs text-suave">
                {r.visitas} visitas en {r.dias} días · {regalo(r.regalo)}
              </p>
            </div>
            <Interruptor
              activo={r.activo}
              etiqueta="Reto activo"
              onChange={(v) => correr(() => supabase.from("retos").update({ activo: v }).eq("id", r.id), v ? "Reto activo" : "Reto pausado")}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

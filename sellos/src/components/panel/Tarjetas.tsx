"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { useAutorizar } from "@/components/Autorizar";
import { TarjetaVisual } from "@/components/TarjetaVisual";
import { Inclinable } from "@/components/Inclinable";
import { Escaner } from "./Escaner";
import { avisarTarjeta } from "@/lib/cliente";
import {
  COLUMNAS_TARJETA,
  codigoDeEscaneo,
  rutaTarjeta,
  textoRegla,
  vigente,
  hitosDe,
  unidad,
  type Cupon,
  type FilaTarjeta,
  type Negocio,
  type Nivel,
  type Premio,
  type ProgramaSellos,
} from "@/lib/tipos";

// Lo que la ficha necesita además de la tarjeta: local en que se trabaja, catálogo y cupones para regalar.
export type ExtrasFicha = { sucursal: string | null; gestor: boolean; catalogo: Premio[]; cupones: Cupon[] };

const mayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const nivelDe = (p: ProgramaSellos, visitas: number): Nivel | null =>
  [...(p.niveles ?? [])].sort((a, b) => b.visitas - a.visitas).find((n) => visitas >= n.visitas) ?? null;
import { formatoFecha, formatoPrecio, mensajeError, numeroWhatsapp, urlSitio } from "@/lib/utils";

type Filtro = "todas" | "premio" | "cerca" | "nuevas" | "dormidas";

// Clientes con tarjeta: buscar, escanear, sumar sellos y canjear premios.
export function Tarjetas({
  negocio,
  programa,
  dueno,
  pidePin,
  iniciales,
  extras,
}: {
  negocio: Negocio;
  programa: ProgramaSellos;
  dueno: boolean;
  pidePin: boolean;
  iniciales: FilaTarjeta[];
  extras: ExtrasFicha;
}) {
  const puntos = programa.tipo === "puntos";
  const minimoCatalogo = Math.min(...extras.catalogo.filter((r) => r.activo).map((r) => r.puntos), Infinity);
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [lista, setLista] = useState(iniciales);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [elegida, setElegida] = useState<FilaTarjeta | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [ahora] = useState(() => Date.now());
  const formato = (n: number) => formatoPrecio(n, negocio.moneda);

  async function recargar() {
    const { data } = await supabase
      .from("tarjetas")
      .select(COLUMNAS_TARJETA)
      .eq("negocio_id", negocio.id)
      .order("ultima_at", { ascending: false, nullsFirst: false })
      .limit(5000);
    if (data) setLista(data as FilaTarjeta[]);
  }

  const visibles = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const digitos = texto.replace(/\D/g, "");
    return lista.filter((t) => {
      if (
        texto &&
        !t.nombre.toLowerCase().includes(texto) &&
        !t.codigo.toLowerCase().includes(texto) &&
        !(digitos.length >= 3 && t.telefono?.replace(/\D/g, "").includes(digitos))
      )
        return false;
      if (filtro === "premio") return puntos ? t.puntos >= minimoCatalogo : t.premios > 0;
      if (filtro === "cerca") return puntos ? t.puntos >= minimoCatalogo * 0.8 : programa.meta - t.sellos <= 2;
      if (filtro === "nuevas") return ahora - Date.parse(t.created_at) < 30 * 86400000;
      if (filtro === "dormidas") return ahora - Date.parse(t.ultima_at ?? t.created_at) > 45 * 86400000;
      return true;
    });
  }, [lista, q, filtro, programa.meta, ahora, puntos, minimoCatalogo]);

  const resumen = useMemo(
    () => ({
      tarjetas: lista.length,
      sellos: lista.reduce((n, t) => n + (puntos ? t.total_puntos : t.total_sellos), 0),
      listos: lista.reduce((n, t) => n + t.premios, 0),
      canjes: lista.reduce((n, t) => n + t.canjes, 0),
    }),
    [lista, puntos],
  );

  useEffect(() => {
    if (elegida) setElegida((e) => (e ? (lista.find((t) => t.id === e.id) ?? null) : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lista]);

  function alEscanear(texto: string) {
    setEscaneando(false);
    const codigo = codigoDeEscaneo(texto);
    const t = lista.find((x) => x.codigo === codigo);
    if (t) setElegida(t);
    else avisar("Esa tarjeta no es de este negocio o no existe.", "error");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto min-w-0">
          <h1 className="text-xl font-semibold">Clientes con tarjeta</h1>
          <p className="text-sm text-suave">
            {puntos ? `Tarjeta de ${programa.nombre_puntos}` : `${programa.meta} sellos = ${programa.premio}`} · {textoRegla(programa, formato)}
            {!programa.activo && " · tarjeta pausada"}
          </p>
        </div>
        <button type="button" className="boton" onClick={() => setEscaneando(true)}>
          <Icono nombre="qr" className="h-4 w-4" /> Escanear tarjeta
        </button>
        <button type="button" className="boton-secundario" onClick={() => setNuevo(true)} disabled={!vigente(negocio)}>
          + Cliente nuevo
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Clientes" valor={resumen.tarjetas} />
        <Dato titulo={puntos ? `${mayus(programa.nombre_puntos)} dados` : "Sellos dados"} valor={resumen.sellos} />
        <Dato titulo="Premios por canjear" valor={resumen.listos} acento={resumen.listos > 0} />
        <Dato titulo="Premios canjeados" valor={resumen.canjes} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, teléfono o código…"
          aria-label="Buscar cliente"
          className="campo w-full max-w-xs py-2 text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["todas", "Todas"],
              ["premio", "Con premio listo"],
              ["cerca", puntos ? "Cerca de un premio" : "A 2 sellos o menos"],
              ["nuevas", "Nuevas (30 días)"],
              ["dormidas", "Sin venir hace 45 días"],
            ] as [Filtro, string][]
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filtro === id}
              onClick={() => setFiltro(id)}
              className={`rounded-full px-3 py-1.5 text-sm ${filtro === id ? "bg-tinta text-white" : "bg-stone-100 text-suave hover:text-tinta"}`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="tarjeta flex flex-col items-center gap-2 p-10 text-center text-sm text-suave">
          <Icono nombre="sellos" className="h-10 w-10 text-stone-300" />
          <p className="max-w-md">
            {lista.length === 0
              ? dueno
                ? "Todavía nadie tiene tu tarjeta. Imprime el QR para unirse (menú “QR para unirse”) y déjalo en la caja o el mesón."
                : "Todavía nadie tiene la tarjeta de este negocio."
              : "Nadie coincide con la búsqueda."}
          </p>
        </div>
      ) : (
        <ul className="tarjeta divide-y divide-borde">
          {visibles.slice(0, 300).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setElegida(t)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-stone-50"
              >
                <span className="min-w-0 flex-1 basis-40">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{t.nombre}</span>
                    {t.premios > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 text-xs font-semibold text-emerald-800">
                        <Icono nombre="regalo" className="h-3 w-3" /> {t.premios === 1 ? "Premio listo" : `${t.premios} premios`}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-suave">{t.telefono || t.codigo}</span>
                </span>
                <span className="w-40 shrink-0">
                  <span className="text-xs text-suave">
                    {puntos ? `${t.puntos.toLocaleString("es-CL")} ${programa.nombre_puntos}` : `${t.sellos}/${programa.meta} sellos`}
                    {nivelDe(programa, t.visitas) && ` · ${nivelDe(programa, t.visitas)?.nombre}`}
                  </span>
                  <span className="mt-1 block h-2 overflow-hidden rounded-full bg-stone-100">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.min(100, puntos ? (t.puntos / (Number.isFinite(minimoCatalogo) ? minimoCatalogo : Math.max(1, t.puntos))) * 100 : (t.sellos / programa.meta) * 100)}%`,
                        background: programa.color,
                      }}
                    />
                  </span>
                </span>
                <span className="w-24 shrink-0 text-right text-sm text-suave">
                  {t.ultima_at ? formatoFecha(t.ultima_at, { day: "numeric", month: "short" }, negocio.zona_horaria) : "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {visibles.length > 300 && <p className="text-center text-xs text-suave">Se muestran 300. Usa la búsqueda.</p>}

      {escaneando && <Escaner onLeido={alEscanear} onCerrar={() => setEscaneando(false)} />}
      {nuevo && (
        <ClienteNuevo
          negocio={negocio}
          onCerrar={() => setNuevo(false)}
          onCreado={async (codigo) => {
            setNuevo(false);
            const { data } = await supabase.from("tarjetas").select(COLUMNAS_TARJETA).eq("codigo", codigo).maybeSingle();
            await recargar();
            if (data) setElegida(data as FilaTarjeta);
          }}
        />
      )}
      {elegida && (
        <FichaTarjeta
          negocio={negocio}
          dueno={dueno}
          pidePin={pidePin}
          programa={programa}
          extras={extras}
          tarjeta={elegida}
          onCambio={recargar}
          onCerrar={() => setElegida(null)}
        />
      )}
    </div>
  );
}

function Dato({ titulo, valor, acento }: { titulo: string; valor: number; acento?: boolean }) {
  return (
    <div className={`tarjeta p-4 ${acento ? "ring-2 ring-emerald-400" : ""}`}>
      <p className="text-xs text-suave">{titulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor.toLocaleString("es-CL")}</p>
    </div>
  );
}

// ── Alta en el mesón: el equipo anota nombre y teléfono y le manda la tarjeta por WhatsApp ──
function ClienteNuevo({
  negocio,
  onCerrar,
  onCreado,
}: {
  negocio: Negocio;
  onCerrar: () => void;
  onCreado: (codigo: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError("");
    const { data, error } = await createClient().rpc("unirse", {
      p_slug: negocio.slug,
      p_nombre: nombre,
      p_telefono: telefono,
      p_email: null,
      p_cumpleanos: null,
      p_acepta: false,
    });
    setEnviando(false);
    if (error || !data) return setError(error ? mensajeError(error) : "No se pudo crear la tarjeta.");
    onCreado(String(data));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCerrar}>
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Cliente nuevo"
        onClick={(e) => e.stopPropagation()}
        onSubmit={crear}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-superficie p-5 shadow-2xl"
      >
        <div>
          <h2 className="text-lg font-semibold">Cliente nuevo</h2>
          <p className="text-sm text-suave">
            Para quien no quiere escanear. Si ese teléfono ya tiene tarjeta, se abre la que tiene.
          </p>
        </div>
        <label className="block text-sm">
          <span className="etiqueta-campo">Nombre</span>
          <input required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" autoFocus />
        </label>
        <label className="block text-sm">
          <span className="etiqueta-campo">Teléfono</span>
          <input
            required
            type="tel"
            maxLength={30}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+56 9 1234 5678"
            className="campo"
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="boton-secundario flex-1" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="boton flex-1" disabled={enviando}>
            {enviando ? "Creando…" : "Crear tarjeta"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Ficha de una tarjeta: sumar, canjear, enviar por WhatsApp ──
function FichaTarjeta({
  negocio,
  dueno,
  pidePin,
  programa,
  extras,
  tarjeta: t,
  onCambio,
  onCerrar,
}: {
  negocio: Negocio;
  dueno: boolean;
  pidePin: boolean;
  programa: ProgramaSellos;
  extras: ExtrasFicha;
  tarjeta: FilaTarjeta;
  onCambio: () => Promise<void>;
  onCerrar: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const avisar = useToast();
  const { pedir: autorizar, dialogo } = useAutorizar();
  const [trabajando, setTrabajando] = useState(false);
  const [monto, setMonto] = useState("");
  const [cantidad, setCantidad] = useState(2);
  const [movimientos, setMovimientos] = useState<{ tipo: string; cantidad: number; origen: string; created_at: string }[]>([]);
  const puntos = programa.tipo === "puntos";
  const porMonto = puntos || programa.regla === "monto";
  const u = unidad(programa);
  const local = extras.sucursal;
  const nivel = nivelDe(programa, t.visitas);
  const [cuponesTarjeta, setCuponesTarjeta] = useState<{ id: string; titulo: string; detalle: string; vence_at: string | null; usado_at: string | null }[]>([]);
  const [darCupon, setDarCupon] = useState("");
  const formato = (n: number) => formatoPrecio(n, negocio.moneda);

  useEffect(() => {
    supabase
      .from("movimientos")
      .select("tipo, cantidad, origen, created_at")
      .eq("tarjeta_id", t.id)
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => setMovimientos(data ?? []));
    supabase
      .from("tarjeta_cupones")
      .select("id, titulo, detalle, vence_at, usado_at")
      .eq("tarjeta_id", t.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setCuponesTarjeta(data ?? []));
  }, [supabase, t.id, t.sellos, t.premios, t.puntos]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  async function sellar() {
    const valor = porMonto ? Number(monto.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
    if (porMonto && !(valor && valor > 0)) return avisar("Anota el monto de la compra", "error");
    setTrabajando(true);
    const { data, error } = await supabase.rpc("sellar", { p_tarjeta: t.codigo, p_monto: valor, p_sucursal: local });
    setTrabajando(false);
    if (error) return avisar(mensajeError(error), "error");
    const r = (data ?? {}) as { sumados?: number; doble?: boolean; referido?: boolean; retos?: string[] | null; promocion?: { titulo: string } | null };
    const n = r.sumados ?? 1;
    const extra = [
      r.doble && "día doble",
      r.promocion && r.promocion.titulo,
      r.referido && "¡y su amigo también ganó!",
      r.retos?.length && `logró el reto ${r.retos.join(", ")}`,
    ]
      .filter(Boolean)
      .join(" · ");
    avisar(`${n === 1 ? `1 ${unidad(programa, 1)} sumado` : `${n} ${u} sumados`}${extra ? ` (${extra})` : ""}`);
    avisarTarjeta(t.codigo);
    setMonto("");
    await onCambio();
  }

  async function ajustar(n: number) {
    const ok = await autorizar({
      titulo: n > 0 ? `¿Sumar ${n} ${u} a ${t.nombre}?` : `¿Quitar ${-n} ${u}?`,
      pin: pidePin,
      motivo: "opcional",
      ejemplos: n > 0 ? ["Sellos de su tarjeta de papel", "Compensación"] : ["Sello por error", "Se equivocó de tarjeta"],
    });
    if (!ok) return;
    setTrabajando(true);
    const { error } = await supabase.rpc("ajustar", {
      p_tarjeta: t.codigo,
      p_cantidad: n,
      p_pin: ok.pin,
      p_motivo: ok.motivo || null,
      p_sucursal: local,
    });
    setTrabajando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar(n > 0 ? `${n} ${u} sumados` : `${u} quitados`);
    if (n > 0) avisarTarjeta(t.codigo);
    await onCambio();
  }

  async function canjear() {
    const ok = await autorizar({ titulo: `¿Canjear ${programa.premio}?`, detalle: `Para ${t.nombre}.`, pin: pidePin, motivo: "no" });
    if (!ok) return;
    setTrabajando(true);
    const { error } = await supabase.rpc("canjear", { p_tarjeta: t.codigo, p_pin: ok.pin, p_sucursal: local });
    setTrabajando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar(`Premio canjeado: ${programa.premio}`);
    avisarTarjeta(t.codigo);
    await onCambio();
  }

  // Canjes que piden PIN si el dueño lo activó.
  async function canjearCon(titulo: string, rpc: string, args: Record<string, unknown>) {
    const ok = await autorizar({ titulo, detalle: `Para ${t.nombre}.`, pin: pidePin, motivo: "no" });
    if (!ok) return;
    setTrabajando(true);
    const { error } = await supabase.rpc(rpc, { ...args, p_pin: ok.pin, p_sucursal: local });
    setTrabajando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Listo, entregado");
    avisarTarjeta(t.codigo);
    await onCambio();
    const { data } = await supabase.from("tarjeta_cupones").select("id, titulo, detalle, vence_at, usado_at").eq("tarjeta_id", t.id).order("created_at", { ascending: false }).limit(20);
    setCuponesTarjeta(data ?? []);
  }

  async function regalarCupon() {
    if (!darCupon) return;
    const { error } = await supabase.rpc("dar_cupon", { p_cupon: darCupon, p_tarjeta: t.codigo });
    if (error) return avisar(mensajeError(error), "error");
    avisar("Cupón regalado");
    setDarCupon("");
    const { data } = await supabase.from("tarjeta_cupones").select("id, titulo, detalle, vence_at, usado_at").eq("tarjeta_id", t.id).order("created_at", { ascending: false }).limit(20);
    setCuponesTarjeta(data ?? []);
  }

  const hitosListos = puntos ? [] : hitosDe(programa).filter((h) => t.sellos >= h.sellos && !t.hitos_canjeados.includes(h.sellos));
  const canjeables = puntos ? extras.catalogo.filter((r) => r.activo && (r.stock === null || r.stock > 0)) : [];
  const cuponesVigentes = cuponesTarjeta.filter((c) => !c.usado_at && (!c.vence_at || Date.parse(c.vence_at) > Date.now()));

  async function borrar() {
    if (!confirm(`¿Borrar la tarjeta de ${t.nombre}? Pierde sus sellos y premios. No se puede deshacer.`)) return;
    const { error } = await supabase.from("tarjetas").delete().eq("id", t.id);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Tarjeta borrada");
    onCerrar();
    await onCambio();
    router.refresh();
  }

  const enlace = `${urlSitio()}${rutaTarjeta(t.codigo)}`;
  const primer = t.nombre.split(" ")[0];
  const wa =
    t.telefono &&
    `https://wa.me/${numeroWhatsapp(t.telefono, negocio.pais)}?text=${encodeURIComponent(
      t.premios > 0
        ? `Hola ${primer}, ¡tienes ${programa.premio} esperándote en ${negocio.nombre}! Tu tarjeta: ${enlace}`
        : `Hola ${primer}, esta es tu tarjeta de ${puntos ? programa.nombre_puntos : "sellos"} de ${negocio.nombre}. Guárdala en tu celular: ${enlace}`,
    )}`;

  const TEXTO: Record<string, string> = {
    qr: "Sello con QR",
    equipo: "Sello del equipo",
    manual: "Sellos sumados a mano",
    bienvenida: "Sello de bienvenida",
    cumpleanos: "Regalo de cumpleaños",
    regreso: "Regalo “te extrañamos”",
    migracion: "Sellos anteriores",
    referido: "Regalo por traer a un amigo",
    api: "Desde la caja",
    premio: "Premio del catálogo",
    cupon: "Cupón",
    reto: "Reto logrado",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.nombre}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-superficie shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-borde px-5 py-4">
          <p className="min-w-0 flex-1 truncate text-xl font-bold">{t.nombre}</p>
          <button type="button" onClick={onCerrar} className="rounded-lg p-2 text-suave hover:bg-stone-100" aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="flex justify-center">
            <Inclinable>
              <TarjetaVisual
                local={negocio.nombre}
                logo={negocio.logo_url}
                programa={programa}
                sellos={t.sellos}
                premios={t.premios}
                puntos={t.puntos}
                proximo={canjeables.filter((r) => r.puntos > t.puntos).sort((a, b) => a.puntos - b.puntos)[0] ?? canjeables.at(-1) ?? null}
                nivel={nivel?.nombre}
                nombre={t.nombre}
              />
            </Inclinable>
          </div>

          {nivel?.beneficio && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Nivel <b>{nivel.nombre}</b>: {nivel.beneficio}
            </p>
          )}

          {hitosListos.map((h) => (
            <button
              key={h.sellos}
              type="button"
              className="boton w-full bg-emerald-600 py-2.5 hover:bg-emerald-700"
              disabled={trabajando}
              onClick={() => canjearCon(`¿Entregar ${h.premio}?`, "canjear_hito", { p_tarjeta: t.codigo, p_sellos: h.sellos })}
            >
              🎀 Entregar {h.premio} ({h.sellos} sellos)
            </button>
          ))}

          {cuponesVigentes.map((c) => (
            <button
              key={c.id}
              type="button"
              className="boton w-full bg-violet-600 py-2.5 hover:bg-violet-700"
              disabled={trabajando}
              onClick={() => canjearCon(`¿Usar el cupón ${c.titulo}?`, "canjear_cupon", { p_id: c.id })}
            >
              🎟️ Usar cupón: {c.titulo}
            </button>
          ))}

          {puntos && canjeables.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Canjear del catálogo</p>
              <ul className="grid grid-cols-2 gap-2">
                {canjeables.map((r) => {
                  const alcanza = t.puntos >= r.puntos;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        disabled={!alcanza || trabajando}
                        onClick={() => canjearCon(`¿Canjear ${r.titulo} por ${r.puntos} ${u}?`, "canjear_puntos", { p_tarjeta: t.codigo, p_premio: r.id })}
                        className="flex w-full items-center gap-2 rounded-xl border border-borde p-2 text-left text-sm hover:border-marca disabled:opacity-45"
                      >
                        {r.imagen_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.imagen_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <span className="text-2xl">🎁</span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.titulo}</span>
                          <span className="text-xs text-suave">
                            {r.puntos.toLocaleString("es-CL")} {u}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {t.premios > 0 && (
            <button
              type="button"
              className="boton w-full bg-emerald-600 py-3 hover:bg-emerald-700"
              disabled={trabajando}
              onClick={canjear}
            >
              <Icono nombre="regalo" className="h-5 w-5" /> Canjear {programa.premio}
            </button>
          )}

          <div className="space-y-2">
            {porMonto && (
              <label className="block text-sm">
                <span className="etiqueta-campo">Monto de la compra{local ? "" : ""}</span>
                <input
                  inputMode="decimal"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder={formato(puntos ? programa.puntos_cada * 100 : programa.monto_por_sello * 2)}
                  className="campo"
                />
                <span className="mt-1 block text-xs text-suave">{textoRegla(programa, formato)}.</span>
              </label>
            )}
            <button type="button" className="boton w-full py-3 text-base" disabled={trabajando} onClick={sellar}>
              + Sumar {puntos ? programa.nombre_puntos : "sello"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 font-semibold text-white"
              >
                <Icono nombre="whatsapp" className="h-4 w-4" /> Enviar su tarjeta
              </a>
            )}
            <a href={rutaTarjeta(t.codigo)} target="_blank" className="boton-secundario py-1.5">
              <Icono nombre="externo" className="h-4 w-4" /> Abrir tarjeta
            </a>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-suave">Teléfono</dt>
              <dd>{t.telefono || "—"}</dd>
            </div>
            <div>
              <dt className="text-suave">Código</dt>
              <dd className="font-mono">{t.codigo}</dd>
            </div>
            <div>
              <dt className="text-suave">{puntos ? `${mayus(programa.nombre_puntos)} en total` : "Sellos en total"}</dt>
              <dd>{puntos ? t.total_puntos.toLocaleString("es-CL") : t.total_sellos}</dd>
            </div>
            <div>
              <dt className="text-suave">Visitas</dt>
              <dd>
                {t.visitas}
                {nivel && ` · ${nivel.nombre}`}
              </dd>
            </div>
            <div>
              <dt className="text-suave">Premios canjeados</dt>
              <dd>{t.canjes}</dd>
            </div>
            <div>
              <dt className="text-suave">Cumpleaños</dt>
              <dd>{t.cumpleanos ? formatoFecha(`${t.cumpleanos}T12:00:00`, { day: "numeric", month: "long" }) : "—"}</dd>
            </div>
            <div>
              <dt className="text-suave">Avisos y promociones</dt>
              <dd>{t.acepta_avisos ? "Sí acepta" : "No"}</dd>
            </div>
          </dl>

          {movimientos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Movimientos</p>
              <ul className="divide-y divide-borde rounded-xl border border-borde text-sm">
                {movimientos.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span>
                      {m.tipo === "canje" ? "Premio canjeado" : m.cantidad < 0 ? `${u} quitados` : (TEXTO[m.origen] ?? "Ajuste")}
                      <span className="block text-xs text-suave">
                        {formatoFecha(
                          m.created_at,
                          { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
                          negocio.zona_horaria,
                        )}
                      </span>
                    </span>
                    {m.tipo !== "canje" && (
                      <span className={`font-semibold tabular-nums ${m.cantidad < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="rounded-xl border border-borde px-3 py-2 text-sm">
            <summary className="cursor-pointer font-medium">Corregir {u}</summary>
            <div className="mt-3 flex flex-wrap items-center gap-2 pb-1">
              <div className="flex items-center rounded-lg border border-borde">
                <button
                  type="button"
                  className="px-3 py-1.5 text-lg text-suave"
                  onClick={() => setCantidad((c) => Math.max(1, c - (puntos ? 10 : 1)))}
                  aria-label="Menos"
                >
                  −
                </button>
                <span className="w-8 text-center font-semibold tabular-nums">{cantidad}</span>
                <button
                  type="button"
                  className="px-3 py-1.5 text-lg text-suave"
                  onClick={() => setCantidad((c) => Math.min(puntos ? 1000000 : 30, c + (puntos ? 10 : 1)))}
                  aria-label="Más"
                >
                  +
                </button>
              </div>
              <button type="button" className="boton-secundario py-1.5" disabled={trabajando} onClick={() => ajustar(cantidad)}>
                Sumar {cantidad}
              </button>
              <button
                type="button"
                className="boton-secundario py-1.5 text-red-700"
                disabled={trabajando || (t.sellos < 1 && t.premios < 1)}
                onClick={() => ajustar(-cantidad)}
              >
                Quitar {cantidad}
              </button>
            </div>
            <p className="pb-1 text-xs text-suave">
              Para pasar los sellos de una tarjeta de papel o corregir un error.{pidePin ? " Pide el PIN del dueño." : ""}
            </p>
          </details>

          {extras.gestor && extras.cupones.length > 0 && (
            <div className="flex gap-2 text-sm">
              <select value={darCupon} onChange={(e) => setDarCupon(e.target.value)} className="campo py-1.5" aria-label="Cupón para regalar">
                <option value="">Regalar un cupón…</option>
                {extras.cupones.filter((c) => c.activo).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
              <button type="button" className="boton-secundario shrink-0 py-1.5" disabled={!darCupon} onClick={regalarCupon}>
                Regalar
              </button>
            </div>
          )}

          {dueno && (
            <div className="border-t border-borde pt-4 text-right text-sm">
              <button type="button" className="text-suave hover:text-red-600" onClick={borrar}>
                Borrar tarjeta
              </button>
            </div>
          )}
        </div>
      </div>
      {dialogo}
    </div>
  );
}

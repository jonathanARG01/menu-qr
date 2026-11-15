"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Interruptor } from "@/components/Interruptor";
import { TarjetaVisual } from "@/components/TarjetaVisual";
import { Inclinable } from "@/components/Inclinable";
import { rubroDe } from "@/lib/rubros";
import {
  DISENOS_SELLO,
  ICONOS_SELLO,
  ORDEN_DIAS,
  PROGRAMA_BASE,
  letraDia,
  textoDias,
  textoRegla,
  type DisenoSello,
  type IconoSello,
  type Negocio,
  type ProgramaSellos,
} from "@/lib/tipos";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { enlaceWhatsapp, type Funcion } from "@/lib/marca";
import { subirImagen } from "@/lib/imagenes";
import type { Cupon, Hito, Nivel } from "@/lib/tipos";

type Puede = Partial<Record<Funcion, boolean>>;

function Bloqueado({ plan }: { plan: string }) {
  return (
    <a href="/panel/plan" className="rounded-full bg-marca/10 px-2 py-0.5 text-xs font-semibold text-marca">
      Plan {plan}
    </a>
  );
}

// ── La tarjeta del negocio ─────────────────────────
export function Configurar({
  negocio,
  programa,
  puede,
  cupones,
}: {
  negocio: Negocio;
  programa: ProgramaSellos;
  puede: Puede;
  cupones: Pick<Cupon, "id" | "titulo">[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const router = useRouter();
  const [p, setP] = useState<ProgramaSellos>(programa);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const puntos = p.tipo === "puntos";
  const cashback = puntos && p.nombre_puntos === "pesos";
  const textoRegalo = (n: number) =>
    n === 0 ? "Ninguno" : puntos ? `${(n * p.puntos_regalo).toLocaleString("es-CL")} ${p.nombre_puntos}` : n === 1 ? "1 sello" : `${n} sellos`;

  async function subirFondo(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    try {
      const url = await subirImagen(supabase, negocio.id, archivo, "fondo", 1400);
      cambiar({ fondo_url: url, diseno: "medida" });
      avisar("Imagen lista. Guarda los cambios para usarla.");
    } catch (e) {
      avisar(mensajeError(e), "error");
    } finally {
      setSubiendo(false);
    }
  }
  const cambiar = (c: Partial<ProgramaSellos>) => setP((x) => ({ ...x, ...c }));
  const formato = (n: number) => formatoPrecio(n, negocio.moneda);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const fila = { ...p, premio: p.premio.trim() || PROGRAMA_BASE.premio, condiciones: p.condiciones.trim() };
    const { error } = await supabase.from("programas").upsert({ negocio_id: negocio.id, ...fila });
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Tarjeta guardada");
    router.refresh();
  }

  const numero = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));

  return (
    <form onSubmit={guardar} className="grid gap-6 lg:grid-cols-[1fr_auto]">
      <div className="space-y-5">
        <section className="tarjeta space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Tarjeta activa</h2>
              <p className="text-sm text-suave">Pausada, nadie nuevo se une ni suma sellos. Lo acumulado se guarda.</p>
            </div>
            <Interruptor activo={p.activo} onChange={(v) => cambiar({ activo: v })} etiqueta="Tarjeta activa" />
          </div>
        </section>

        <section className="tarjeta space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Tipo de tarjeta</h2>
            {!puede.puntos && <Bloqueado plan="Pro" />}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ["sellos", "🎟️ Sellos", "Junta sellos y gana el premio. La más simple."],
                ["puntos", "⭐ Puntos", "Suma puntos por compra y canjéalos en tu catálogo de premios."],
                ["cashback", "💸 Cashback", "Devuelve un % de cada compra en “pesos” para canjear."],
              ] as const
            ).map(([id, titulo, texto]) => {
              const activo = id === "sellos" ? !puntos : id === "cashback" ? cashback : puntos && !cashback;
              const bloqueado = id !== "sellos" && !puede.puntos;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={bloqueado}
                  aria-pressed={activo}
                  onClick={() =>
                    cambiar(
                      id === "sellos"
                        ? { tipo: "sellos" }
                        : id === "cashback"
                          ? { tipo: "puntos", nombre_puntos: "pesos", puntos_cada: 20, puntos_regalo: 500 }
                          : { tipo: "puntos", nombre_puntos: p.nombre_puntos === "pesos" ? "puntos" : p.nombre_puntos },
                    )
                  }
                  className={`rounded-xl border p-3 text-left text-sm disabled:opacity-50 ${
                    activo ? "border-marca ring-2 ring-marca/30" : "border-borde hover:border-marca/50"
                  }`}
                >
                  <span className="block font-semibold">{titulo}</span>
                  <span className="block text-xs text-suave">{texto}</span>
                </button>
              );
            })}
          </div>
          {puntos && (
            <div className="grid gap-4 sm:grid-cols-3">
              {cashback ? (
                <label className="block text-sm">
                  <span className="etiqueta-campo">Cashback</span>
                  <select
                    value={Math.round(100 / p.puntos_cada)}
                    onChange={(e) => cambiar({ puntos_cada: Math.round(10000 / Number(e.target.value)) / 100 })}
                    className="campo"
                  >
                    {[1, 2, 3, 5, 7, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>
                        {n} % de cada compra
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="block text-sm">
                    <span className="etiqueta-campo">1 punto por cada</span>
                    <input
                      type="number"
                      min={1}
                      value={p.puntos_cada}
                      onChange={(e) => cambiar({ puntos_cada: Math.max(1, Number(e.target.value) || 1) })}
                      className="campo"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="etiqueta-campo">Se llaman</span>
                    <input
                      maxLength={20}
                      value={p.nombre_puntos}
                      onChange={(e) => cambiar({ nombre_puntos: e.target.value.toLowerCase() })}
                      placeholder="puntos, granos, estrellas…"
                      className="campo"
                    />
                  </label>
                </>
              )}
              <label className="block text-sm">
                <span className="etiqueta-campo">Valor de cada regalo</span>
                <input
                  type="number"
                  min={1}
                  value={p.puntos_regalo}
                  onChange={(e) => cambiar({ puntos_regalo: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                  className="campo"
                />
              </label>
              <p className="text-xs text-suave sm:col-span-3">
                {textoRegla(p, formato)}. El “valor de cada regalo” es lo que suman la bienvenida, el cumpleaños, el “te extrañamos”,
                los retos y los amigos invitados. Los premios para canjear se arman en{" "}
                <a href="/panel/premios" className="text-marca underline">
                  Premios y cupones
                </a>
                , con foto, stock y fechas.
              </p>
            </div>
          )}
        </section>

        <section className="tarjeta space-y-4 p-5">
          <h2 className="font-semibold">{puntos ? "Reglas" : "Sellos y premio"}</h2>
          {!puntos && (
          <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="etiqueta-campo">Sellos para el premio</span>
              <input
                id="meta"
                type="number"
                min={3}
                max={30}
                value={p.meta}
                onChange={(e) => cambiar({ meta: numero(e.target.value, 3, 30) })}
                className="campo"
              />
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Premio</span>
              <input
                id="premio"
                required
                maxLength={60}
                value={p.premio}
                onChange={(e) => cambiar({ premio: e.target.value })}
                placeholder={rubroDe(negocio.rubro).premio}
                className="campo"
              />
            </label>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="etiqueta-campo">Cómo se gana un sello</legend>
            <label className="flex items-center gap-2">
              <input type="radio" name="regla" checked={p.regla === "visita"} onChange={() => cambiar({ regla: "visita" })} />
              Uno por visita o compra
            </label>
            <label className="flex flex-wrap items-center gap-2">
              <input type="radio" name="regla" checked={p.regla === "monto"} onChange={() => cambiar({ regla: "monto" })} />
              Uno por cada
              <input
                id="monto"
                type="number"
                min={1}
                value={p.monto_por_sello}
                onChange={(e) => cambiar({ monto_por_sello: Math.max(1, Number(e.target.value) || 1), regla: "monto" })}
                className="campo py-1.5"
                style={{ width: "8rem" }}
              />
              de compra (el equipo anota el monto)
            </label>
          </fieldset>
          </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="etiqueta-campo">Regalo al unirse</span>
              <select
                id="bienvenida"
                value={p.bienvenida}
                onChange={(e) => cambiar({ bienvenida: Number(e.target.value) })}
                className="campo"
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {textoRegalo(n)}
                    {n === 1 ? " (recomendado)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Máximo por día con el QR del mesón</span>
              <select
                id="max-dia"
                value={p.max_por_dia}
                onChange={(e) => cambiar({ max_por_dia: Number(e.target.value) })}
                className="campo"
              >
                {[1, 2, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1 vez al día" : `${n} veces al día`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm sm:max-w-xs">
            <span className="etiqueta-campo">Cuánto te cuesta el premio (opcional)</span>
            <input
              type="number"
              min={0}
              value={p.costo_premio ?? ""}
              onChange={(e) => cambiar({ costo_premio: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
              placeholder="Ej: 1500"
              className="campo"
            />
            <span className="mt-1 block text-xs text-suave">Para ver en Métricas cuánto inviertes en premios.</span>
          </label>
          {puntos && (
            <label className="block text-sm">
              <span className="etiqueta-campo">Texto de la tarjeta</span>
              <input
                maxLength={60}
                value={p.premio}
                onChange={(e) => cambiar({ premio: e.target.value })}
                placeholder="Canjea tus puntos por premios"
                className="campo"
              />
            </label>
          )}
          <p className="text-xs text-suave">
            {textoRegla(p, formato)}.{" "}
            {puntos
              ? "El cliente ve sus puntos, el catálogo y cuánto le falta para cada premio."
              : `Con la tarjeta llena el cliente gana ${p.premio || "el premio"} y empieza una nueva.`}
          </p>
        </section>

        {!puntos && (
          <section className="tarjeta space-y-3 p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">Premios en el camino</h2>
                <p className="text-sm text-suave">Un premio chico antes del grande, para que no abandonen la tarjeta. Hasta 5.</p>
              </div>
              {!puede.premios && <Bloqueado plan="Pro" />}
            </div>
            <ListaHitos hitos={p.hitos} meta={p.meta} onChange={(hitos) => cambiar({ hitos })} deshabilitado={!puede.premios} />
          </section>
        )}

        <section className="tarjeta space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">Niveles</h2>
              <p className="text-sm text-suave">
                Bronce, Plata, Oro… según las visitas. Cada nivel puede tener un beneficio y sumar el doble. Hasta 4.
              </p>
            </div>
            {!puede.niveles && <Bloqueado plan="Pro" />}
          </div>
          <ListaNiveles niveles={p.niveles} onChange={(niveles) => cambiar({ niveles })} deshabilitado={!puede.niveles} />
        </section>

        <section className="tarjeta space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold">Trae a un amigo</h2>
              <p className="text-sm text-suave">
                Cada cliente comparte su enlace. Cuando el amigo viene por primera vez, los dos ganan el regalo.
              </p>
            </div>
            {!puede.referidos && <Bloqueado plan="Pro" />}
          </div>
          <select
            value={p.referido_regalo}
            disabled={!puede.referidos}
            onChange={(e) => cambiar({ referido_regalo: Number(e.target.value) })}
            className="campo sm:max-w-xs"
            aria-label="Regalo por traer a un amigo"
          >
            {[0, 1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "Apagado" : `${textoRegalo(n)} para cada uno`}
              </option>
            ))}
          </select>
        </section>

        <section className="tarjeta space-y-5 p-5">
          <div>
            <h2 className="font-semibold">Para que vuelvan</h2>
            <p className="text-sm text-suave">
              Detalles automáticos que hacen volver al cliente. Los avisos llegan solo a quien aceptó recibirlos.
            </p>
          </div>

          <div>
            <p className="etiqueta-campo">Días dobles</p>
            <div className="flex flex-wrap gap-1.5">
              {ORDEN_DIAS.map((d) => {
                const activo = p.dias_dobles.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      cambiar({ dias_dobles: activo ? p.dias_dobles.filter((x) => x !== d) : [...p.dias_dobles, d].sort() })
                    }
                    className={`h-10 w-12 rounded-xl border text-sm font-semibold ${
                      activo ? "border-marca bg-marca text-white" : "border-borde text-suave hover:border-marca/50"
                    }`}
                  >
                    {letraDia(d)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-suave">
              {p.dias_dobles.length
                ? `${textoDias(p.dias_dobles)}: cada visita vale el doble. Úsalo en los días flojos.`
                : "Elige los días más flojos: ese día cada visita vale el doble."}
            </p>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">Invitar a dejar reseña en Google</p>
              <p className="text-suave">
                {negocio.resena_url
                  ? "Después de sumar un sello, la tarjeta invita al cliente a dejar su reseña."
                  : "Primero pega tu enlace de reseñas de Google en Negocio."}
              </p>
            </div>
            <Interruptor
              activo={p.pedir_resena && !!negocio.resena_url}
              onChange={(v) => cambiar({ pedir_resena: v })}
              etiqueta="Invitar a dejar reseña en Google"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="etiqueta-campo">“Te extrañamos” si no vuelve en</span>
              <select
                id="extranamos"
                value={p.extranamos_dias}
                onChange={(e) => cambiar({ extranamos_dias: Number(e.target.value) })}
                className="campo"
              >
                <option value={0}>No enviar</option>
                {[21, 30, 45, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} días
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Regalo con el “te extrañamos”</span>
              <select
                id="extranamos-sellos"
                value={p.extranamos_sellos}
                disabled={p.extranamos_dias === 0}
                onChange={(e) => cambiar({ extranamos_sellos: Number(e.target.value) })}
                className="campo"
              >
                {[0, 1, 2].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Solo el aviso" : `${textoRegalo(n)} de regalo`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Regalo de cumpleaños</span>
              <select
                id="cumple"
                value={p.cumple_sellos}
                onChange={(e) => cambiar({ cumple_sellos: Number(e.target.value) })}
                className="campo"
              >
                {[0, 1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "Solo el saludo" : `${textoRegalo(n)} de regalo`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="etiqueta-campo">Cupón de cumpleaños {!puede.cupones && <Bloqueado plan="Pro" />}</span>
              <select
                value={p.cumple_cupon ?? ""}
                disabled={!puede.cupones || !cupones.length}
                onChange={(e) => cambiar({ cumple_cupon: e.target.value || null })}
                className="campo"
              >
                <option value="">{cupones.length ? "Sin cupón" : "Primero crea un cupón en Premios"}</option>
                {cupones.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-suave">
            El “te extrañamos” se manda una vez por ausencia, y el saludo de cumpleaños el mismo día (a quien dio su fecha al
            unirse). Llegan como aviso al celular y en Google Wallet. El aviso de “te falta 1 sello” sale solo después de cada
            sello.
          </p>
        </section>

        <section className="tarjeta space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Diseño</h2>
            <p className="text-sm text-suave">
              Elige el estilo. Todos usan tu logo, tu color y tu dibujo, y todos vienen en todos los planes.
            </p>
          </div>
          <div className="rounded-2xl border border-marca/30 bg-marca/5 p-4 text-sm">
            <p className="font-semibold">Diseño a medida de tu negocio</p>
            <p className="mt-1 text-suave">
              Sube una foto de tu local o tu arte, o pídenos que la diseñemos por ti (incluido en tu plan, sin costo extra).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="boton-secundario cursor-pointer py-1.5">
                {subiendo ? "Subiendo…" : p.fondo_url ? "Cambiar imagen" : "Subir imagen de fondo"}
                <input type="file" accept="image/*" className="sr-only" disabled={subiendo} onChange={(e) => subirFondo(e.target.files?.[0])} />
              </label>
              <a
                href={enlaceWhatsapp(`Hola, quiero que me diseñen la tarjeta a medida para ${negocio.nombre} (${negocio.slug}).`)}
                target="_blank"
                rel="noopener noreferrer"
                className="boton py-1.5"
              >
                Pide tu diseño a medida
              </a>
              {p.fondo_url && (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={p.texto_claro} onChange={(e) => cambiar({ texto_claro: e.target.checked })} />
                    Letras blancas
                  </label>
                  <button type="button" className="text-sm text-suave hover:text-tinta" onClick={() => cambiar({ fondo_url: null, diseno: p.diseno === "medida" ? "clasica" : p.diseno })}>
                    Quitar imagen
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(DISENOS_SELLO) as DisenoSello[]).filter((dis) => dis !== "medida" || p.fondo_url).map((dis) => (
              <button
                key={dis}
                type="button"
                onClick={() => cambiar({ diseno: dis })}
                aria-pressed={p.diseno === dis}
                className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                  p.diseno === dis ? "border-marca ring-2 ring-marca/30" : "border-borde hover:border-marca/50"
                }`}
              >
                <span
                  className="pointer-events-none flex h-40 items-start justify-center overflow-hidden bg-fondo pt-3"
                  aria-hidden
                >
                  <span className="w-[384px] shrink-0" style={{ zoom: 0.4 }}>
                    <TarjetaVisual
                      local={negocio.nombre}
                      logo={negocio.logo_url}
                      programa={{ ...p, meta: Math.min(p.meta, 10), diseno: dis }}
                      sellos={Math.min(p.meta, 10) - 3}
                      puntos={1250}
                      proximo={{ titulo: "Tu premio", puntos: 2000 }}
                      nombre="Camila"
                    />
                  </span>
                </span>
                <span className="border-t border-borde px-3 py-2">
                  <span className="block text-sm font-semibold">{DISENOS_SELLO[dis].nombre}</span>
                  <span className="block text-xs leading-snug text-suave">{DISENOS_SELLO[dis].texto}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Color
              <input
                id="color"
                type="color"
                value={p.color}
                onChange={(e) => cambiar({ color: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded border border-borde"
              />
            </label>
            <button type="button" className="text-marca hover:underline" onClick={() => cambiar({ color: rubroDe(negocio.rubro).color })}>
              Color sugerido de mi rubro
            </button>
          </div>
          <div>
            <p className="etiqueta-campo">Dibujo de los sellos</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ICONOS_SELLO) as IconoSello[]).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => cambiar({ icono: i })}
                  aria-pressed={p.icono === i}
                  aria-label={i}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl ${
                    p.icono === i ? "border-marca ring-2 ring-marca/30" : "border-borde"
                  }`}
                >
                  {ICONOS_SELLO[i]}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm">
            <span className="etiqueta-campo">Condiciones (opcional)</span>
            <textarea
              id="condiciones"
              maxLength={300}
              rows={2}
              value={p.condiciones}
              onChange={(e) => cambiar({ condiciones: e.target.value })}
              placeholder="Premio válido de lunes a jueves. No acumulable con otras promociones."
              className="campo resize-none"
            />
          </label>
        </section>

        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-center text-xs text-suave">Así la ven tus clientes</p>
        <div className="flex justify-center">
          <Inclinable>
            <TarjetaVisual
              local={negocio.nombre}
              logo={negocio.logo_url}
              programa={p}
              sellos={Math.min(p.meta - 1, Math.max(p.bienvenida, Math.round(p.meta * 0.6)))}
              puntos={1250}
              proximo={{ titulo: "Un café de regalo", puntos: 2000 }}
              nivel={p.niveles[0]?.nombre}
              nombre="Camila"
            />
          </Inclinable>
        </div>
      </div>
    </form>
  );
}

// ── Premios intermedios ─────────────────────────
function ListaHitos({ hitos, meta, onChange, deshabilitado }: { hitos: Hito[]; meta: number; onChange: (h: Hito[]) => void; deshabilitado: boolean }) {
  const poner = (i: number, c: Partial<Hito>) => onChange(hitos.map((h, j) => (j === i ? { ...h, ...c } : h)));
  return (
    <div className="space-y-2">
      {hitos.map((h, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <span>A los</span>
          <input
            type="number"
            min={1}
            max={meta - 1}
            value={h.sellos}
            disabled={deshabilitado}
            onChange={(e) => poner(i, { sellos: Math.min(meta - 1, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
            className="campo w-20 py-1.5"
            aria-label="Sellos"
          />
          <span>sellos:</span>
          <input
            maxLength={60}
            value={h.premio}
            disabled={deshabilitado}
            onChange={(e) => poner(i, { premio: e.target.value })}
            placeholder="Un café chico"
            className="campo min-w-0 flex-1 py-1.5"
            aria-label="Premio intermedio"
          />
          <button type="button" className="text-suave hover:text-red-700" onClick={() => onChange(hitos.filter((_, j) => j !== i))} aria-label="Quitar">
            ✕
          </button>
        </div>
      ))}
      {hitos.length < 5 && meta > 2 && (
        <button
          type="button"
          disabled={deshabilitado}
          className="text-sm font-medium text-marca hover:underline disabled:opacity-50"
          onClick={() => onChange([...hitos, { sellos: Math.max(1, Math.floor(meta / 2)), premio: "" }])}
        >
          + Agregar premio intermedio
        </button>
      )}
    </div>
  );
}

// ── Niveles ─────────────────────────
const NIVELES_SUGERIDOS: Nivel[] = [
  { nombre: "Bronce", visitas: 5, beneficio: "", doble: false },
  { nombre: "Plata", visitas: 15, beneficio: "Bebida de regalo en tu cumpleaños", doble: false },
  { nombre: "Oro", visitas: 30, beneficio: "Suma el doble siempre", doble: true },
];
function ListaNiveles({ niveles, onChange, deshabilitado }: { niveles: Nivel[]; onChange: (n: Nivel[]) => void; deshabilitado: boolean }) {
  const poner = (i: number, c: Partial<Nivel>) => onChange(niveles.map((h, j) => (j === i ? { ...h, ...c } : h)));
  return (
    <div className="space-y-2">
      {niveles.map((n, i) => (
        <div key={i} className="grid gap-2 rounded-xl border border-borde p-3 text-sm sm:grid-cols-[1fr_6rem_2fr_auto_auto] sm:items-center">
          <input
            maxLength={30}
            value={n.nombre}
            disabled={deshabilitado}
            onChange={(e) => poner(i, { nombre: e.target.value })}
            placeholder="Oro"
            className="campo py-1.5"
            aria-label="Nombre del nivel"
          />
          <label className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              value={n.visitas}
              disabled={deshabilitado}
              onChange={(e) => poner(i, { visitas: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
              className="campo py-1.5"
              aria-label="Visitas"
            />
            <span className="text-xs text-suave">visitas</span>
          </label>
          <input
            maxLength={80}
            value={n.beneficio}
            disabled={deshabilitado}
            onChange={(e) => poner(i, { beneficio: e.target.value })}
            placeholder="Beneficio (opcional)"
            className="campo py-1.5"
            aria-label="Beneficio"
          />
          <label className="flex items-center gap-1.5 whitespace-nowrap">
            <input type="checkbox" checked={n.doble} disabled={deshabilitado} onChange={(e) => poner(i, { doble: e.target.checked })} />
            Suma el doble
          </label>
          <button type="button" className="text-suave hover:text-red-700" onClick={() => onChange(niveles.filter((_, j) => j !== i))} aria-label="Quitar">
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-3">
        {niveles.length < 4 && (
          <button
            type="button"
            disabled={deshabilitado}
            className="text-sm font-medium text-marca hover:underline disabled:opacity-50"
            onClick={() => onChange([...niveles, { nombre: "", visitas: (niveles.at(-1)?.visitas ?? 0) + 10, beneficio: "", doble: false }])}
          >
            + Agregar nivel
          </button>
        )}
        {!niveles.length && (
          <button
            type="button"
            disabled={deshabilitado}
            className="text-sm text-suave hover:text-tinta disabled:opacity-50"
            onClick={() => onChange(NIVELES_SUGERIDOS)}
          >
            Usar Bronce, Plata y Oro
          </button>
        )}
      </div>
    </div>
  );
}

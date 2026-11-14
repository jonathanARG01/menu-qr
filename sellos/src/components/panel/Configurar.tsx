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

// ── La tarjeta del negocio ─────────────────────────
export function Configurar({ negocio, programa }: { negocio: Negocio; programa: ProgramaSellos }) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const router = useRouter();
  const [p, setP] = useState<ProgramaSellos>(programa);
  const [guardando, setGuardando] = useState(false);
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
          <h2 className="font-semibold">Sellos y premio</h2>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="etiqueta-campo">Sellos de regalo al unirse</span>
              <select
                id="bienvenida"
                value={p.bienvenida}
                onChange={(e) => cambiar({ bienvenida: Number(e.target.value) })}
                className="campo"
              >
                <option value={0}>Ninguno</option>
                <option value={1}>1 sello (recomendado)</option>
                <option value={2}>2 sellos</option>
                <option value={3}>3 sellos</option>
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
          <p className="text-xs text-suave">
            {textoRegla(p, formato)}. Con la tarjeta llena el cliente gana {p.premio || "el premio"} y empieza una nueva.
          </p>
        </section>

        <section className="tarjeta space-y-5 p-5">
          <div>
            <h2 className="font-semibold">Para que vuelvan</h2>
            <p className="text-sm text-suave">
              Detalles automáticos que hacen volver al cliente. Los avisos llegan solo a quien aceptó recibirlos.
            </p>
          </div>

          <div>
            <p className="etiqueta-campo">Días de sello doble</p>
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
                ? `${textoDias(p.dias_dobles)}: cada sello vale 2 . Úsalo en los días flojos.`
                : "Elige los días más flojos: ese día cada sello vale 2."}
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
                <option value={0}>Solo el aviso</option>
                <option value={1}>1 sello de regalo</option>
                <option value={2}>2 sellos de regalo</option>
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
                <option value={0}>Solo el saludo</option>
                <option value={1}>1 sello de regalo</option>
                <option value={2}>2 sellos de regalo</option>
                <option value={3}>3 sellos de regalo</option>
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
            <p className="text-sm text-suave">Elige el estilo. Todos usan tu logo, tu color y el dibujo de los sellos.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(DISENOS_SELLO) as DisenoSello[]).map((dis) => (
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
              nombre="Camila"
            />
          </Inclinable>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icono } from "@/components/Icono";
import { useToast } from "@/components/Toast";
import { esEfectivo, resumirCaja, type TotalesCaja } from "@/lib/caja";
import { fechaCorta, imprimirTicket, type LineaTicket } from "@/lib/imprimir";
import type { Pago } from "@/lib/salon";
import { createClient } from "@/lib/supabase/client";
import type { Restaurante } from "@/lib/types";
import { formatoPrecio, mensajeError } from "@/lib/utils";

type Cierre = {
  id: string;
  desde: string;
  hasta: string;
  totales: TotalesCaja & { pendiente?: number };
  efectivo_inicial: number;
  efectivo_contado: number | null;
  nota: string | null;
  created_at: string;
};

type Abiertas = { cantidad: number; falta: number };

const inicioDeHoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const numero = (v: string) => {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// Cierre de caja: todo lo cobrado desde el último cierre, por medio de pago y por persona, y el arqueo del efectivo.
export function Caja({
  restaurante,
  admin,
  usuario,
}: {
  restaurante: Restaurante;
  admin: boolean;
  usuario: { id: string; email: string };
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const formato = useCallback((n: number) => formatoPrecio(n, restaurante.moneda), [restaurante.moneda]);
  const [cargando, setCargando] = useState(true);
  const [falta0009, setFalta0009] = useState(false);
  const [cierres, setCierres] = useState<Cierre[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [cerradas, setCerradas] = useState<{ comensales: number }[]>([]);
  const [abiertas, setAbiertas] = useState<Abiertas>({ cantidad: 0, falta: 0 });
  const [nombres, setNombres] = useState<Map<string, string>>(new Map([[usuario.id, usuario.email.split("@")[0]]]));
  const [fondo, setFondo] = useState("");
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [viendo, setViendo] = useState<Cierre | null>(null);
  const [hasta, setHasta] = useState(() => new Date().toISOString());

  const ultimo = cierres[0];
  const desde = ultimo?.hasta ?? inicioDeHoy();

  const cargar = useCallback(async () => {
    const ahora = new Date().toISOString();
    const historial = await supabase
      .from("cierres_caja")
      .select("*")
      .eq("restaurante_id", restaurante.id)
      .order("hasta", { ascending: false })
      .limit(30);
    if (historial.error) {
      setFalta0009(true);
      setCargando(false);
      return;
    }
    const lista = (historial.data ?? []) as Cierre[];
    const inicio = lista[0]?.hasta ?? inicioDeHoy();
    const [p, c, a] = await Promise.all([
      supabase.from("pagos").select("*").eq("restaurante_id", restaurante.id).gte("created_at", inicio).lte("created_at", ahora),
      supabase
        .from("cuentas")
        .select("comensales")
        .eq("restaurante_id", restaurante.id)
        .eq("estado", "cerrada")
        .gte("cerrada_at", inicio)
        .lte("cerrada_at", ahora),
      supabase.from("cuentas").select("id").eq("restaurante_id", restaurante.id).eq("estado", "abierta"),
    ]);
    const idsAbiertas = (a.data ?? []).map((x) => x.id as string);
    let falta = 0;
    if (idsAbiertas.length) {
      const [ped, pag] = await Promise.all([
        supabase.from("pedidos").select("estado, pedido_items(precio, cantidad)").in("cuenta_id", idsAbiertas),
        supabase.from("pagos").select("monto").in("cuenta_id", idsAbiertas),
      ]);
      const consumo = (ped.data ?? [])
        .filter((x) => x.estado !== "cancelado")
        .flatMap((x) => (x.pedido_items ?? []) as { precio: number; cantidad: number }[])
        .reduce((s, i) => s + Number(i.precio) * i.cantidad, 0);
      falta = Math.max(0, consumo - (pag.data ?? []).reduce((s, x) => s + Number(x.monto), 0));
    }
    setCierres(lista);
    setPagos((p.data ?? []) as Pago[]);
    setCerradas((c.data ?? []) as { comensales: number }[]);
    setAbiertas({ cantidad: idsAbiertas.length, falta });
    setHasta(ahora);
    setCargando(false);
  }, [supabase, restaurante.id]);

  useEffect(() => {
    cargar();
    // Los nombres del equipo solo los puede leer el administrador; el resto ve "Equipo".
    if (admin)
      supabase.rpc("equipo", { p_restaurante: restaurante.id }).then(({ data }) => {
        const filas = (data ?? []) as { user_id: string | null; email: string }[];
        setNombres(new Map(filas.filter((f) => f.user_id).map((f) => [f.user_id!, f.email.split("@")[0]])));
      });
  }, [cargar, admin, supabase, restaurante.id]);

  const totales = useMemo(
    () => resumirCaja({ pagos, cuentasCerradas: cerradas, nombres, fondoInicial: numero(fondo) }),
    [pagos, cerradas, nombres, fondo],
  );
  const diferencia = contado.trim() ? numero(contado) - totales.efectivo_esperado : null;

  async function cerrarCaja() {
    if (!totales.cobros && !confirm("No hay cobros en este turno. ¿Cerrar la caja igual?")) return;
    if (
      abiertas.cantidad &&
      !confirm(`Quedan ${abiertas.cantidad} mesas abiertas. Lo que cobren después entra en el próximo turno. ¿Cerrar igual?`)
    )
      return;
    setGuardando(true);
    const { data, error } = await supabase
      .from("cierres_caja")
      .insert({
        restaurante_id: restaurante.id,
        desde,
        hasta,
        totales: { ...totales, pendiente: abiertas.falta },
        efectivo_inicial: numero(fondo),
        efectivo_contado: contado.trim() ? numero(contado) : null,
        nota: nota.trim() || null,
      })
      .select("*")
      .single();
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Caja cerrada");
    setFondo("");
    setContado("");
    setNota("");
    setViendo(data as Cierre);
    await cargar();
  }

  async function borrarCierre(c: Cierre) {
    if (!confirm("¿Borrar este cierre? Sus cobros vuelven a sumarse al turno siguiente.")) return;
    const { error } = await supabase.from("cierres_caja").delete().eq("id", c.id);
    if (error) return avisar(mensajeError(error), "error");
    setViendo(null);
    avisar("Cierre borrado");
    await cargar();
  }

  function imprimir(c: Pick<Cierre, "desde" | "hasta" | "totales" | "efectivo_inicial" | "efectivo_contado" | "nota">) {
    const t = c.totales;
    const lineas: LineaTicket[] = [
      { tipo: "titulo", texto: "Cierre de caja" },
      { tipo: "texto", texto: restaurante.nombre, fuerte: true },
      { tipo: "texto", texto: `${fechaCorta(c.desde)} → ${fechaCorta(c.hasta)}`, chico: true },
      { tipo: "separador" },
      { tipo: "fila", izq: "Ventas", der: formato(t.ventas) },
      { tipo: "fila", izq: "Propinas", der: formato(t.propinas) },
      { tipo: "fila", izq: "Total cobrado", der: formato(t.ventas + t.propinas), fuerte: true },
      { tipo: "fila", izq: `Mesas cerradas (${t.comensales} pers.)`, der: String(t.mesas) },
      { tipo: "separador" },
      { tipo: "texto", texto: "Por medio de pago", fuerte: true },
      ...t.medios.map((m) => ({
        tipo: "fila" as const,
        izq: `${m.medio} (${m.cantidad})`,
        der: formato(m.ventas + m.propinas),
        nota: m.propinas ? `incluye ${formato(m.propinas)} de propina` : undefined,
      })),
      { tipo: "separador" },
      { tipo: "texto", texto: "Propinas por persona", fuerte: true },
      ...t.personas.map((p) => ({ tipo: "fila" as const, izq: p.nombre, der: formato(p.propinas) })),
      { tipo: "separador" },
      { tipo: "fila", izq: "Fondo inicial", der: formato(Number(c.efectivo_inicial)) },
      { tipo: "fila", izq: "Efectivo esperado", der: formato(t.efectivo_esperado) },
    ];
    if (c.efectivo_contado !== null) {
      const dif = Number(c.efectivo_contado) - t.efectivo_esperado;
      lineas.push(
        { tipo: "fila", izq: "Efectivo contado", der: formato(Number(c.efectivo_contado)) },
        { tipo: "fila", izq: dif < 0 ? "Falta" : dif > 0 ? "Sobra" : "Diferencia", der: formato(Math.abs(dif)), fuerte: true },
      );
    }
    if (t.pendiente)
      lineas.push({ tipo: "texto", texto: `Quedaba sin cobrar en mesas abiertas: ${formato(t.pendiente)}`, chico: true });
    if (c.nota) lineas.push({ tipo: "separador" }, { tipo: "texto", texto: c.nota });
    imprimirTicket(lineas);
  }

  if (falta0009) {
    return (
      <div className="tarjeta mx-auto max-w-lg p-6">
        <h1 className="font-semibold">Falta un paso en la base de datos</h1>
        <p className="mt-2 text-sm text-suave">
          Para usar el cierre de caja ejecuta el SQL <code>0009_caja_reservas_cobro_online.sql</code> en Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Caja</h1>
          <p className="text-sm text-suave" suppressHydrationWarning>
            Turno desde {fechaCorta(desde)} {ultimo ? "(último cierre)" : "(inicio del día)"}
          </p>
        </div>
        <button type="button" onClick={() => cargar()} className="boton-secundario">
          Actualizar
        </button>
        <button
          type="button"
          onClick={() =>
            imprimir({
              desde,
              hasta,
              totales: { ...totales, pendiente: abiertas.falta },
              efectivo_inicial: numero(fondo),
              efectivo_contado: contado.trim() ? numero(contado) : null,
              nota,
            })
          }
          className="boton-secundario"
        >
          Imprimir parcial
        </button>
      </header>

      {cargando ? (
        <p className="py-10 text-center text-suave">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Dato titulo="Ventas" valor={formato(totales.ventas)} />
            <Dato titulo="Propinas" valor={formato(totales.propinas)} />
            <Dato titulo="Total cobrado" valor={formato(totales.ventas + totales.propinas)} fuerte />
            <Dato titulo="Mesas cerradas" valor={`${totales.mesas}`} ayuda={`${totales.comensales} personas`} />
            <Dato
              titulo="Ticket promedio"
              valor={totales.mesas ? formato(Math.round(totales.ventas / totales.mesas)) : "—"}
              ayuda={totales.comensales ? `${formato(Math.round(totales.ventas / totales.comensales))} por persona` : undefined}
            />
          </div>

          {abiertas.cantidad > 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Hay {abiertas.cantidad} {abiertas.cantidad === 1 ? "mesa abierta" : "mesas abiertas"}
              {abiertas.falta > 0 ? ` con ${formato(abiertas.falta)} sin cobrar` : ""}. Lo que se cobre después de cerrar la caja
              entra en el turno siguiente.
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="tarjeta p-5">
              <h2 className="mb-3 font-semibold">Por medio de pago</h2>
              {totales.medios.length === 0 ? (
                <p className="text-sm text-suave">Todavía no hay cobros en este turno.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-suave">
                    <tr>
                      <th className="pb-2 font-medium">Medio</th>
                      <th className="pb-2 text-right font-medium">Ventas</th>
                      <th className="pb-2 text-right font-medium">Propinas</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {totales.medios.map((m) => (
                      <tr key={m.medio} className="border-t border-borde">
                        <td className="py-2">
                          {m.medio} <span className="text-xs text-suave">· {m.cantidad}</span>
                        </td>
                        <td className="py-2 text-right">{formato(m.ventas)}</td>
                        <td className="py-2 text-right">{formato(m.propinas)}</td>
                        <td className="py-2 text-right font-semibold">{formato(m.ventas + m.propinas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {totales.online > 0 && (
                <p className="mt-3 text-xs text-suave">
                  {formato(totales.online)} se pagaron online con Mercado Pago: llegan a la cuenta de Mercado Pago, no a la caja.
                </p>
              )}
            </section>

            <section className="tarjeta p-5">
              <h2 className="mb-3 font-semibold">Propinas por persona</h2>
              {totales.personas.length === 0 ? (
                <p className="text-sm text-suave">Sin cobros todavía.</p>
              ) : (
                <ul className="divide-y divide-borde text-sm tabular-nums">
                  {totales.personas.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-xs font-bold uppercase">
                        {p.nombre.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.nombre}</span>
                        <span className="block text-xs text-suave">
                          {p.cobros} {p.cobros === 1 ? "cobro" : "cobros"} · {formato(p.ventas)} en ventas
                        </span>
                      </span>
                      <span className="font-semibold">{formato(p.propinas)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="tarjeta p-5">
            <h2 className="font-semibold">Arqueo de efectivo</h2>
            <p className="mb-4 text-sm text-suave">
              Cuenta los billetes de la caja y escribe cuánto hay. El sistema te dice si sobra o falta.
            </p>
            <div className="grid gap-4 sm:grid-cols-4">
              <label className="block text-sm">
                <span className="mb-1 block text-suave">Fondo inicial</span>
                <input
                  inputMode="decimal"
                  value={fondo}
                  onChange={(e) => setFondo(e.target.value)}
                  placeholder="0"
                  className="campo w-full"
                />
              </label>
              <div className="text-sm">
                <span className="mb-1 block text-suave">Efectivo esperado</span>
                <p className="py-2 text-lg font-semibold tabular-nums">{formato(totales.efectivo_esperado)}</p>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-suave">Efectivo contado</span>
                <input
                  inputMode="decimal"
                  value={contado}
                  onChange={(e) => setContado(e.target.value)}
                  placeholder="Escribe lo que contaste"
                  className="campo w-full"
                />
              </label>
              <div className="text-sm">
                <span className="mb-1 block text-suave">Diferencia</span>
                <p
                  className={`py-2 text-lg font-semibold tabular-nums ${
                    diferencia === null
                      ? "text-suave"
                      : Math.abs(diferencia) < 0.01
                        ? "text-emerald-600"
                        : diferencia < 0
                          ? "text-red-600"
                          : "text-amber-600"
                  }`}
                >
                  {diferencia === null
                    ? "—"
                    : Math.abs(diferencia) < 0.01
                      ? "Cuadra justo"
                      : `${diferencia < 0 ? "Falta" : "Sobra"} ${formato(Math.abs(diferencia))}`}
                </p>
              </div>
            </div>
            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-suave">Nota (opcional)</span>
              <input
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                maxLength={300}
                placeholder="Ej.: se pagó al proveedor de hielo con efectivo de la caja"
                className="campo w-full"
              />
            </label>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" disabled={guardando} onClick={cerrarCaja} className="boton">
                <Icono nombre="check" className="h-4 w-4" /> {guardando ? "Cerrando…" : "Cerrar caja"}
              </button>
              <p className="text-xs text-suave">
                Guarda este resumen y empieza un turno nuevo.{" "}
                {totales.medios.some((m) => esEfectivo(m.medio)) ? "" : "No hubo cobros en efectivo."}
              </p>
            </div>
          </section>

          <section className="tarjeta p-5">
            <h2 className="mb-3 font-semibold">Cierres anteriores</h2>
            {cierres.length === 0 ? (
              <p className="text-sm text-suave">Todavía no cerraste ninguna caja.</p>
            ) : (
              <ul className="divide-y divide-borde text-sm">
                {cierres.map((c) => {
                  const dif = c.efectivo_contado === null ? null : Number(c.efectivo_contado) - c.totales.efectivo_esperado;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setViendo(c)}
                        className="flex w-full items-center gap-3 py-2.5 text-left hover:text-marca"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium" suppressHydrationWarning>
                            {fechaCorta(c.desde)} → {fechaCorta(c.hasta)}
                          </span>
                          <span className="block text-xs text-suave">
                            {c.totales.mesas} mesas · {c.totales.cobros} cobros
                            {dif !== null && Math.abs(dif) >= 0.01
                              ? ` · ${dif < 0 ? "faltó" : "sobró"} ${formato(Math.abs(dif))}`
                              : ""}
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums">{formato(c.totales.ventas + c.totales.propinas)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {viendo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setViendo(null)}>
          <div
            className="tarjeta max-h-[90vh] w-full max-w-md overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Detalle del cierre"
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex-1">
                <h2 className="text-lg font-semibold">Cierre de caja</h2>
                <p className="text-sm text-suave" suppressHydrationWarning>
                  {fechaCorta(viendo.desde)} → {fechaCorta(viendo.hasta)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViendo(null)}
                aria-label="Cerrar"
                className="rounded-lg p-1 hover:bg-stone-100"
              >
                <Icono nombre="cerrar" className="h-5 w-5" />
              </button>
            </div>
            <dl className="space-y-1.5 text-sm tabular-nums">
              <Fila t="Ventas" v={formato(viendo.totales.ventas)} />
              <Fila t="Propinas" v={formato(viendo.totales.propinas)} />
              <Fila t="Total cobrado" v={formato(viendo.totales.ventas + viendo.totales.propinas)} fuerte />
              {viendo.totales.medios.map((m) => (
                <Fila key={m.medio} t={`· ${m.medio}`} v={formato(m.ventas + m.propinas)} />
              ))}
              <Fila t="Efectivo esperado" v={formato(viendo.totales.efectivo_esperado)} />
              {viendo.efectivo_contado !== null && <Fila t="Efectivo contado" v={formato(Number(viendo.efectivo_contado))} />}
            </dl>
            {viendo.nota && <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm">{viendo.nota}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => imprimir(viendo)} className="boton flex-1">
                Imprimir
              </button>
              {admin && (
                <button type="button" onClick={() => borrarCierre(viendo)} className="boton-secundario text-red-600">
                  Borrar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dato({ titulo, valor, ayuda, fuerte }: { titulo: string; valor: string; ayuda?: string; fuerte?: boolean }) {
  return (
    <div className={`tarjeta p-4 ${fuerte ? "ring-2 ring-marca/40" : ""}`}>
      <p className="text-xs uppercase tracking-wide text-suave">{titulo}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{valor}</p>
      {ayuda && <p className="text-xs text-suave">{ayuda}</p>}
    </div>
  );
}

function Fila({ t, v, fuerte }: { t: string; v: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${fuerte ? "font-semibold" : ""}`}>
      <dt>{t}</dt>
      <dd>{v}</dd>
    </div>
  );
}

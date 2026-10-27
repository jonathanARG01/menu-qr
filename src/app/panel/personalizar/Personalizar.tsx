"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { Interruptor } from "@/components/Interruptor";
import { AJUSTES_BASE, PERMITIDAS, SECCIONES, type Ajustes, type Modulo, type Seccion } from "@/lib/salon";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { PAISES, ZONAS, paisDe } from "@/lib/region";
import { revalidarCarta } from "../actions";
import { MONEDAS_MP } from "@/lib/mercadopago";

const MODULOS: { id: Modulo; titulo: string; ayuda: string }[] = [
  { id: "salon", titulo: "Salón y mesas", ayuda: "Plano por pisos, abrir mesas y tomar pedidos" },
  { id: "cocina", titulo: "Pantalla de cocina", ayuda: "Comandas en tiempo real para cocina y barra" },
  { id: "cobros", titulo: "Cobros", ayuda: "Cuenta dividida, propinas y medios de pago" },
  { id: "pedidos_mesa", titulo: "Pedidos desde la mesa", ayuda: "El cliente pide y pide la cuenta desde el QR" },
  {
    id: "llevar",
    titulo: "Para llevar y delivery",
    ayuda: "Pedidos sin mesa: por teléfono o desde la carta, con hora de retiro",
  },
  {
    id: "reservas",
    titulo: "Reservas y lista de espera",
    ayuda: "Reservas del día, lista de espera con QR y aviso por WhatsApp",
  },
  { id: "clientes", titulo: "Clientes frecuentes", ayuda: "Visitas y gasto de cada cliente, y premios a los que vuelven" },
  { id: "estadisticas", titulo: "Estadísticas", ayuda: "Visitas, horarios y lo más pedido" },
  { id: "sucursales", titulo: "Sucursales", ayuda: "Varios locales con la misma carta" },
  { id: "equipo", titulo: "Equipo", ayuda: "Meseros y cocina con su propio usuario" },
];

// Atajos para empezar: después se puede ajustar cada interruptor.
const PERFILES: { titulo: string; ayuda: string; modulos: Partial<Record<Modulo, boolean>> }[] = [
  {
    titulo: "Solo carta",
    ayuda: "Carta QR y pedidos por WhatsApp",
    modulos: {
      salon: false,
      cocina: false,
      cobros: false,
      pedidos_mesa: false,
      llevar: false,
      clientes: false,
      equipo: false,
      sucursales: false,
      estadisticas: true,
    },
  },
  {
    titulo: "Café o local chico",
    ayuda: "Mesas, cocina y cobro, sin complicaciones",
    modulos: {
      salon: true,
      cocina: true,
      cobros: true,
      pedidos_mesa: true,
      llevar: true,
      clientes: true,
      equipo: true,
      sucursales: false,
      estadisticas: true,
    },
  },
  {
    titulo: "Restaurante completo",
    ayuda: "Todo encendido",
    modulos: {
      salon: true,
      cocina: true,
      cobros: true,
      pedidos_mesa: true,
      llevar: true,
      clientes: true,
      equipo: true,
      sucursales: true,
      estadisticas: true,
    },
  },
];

const numeros = (texto: string) =>
  texto
    .split(/[,\s]+/)
    .map((t) => Number(t.replace(/[^\d.]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 6);

export function Personalizar({
  restauranteId,
  moneda,
  iniciales,
}: {
  restauranteId: string;
  moneda: string;
  iniciales: Ajustes;
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const router = useRouter();
  const [a, setA] = useState(iniciales);
  const [guardando, setGuardando] = useState(false);
  const cambiado = JSON.stringify(a) !== JSON.stringify(iniciales);
  const formato = (n: number) => formatoPrecio(n, moneda);

  const set = (cambios: Partial<Ajustes>) => setA((x) => ({ ...x, ...cambios }));
  // El atajo que coincide con los módulos encendidos queda marcado.
  const coincide = (p: (typeof PERFILES)[number]) =>
    (Object.keys(p.modulos) as Modulo[]).every((m) => !!a.modulos[m] === p.modulos[m]);
  const modulo = (id: Modulo, v: boolean) => set({ modulos: { ...a.modulos, [id]: v } });

  async function guardar() {
    setGuardando(true);
    const { error } = await supabase.from("restaurantes").update({ ajustes: a }).eq("id", restauranteId);
    setGuardando(false);
    if (error) return avisar(mensajeError(error), "error");
    avisar("Guardado");
    revalidarCarta();
    router.refresh();
  }

  function alternarVista(rol: "mesero" | "cocina", s: Seccion) {
    const actual = a.vistas[rol];
    set({ vistas: { ...a.vistas, [rol]: actual.includes(s) ? actual.filter((x) => x !== s) : [...actual, s] } });
  }

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-semibold">Personalizar</h1>
        <p className="text-sm text-suave">
          El sistema se adapta a tu restaurante: muestra solo lo que usas y cobra como tú cobras.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Empezar rápido</h2>
          {!PERFILES.some(coincide) && <span className="text-sm text-suave">Ahora: a tu medida</span>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERFILES.map((p) => {
            const elegido = coincide(p);
            return (
              <button
                key={p.titulo}
                type="button"
                aria-pressed={elegido}
                onClick={() => set({ modulos: { ...a.modulos, ...p.modulos } })}
                className={`relative rounded-2xl border-2 p-4 text-left transition ${
                  elegido ? "border-marca bg-marca/10" : "border-borde bg-superficie hover:border-marca/50"
                }`}
              >
                {elegido && (
                  <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-marca text-white">
                    <Icono nombre="check" className="h-4 w-4" />
                  </span>
                )}
                <span className={`block pr-7 font-semibold ${elegido ? "text-marca" : ""}`}>{p.titulo}</span>
                <span className="block text-sm text-suave">{p.ayuda}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="tarjeta divide-y divide-borde">
        <h2 className="px-5 py-3 font-semibold">Qué partes usa tu restaurante</h2>
        {MODULOS.map((m) => (
          <div key={m.id} className="flex items-center gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{m.titulo}</p>
              <p className="text-sm text-suave">{m.ayuda}</p>
            </div>
            <Interruptor activo={a.modulos[m.id]} onChange={(v) => modulo(m.id, v)} etiqueta={m.titulo} />
          </div>
        ))}
        <p className="px-5 py-3 text-xs text-suave">
          Lo apagado desaparece del menú. No se borra nada: si lo vuelves a encender, está todo como lo dejaste.
        </p>
      </section>

      {a.modulos.equipo && (
        <section className="tarjeta p-5">
          <h2 className="font-semibold">Qué ve cada rol</h2>
          <p className="mb-3 text-sm text-suave">El administrador ve todo. Elige qué le aparece al mesero y a la cocina.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suave">
                  <th className="py-2 font-medium">Sección</th>
                  <th className="w-24 py-2 text-center font-medium">Mesero</th>
                  <th className="w-24 py-2 text-center font-medium">Cocina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {SECCIONES.filter((s) => PERMITIDAS.mesero.includes(s.id) || PERMITIDAS.cocina.includes(s.id)).map((s) => (
                  <tr key={s.id}>
                    <td className="py-2">{s.texto}</td>
                    {(["mesero", "cocina"] as const).map((rol) => (
                      <td key={rol} className="py-2 text-center">
                        {PERMITIDAS[rol].includes(s.id) ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--color-marca)]"
                            checked={a.vistas[rol].includes(s.id)}
                            onChange={() => alternarVista(rol, s.id)}
                            aria-label={`${s.texto} para ${rol}`}
                          />
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-suave">
            Carta, precios, marca, QR, equipo y estos ajustes son solo para administradores.
          </p>
        </section>
      )}

      {a.modulos.pedidos_mesa && (
        <section className="tarjeta flex items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">El mesero confirma los pedidos del QR</p>
            <p className="text-sm text-suave">
              Encendido: lo que pide el cliente espera la aprobación del mesero antes de llegar a cocina. Apagado: va directo.
            </p>
          </div>
          <Interruptor
            activo={a.confirmar_pedidos}
            onChange={(v) => set({ confirmar_pedidos: v })}
            etiqueta="Confirmar pedidos"
          />
        </section>
      )}

      {a.modulos.llevar && (
        <section id="llevar" className="tarjeta scroll-mt-24 space-y-4 p-5">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Pedidos para llevar desde la carta</h2>
              <p className="text-sm text-suave">
                Encendido: quien abre la carta sin el QR de una mesa puede pedir para retirar (o delivery), elegir la hora y
                seguir su pedido en el teléfono. Llegan a la sección Para llevar.
              </p>
            </div>
            <Interruptor
              activo={a.llevar.online}
              onChange={(online) => set({ llevar: { ...a.llevar, online } })}
              etiqueta="Pedidos para llevar desde la carta"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 text-sm">
              <Interruptor
                activo={a.llevar.delivery}
                onChange={(delivery) => set({ llevar: { ...a.llevar, delivery } })}
                etiqueta="Delivery"
              />
              También delivery (con dirección)
            </div>
            {a.llevar.delivery && (
              <label className="flex items-center gap-2 text-sm">
                Costo de envío
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={a.llevar.envio}
                  onChange={(e) => set({ llevar: { ...a.llevar, envio: Math.max(0, Number(e.target.value) || 0) } })}
                  className="w-28 rounded-lg border border-borde px-2 py-1"
                />
                <span className="text-suave">{a.llevar.envio > 0 ? formato(a.llevar.envio) : "gratis"}</span>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              Tiempo de preparación
              <input
                type="number"
                min={5}
                max={180}
                value={a.llevar.minutos}
                onChange={(e) => set({ llevar: { ...a.llevar, minutos: Number(e.target.value) || 30 } })}
                className="w-16 rounded-lg border border-borde px-2 py-1"
              />
              minutos
            </label>
            <div className="flex items-center gap-3 text-sm">
              <Interruptor
                activo={a.llevar.confirmar}
                onChange={(confirmar) => set({ llevar: { ...a.llevar, confirmar } })}
                etiqueta="Aceptar los pedidos"
              />
              Aceptar cada pedido antes de que pase a cocina
            </div>
            {a.modulos.cobros && a.cobro_online.activo && (
              <div className="flex items-center gap-3 text-sm sm:col-span-2">
                <Interruptor
                  activo={a.llevar.pago_obligatorio}
                  onChange={(pago_obligatorio) => set({ llevar: { ...a.llevar, pago_obligatorio } })}
                  etiqueta="Pago por adelantado"
                />
                Pedir el pago con Mercado Pago antes de prepararlo (si no, el cliente elige pagar online o al retirar)
              </div>
            )}
          </div>
          {!a.cobro_online.activo && a.modulos.cobros && (
            <p className="text-xs text-suave">
              Con el cobro online de Mercado Pago encendido (más abajo) también pueden pagar por adelantado.
            </p>
          )}
        </section>
      )}

      {a.modulos.cobros && (
        <>
          <section className="tarjeta space-y-4 p-5">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Propinas</h2>
                <p className="text-sm text-suave">Opciones que se ofrecen al cobrar y cuando el cliente pide la cuenta.</p>
              </div>
              <Interruptor
                activo={a.propinas.activas}
                onChange={(v) => set({ propinas: { ...a.propinas, activas: v } })}
                etiqueta="Propinas"
              />
            </div>
            {a.propinas.activas && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Porcentajes (separados por coma)
                  <input
                    defaultValue={a.propinas.porcentajes.join(", ")}
                    onBlur={(e) => set({ propinas: { ...a.propinas, porcentajes: numeros(e.target.value) } })}
                    className="campo mt-1"
                    placeholder="10, 15, 20"
                  />
                </label>
                <label className="block text-sm">
                  Montos fijos (separados por coma)
                  <input
                    defaultValue={a.propinas.montos.join(", ")}
                    onBlur={(e) => set({ propinas: { ...a.propinas, montos: numeros(e.target.value) } })}
                    className="campo mt-1"
                    placeholder="500, 1000, 2000"
                  />
                </label>
                <label className="block text-sm">
                  Propina marcada de entrada
                  <select
                    value={a.propinas.sugerida ?? ""}
                    onChange={(e) =>
                      set({ propinas: { ...a.propinas, sugerida: e.target.value ? Number(e.target.value) : null } })
                    }
                    className="campo mt-1"
                  >
                    <option value="">Ninguna</option>
                    {a.propinas.porcentajes.map((p) => (
                      <option key={p} value={p}>
                        {p}%
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-3 text-sm">
                  <Interruptor
                    activo={a.propinas.libre}
                    onChange={(v) => set({ propinas: { ...a.propinas, libre: v } })}
                    etiqueta="Monto libre"
                  />
                  Permitir escribir cualquier porcentaje o monto
                </div>
                <p className="text-xs text-suave sm:col-span-2">
                  Siempre se puede elegir “Sin propina” o “Al final”, y pagar la propina con otro medio (por ejemplo, la cuenta
                  con tarjeta y la propina en efectivo). Ejemplo: {a.propinas.porcentajes.map((p) => `${p}%`).join(" · ")}
                  {a.propinas.montos.length ? ` · ${a.propinas.montos.map(formato).join(" · ")}` : ""}
                </p>
              </div>
            )}
          </section>

          <ListaEditable
            titulo="Medios de pago"
            ayuda="Los que aceptas. Aparecen al cobrar y al pedir la cuenta."
            items={a.metodos_pago}
            onChange={(metodos_pago) => set({ metodos_pago })}
            ejemplo="Cuenta RUT"
          />

          <CobroOnline
            restauranteId={restauranteId}
            activo={a.cobro_online.activo}
            onActivo={(activo) => set({ cobro_online: { ...a.cobro_online, activo } })}
            pedidosMesa={a.modulos.pedidos_mesa}
            moneda={moneda}
          />
        </>
      )}

      {a.modulos.reservas && (
        <section className="tarjeta space-y-4 p-5">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Reservas desde internet</h2>
              <p className="text-sm text-suave">
                Encendido: en la carta aparece “Reservar” y cualquiera puede pedir una mesa. Tú las confirmas en Reservas.
              </p>
            </div>
            <Interruptor
              activo={a.reservas.online}
              onChange={(online) => set({ reservas: { ...a.reservas, online } })}
              etiqueta="Reservas desde internet"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            Se avisa que la reserva no llegó a los
            <input
              type="number"
              min={5}
              max={120}
              value={a.reservas.tolerancia}
              onChange={(e) => set({ reservas: { ...a.reservas, tolerancia: Number(e.target.value) || 15 } })}
              className="w-16 rounded-lg border border-borde px-2 py-1"
            />
            minutos
          </label>
          <div className="flex flex-wrap items-center gap-3 border-t border-borde pt-4 text-sm">
            <Interruptor
              activo={a.reservas.recordatorio}
              onChange={(recordatorio) => set({ reservas: { ...a.reservas, recordatorio } })}
              etiqueta="Recordatorio de reserva"
            />
            Recordar la reserva al celular del cliente
            <input
              type="number"
              min={1}
              max={48}
              value={a.reservas.horas_antes}
              onChange={(e) =>
                set({ reservas: { ...a.reservas, horas_antes: Math.min(48, Math.max(1, Number(e.target.value) || 3)) } })
              }
              className="w-16 rounded-lg border border-borde px-2 py-1"
              disabled={!a.reservas.recordatorio}
            />
            horas antes
          </div>
          <p className="text-xs text-suave">
            Llega a quien tocó “Avisarme” al reservar o en el enlace de su reserva, y se manda solo mientras el panel está abierto
            (y además cada mañana). A los demás, Reservas te ofrece mandar el recordatorio por WhatsApp con un enlace para
            confirmar o cancelar.
          </p>
        </section>
      )}

      {a.modulos.clientes && (
        <section id="clientes" className="tarjeta scroll-mt-24 space-y-3 p-5">
          <h2 className="font-semibold">Premio a los clientes frecuentes</h2>
          <p className="text-sm text-suave">
            Cuando un cliente anotado llega a esa visita, el mesero lo ve en la ficha de la mesa y en Clientes.
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            Cada
            <input
              type="number"
              min={0}
              max={50}
              value={a.clientes.premio_cada}
              onChange={(e) => set({ clientes: { ...a.clientes, premio_cada: Math.max(0, Number(e.target.value) || 0) } })}
              className="w-16 rounded-lg border border-borde px-2 py-1"
            />
            visitas, regalar
            <input
              value={a.clientes.premio}
              maxLength={60}
              onChange={(e) => set({ clientes: { ...a.clientes, premio: e.target.value } })}
              placeholder="un postre"
              className="campo w-48 flex-1 py-1.5"
            />
          </div>
          <p className="text-xs text-suave">Con 0 no hay premio. Ejemplo: cada 5 visitas, un postre de la casa.</p>
        </section>
      )}

      <section className="tarjeta space-y-4 p-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Reseñas en Google</h2>
            <p className="text-sm text-suave">
              Cuando el mesero cierra la mesa, el cliente califica con estrellas. Con 4 o 5 lo invitamos a dejar la reseña en
              Google; con menos, el comentario te llega solo a ti (en Estadísticas).
            </p>
          </div>
          <Interruptor
            activo={a.resenas.pedir}
            onChange={(pedir) => set({ resenas: { ...a.resenas, pedir } })}
            etiqueta="Pedir opinión"
          />
        </div>
        {a.resenas.pedir && (
          <label className="block text-sm">
            Link para dejar reseña en Google
            <input
              value={a.resenas.google_url}
              onChange={(e) => set({ resenas: { ...a.resenas, google_url: e.target.value.trim() } })}
              placeholder="https://g.page/r/…/review"
              className="campo mt-1"
              inputMode="url"
            />
            <span className="mt-1 block text-xs text-suave">
              En Google Maps busca tu local → “Pedir reseñas” (o en tu Perfil de Empresa → “Compartir formulario de reseñas”) y
              copia el link. Sin link, igual recibes las opiniones privadas.
            </span>
          </label>
        )}
      </section>

      <section className="tarjeta grid gap-4 p-5 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold">País</span>
          <span className="block text-suave">Formato de fechas y código de país de los teléfonos para WhatsApp.</span>
          <select
            value={a.pais}
            onChange={(e) => set({ pais: e.target.value, zona_horaria: paisDe(e.target.value).zona })}
            className="campo mt-2"
          >
            {PAISES.map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre}
              </option>
            ))}
          </select>
          {paisDe(a.pais).moneda !== moneda && (
            <span className="mt-1 block text-xs text-amber-800">
              Tu carta está en {moneda}. Si cobras en {paisDe(a.pais).moneda}, cámbiala en Marca.
            </span>
          )}
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Zona horaria</span>
          <span className="block text-suave">Para las promos por horario, los platos agotados y el cierre de caja.</span>
          <select value={a.zona_horaria} onChange={(e) => set({ zona_horaria: e.target.value })} className="campo mt-2">
            {(ZONAS.some(([z]) => z === a.zona_horaria) ? ZONAS : [[a.zona_horaria, a.zona_horaria], ...ZONAS]).map(
              ([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      {a.modulos.cocina && (
        <>
          <ListaEditable
            titulo="Pantallas de preparación"
            ayuda="Por ejemplo Cocina, Barra, Parrilla, Postres. En la Carta eliges a cuál va cada categoría."
            items={a.estaciones}
            onChange={(estaciones) => set({ estaciones })}
            ejemplo="Parrilla"
          />
          <section className="tarjeta space-y-3 p-5">
            <h2 className="font-semibold">Alertas de demora en cocina</h2>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500" /> Amarillo a los
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={a.alertas.amarillo}
                  onChange={(e) => set({ alertas: { ...a.alertas, amarillo: Number(e.target.value) || 10 } })}
                  className="w-16 rounded-lg border border-borde px-2 py-1"
                />
                min
              </label>
              <label className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-600" /> Rojo a los
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={a.alertas.rojo}
                  onChange={(e) => set({ alertas: { ...a.alertas, rojo: Number(e.target.value) || 20 } })}
                  className="w-16 rounded-lg border border-borde px-2 py-1"
                />
                min
              </label>
            </div>
          </section>
        </>
      )}

      <div className="fixed inset-x-0 bottom-16 z-10 px-4 lg:bottom-6 lg:left-64">
        <div className="mx-auto flex max-w-4xl items-center gap-3 rounded-2xl bg-tinta px-4 py-3 text-white shadow-xl">
          <span className="flex-1 text-sm">{cambiado ? "Tienes cambios sin guardar" : "Todo guardado"}</span>
          <button type="button" className="text-sm text-white/70 hover:text-white" onClick={() => setA(AJUSTES_BASE)}>
            Valores de fábrica
          </button>
          <button type="button" className="boton" disabled={!cambiado || guardando} onClick={guardar}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Conectar Mercado Pago: el dueño pega su Access Token. Se guarda en la base y nunca vuelve al navegador.
function CobroOnline({
  restauranteId,
  activo,
  onActivo,
  pedidosMesa,
  moneda,
}: {
  restauranteId: string;
  activo: boolean;
  onActivo: (v: boolean) => void;
  pedidosMesa: boolean;
  moneda: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const avisar = useToast();
  const [conectado, setConectado] = useState<boolean | null>(null);
  const [servidor, setServidor] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    supabase
      .rpc("cobro_online_conectado", { p_restaurante: restauranteId })
      .then(({ data, error }) => setConectado(error ? null : Boolean(data)));
    fetch("/api/pagos/crear")
      .then((r) => r.json())
      .then((d: { listo?: boolean }) => setServidor(Boolean(d.listo)))
      .catch(() => setServidor(null));
  }, [supabase, restauranteId]);

  async function guardar(valor: string) {
    setGuardando(true);
    const { data, error } = await supabase.rpc("guardar_cobro_online", { p_restaurante: restauranteId, p_token: valor });
    setGuardando(false);
    if (error) {
      return avisar(
        /guardar_cobro_online/.test(error.message) ? "Falta ejecutar el SQL 0009 en Supabase." : mensajeError(error),
        "error",
      );
    }
    setConectado(Boolean(data));
    setToken("");
    avisar(data ? "Mercado Pago conectado" : "Mercado Pago desconectado");
    if (!data && activo) onActivo(false);
  }

  return (
    <section className="tarjeta space-y-4 p-5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Cobro online con Mercado Pago</h2>
          <p className="text-sm text-suave">
            El cliente paga la cuenta (o su parte, con propina) desde el QR. La plata va directo a tu cuenta de Mercado Pago y el
            pago queda anotado en la mesa.
          </p>
        </div>
        <Interruptor activo={activo} onChange={onActivo} etiqueta="Cobro online" />
      </div>
      {activo && !MONEDAS_MP.includes(moneda) && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Mercado Pago no cobra en {moneda}. Funciona con {MONEDAS_MP.join(", ")}: la moneda tiene que ser la de tu cuenta de
          Mercado Pago (en Chile, CLP).
        </p>
      )}
      {activo && !pedidosMesa && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Enciende también “Pedidos desde la mesa”: el botón de pago aparece en “Mi mesa”.
        </p>
      )}
      {servidor === false && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Falta un paso en Vercel: agregar la variable <code>SUPABASE_SERVICE_ROLE_KEY</code> (ver la guía).
        </p>
      )}
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${conectado ? "bg-emerald-500" : "bg-stone-300"}`} />
        {conectado === null ? "Revisando…" : conectado ? "Cuenta de Mercado Pago conectada" : "Sin conectar"}
        {conectado && (
          <button type="button" disabled={guardando} onClick={() => guardar("")} className="ml-auto text-red-600 hover:underline">
            Desconectar
          </button>
        )}
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (token.trim()) guardar(token.trim());
        }}
      >
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={conectado ? "Pegar otro Access Token para cambiarlo" : "APP_USR-…"}
          autoComplete="off"
          aria-label="Access Token de Mercado Pago"
          className="campo min-w-0 flex-1 py-2"
        />
        <button type="submit" className="boton-secundario" disabled={guardando || token.trim().length < 20}>
          {guardando ? "Guardando…" : "Conectar"}
        </button>
      </form>
      <p className="text-xs text-suave">
        Dónde está: en Mercado Pago Developers de tu país (en Chile, mercadopago.cl/developers) → Tus integraciones → crear una
        aplicación (Checkout Pro) → Credenciales de producción → Access Token. Empieza con APP_USR-.
      </p>
    </section>
  );
}

function ListaEditable({
  titulo,
  ayuda,
  items,
  onChange,
  ejemplo,
}: {
  titulo: string;
  ayuda: string;
  items: string[];
  onChange: (items: string[]) => void;
  ejemplo: string;
}) {
  const [nuevo, setNuevo] = useState("");
  return (
    <section className="tarjeta space-y-3 p-5">
      <div>
        <h2 className="font-semibold">{titulo}</h2>
        <p className="text-sm text-suave">{ayuda}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((m) => (
          <span key={m} className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm">
            {m}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x !== m))}
              className="flex h-6 w-6 items-center justify-center rounded-full text-suave hover:bg-stone-200 hover:text-tinta"
              aria-label={`Quitar ${m}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = nuevo.trim().slice(0, 30);
          if (t && !items.includes(t)) onChange([...items, t]);
          setNuevo("");
        }}
      >
        <input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          placeholder={ejemplo}
          className="campo max-w-xs py-2"
          maxLength={30}
        />
        <button type="submit" className="boton-secundario">
          Agregar
        </button>
      </form>
    </section>
  );
}

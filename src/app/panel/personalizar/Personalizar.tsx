"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { Interruptor } from "@/components/Interruptor";
import { AJUSTES_BASE, PERMITIDAS, SECCIONES, type Ajustes, type Modulo, type Seccion } from "@/lib/salon";
import { formatoPrecio, mensajeError } from "@/lib/utils";
import { revalidarCarta } from "../actions";

const MODULOS: { id: Modulo; titulo: string; ayuda: string }[] = [
  { id: "salon", titulo: "Salón y mesas", ayuda: "Plano por pisos, abrir mesas y tomar pedidos" },
  { id: "cocina", titulo: "Pantalla de cocina", ayuda: "Comandas en tiempo real para cocina y barra" },
  { id: "cobros", titulo: "Cobros", ayuda: "Cuenta dividida, propinas y medios de pago" },
  { id: "pedidos_mesa", titulo: "Pedidos desde la mesa", ayuda: "El cliente pide y pide la cuenta desde el QR" },
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
      equipo: false,
      sucursales: false,
      estadisticas: true,
    },
  },
  {
    titulo: "Café o local chico",
    ayuda: "Mesas, cocina y cobro, sin complicaciones",
    modulos: { salon: true, cocina: true, cobros: true, pedidos_mesa: true, equipo: true, sucursales: false, estadisticas: true },
  },
  {
    titulo: "Restaurante completo",
    ayuda: "Todo encendido",
    modulos: { salon: true, cocina: true, cobros: true, pedidos_mesa: true, equipo: true, sucursales: true, estadisticas: true },
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
        <h2 className="font-semibold">Empezar rápido</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {PERFILES.map((p) => (
            <button
              key={p.titulo}
              type="button"
              onClick={() => set({ modulos: { ...a.modulos, ...p.modulos } })}
              className="tarjeta p-4 text-left transition hover:border-marca"
            >
              <span className="block font-semibold">{p.titulo}</span>
              <span className="block text-sm text-suave">{p.ayuda}</span>
            </button>
          ))}
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
            ejemplo="Cuenta DNI"
          />
        </>
      )}

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

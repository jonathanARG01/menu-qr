"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useToast } from "@/components/Toast";
import { Icono } from "@/components/Icono";
import { regionDe, type Ajustes, type Cuenta } from "@/lib/salon";
import { formatoFecha } from "@/lib/region";
import { mensajeError } from "@/lib/utils";

export type ClienteResumen = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  nota: string | null;
  visitas: number;
  gastado: number;
  ultima_visita: string | null;
  reservas: number;
  no_vino: number;
  created_at: string;
};

// Premio por visitas: la visita que se está atendiendo es la número visitas + 1.
export function premioDe(c: Pick<ClienteResumen, "visitas">, ajustes: Ajustes, contandoEsta = true) {
  const cada = ajustes.clientes.premio_cada;
  if (!cada || cada < 2) return null;
  const numero = c.visitas + (contandoEsta ? 1 : 0);
  const faltan = (cada - (numero % cada)) % cada;
  return { toca: faltan === 0, faltan, numero, premio: ajustes.clientes.premio.trim() || "un premio" };
}

const soloDigitos = (t: string) => t.replace(/\D/g, "");

// En la ficha de la mesa: quién es el cliente (para contar sus visitas y avisar cuando le toca premio).
export function ClienteCuenta({
  supabase,
  cuenta,
  ajustes,
  formato,
  onCambio,
}: {
  supabase: SupabaseClient;
  cuenta: Cuenta;
  ajustes: Ajustes;
  formato: (n: number) => string;
  onCambio: () => unknown;
}) {
  const avisar = useToast();
  const [cliente, setCliente] = useState<ClienteResumen | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [falta, setFalta] = useState(false);

  useEffect(() => {
    if (!cuenta.cliente_id) return setCliente(null);
    supabase
      .from("clientes_resumen")
      .select("*")
      .eq("id", cuenta.cliente_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setFalta(true);
        setCliente((data as ClienteResumen | null) ?? null);
      });
  }, [supabase, cuenta.cliente_id]);

  async function elegir(id: string | null) {
    const { error } = await supabase.from("cuentas").update({ cliente_id: id }).eq("id", cuenta.id);
    if (error)
      return avisar(/cliente_id/.test(error.message) ? "Falta ejecutar el SQL 0014 en Supabase." : mensajeError(error), "error");
    setBuscando(false);
    onCambio();
  }

  if (falta || cuenta.cliente_id === undefined) return null;

  if (buscando)
    return (
      <BuscarCliente
        supabase={supabase}
        restauranteId={cuenta.restaurante_id}
        onElegir={elegir}
        onCancelar={() => setBuscando(false)}
      />
    );

  if (!cuenta.cliente_id || !cliente) {
    return (
      <button
        type="button"
        onClick={() => setBuscando(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-borde px-3 py-2 text-sm text-suave hover:border-marca hover:text-marca"
      >
        <Icono nombre="clientes" className="h-4 w-4" />
        Anotar cliente (para contar sus visitas)
      </button>
    );
  }

  const premio = premioDe(cliente, ajustes);
  const region = regionDe(ajustes);
  return (
    <div className="space-y-1.5 rounded-xl border border-borde p-3 text-sm">
      <div className="flex items-center gap-2">
        <Icono nombre="clientes" className="h-4 w-4 text-marca" />
        <span className="min-w-0 flex-1 truncate font-semibold">{cliente.nombre}</span>
        {cliente.visitas >= 3 && (
          <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-900">Frecuente</span>
        )}
        <button type="button" onClick={() => setBuscando(true)} className="text-xs text-suave hover:text-tinta">
          Cambiar
        </button>
        <button type="button" onClick={() => elegir(null)} className="text-xs text-suave hover:text-red-600">
          Quitar
        </button>
      </div>
      <p className="text-suave">
        {cliente.visitas === 0
          ? "Primera visita"
          : `${cliente.visitas} ${cliente.visitas === 1 ? "visita" : "visitas"} · ${formato(Number(cliente.gastado))} en total`}
        {cliente.ultima_visita
          ? ` · última el ${formatoFecha(cliente.ultima_visita, region, { day: "numeric", month: "short" })}`
          : ""}
      </p>
      {cliente.nota && <p className="rounded-lg bg-amber-50 px-2 py-1 text-amber-900">{cliente.nota}</p>}
      {premio?.toca ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-800">
          <Icono nombre="regalo" className="h-4 w-4" /> Es su visita {premio.numero}: le toca {premio.premio}
        </p>
      ) : (
        premio && (
          <p className="text-xs text-suave">
            Le faltan {premio.faltan} {premio.faltan === 1 ? "visita" : "visitas"} para {premio.premio}.
          </p>
        )
      )}
    </div>
  );
}

// Busca por nombre o teléfono; si no está, lo anota.
export function BuscarCliente({
  supabase,
  restauranteId,
  onElegir,
  onCancelar,
}: {
  supabase: SupabaseClient;
  restauranteId: string;
  onElegir: (id: string) => unknown;
  onCancelar: () => void;
}) {
  const avisar = useToast();
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<ClienteResumen[]>([]);
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) return setLista([]);
    const id = setTimeout(async () => {
      const digitos = soloDigitos(texto);
      const consulta = supabase.from("clientes_resumen").select("*").eq("restaurante_id", restauranteId);
      const { data } = await (
        digitos.length >= 3
          ? consulta.ilike("telefono_clave", `%${digitos.slice(-9)}%`)
          : consulta.ilike("nombre", `%${texto.replace(/[%_,()]/g, "")}%`)
      )
        .order("visitas", { ascending: false })
        .limit(6);
      setLista((data ?? []) as ClienteResumen[]);
    }, 250);
    return () => clearTimeout(id);
  }, [q, supabase, restauranteId]);

  const esTelefono = soloDigitos(q).length >= 6 && !/[a-z]/i.test(q);

  async function crear() {
    const nombre = esTelefono ? "" : q.trim();
    const tel = esTelefono ? q.trim() : telefono.trim();
    if (!nombre && !tel) return;
    const { data, error } = await supabase
      .from("clientes")
      .insert({ restaurante_id: restauranteId, nombre: nombre || "Cliente", telefono: tel || null })
      .select("id")
      .single();
    if (error) {
      return avisar(
        /duplicate|clientes_telefono/.test(error.message) ? "Ya hay un cliente con ese teléfono: búscalo." : mensajeError(error),
        "error",
      );
    }
    onElegir(data.id);
  }

  return (
    <div className="space-y-2 rounded-xl border border-marca/40 p-3">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Nombre o teléfono del cliente"
        className="campo py-2 text-sm"
      />
      {lista.length > 0 && (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {lista.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onElegir(c.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-stone-50"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{c.nombre}</span>
                <span className="text-xs text-suave">{c.telefono}</span>
                <span className="text-xs tabular-nums text-suave">{c.visitas} vis.</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && (
        <div className="flex flex-wrap items-center gap-2">
          {!esTelefono && (
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              type="tel"
              placeholder="Teléfono (opcional)"
              className="campo w-40 flex-1 py-1.5 text-sm"
            />
          )}
          <button type="button" onClick={crear} className="boton-secundario py-1.5 text-sm">
            + Anotar {esTelefono ? "este teléfono" : `“${q.trim().slice(0, 20)}”`}
          </button>
        </div>
      )}
      <button type="button" onClick={onCancelar} className="text-xs text-suave hover:text-tinta">
        Cancelar
      </button>
    </div>
  );
}

type Persona = { user_id: string; nombre: string; rol: string };
let cacheEquipo: { restaurante: string; lista: Persona[] } | null = null;

// Quién atiende la mesa (cuenta para los reportes por mesero). Se asigna solo a quien la abre o toma el primer pedido.
export function Atiende({ supabase, cuenta, onCambio }: { supabase: SupabaseClient; cuenta: Cuenta; onCambio: () => unknown }) {
  const avisar = useToast();
  const [equipo, setEquipo] = useState<Persona[]>(cacheEquipo?.restaurante === cuenta.restaurante_id ? cacheEquipo.lista : []);

  useEffect(() => {
    if (cacheEquipo?.restaurante === cuenta.restaurante_id) return;
    supabase.rpc("nombres_equipo", { p_restaurante: cuenta.restaurante_id }).then(({ data, error }) => {
      if (error) return;
      const lista = ((data ?? []) as Persona[]).filter((p) => p.rol !== "cocina");
      cacheEquipo = { restaurante: cuenta.restaurante_id, lista };
      setEquipo(lista);
    });
  }, [supabase, cuenta.restaurante_id]);

  if (cuenta.mesero_id === undefined || equipo.length < 2) return null;

  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-suave">Atiende</span>
      <select
        value={cuenta.mesero_id ?? ""}
        onChange={async (e) => {
          const { error } = await supabase
            .from("cuentas")
            .update({ mesero_id: e.target.value || null })
            .eq("id", cuenta.id);
          if (error) return avisar(mensajeError(error), "error");
          onCambio();
        }}
        className="campo w-auto py-1.5 text-sm"
      >
        <option value="">Sin asignar</option>
        {equipo.map((p) => (
          <option key={p.user_id} value={p.user_id}>
            {p.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

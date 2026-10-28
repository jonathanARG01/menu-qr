"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IDIOMAS_EXTRA, texto, type ClaveTexto, type Idioma } from "@/lib/i18n";
import type { Plato, Restaurante, Seccion, Sucursal } from "@/lib/types";
import { leerAjustes, type Ajustes, type OpcionElegida } from "@/lib/salon";
import { claveLinea, extraOpciones } from "@/lib/opciones";

// Una línea del pedido: un plato con sus opciones (el mismo plato con otras opciones va en otra línea).
export type Linea = { clave: string; plato: Plato; cantidad: number; opciones: OpcionElegida[]; precio: number };
type Guardada = { platoId: string; cantidad: number; opciones: OpcionElegida[] };

type Valor = {
  idioma: Idioma;
  idiomas: Idioma[];
  setIdioma: (idioma: Idioma) => void;
  t: (clave: ClaveTexto) => string;
  // Pedidos: por WhatsApp o directo a la cocina desde la mesa
  pedidos: boolean;
  whatsapp: boolean;
  // El cliente está en una mesa (vino del QR) y el restaurante recibe pedidos desde la mesa.
  pedidosMesa: boolean;
  // Sin mesa: el restaurante recibe pedidos para llevar (o delivery) desde la carta.
  pedidosLlevar: boolean;
  ajustes: Ajustes;
  moneda: string;
  lineas: Linea[];
  cantidad: (platoId: string) => number;
  cambiar: (platoId: string, delta: number) => void;
  cambiarLinea: (clave: string, delta: number) => void;
  agregar: (platoId: string, opciones: OpcionElegida[]) => void;
  vaciar: () => void;
  // Datos que llegan en el enlace del QR (?mesa=4&s=centro). Si el número de mesa se repite en otro piso,
  // el QR trae el id de la mesa (?mesa=<id>&n=4): mesa es lo que se manda a la base y mesaNombre lo que se muestra.
  mesa: string | null;
  mesaNombre: string | null;
  sucursales: Sucursal[];
  sucursal: Sucursal | null;
  setSucursal: (sucursal: Sucursal | null) => void;
  registrarPedido: (total: number) => void;
};

const Ctx = createContext<Valor>({
  idioma: "es",
  idiomas: ["es"],
  setIdioma: () => {},
  t: (clave) => texto("es", clave),
  pedidos: false,
  whatsapp: false,
  pedidosMesa: false,
  pedidosLlevar: false,
  ajustes: leerAjustes(),
  moneda: "CLP",
  lineas: [],
  cantidad: () => 0,
  cambiar: () => {},
  cambiarLinea: () => {},
  agregar: () => {},
  vaciar: () => {},
  mesa: null,
  mesaNombre: null,
  sucursales: [],
  sucursal: null,
  setSucursal: () => {},
  registrarPedido: () => {},
});

export const useCarta = () => useContext(Ctx);

const leer = (clave: string) => {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
};
const guardar = (clave: string, valor: string) => {
  try {
    localStorage.setItem(clave, valor);
  } catch {}
};

export function ProveedorCarta({
  restaurante,
  secciones,
  sucursales = [],
  vistaPrevia,
  children,
}: {
  restaurante: Restaurante;
  secciones: Seccion[];
  sucursales?: Sucursal[];
  vistaPrevia?: boolean;
  children: React.ReactNode;
}) {
  const idiomas = useMemo<Idioma[]>(
    () => ["es", ...IDIOMAS_EXTRA.filter((i) => restaurante.idiomas?.includes(i))],
    [restaurante.idiomas],
  );
  const [idioma, setIdiomaEstado] = useState<Idioma>("es");
  const [mesa, setMesa] = useState<string | null>(null);
  const [mesaNombre, setMesaNombre] = useState<string | null>(null);
  const [sucursal, setSucursal] = useState<Sucursal | null>(sucursales.length === 1 ? sucursales[0] : null);
  const [cantidades, setCantidades] = useState<Record<string, Guardada>>({});

  // Idioma: el último elegido en este teléfono, si no el del navegador, si no español.
  useEffect(() => {
    const guardado = leer("carta:idioma") as Idioma | null;
    const delNavegador = navigator.languages.map((l) => l.slice(0, 2).toLowerCase() as Idioma);
    const elegido = [guardado, ...delNavegador].find((i): i is Idioma => !!i && idiomas.includes(i));
    if (elegido) setIdiomaEstado(elegido);
  }, [idiomas]);

  useEffect(() => {
    if (!vistaPrevia) document.documentElement.lang = idioma;
  }, [idioma, vistaPrevia]);

  const setIdioma = useCallback((nuevo: Idioma) => {
    setIdiomaEstado(nuevo);
    guardar("carta:idioma", nuevo);
  }, []);

  // Mesa y sucursal se leen del enlace al montar: así la página sigue sirviéndose desde caché.
  // También se registra la visita, una vez por sesión del navegador.
  useEffect(() => {
    if (vistaPrevia) return;
    const params = new URLSearchParams(window.location.search);
    const numeroMesa = params.get("mesa")?.slice(0, 36) || null;
    const nombreMesa = params.get("n")?.slice(0, 12) || (numeroMesa && numeroMesa.length <= 12 ? numeroMesa : null);
    const deEnlace = sucursales.find((s) => s.slug === params.get("s")) ?? null;
    setMesa(numeroMesa);
    setMesaNombre(nombreMesa);
    if (deEnlace) setSucursal(deEnlace);

    const clave = `carta:visita:${restaurante.id}:${numeroMesa ?? ""}:${deEnlace?.id ?? ""}`;
    try {
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, "1");
    } catch {}
    createClient()
      .rpc("registrar_evento", {
        p_restaurante: restaurante.id,
        p_tipo: "visita",
        p_sucursal: deEnlace?.id ?? (sucursales.length === 1 ? sucursales[0].id : null),
        p_mesa: nombreMesa,
        p_idioma: (leer("carta:idioma") ?? navigator.language).slice(0, 2),
      })
      .then(
        () => {},
        () => {},
      );
  }, [restaurante.id, sucursales, vistaPrevia]);

  const platos = useMemo(() => new Map(secciones.flatMap((s) => s.platos).map((p) => [p.id, p])), [secciones]);
  const lineas = useMemo<Linea[]>(
    () =>
      Object.entries(cantidades)
        .filter(([, g]) => g.cantidad > 0 && platos.has(g.platoId))
        .map(([clave, g]) => {
          const plato = platos.get(g.platoId)!;
          return { clave, plato, cantidad: g.cantidad, opciones: g.opciones, precio: Number(plato.precio) + extraOpciones(g.opciones) };
        }),
    [cantidades, platos],
  );

  const cambiarLinea = useCallback((clave: string, delta: number) => {
    setCantidades((actual) => {
      const g = actual[clave];
      if (!g) return actual;
      return { ...actual, [clave]: { ...g, cantidad: Math.min(99, Math.max(0, g.cantidad + delta)) } };
    });
  }, []);

  const agregar = useCallback((platoId: string, opciones: OpcionElegida[]) => {
    const clave = claveLinea(platoId, opciones);
    setCantidades((actual) => ({
      ...actual,
      [clave]: { platoId, opciones, cantidad: Math.min(99, (actual[clave]?.cantidad ?? 0) + 1) },
    }));
  }, []);

  // Sin opciones: suma o resta del plato. Con opciones, restar quita de la última línea de ese plato.
  const cambiar = useCallback(
    (platoId: string, delta: number) => {
      if (delta > 0) return agregar(platoId, []);
      setCantidades((actual) => {
        const clave = Object.keys(actual)
          .filter((c) => actual[c].platoId === platoId && actual[c].cantidad > 0)
          .pop();
        if (!clave) return actual;
        return { ...actual, [clave]: { ...actual[clave], cantidad: Math.max(0, actual[clave].cantidad + delta) } };
      });
    },
    [agregar],
  );

  const numeroWhatsapp = sucursal?.whatsapp || restaurante.whatsapp || sucursales.find((s) => s.whatsapp)?.whatsapp;
  const whatsapp = Boolean(restaurante.pedidos_whatsapp && numeroWhatsapp);
  const ajustes = useMemo(() => leerAjustes(restaurante.ajustes), [restaurante.ajustes]);
  const pedidosMesa = Boolean(ajustes.modulos.pedidos_mesa && mesa);
  const pedidosLlevar = Boolean(!mesa && !vistaPrevia && ajustes.modulos.llevar && ajustes.llevar.online);
  const pedidos = whatsapp || pedidosMesa || pedidosLlevar;

  const registrarPedido = useCallback(
    (total: number) => {
      createClient()
        .rpc("registrar_evento", {
          p_restaurante: restaurante.id,
          p_tipo: "pedido",
          p_sucursal: sucursal?.id ?? null,
          p_mesa: mesaNombre,
          p_idioma: idioma,
          p_total: total,
          p_detalle: lineas.map((l) => ({ id: l.plato.id, nombre: l.plato.nombre, cantidad: l.cantidad })),
        })
        .then(
          () => {},
          () => {},
        );
    },
    [restaurante.id, sucursal, mesaNombre, idioma, lineas],
  );

  const valor: Valor = {
    idioma,
    idiomas,
    setIdioma,
    t: (clave) => texto(idioma, clave),
    pedidos,
    whatsapp,
    pedidosMesa,
    pedidosLlevar,
    ajustes,
    moneda: restaurante.moneda,
    lineas,
    cantidad: (id) => Object.values(cantidades).reduce((n, g) => (g.platoId === id ? n + g.cantidad : n), 0),
    cambiar,
    cambiarLinea,
    agregar,
    vaciar: () => setCantidades({}),
    mesa,
    mesaNombre,
    sucursales,
    sucursal,
    setSucursal,
    registrarPedido,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IDIOMAS_EXTRA, texto, type ClaveTexto, type Idioma } from "@/lib/i18n";
import type { Plato, Restaurante, Seccion, Sucursal } from "@/lib/types";
import { leerAjustes, type Ajustes } from "@/lib/salon";

type Linea = { plato: Plato; cantidad: number };

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
  ajustes: Ajustes;
  lineas: Linea[];
  cantidad: (platoId: string) => number;
  cambiar: (platoId: string, delta: number) => void;
  vaciar: () => void;
  // Datos que llegan en el enlace del QR (?mesa=4&s=centro)
  mesa: string | null;
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
  ajustes: leerAjustes(),
  lineas: [],
  cantidad: () => 0,
  cambiar: () => {},
  vaciar: () => {},
  mesa: null,
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
  const [sucursal, setSucursal] = useState<Sucursal | null>(sucursales.length === 1 ? sucursales[0] : null);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

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
    const numeroMesa = params.get("mesa")?.slice(0, 12) || null;
    const deEnlace = sucursales.find((s) => s.slug === params.get("s")) ?? null;
    setMesa(numeroMesa);
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
        p_mesa: numeroMesa,
        p_idioma: (leer("carta:idioma") ?? navigator.language).slice(0, 2),
      })
      .then(
        () => {},
        () => {},
      );
  }, [restaurante.id, sucursales, vistaPrevia]);

  const platos = useMemo(() => new Map(secciones.flatMap((s) => s.platos).map((p) => [p.id, p])), [secciones]);
  const lineas = useMemo(
    () =>
      Object.entries(cantidades)
        .filter(([id, n]) => n > 0 && platos.has(id))
        .map(([id, n]) => ({ plato: platos.get(id)!, cantidad: n })),
    [cantidades, platos],
  );

  const cambiar = useCallback((platoId: string, delta: number) => {
    setCantidades((actual) => ({ ...actual, [platoId]: Math.min(99, Math.max(0, (actual[platoId] ?? 0) + delta)) }));
  }, []);

  const numeroWhatsapp = sucursal?.whatsapp || restaurante.whatsapp || sucursales.find((s) => s.whatsapp)?.whatsapp;
  const whatsapp = Boolean(restaurante.pedidos_whatsapp && numeroWhatsapp);
  const ajustes = useMemo(() => leerAjustes(restaurante.ajustes), [restaurante.ajustes]);
  const pedidosMesa = Boolean(ajustes.modulos.pedidos_mesa && mesa);
  const pedidos = whatsapp || pedidosMesa;

  const registrarPedido = useCallback(
    (total: number) => {
      createClient()
        .rpc("registrar_evento", {
          p_restaurante: restaurante.id,
          p_tipo: "pedido",
          p_sucursal: sucursal?.id ?? null,
          p_mesa: mesa,
          p_idioma: idioma,
          p_total: total,
          p_detalle: lineas.map((l) => ({ id: l.plato.id, nombre: l.plato.nombre, cantidad: l.cantidad })),
        })
        .then(
          () => {},
          () => {},
        );
    },
    [restaurante.id, sucursal, mesa, idioma, lineas],
  );

  const valor: Valor = {
    idioma,
    idiomas,
    setIdioma,
    t: (clave) => texto(idioma, clave),
    pedidos,
    whatsapp,
    pedidosMesa,
    ajustes,
    lineas,
    cantidad: (id) => cantidades[id] ?? 0,
    cambiar,
    vaciar: () => setCantidades({}),
    mesa,
    sucursales,
    sucursal,
    setSucursal,
    registrarPedido,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

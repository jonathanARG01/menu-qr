"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sonar } from "@/lib/sonidos";
import type { Restaurante, Sucursal } from "@/lib/types";
import { BOTON, CAMPO, ESTILO_BOTON, Marco, useSucursal, useTextos } from "./Marco";

type Estado = {
  nombre: string;
  personas: number;
  estado: "pendiente" | "avisada" | "sentada" | "cancelada" | "no_vino" | "confirmada";
  avisada_at: string | null;
  desde: string;
  delante: number;
};

// Lista de espera desde el QR de la entrada: el cliente se anota, ve cuántos grupos tiene delante
// y el teléfono suena y vibra cuando el restaurante lo llama.
export function EsperaCliente({ restaurante, sucursales }: { restaurante: Restaurante; sucursales: Sucursal[] }) {
  const t = useTextos(restaurante);
  const supabase = useRef(createClient()).current;
  const clave = `espera:${restaurante.id}`;
  const [sucursal, setSucursal] = useSucursal(sucursales);
  const [id, setId] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [personas, setPersonas] = useState(2);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const avisado = useRef(false);

  useEffect(() => {
    try {
      setId(localStorage.getItem(clave));
    } catch {}
  }, [clave]);

  const consultar = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.rpc("estado_espera", { p_id: id });
    const e = data as Estado | null;
    if (!e) {
      setId(null);
      try {
        localStorage.removeItem(clave);
      } catch {}
      return;
    }
    setEstado(e);
    setAhora(Date.now());
    if (e.estado === "avisada" && !avisado.current) {
      avisado.current = true;
      sonar("mozo");
      navigator.vibrate?.([300, 150, 300, 150, 300]);
    }
    if (e.estado !== "pendiente" && e.estado !== "avisada") {
      try {
        localStorage.removeItem(clave);
      } catch {}
    }
  }, [id, supabase, clave]);

  useEffect(() => {
    if (!id) return;
    consultar();
    const intervalo = setInterval(consultar, 10000);
    const alVolver = () => document.visibilityState === "visible" && consultar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [id, consultar]);

  async function anotarme(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { data, error } = await supabase.rpc("anotarse_espera", {
      p_restaurante: restaurante.id,
      p_sucursal: sucursal?.id ?? null,
      p_nombre: nombre,
      p_telefono: telefono || null,
      p_personas: personas,
    });
    setEnviando(false);
    if (error || !data) return setError(error?.message ?? t("errorEnvio"));
    try {
      localStorage.setItem(clave, data as string);
    } catch {}
    avisado.current = false;
    setId(data as string);
  }

  async function salir() {
    if (!id) return;
    await supabase.rpc("salir_espera", { p_id: id });
    consultar();
  }

  if (id && estado) {
    const minutos = Math.max(0, Math.round((ahora - Date.parse(estado.desde)) / 60000));
    const final =
      estado.estado === "sentada"
        ? t("esperaSentada")
        : estado.estado === "cancelada" || estado.estado === "no_vino"
          ? t("esperaFuera")
          : null;
    return (
      <Marco restaurante={restaurante} titulo={t("esperaTitulo")}>
        {final ? (
          <p className="text-lg">{final}</p>
        ) : estado.estado === "avisada" ? (
          <div className="aviso-entrada rounded-2xl bg-emerald-600 p-6 text-center text-white">
            <p className="text-5xl">🔔</p>
            <p className="mt-2 text-2xl font-bold">{t("esperaAvisada")}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-7xl font-black tabular-nums" style={{ color: "var(--acento)" }}>
              {estado.delante === 0 ? "1º" : estado.delante}
            </p>
            <p className="mt-1 text-lg font-semibold">{estado.delante === 0 ? t("esperaPrimero") : t("esperaDelante")}</p>
          </div>
        )}
        <p className="mt-5 text-center text-sm text-stone-500">
          {estado.nombre} · {estado.personas} {t("personas").toLowerCase()} · {t("esperaTiempo")} {minutos} min
        </p>
        {!final && (
          <button type="button" onClick={salir} className="mt-6 w-full text-sm text-stone-500 underline">
            {t("esperaSalir")}
          </button>
        )}
        {final && (
          <button
            type="button"
            onClick={() => {
              setId(null);
              setEstado(null);
            }}
            className={`${BOTON} mt-6`}
            style={ESTILO_BOTON}
          >
            {t("esperaAnotarme")}
          </button>
        )}
      </Marco>
    );
  }

  return (
    <Marco restaurante={restaurante} titulo={t("esperaTitulo")}>
      <p className="-mt-2 mb-4 text-stone-600">{t("esperaAyuda")}</p>
      <form onSubmit={anotarme} className="space-y-3">
        {sucursales.length > 1 && (
          <label className="block text-sm font-medium">
            {t("sucursal")}
            <select
              required
              value={sucursal?.id ?? ""}
              onChange={(e) => setSucursal(sucursales.find((s) => s.id === e.target.value) ?? null)}
              className={CAMPO}
            >
              <option value="" disabled>
                {t("elegirSucursal")}
              </option>
              {sucursales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm font-medium">
          {t("nombreYApellido")}
          <input
            required
            maxLength={60}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="given-name"
            className={CAMPO}
          />
        </label>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <label className="block text-sm font-medium">
            {t("telefono")} <span className="font-normal text-stone-400">({t("opcional")})</span>
            <input
              type="tel"
              maxLength={30}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              autoComplete="tel"
              className={CAMPO}
            />
          </label>
          <label className="block text-sm font-medium">
            {t("personas")}
            <input
              type="number"
              min={1}
              max={99}
              value={personas}
              onChange={(e) => setPersonas(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className={CAMPO}
            />
          </label>
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={enviando || (sucursales.length > 1 && !sucursal)} className={BOTON} style={ESTILO_BOTON}>
          {enviando ? t("cargando") : t("esperaAnotarme")}
        </button>
      </form>
    </Marco>
  );
}

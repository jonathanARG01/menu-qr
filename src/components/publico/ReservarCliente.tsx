"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Restaurante, Sucursal } from "@/lib/types";
import { BOTON, CAMPO, ESTILO_BOTON, Marco, useSucursal, useTextos } from "./Marco";

const manana = () => {
  const d = new Date(Date.now() + 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Pedir una reserva desde internet. Queda "por confirmar" y el restaurante la confirma por WhatsApp.
export function ReservarCliente({ restaurante, sucursales }: { restaurante: Restaurante; sucursales: Sucursal[] }) {
  const t = useTextos(restaurante);
  const [sucursal, setSucursal] = useSucursal(sucursales);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [personas, setPersonas] = useState(2);
  const [dia, setDia] = useState(manana);
  const [hora, setHora] = useState("21:00");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const falta = sucursales.length > 1 && !sucursal;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { error } = await createClient().rpc("reservar", {
      p_restaurante: restaurante.id,
      p_sucursal: sucursal?.id ?? null,
      p_nombre: nombre,
      p_telefono: telefono,
      p_personas: personas,
      p_fecha: new Date(`${dia}T${hora}`).toISOString(),
      p_nota: nota || null,
    });
    setEnviando(false);
    if (error) return setError(error.message);
    setListo(true);
  }

  if (listo) {
    return (
      <Marco restaurante={restaurante} titulo={t("reservar")}>
        <p className="text-5xl">✅</p>
        <p className="mt-3 text-lg">{t("reservaEnviada")}</p>
        <a href={`/${restaurante.slug}`} className={`${BOTON} mt-6 block text-center`} style={ESTILO_BOTON}>
          {t("verCarta")}
        </a>
      </Marco>
    );
  }

  return (
    <Marco restaurante={restaurante} titulo={t("reservar")}>
      <p className="-mt-2 mb-4 text-stone-600">{t("reservaAyuda")}</p>
      <form onSubmit={enviar} className="space-y-3">
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
            autoComplete="name"
            className={CAMPO}
          />
        </label>
        <label className="block text-sm font-medium">
          {t("telefono")}
          <input
            required
            type="tel"
            maxLength={30}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            autoComplete="tel"
            className={CAMPO}
          />
        </label>
        <div className="grid grid-cols-3 gap-3">
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
          <label className="block text-sm font-medium">
            {t("dia")}
            <input type="date" required value={dia} onChange={(e) => setDia(e.target.value)} className={CAMPO} />
          </label>
          <label className="block text-sm font-medium">
            {t("hora")}
            <input type="time" required step={900} value={hora} onChange={(e) => setHora(e.target.value)} className={CAMPO} />
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t("comentario")}
          <input maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} className={CAMPO} />
        </label>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={enviando || falta} className={BOTON} style={ESTILO_BOTON}>
          {enviando ? t("cargando") : t("reservar")}
        </button>
      </form>
    </Marco>
  );
}

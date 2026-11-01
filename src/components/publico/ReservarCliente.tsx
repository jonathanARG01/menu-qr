"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Restaurante, Sucursal } from "@/lib/types";
import { leerAjustes } from "@/lib/salon";
import { numeroWhatsapp, paisDe } from "@/lib/region";
import { BOTON, CAMPO, ESTILO_BOTON, Marco, useSucursal, useTextos } from "./Marco";

const manana = () => {
  const d = new Date(Date.now() + 86400000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

// Horas cada 15 minutos en formato 24 h (igual que el reloj del celular). Un select en vez de <input type="time">:
// en Android el campo nativo se cortaba ("07:3…") y mostraba AM/PM distinto al selector.
const HORAS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

// Pedir una reserva desde internet. Queda "por confirmar" y el restaurante la confirma por WhatsApp.
export function ReservarCliente({ restaurante, sucursales }: { restaurante: Restaurante; sucursales: Sucursal[] }) {
  const t = useTextos(restaurante);
  const [sucursal, setSucursal] = useSucursal(sucursales);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  // Texto libre para poder borrar y escribir otro número sin pelear con el valor anterior.
  const [personas, setPersonas] = useState("2");
  const [dia, setDia] = useState(manana);
  const [hora, setHora] = useState("21:00");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const falta = sucursales.length > 1 && !sucursal;
  const cantidad = Math.max(1, Math.min(99, Number(personas) || 1));
  const whatsapp = sucursal?.whatsapp || restaurante.whatsapp;
  const enlaceWhatsapp = whatsapp
    ? `https://wa.me/${numeroWhatsapp(whatsapp, paisDe(leerAjustes(restaurante.ajustes).pais))}?text=${encodeURIComponent(
        `Hola ${restaurante.nombre}, quiero reservar una mesa para ${cantidad} ${cantidad === 1 ? "persona" : "personas"} el ${dia
          .split("-")
          .reverse()
          .join("/")} a las ${hora}.${nombre.trim() ? ` A nombre de ${nombre.trim()}.` : ""}${nota.trim() ? ` ${nota.trim()}` : ""}`,
      )}`
    : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { data, error } = await createClient().rpc("reservar", {
      p_restaurante: restaurante.id,
      p_sucursal: sucursal?.id ?? null,
      p_nombre: nombre,
      p_telefono: telefono,
      p_personas: cantidad,
      p_fecha: new Date(`${dia}T${hora}`).toISOString(),
      p_nota: nota || null,
    });
    setEnviando(false);
    if (error) return setError(error.message);
    setListo(String(data));
  }

  if (listo) {
    return (
      <Marco restaurante={restaurante} titulo={t("reservar")}>
        <p className="text-5xl">✅</p>
        <p className="mt-3 text-lg">{t("reservaEnviada")}</p>
        <a href={`/${restaurante.slug}/reserva/${listo}`} className={`${BOTON} mt-6 block text-center`} style={ESTILO_BOTON}>
          {t("verReserva")}
        </a>
        <a href={`/${restaurante.slug}`} className="mt-3 block text-center text-sm text-stone-500 hover:underline">
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
        {/* En celular: Personas arriba y Día + Hora lado a lado con espacio, para que la fecha no se corte. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[5.5rem_1fr_1fr]">
          <label className="col-span-2 block text-sm font-medium sm:col-span-1">
            {t("personas")}
            <input
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={99}
              value={personas}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setPersonas(e.target.value.replace(/\D/g, "").slice(0, 2))}
              onBlur={() => setPersonas(String(cantidad))}
              className={CAMPO}
            />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            {t("dia")}
            <input
              type="date"
              required
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              className={`${CAMPO} min-w-0 appearance-none px-2.5`}
            />
          </label>
          <label className="block min-w-0 text-sm font-medium">
            {t("hora")}
            <select required value={hora} onChange={(e) => setHora(e.target.value)} className={`${CAMPO} min-w-0 px-2.5`}>
              {HORAS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          {t("comentario")}
          <input maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} className={CAMPO} />
        </label>
        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{error}</p>
            {enlaceWhatsapp && (
              <a
                href={enlaceWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block w-full rounded-xl bg-[#25d366] px-4 py-2.5 text-center font-semibold text-white"
              >
                {t("escribir")}
              </a>
            )}
          </div>
        )}
        <button type="submit" disabled={enviando || falta} className={BOTON} style={ESTILO_BOTON}>
          {enviando ? t("cargando") : t("reservar")}
        </button>
      </form>
    </Marco>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Restaurante, Sucursal } from "@/lib/types";
import { horasTurno, leerAjustes } from "@/lib/salon";
import { numeroWhatsapp, paisDe } from "@/lib/region";
import { BOTON, CAMPO, ESTILO_BOTON, Marco, useSucursal, useTextos } from "./Marco";

// Día y hora de ahora en la zona horaria del local ("2026-11-12", "19:45"), no la del celular del cliente.
function ahoraEn(zona: string, sumarDias = 0) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(Date.now() + sumarDias * 86400000))
      .map((p) => [p.type, p.value]),
  );
  return { dia: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

// 0 = domingo … 6 = sábado, del día elegido (sin pasar por la zona horaria del celular).
const diaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();

// Horas cada 15 minutos en formato 24 h (igual que el reloj del celular). Un select en vez de <input type="time">:
// en Android el campo nativo se cortaba ("07:3…") y mostraba AM/PM distinto al selector.
const HORAS = Array.from(
  { length: 96 },
  (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
);

// Pedir una reserva desde internet. Queda "por confirmar" y el restaurante la confirma por WhatsApp.
export function ReservarCliente({ restaurante, sucursales }: { restaurante: Restaurante; sucursales: Sucursal[] }) {
  const t = useTextos(restaurante);
  const ajustes = leerAjustes(restaurante.ajustes);
  const config = ajustes.reservas;
  const zona = ajustes.zona_horaria;
  const [sucursal, setSucursal] = useSucursal(sucursales);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  // Texto libre para poder borrar y escribir otro número sin pelear con el valor anterior.
  const [personas, setPersonas] = useState("2");
  const [ninos, setNinos] = useState("0");
  const [dia, setDia] = useState(() => ahoraEn(zona, 1).dia);
  const [hora, setHora] = useState(config.turnos.length ? "" : "21:00");
  const [ubicacion, setUbicacion] = useState("");
  const [nota, setNota] = useState("");
  // Lugares que quedan en cada turno del día elegido (null = sin tope), en el mismo orden que config.turnos.
  const [cupos, setCupos] = useState<(number | null)[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hoy = ahoraEn(zona).dia;
  const adultos = Math.max(1, Math.min(99, Number(personas) || 1));
  const menores = config.ninos ? Math.max(0, Math.min(99 - adultos, Number(ninos) || 0)) : 0;
  const cantidad = adultos + menores;
  const conTurnos = config.turnos.length > 0;
  const idSucursal = sucursal?.id ?? null;

  useEffect(() => {
    if (!conTurnos || !dia) return;
    let vigente = true;
    createClient()
      .rpc("cupos_reserva", { p_restaurante: restaurante.id, p_dia: dia, p_sucursal: idSucursal })
      .then(({ data }) => vigente && setCupos(Array.isArray(data) ? (data as (number | null)[]) : []));
    return () => {
      vigente = false;
    };
  }, [conTurnos, dia, idSucursal, restaurante.id]);

  // Turnos del día elegido, con sus horarios (sin los que ya pasaron si es hoy) y si están completos.
  const turnosDelDia = useMemo(() => {
    if (!conTurnos) return [];
    const ahora = ahoraEn(zona);
    return config.turnos
      .map((turno, i) => ({ turno, quedan: cupos[i] ?? null }))
      .filter(({ turno }) => turno.dias.length === 0 || turno.dias.includes(diaSemana(dia)))
      .map(({ turno, quedan }) => ({
        nombre: turno.nombre,
        horas: horasTurno(turno).filter((h) => dia > ahora.dia || (dia === ahora.dia && h > ahora.hora)),
        completo: quedan !== null && quedan < cantidad,
      }))
      .filter((x) => x.horas.length > 0);
  }, [conTurnos, config.turnos, cupos, dia, zona, cantidad]);
  const horaValida = !conTurnos || turnosDelDia.some((x) => !x.completo && x.horas.includes(hora));

  const falta = (sucursales.length > 1 && !sucursal) || !horaValida || (config.ubicaciones.length > 0 && !ubicacion) || !dia;
  const whatsapp = sucursal?.whatsapp || restaurante.whatsapp;
  const detalle = [
    config.ninos && menores > 0 ? `(${adultos} adultos y ${menores} niños)` : "",
    ubicacion ? `Ubicación: ${ubicacion}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const enlaceWhatsapp = whatsapp
    ? `https://wa.me/${numeroWhatsapp(whatsapp, paisDe(ajustes.pais))}?text=${encodeURIComponent(
        `Hola ${restaurante.nombre}, quiero reservar una mesa para ${cantidad} ${cantidad === 1 ? "persona" : "personas"} el ${dia
          .split("-")
          .reverse()
          .join(
            "/",
          )}${hora ? ` a las ${hora}` : ""}.${detalle ? ` ${detalle}` : ""}${nombre.trim() ? ` A nombre de ${nombre.trim()}.` : ""}${nota.trim() ? ` ${nota.trim()}` : ""}`,
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
      p_nota: nota || null,
      p_dia: dia,
      p_hora: hora,
      p_ninos: menores,
      p_ubicacion: ubicacion || null,
      p_correo: correo.trim() || null,
    });
    setEnviando(false);
    if (error) {
      // Los dos errores más comunes, en el idioma del cliente; el resto tal cual llega.
      if (/completo/i.test(error.message)) setError(t("horarioCompleto"));
      else if (/no está disponible/i.test(error.message)) setError(t("horarioNoDisponible"));
      else setError(error.message);
      return;
    }
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
        {config.correo !== "no" && (
          <label className="block text-sm font-medium">
            {t("correo")} {config.correo === "opcional" && <span className="font-normal text-stone-500">({t("opcional")})</span>}
            <input
              type="email"
              required={config.correo === "obligatorio"}
              maxLength={120}
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              autoComplete="email"
              className={CAMPO}
            />
          </label>
        )}
        {/* En celular: Personas (o Adultos + Niños) arriba y Día + Hora lado a lado, para que la fecha no se corte. */}
        <div
          className={`grid grid-cols-2 gap-3 ${conTurnos ? "" : config.ninos ? "sm:grid-cols-4" : "sm:grid-cols-[5.5rem_1fr_1fr]"}`}
        >
          <label className={`block text-sm font-medium ${config.ninos ? "" : "col-span-2 sm:col-span-1"}`}>
            {config.ninos ? t("adultos") : t("personas")}
            <input
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={99}
              value={personas}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setPersonas(e.target.value.replace(/\D/g, "").slice(0, 2))}
              onBlur={() => setPersonas(String(adultos))}
              className={CAMPO}
            />
          </label>
          {config.ninos && (
            <label className="block text-sm font-medium">
              {t("ninos")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={98}
                value={ninos}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNinos(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={() => setNinos(String(menores))}
                className={CAMPO}
              />
            </label>
          )}
          <label className={`block min-w-0 text-sm font-medium ${conTurnos ? "col-span-2" : ""}`}>
            {t("dia")}
            <input
              type="date"
              required
              min={hoy}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              className={`${CAMPO} min-w-0 appearance-none px-2.5`}
            />
          </label>
          {!conTurnos && (
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
          )}
        </div>
        {conTurnos && (
          <fieldset>
            <legend className="text-sm font-medium">{t("elegirHorario")}</legend>
            {turnosDelDia.length === 0 ? (
              <p className="mt-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("diaSinReservas")}</p>
            ) : (
              turnosDelDia.map((x) => (
                <div key={x.nombre} className="mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {x.nombre}
                    {x.completo && <span className="ml-2 text-red-700">· {t("completo")}</span>}
                  </p>
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    {x.horas.map((h) => {
                      const elegida = hora === h;
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={x.completo}
                          aria-pressed={elegida}
                          onClick={() => setHora(h)}
                          className={`rounded-xl px-1 py-2 text-sm font-semibold tabular-nums ring-1 disabled:opacity-40 ${
                            elegida ? "ring-transparent" : "bg-white ring-stone-300"
                          }`}
                          style={elegida ? ESTILO_BOTON : undefined}
                        >
                          {h}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </fieldset>
        )}
        {config.ubicaciones.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium">{t("ubicacion")}</legend>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {config.ubicaciones.map((u) => {
                const elegida = ubicacion === u;
                return (
                  <button
                    key={u}
                    type="button"
                    aria-pressed={elegida}
                    onClick={() => setUbicacion(u)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ${elegida ? "ring-transparent" : "bg-white ring-stone-300"}`}
                    style={elegida ? ESTILO_BOTON : undefined}
                  >
                    {u}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
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
        {config.mostrar_tolerancia && (
          <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700">
            ⏱ {t("toleranciaAviso").replace("{n}", String(config.tolerancia))}
          </p>
        )}
        <button type="submit" disabled={enviando || falta} className={BOTON} style={ESTILO_BOTON}>
          {enviando ? t("cargando") : t("reservar")}
        </button>
      </form>
    </Marco>
  );
}

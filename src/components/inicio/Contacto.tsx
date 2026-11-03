"use client";

import { useState } from "react";
import { Icono } from "@/components/Icono";

type Estado = "listo" | "enviando" | "enviado" | "error";

const CAMPO =
  "w-full rounded-2xl border border-sitio-borde bg-sitio-vidrio px-4 py-3 text-sitio-tinta placeholder:text-sitio-suave/70 outline-none transition focus:border-sitio-oro/60 focus:ring-2 focus:ring-sitio-oro/20";

// Formulario de contacto de la landing. Guarda el mensaje (se ve en /admin/sitio) y te llega por correo.
export function FormContacto({ whatsapp }: { whatsapp: string }) {
  const [estado, setEstado] = useState<Estado>("listo");
  const [error, setError] = useState("");

  const enviar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const datos = Object.fromEntries(new FormData(form).entries());
    setEstado("enviando");
    setError("");
    try {
      const r = await fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error || "No se pudo enviar el mensaje.");
      form.reset();
      setEstado("enviado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
      setEstado("error");
    }
  };

  const wa = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : "";

  if (estado === "enviado") {
    return (
      <div className="vidrio tarjeta-sitio cambio-precio flex min-h-[28rem] flex-col items-center justify-center rounded-[2rem] p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sitio-oro/15 text-sitio-oro">
          <Icono nombre="check" className="h-8 w-8" />
        </span>
        <h3 className="mt-5 text-2xl font-semibold text-sitio-tinta">¡Gracias! Recibimos tu mensaje</h3>
        <p className="mt-2 max-w-sm text-sitio-suave">Te respondemos pronto, normalmente en minutos. Atendemos todos los días, las 24 horas.</p>
        <button type="button" onClick={() => setEstado("listo")} className="mt-6 text-sm font-medium text-sitio-oro hover:underline">
          Enviar otro mensaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="vidrio tarjeta-sitio rounded-[2rem] p-6 sm:p-8">
      <h3 className="text-xl font-semibold text-sitio-tinta">Escríbenos</h3>
      <p className="mt-1 text-sm text-sitio-suave">Cuéntanos de tu restaurante y te ayudamos a empezar.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-sitio-suave">Nombre *</span>
          <input name="nombre" required minLength={2} maxLength={80} autoComplete="name" className={CAMPO} placeholder="Tu nombre" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-sitio-suave">Correo *</span>
          <input name="correo" type="email" required maxLength={120} autoComplete="email" className={CAMPO} placeholder="tu@correo.cl" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-sitio-suave">Teléfono o WhatsApp</span>
          <input name="telefono" type="tel" maxLength={30} autoComplete="tel" className={CAMPO} placeholder="+56 9 1234 5678" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-sitio-suave">Restaurante</span>
          <input name="negocio" maxLength={80} autoComplete="organization" className={CAMPO} placeholder="Nombre del local" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm text-sitio-suave">Mensaje *</span>
          <textarea name="mensaje" required minLength={5} maxLength={2000} rows={5} className={`${CAMPO} resize-y`} placeholder="¿En qué te podemos ayudar?" />
        </label>
        {/* Campo trampa para robots: oculto para las personas. */}
        <input name="sitio_web" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      </div>
      {estado === "error" && (
        <p role="alert" className="mt-4 rounded-2xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          {wa && (
            <>
              {" "}También puedes{" "}
              <a href={wa} target="_blank" rel="noreferrer" className="font-medium underline">
                escribirnos por WhatsApp
              </a>
              .
            </>
          )}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" disabled={estado === "enviando"} className="boton-oro px-6 py-3.5 text-base disabled:opacity-60">
          {estado === "enviando" ? "Enviando…" : "Enviar mensaje"}
          <span className="flecha">→</span>
        </button>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="text-sm text-sitio-suave transition hover:text-sitio-oro">
            ¿Prefieres WhatsApp? Escríbenos directo
          </a>
        )}
      </div>
    </form>
  );
}

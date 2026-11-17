"use client";

import { useState } from "react";
import { Icono } from "@/components/Icono";
import { MARCA, WHATSAPP_VENTAS, enlaceWhatsapp } from "@/lib/marca";
import { RUBROS, type IdRubro } from "@/lib/rubros";

// Formulario de contacto: arma el mensaje y lo abre en WhatsApp (o en el correo si no hay WhatsApp configurado).
// No guarda nada en el servidor.
export function FormContacto() {
  const [enviado, setEnviado] = useState(false);
  const porWhatsapp = Boolean(WHATSAPP_VENTAS);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const rubro = String(d.get("rubro") || "");
    const lineas = [
      `Hola, soy ${String(d.get("nombre")).trim()} y quiero saber más de ${MARCA}.`,
      d.get("negocio") ? `Negocio: ${String(d.get("negocio")).trim()}${rubro ? ` (${RUBROS[rubro as IdRubro]?.nombre ?? rubro})` : ""}` : "",
      d.get("telefono") ? `Mi teléfono: ${String(d.get("telefono")).trim()}` : "",
      "",
      String(d.get("mensaje")).trim(),
    ].filter((l, i) => l || i === 3);
    window.open(enlaceWhatsapp(lineas.join("\n")), "_blank", "noopener,noreferrer");
    setEnviado(true);
  };

  if (enviado) {
    return (
      <div className="tarjeta-club quieta aparecer-club flex min-h-[28rem] flex-col items-center justify-center rounded-[2rem] p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-club-oro/15 text-club-oro">
          <Icono nombre="check" className="h-8 w-8" />
        </span>
        <h3 className="mt-5 text-2xl font-semibold">¡Listo! Tu mensaje está escrito</h3>
        <p className="mt-2 max-w-sm text-suave">
          Se abrió {porWhatsapp ? "WhatsApp" : "tu correo"} con todo lo que pusiste. Solo falta tocar enviar y te respondemos pronto.
        </p>
        <button type="button" onClick={() => setEnviado(false)} className="mt-6 text-sm font-medium text-club-oro-texto hover:underline">
          Volver al formulario
        </button>
      </div>
    );
  }

  const rubros = (Object.keys(RUBROS) as IdRubro[]).filter((r) => r !== "otro");
  return (
    <form onSubmit={enviar} className="tarjeta-club quieta rounded-[2rem] p-6 sm:p-8">
      <h3 className="text-xl font-semibold">Escríbenos</h3>
      <p className="mt-1 text-sm text-suave">Cuéntanos de tu negocio y te ayudamos a armar tu tarjeta.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-suave">Nombre *</span>
          <input name="nombre" required minLength={2} maxLength={80} autoComplete="name" className="campo-club" placeholder="Tu nombre" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-suave">Teléfono o WhatsApp</span>
          <input name="telefono" type="tel" maxLength={30} autoComplete="tel" className="campo-club" placeholder="+56 9 1234 5678" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-suave">Negocio</span>
          <input name="negocio" maxLength={80} autoComplete="organization" className="campo-club" placeholder="Nombre del local" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-suave">Rubro</span>
          <select name="rubro" defaultValue="" className="campo-club appearance-none">
            <option value="">Elige uno</option>
            {rubros.map((r) => (
              <option key={r} value={r}>
                {RUBROS[r].nombre}
              </option>
            ))}
            <option value="otro">Otro</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm text-suave">Mensaje *</span>
          <textarea name="mensaje" required minLength={5} maxLength={1500} rows={5} className="campo-club resize-y" placeholder="¿En qué te podemos ayudar?" />
        </label>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="submit" className="boton-oro px-6 py-3.5 text-base">
          {porWhatsapp ? "Enviar por WhatsApp" : "Enviar mensaje"} <span className="flecha">→</span>
        </button>
        <p className="text-xs text-suave">Respondemos todos los días.</p>
      </div>
    </form>
  );
}

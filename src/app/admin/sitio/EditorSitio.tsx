"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { enlaceRed, INFO_RED, type Redes } from "@/lib/redes";
import { REDES_SITIO, type AjustesSitio, type ContactoSitio } from "@/lib/sitio";
import { borrarMensaje, guardarSitio, marcarMensaje } from "./actions";

export type MensajeContacto = {
  id: string;
  nombre: string;
  correo: string;
  telefono: string | null;
  negocio: string | null;
  mensaje: string;
  leido: boolean;
  created_at: string;
};

const CAMPOS: { id: keyof ContactoSitio; texto: string; ayuda: string; tipo?: string }[] = [
  { id: "whatsapp", texto: "WhatsApp", ayuda: "Con código de país, solo números. Ej: 56941497083", tipo: "tel" },
  { id: "telefono", texto: "Teléfono (como se muestra)", ayuda: "Ej: +56 9 4149 7083", tipo: "tel" },
  { id: "correo", texto: "Correo de contacto", ayuda: "El que ven los clientes en la página", tipo: "email" },
  { id: "aviso_correo", texto: "Correo donde te llegan los mensajes", ayuda: "Del formulario de contacto", tipo: "email" },
  { id: "horario", texto: "Horario de atención", ayuda: "Ej: Todos los días, las 24 horas" },
  { id: "ubicacion", texto: "Ubicación", ayuda: "Ej: Chile · atendemos en todo el país y el extranjero" },
];

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" });

export function EditorSitio({ inicial, mensajes, faltaSql }: { inicial: AjustesSitio; mensajes: MensajeContacto[]; faltaSql: boolean }) {
  const avisar = useToast();
  const [contacto, setContacto] = useState(inicial.contacto);
  const [redes, setRedes] = useState<Redes>(inicial.redes);
  const [guardando, iniciar] = useTransition();
  const sinLeer = mensajes.filter((m) => !m.leido).length;

  const guardar = () =>
    iniciar(async () => {
      const error = await guardarSitio(contacto, redes);
      avisar(error ?? "Sitio actualizado. Ya se ve en platovi.cl", error ? "error" : undefined);
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sitio web</h1>
        <p className="text-sm text-suave">
          Lo que ven los clientes en platovi.cl: tus datos de contacto, las redes sociales del pie y la sección de contacto.
        </p>
      </div>

      {faltaSql && (
        <p className="tarjeta border-amber-300 p-4 text-sm text-amber-800">
          Falta ejecutar el SQL 0028_sitio_contacto.sql en Supabase. Mientras tanto la página usa los datos de siempre.
        </p>
      )}

      <section className="tarjeta space-y-4 p-5">
        <h2 className="font-semibold">Contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <label key={c.id} className="block">
              <span className="etiqueta-campo">{c.texto}</span>
              <input
                type={c.tipo ?? "text"}
                value={contacto[c.id]}
                onChange={(e) => setContacto({ ...contacto, [c.id]: e.target.value })}
                className="campo"
                maxLength={160}
              />
              <span className="mt-1 block text-xs text-suave">{c.ayuda}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="tarjeta space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Redes sociales</h2>
          <p className="text-sm text-suave">Las que dejes vacías no se muestran. Puedes escribir @usuario o pegar el enlace.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {REDES_SITIO.map((r) => {
            const info = INFO_RED[r];
            const valor = redes[r];
            const enlace = valor ? enlaceRed(r, valor) : null;
            return (
              <label key={r} className="block">
                <span className="etiqueta-campo flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d={info.icono} />
                  </svg>
                  {info.nombre}
                </span>
                <input
                  value={valor}
                  onChange={(e) => setRedes({ ...redes, [r]: e.target.value })}
                  placeholder={info.ejemplo}
                  className="campo"
                  maxLength={200}
                />
                {valor && (
                  <span className={`mt-1 block truncate text-xs ${enlace ? "text-suave" : "text-red-600"}`}>
                    {enlace ?? "No parece un enlace válido"}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      <button type="button" className="boton" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar cambios"}
      </button>

      <section className="space-y-3">
        <h2 className="font-semibold">
          Mensajes del formulario {sinLeer > 0 && <span className="ml-1 rounded-full bg-marca-claro px-2 py-0.5 text-xs text-marca-tinta">{sinLeer} sin leer</span>}
        </h2>
        {mensajes.length === 0 ? (
          <p className="tarjeta p-5 text-sm text-suave">Todavía no llegan mensajes desde la página.</p>
        ) : (
          <ul className="space-y-3">
            {mensajes.map((m) => (
              <Mensaje key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Mensaje({ m }: { m: MensajeContacto }) {
  const avisar = useToast();
  const [ocupado, iniciar] = useTransition();
  const telefono = m.telefono?.replace(/\D/g, "");
  return (
    <li className={`tarjeta p-4 ${m.leido ? "opacity-75" : "ring-1 ring-marca-claro/60"}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-semibold">{m.nombre}</p>
        {m.negocio && <p className="text-sm text-suave">{m.negocio}</p>}
        <p className="ml-auto text-xs text-suave">{fecha(m.created_at)}</p>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm">{m.mensaje}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-borde pt-3 text-sm">
        <a className="text-marca hover:underline" href={`mailto:${m.correo}?subject=${encodeURIComponent("Platovi")}`}>
          {m.correo}
        </a>
        {telefono && (
          <a className="text-marca hover:underline" href={`https://wa.me/${telefono}`} target="_blank" rel="noreferrer">
            WhatsApp {m.telefono}
          </a>
        )}
        <span className="flex-1" />
        <button
          type="button"
          disabled={ocupado}
          className="text-suave hover:text-tinta"
          onClick={() => iniciar(async () => {
            const e = await marcarMensaje(m.id, !m.leido);
            if (e) avisar(e, "error");
          })}
        >
          {m.leido ? "Marcar sin leer" : "Marcar leído"}
        </button>
        <button
          type="button"
          disabled={ocupado}
          className="text-suave hover:text-red-600"
          onClick={() => {
            if (!confirm(`¿Borrar el mensaje de ${m.nombre}?`)) return;
            iniciar(async () => {
              const e = await borrarMensaje(m.id);
              if (e) avisar(e, "error");
            });
          }}
        >
          Borrar
        </button>
      </div>
    </li>
  );
}

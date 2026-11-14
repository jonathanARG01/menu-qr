"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Aviso } from "@/components/AuthShell";
import { crearNegocio, type DatosAlta } from "@/lib/alta";
import { RUBROS, type IdRubro } from "@/lib/rubros";
import { emojiSello } from "@/lib/tipos";
import { mensajeError, slugify, urlSitio } from "@/lib/utils";

// Alta de un negocio (14 días gratis) o, con ?invitacion=, de alguien del equipo que se suma a un negocio existente.
export function FormRegistro({ invitacion, rubroInicial }: { invitacion: string | null; rubroInicial: string | null }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTocado, setSlugTocado] = useState(false);
  const [rubro, setRubro] = useState<IdRubro>(rubroInicial && rubroInicial in RUBROS ? (rubroInicial as IdRubro) : "cafe");
  const [error, setError] = useState<string | null>(null);
  const [revisarCorreo, setRevisarCorreo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const direccion = slugTocado ? slug : slugify(nombre);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const alta: DatosAlta = {
      nombre: nombre.trim(),
      slug: direccion,
      rubro,
      tu_nombre: String(f.get("tu_nombre") ?? "").trim(),
      telefono: String(f.get("telefono") ?? "").trim(),
    };
    if (!invitacion && direccion.length < 3) return setError("La dirección debe tener al menos 3 letras o números.");
    setCargando(true);
    setError(null);
    const supabase = createClient();
    const siguiente = invitacion ? `/equipo/${invitacion}` : "/panel";
    const { data, error } = await supabase.auth.signUp({
      email: String(f.get("email")),
      password: String(f.get("password")),
      options: {
        emailRedirectTo: `${urlSitio()}/auth/confirm?next=${siguiente}`,
        data: invitacion ? { nombre: alta.tu_nombre } : { nombre: alta.tu_nombre, alta },
      },
    });
    if (error) {
      setError(mensajeError(error));
      setCargando(false);
      return;
    }
    if (!data.session) {
      setRevisarCorreo(true);
      setCargando(false);
      return;
    }
    if (!invitacion) {
      const { error: errorAlta } = await crearNegocio(supabase, alta);
      if (errorAlta) {
        router.replace(`/panel?error=${encodeURIComponent(mensajeError(errorAlta))}`);
        return;
      }
    }
    router.replace(siguiente);
    router.refresh();
  }

  if (revisarCorreo) {
    return (
      <Aviso tipo="ok">
        Te enviamos un correo para confirmar tu cuenta. Ábrelo desde este dispositivo y entrarás directo a tu panel.
      </Aviso>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      {!invitacion && (
        <>
          <div>
            <label htmlFor="nombre" className="etiqueta-campo">
              Nombre de tu negocio
            </label>
            <input
              id="nombre"
              required
              maxLength={80}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Barbería Don Pepe"
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="rubro" className="etiqueta-campo">
              Rubro
            </label>
            <select id="rubro" value={rubro} onChange={(e) => setRubro(e.target.value as IdRubro)} className="campo">
              {(Object.keys(RUBROS) as IdRubro[]).map((id) => (
                <option key={id} value={id}>
                  {emojiSello(RUBROS[id].icono)} {RUBROS[id].nombre}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-suave">
              Tu tarjeta parte con {RUBROS[rubro].meta} sellos = {RUBROS[rubro].premio}. Lo cambias cuando quieras.
            </p>
          </div>
          <div>
            <label htmlFor="slug" className="etiqueta-campo">
              Dirección de tu tarjeta
            </label>
            <div className="flex items-center rounded-lg border border-borde bg-stone-50 pl-3 text-sm text-suave focus-within:border-marca">
              <span className="shrink-0">…/u/</span>
              <input
                id="slug"
                required
                minLength={3}
                maxLength={50}
                value={direccion}
                onChange={(e) => {
                  setSlugTocado(true);
                  setSlug(slugify(e.target.value));
                }}
                className="w-full min-w-0 rounded-r-lg bg-superficie px-2 py-2.5 text-base text-tinta outline-none"
              />
            </div>
          </div>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tu_nombre" className="etiqueta-campo">
            Tu nombre
          </label>
          <input id="tu_nombre" name="tu_nombre" required maxLength={60} autoComplete="name" className="campo" />
        </div>
        <div>
          <label htmlFor="telefono" className="etiqueta-campo">
            WhatsApp <span className="font-normal text-suave">(opcional)</span>
          </label>
          <input id="telefono" name="telefono" type="tel" maxLength={30} placeholder="+56 9 1234 5678" className="campo" />
        </div>
      </div>
      <div>
        <label htmlFor="email" className="etiqueta-campo">
          Tu correo
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
      </div>
      <div>
        <label htmlFor="password" className="etiqueta-campo">
          Contraseña
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={6} required className="campo" />
      </div>
      {error && <Aviso>{error}</Aviso>}
      <button type="submit" className="boton w-full py-3 text-base" disabled={cargando}>
        {cargando ? "Creando…" : invitacion ? "Crear cuenta y unirme" : "Empezar 14 días gratis"}
      </button>
      <p className="text-center text-xs text-suave">
        Sin tarjeta de crédito. Al crear la cuenta aceptas los{" "}
        <a href="/terminos" target="_blank" className="underline hover:text-tinta">
          términos
        </a>{" "}
        y la{" "}
        <a href="/privacidad" target="_blank" className="underline hover:text-tinta">
          política de privacidad
        </a>
        .
      </p>
    </form>
  );
}

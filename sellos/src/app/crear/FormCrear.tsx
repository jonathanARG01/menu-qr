"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Aviso } from "@/components/AuthShell";
import { crearNegocio } from "@/lib/alta";
import { RUBROS, type IdRubro } from "@/lib/rubros";
import { emojiSello } from "@/lib/tipos";
import { mensajeError, slugify } from "@/lib/utils";
import { DIAS_PRUEBA } from "@/lib/marca";

export function FormCrear() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [rubro, setRubro] = useState<IdRubro>("cafe");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const direccion = slug ?? slugify(nombre);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    const { data, error } = await crearNegocio(createClient(), { nombre, slug: direccion, rubro, tu_nombre: "", telefono: "" });
    if (error) {
      setCargando(false);
      return setError(mensajeError(error));
    }
    router.replace(`/panel/cambiar?n=${data}`);
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <label className="block">
        <span className="etiqueta-campo">Nombre del negocio</span>
        <input required maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo" />
      </label>
      <label className="block">
        <span className="etiqueta-campo">Rubro</span>
        <select value={rubro} onChange={(e) => setRubro(e.target.value as IdRubro)} className="campo">
          {(Object.keys(RUBROS) as IdRubro[]).map((id) => (
            <option key={id} value={id}>
              {emojiSello(RUBROS[id].icono)} {RUBROS[id].nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="etiqueta-campo">Dirección de la tarjeta</span>
        <input
          required
          minLength={3}
          maxLength={50}
          value={direccion}
          onChange={(e) => setSlug(slugify(e.target.value))}
          className="campo"
        />
      </label>
      {error && <Aviso>{error}</Aviso>}
      <button className="boton w-full" disabled={cargando}>
        {cargando ? "Creando…" : `Crear negocio (${DIAS_PRUEBA} días gratis)`}
      </button>
    </form>
  );
}

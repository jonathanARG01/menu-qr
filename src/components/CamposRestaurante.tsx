"use client";

import { useState } from "react";
import { slugify } from "@/lib/utils";
import { useUrlSitio } from "@/lib/useUrlSitio";

// Nombre del restaurante + dirección de su carta (slug), que se propone a partir del nombre.
export function CamposRestaurante({ nombreInicial = "", slugInicial = "" }: { nombreInicial?: string; slugInicial?: string }) {
  const sitio = useUrlSitio();
  const [nombre, setNombre] = useState(nombreInicial);
  const [slug, setSlug] = useState(slugInicial || slugify(nombreInicial));
  const [slugEditado, setSlugEditado] = useState(Boolean(slugInicial));

  return (
    <>
      <div>
        <label htmlFor="nombre" className="etiqueta-campo">
          Nombre del restaurante
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={80}
          className="campo"
          value={nombre}
          onChange={(e) => {
            setNombre(e.target.value);
            if (!slugEditado) setSlug(slugify(e.target.value));
          }}
        />
      </div>
      <div>
        <label htmlFor="slug" className="etiqueta-campo">
          Dirección de la carta
        </label>
        <input
          id="slug"
          name="slug"
          required
          minLength={3}
          maxLength={50}
          pattern="[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]"
          className="campo font-mono text-sm"
          value={slug}
          onChange={(e) => {
            setSlugEditado(true);
            setSlug(slugify(e.target.value));
          }}
        />
        <p className="mt-1 text-xs text-suave [overflow-wrap:anywhere]">
          {sitio.replace(/^https?:\/\//, "")}/{slug || "tu-restaurante"} · No podrás cambiarla después porque los QR apuntan aquí.
        </p>
      </div>
    </>
  );
}

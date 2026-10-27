"use client";

import { useEffect, useState } from "react";
import { slugify } from "@/lib/utils";
import { useUrlSitio } from "@/lib/useUrlSitio";
import { PAISES, PAIS_BASE, paisPorZona } from "@/lib/region";

// Nombre del restaurante + dirección de su carta (slug), que se propone a partir del nombre.
export function CamposRestaurante({
  nombreInicial = "",
  slugInicial = "",
  paisInicial = "",
}: {
  nombreInicial?: string;
  slugInicial?: string;
  paisInicial?: string;
}) {
  const sitio = useUrlSitio();
  const [nombre, setNombre] = useState(nombreInicial);
  const [slug, setSlug] = useState(slugInicial || slugify(nombreInicial));
  const [slugEditado, setSlugEditado] = useState(Boolean(slugInicial));
  const [pais, setPais] = useState(paisInicial || PAIS_BASE.codigo);

  // Sin país guardado se propone el de la zona horaria del dispositivo.
  useEffect(() => {
    if (!paisInicial) setPais(paisPorZona(Intl.DateTimeFormat().resolvedOptions().timeZone).codigo);
  }, [paisInicial]);

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
      <div>
        <label htmlFor="pais" className="etiqueta-campo">
          País
        </label>
        <select id="pais" name="pais" className="campo" value={pais} onChange={(e) => setPais(e.target.value)}>
          {PAISES.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre} ({p.moneda})
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-suave">Define la moneda y la zona horaria. Puedes cambiarlas después.</p>
      </div>
    </>
  );
}

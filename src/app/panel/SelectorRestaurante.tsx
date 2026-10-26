"use client";

import { elegirRestaurante } from "./actions";

// Lista para cambiar de restaurante; se envía sola al elegir.
export function SelectorRestaurante({
  actual,
  restaurantes,
}: {
  actual: string;
  restaurantes: { id: string; nombre: string; rol: string }[];
}) {
  return (
    <form action={elegirRestaurante}>
      <select
        name="restaurante"
        defaultValue={actual}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Restaurante que estás editando"
        className="-ml-1 max-w-full truncate rounded-md bg-transparent py-0.5 pr-6 font-semibold leading-tight hover:bg-stone-100"
      >
        {restaurantes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.nombre}
            {r.rol === "staff" ? " (como admin)" : ""}
          </option>
        ))}
      </select>
    </form>
  );
}

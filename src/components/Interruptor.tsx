"use client";

export function Interruptor({
  activo,
  onChange,
  etiqueta,
  color = "#16a34a",
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={() => onChange(!activo)}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition"
      style={{ background: activo ? color : "#d6d3d1" }}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${activo ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

"use client";

import { useSearchParams } from "next/navigation";

export function PieMesa({ whatsapp, nombre }: { whatsapp: string | null; nombre: string }) {
  const mesa = useSearchParams().get("mesa")?.slice(0, 12);
  if (!mesa && !whatsapp) return null;

  const texto = mesa ? `Hola ${nombre}, estoy en la mesa ${mesa}.` : `Hola ${nombre}.`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl p-2 pl-4 shadow-xl ring-1 ring-black/10"
        style={{ background: "var(--pie-bg)", color: "var(--pie-text)" }}
      >
        <span className="flex-1 text-sm font-medium">{mesa ? `Mesa ${mesa}` : nombre}</span>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ background: "var(--acento)", color: "var(--sobre-acento)" }}
          >
            Escribir por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

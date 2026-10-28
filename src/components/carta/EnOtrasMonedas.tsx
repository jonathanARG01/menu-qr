import type { OtraMoneda } from "@/lib/salon";
import { formatoOtraMoneda } from "@/lib/utils";

// Total de referencia en otras monedas (para turistas), con la tasa que cargó el local.
export function EnOtrasMonedas({ total, monedas, texto }: { total: number; monedas: OtraMoneda[]; texto: string }) {
  if (!monedas.length || total <= 0) return null;
  return (
    <span className="block text-xs tabular-nums text-stone-500">
      {texto} {monedas.map((m) => formatoOtraMoneda(total / m.tasa, m.codigo)).join(" · ")}
    </span>
  );
}

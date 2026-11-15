import Link from "next/link";
import { PLANES, planQueIncluye, type Funcion } from "@/lib/marca";

// Aviso cuando el plan del negocio no incluye una función (en la prueba gratis se puede probar todo).
export function ConPlan({ funcion, que, dueno }: { funcion: Funcion; que: string; dueno: boolean }) {
  const plan = PLANES[planQueIncluye(funcion)];
  return (
    <div className="tarjeta flex flex-col items-start gap-3 border-dashed p-5 sm:flex-row sm:items-center">
      <span className="text-2xl" aria-hidden>
        ✨
      </span>
      <div className="flex-1">
        <p className="font-semibold">
          {que} es del plan {plan.nombre}
        </p>
        <p className="text-sm text-suave">Súbete al plan {plan.nombre} para usarlo. Lo que ya tienes se guarda igual.</p>
      </div>
      {dueno && (
        <Link href="/panel/plan" className="boton">
          Ver planes
        </Link>
      )}
    </div>
  );
}

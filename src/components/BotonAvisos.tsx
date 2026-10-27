"use client";

import { useEffect, useState } from "react";
import { Icono } from "@/components/Icono";
import { iphoneSinInstalar, soportaPush, suscribirCuenta } from "@/lib/push";

// Activa los avisos de la cuenta en este dispositivo (celular o computador). Si el navegador no puede, no se muestra.
export function BotonAvisos({ texto = "Avisarme en este dispositivo", className = "" }: { texto?: string; className?: string }) {
  const [estado, setEstado] = useState<"oculto" | "listo" | "activo" | "iphone" | "bloqueado">("oculto");

  useEffect(() => {
    if (iphoneSinInstalar()) return setEstado("iphone");
    if (!soportaPush()) return;
    setEstado(Notification.permission === "denied" ? "bloqueado" : "listo");
    // Si ya dio permiso, se renueva la suscripción sin preguntar.
    if (Notification.permission === "granted") suscribirCuenta().then((ok) => ok && setEstado("activo"));
  }, []);

  if (estado === "oculto") return null;
  if (estado === "activo")
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 ${className}`}>
        <Icono nombre="check" className="h-4 w-4" /> Avisos activados en este dispositivo
      </span>
    );
  if (estado === "iphone" || estado === "bloqueado")
    return (
      <span className={`text-xs text-suave ${className}`}>
        {estado === "iphone"
          ? "En iPhone: agrega esta página a la pantalla de inicio para recibir avisos."
          : "Los avisos están bloqueados en este navegador."}
      </span>
    );
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full border border-borde bg-superficie px-3 py-1.5 text-xs font-semibold hover:bg-stone-100 ${className}`}
      onClick={async () =>
        setEstado((await suscribirCuenta()) ? "activo" : Notification.permission === "denied" ? "bloqueado" : "listo")
      }
    >
      <Icono nombre="campana" className="h-4 w-4" />
      {texto}
    </button>
  );
}

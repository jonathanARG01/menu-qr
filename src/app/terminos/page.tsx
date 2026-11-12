import type { Metadata } from "next";
import { PaginaLegal } from "@/components/inicio/PaginaLegal";
import { TERMINOS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Términos y condiciones · Platovi",
  description: "Condiciones de uso de Platovi, la carta digital con QR y gestión del salón para restaurantes.",
};

export default function PaginaTerminos() {
  return (
    <PaginaLegal
      titulo="Términos y condiciones"
      bajada="Las reglas para usar platovi.cl y el panel de Platovi."
      secciones={TERMINOS}
    />
  );
}

import type { Metadata } from "next";
import { PaginaLegal } from "@/components/inicio/PaginaLegal";
import { PRIVACIDAD } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Política de privacidad · Platovi",
  description: "Cómo Platovi recoge, usa y protege los datos de restaurantes y comensales.",
};

export default function PaginaPrivacidad() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      bajada="Qué datos guardamos, para qué y cómo puedes ejercer tus derechos."
      secciones={PRIVACIDAD}
    />
  );
}

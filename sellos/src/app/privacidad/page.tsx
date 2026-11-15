import { PaginaLegal } from "@/components/PaginaLegal";
import { PRIVACIDAD } from "@/lib/legal";

export const metadata = { title: "Privacidad · Sellito" };

export default function PaginaPrivacidad() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      bajada="Qué datos guardamos, para qué y cómo puedes pedir que los borremos."
      secciones={PRIVACIDAD}
    />
  );
}

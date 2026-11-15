import { PaginaLegal } from "@/components/PaginaLegal";
import { TERMINOS } from "@/lib/legal";

export const metadata = { title: "Términos y condiciones · Sellito" };

export default function PaginaTerminos() {
  return <PaginaLegal titulo="Términos y condiciones" bajada="Las reglas para usar Sellito y su panel." secciones={TERMINOS} />;
}

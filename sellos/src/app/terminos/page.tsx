import { PaginaLegal } from "@/components/PaginaLegal";
import { MARCA } from "@/lib/marca";
import { TERMINOS } from "@/lib/legal";

export const metadata = { title: "Términos y condiciones" };

export default function PaginaTerminos() {
  return <PaginaLegal titulo="Términos y condiciones" bajada={`Las reglas para usar ${MARCA} y su panel.`} secciones={TERMINOS} />;
}

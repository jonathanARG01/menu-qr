import { cargarPanelDueno } from "@/lib/panel";
import { Locales } from "@/components/panel/Locales";

export const metadata = { title: "Locales" };

export default async function PaginaLocales() {
  const { negocio, sucursales, incluye } = await cargarPanelDueno();
  return <Locales negocio={negocio} sucursales={sucursales} puede={incluye("sucursales")} />;
}

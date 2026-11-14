import { cargarPanelDueno } from "@/lib/panel";
import { Configurar } from "@/components/panel/Configurar";

export const metadata = { title: "Tu tarjeta · Sellito" };

export default async function PaginaTarjeta() {
  const { negocio, programa } = await cargarPanelDueno();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tu tarjeta de sellos</h1>
        <p className="text-sm text-suave">Cuántos sellos, el premio, el diseño y los detalles para que vuelvan.</p>
      </div>
      <Configurar negocio={negocio} programa={programa} />
    </div>
  );
}
